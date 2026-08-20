import type { Database } from "../db/connection.js";
import type { ServerResponse } from "node:http";
import type { Router } from "../router.js";
import {
  markInFlight,
  clearInFlight,
  isInFlightRemote,
  publishEvent,
  subscribeToConversation,
} from "../redis.js";
import { getConversation, updateConversation, type Conversation } from "../db/conversations.js";
import {
  addChatMessage,
  createMessage,
  getMessages,
  getMessageHistory,
  getMessagesForPrompt,
  deleteMessage,
  updateMessageContent,
} from "../db/repo/chat-messages.js";
import { getPendingAttachmentIds } from "../db/repo/attachments.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getActiveSubscription } from "../db/repo/subscriptions.js";
import { incrementUsage, getMonthlyUsage } from "../db/repo/usage.js";
import { PLANS } from "../pipeline/plans.js";
import { stageInstruction, detectDeliverableType, detectPreviewIntent, detectRefineIntent, hasLogoAndColorDetails, type PipelineStage } from "../pipeline/orchestrate.js";
import {
  createDocument,
  createDocumentVersion,
  getNextVersionNo,
  linkConversationDocument,
  listConversationDocuments,
  rollbackDocument,
  type DocumentType,
} from "../db/documents.js";
import { formatPrototypeSummary, generatePrototypeDocument } from "../prototype/engine.js";
import { parseRollbackIntent } from "../prototype/rollback.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import {
  SANDWICH_PRD_GUIDE,
  SANDWICH_USERFLOWS_GUIDE,
  SANDWICH_TECHNICAL_GUIDE,
  SANDWICH_QUOTATION_GUIDE,
  SANDWICH_SPECS_GUIDE,
  GETOKUI_PROTOTYPE_GUIDE,
} from "../pipeline/prompts.js";
import { buildReferenceBlock } from "../pipeline/references.js";
import { startSpan } from '../otel.js';

export interface DocumentRef {
  id: string;
  type: DocumentType;
  title: string;
  versionNo: number;
  previewUrl: string | null;
}

export interface ConversationRunEvent {
  type: "stage_start" | "stage_end" | "output" | "error" | "done";
  stage?: string;
  text?: string;
  document?: DocumentRef;
  conversation?: Conversation;
}

type Role = "system" | "user" | "assistant";
type ConversationTurn = { role: Role; content: string };

function buildMessages(
  history: ConversationTurn[],
  stage: PipelineStage,
  pendingType: DocumentType | null,
): ConversationTurn[] {
  const instruction = stageInstruction(stage, pendingType);

  const base = [
    `You are SANDWICH, an expert product consultant AI built by Etalas.`,
    `You help clients turn ideas and briefs into structured product documents.`,
    `Reply in the same language as the client (Indonesian or English).`,
  ];

  let system: string;
  if (stage === "generating" && pendingType) {
    const guideKind: "prototype" | "quotation" | "specs" | "prd" =
      pendingType === "prototype"
        ? "prototype"
        : pendingType === "quotation"
          ? "quotation"
          : pendingType === "specs"
            ? "specs"
            : "prd";

    const docGuide =
      guideKind === "prototype"
        ? GETOKUI_PROTOTYPE_GUIDE
        : guideKind === "quotation"
          ? SANDWICH_QUOTATION_GUIDE
          : guideKind === "specs"
            ? SANDWICH_SPECS_GUIDE
            : SANDWICH_PRD_GUIDE;

    const outputInstruction =
      guideKind === "prototype"
        ? `Output a complete, self-contained HTML prototype file. Include all CSS and JS inline. Follow ALL quality standards above. NO preamble — start with <!DOCTYPE html>.`
        : `Output the full document in markdown. Be thorough and professional. Return ONLY the document content — no meta-commentary.`;

    const briefText = history
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.content)
      .join("\n");
    const referenceBlock =
      guideKind === "prd" || guideKind === "quotation" ? buildReferenceBlock(guideKind, briefText) : "";

    const parts = [...base, ``, instruction, ``, docGuide];
    if (referenceBlock) parts.push(``, referenceBlock);
    parts.push(``, outputInstruction);
    system = parts.join("\n");
  } else {
    system = [...base, ``, instruction].join("\n");
  }

  return [{ role: "system", content: system }, ...history];
}

const inFlight = new Map<string, AbortController>();
const sseClients = new Map<string, Set<ServerResponse>>();

// ── Engine selection ─────────────────────────────────────────────────────────
// OpenCode (Pi SDK) is primary. Groq is dev fallback.
// Owner sets via env vars — users never pick.

function getEngine(): "opencode" | "groq" | null {
  if (process.env.OPENCODE_API_KEY) return "opencode";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

const ENGINE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes — hard stop for any engine call

async function runWithGroq(
  history: ConversationTurn[],
  signal: AbortSignal,
  stage: PipelineStage,
  pendingType: DocumentType | null,
  isRegenerate = false,
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY!;
  const messages = buildMessages(history, stage, pendingType);
  if (isRegenerate && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last && last.role === "user") {
      last.content = `${last.content}\n\n[Try a different structure or angle than your previous response, but stay accurate and grounded in the context. Do not repeat the same phrasing or order as before.]`;
    }
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      messages,
      max_tokens: 4000,
      reasoning_effort: "none",
      temperature: 0.7,
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(ENGINE_TIMEOUT_MS)]),
  });
  if (!res.ok) {
    throw new Error(
      `Groq ${res.status}: ${await res.text().catch(() => res.statusText)}`,
    );
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function runWithOpenCode(
  history: ConversationTurn[],
  signal: AbortSignal,
  stage: PipelineStage,
  pendingType: DocumentType | null,
): Promise<string> {
  // Dynamic import Pi SDK — only loaded when OpenCode is configured
  const pi = await import("@earendil-works/pi-coding-agent");

  const modelRuntime = await pi.ModelRuntime.create({
    modelsPath: null,
  });

  const provider = process.env.OPENCODE_PROVIDER ?? "opencode-go";
  const modelId = process.env.OPENCODE_MODEL ?? "deepseek-v4-pro";
  const model = modelRuntime.getModel(provider, modelId);
  if (!model) {
    throw new Error(`OpenCode model not available: ${provider}/${modelId}`);
  }

  const { session } = await pi.createAgentSession({
    cwd: process.cwd(),
    model: model as any,
    modelRuntime: modelRuntime as any,
    tools: [],
    sessionManager: pi.SessionManager.inMemory(),
    settingsManager: pi.SettingsManager.inMemory({
      compaction: { enabled: false },
    }),
  });

  let responseText = "";
  let errorMessage = "";

  session.subscribe((event: any) => {
    if (signal.aborted) return;

    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    ) {
      responseText += event.assistantMessageEvent.delta;
      return;
    }

    if (event.type === "agent_end") {
      if (!errorMessage && typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
      if (!responseText) {
        const messages = event.messages;
        if (Array.isArray(messages)) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg?.role === "assistant" || msg?.type === "assistant") {
              const content = msg.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block?.type === "text" && block.text) responseText += block.text;
                }
              } else if (typeof content === "string") {
                responseText = content;
              } else if (typeof msg.text === "string") {
                responseText = msg.text;
              }
              if (responseText) break;
            }
          }
        }
      }
    }
  });

  const messages = buildMessages(history, stage, pendingType);
  const prompt = messages
    .map((m) => {
      if (m.role === "system") return m.content;
      return `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`;
    })
    .join("\n\n");

  try {
    const promptPromise = session.prompt(prompt);
    promptPromise.catch(() => {}); // avoid unhandled rejection on timeout
    await Promise.race([
      promptPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI generation timed out")), ENGINE_TIMEOUT_MS),
      ),
    ]);
    await new Promise((r) => setTimeout(r, 100));
    session.dispose();

    if (!responseText && errorMessage) {
      throw new Error(errorMessage);
    }
    return responseText;
  } catch (err) {
    session.dispose();
    throw err;
  }
}

export function closeInFlight(conversationId: string): void {
  inFlight.delete(conversationId);
  // Publish abort signal so other instances can close their SSE streams too.
  void clearInFlight(conversationId, `data: ${JSON.stringify({ type: "abort" })}\n\n`);
  const clients = sseClients.get(conversationId);
  if (clients) {
    for (const client of clients) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
    }
    sseClients.delete(conversationId);
  }
}

async function waitForExtraction(
  db: Database,
  conversationId: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = await getPendingAttachmentIds(db, conversationId);
    if (pending.length === 0) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function enrichMessageContent(m: {
  role: string;
  content: string;
  attachments: {
    filename: string;
    mimeType: string;
    extractedText: string | null;
    extractStatus: string;
  }[];
}): string {
  if (m.role !== "user") return m.content;
  const blocks = m.attachments
    .filter((a) => a.extractStatus === "done" && a.extractedText)
    .map((a) => `[attachment: ${a.filename}]\n${a.extractedText}`);
  if (blocks.length === 0) return m.content;
  return `${m.content}\n\n${blocks.join("\n\n")}`;
}

/**
 * Compose the brief handed to the prototype engine. Unlike the text engine
 * (which receives the full message history), the prototype engine takes a
 * single `brief` string — so we fold every user turn (original brief, follow-ups,
 * clarifying answers) and their extracted attachment text into one document.
 * This prevents the prototype from being generated from only the last message.
 */
export function composePrototypeBrief(turns: ConversationTurn[]): string {
  const parts: string[] = [];
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    const text = turn.content.trim();
    if (!text) continue;
    if (parts.length > 0 && parts[parts.length - 1] === text) continue;
    parts.push(text);
  }
  return parts.join("\n\n");
}

/**
 * Absolute preview URL for a prototype document. Uses PREVIEW_DOMAIN in
 * production, otherwise the app URL (localhost in dev) so the assistant can
 * hand the user a real, clickable link instead of guessing.
 */
export function prototypePreviewUrl(docId: string): string {
  const domain = process.env.PREVIEW_DOMAIN;
  if (domain) return `https://${domain.replace(/\/+$/, "")}/p/${docId}/`;
  // Relative fallback: works same-origin in dev (Vite proxies /p) and in the
  // single-server Railway deploy. For a split frontend/API deploy, set
  // PREVIEW_DOMAIN to the host that serves /p (e.g. preview.sandwich.etalas.com).
  return `/p/${docId}/`;
}

const DELIVERABLE_LABEL: Record<DocumentType, string> = {
  prd: "PRD",
  quotation: "Quotation",
  prototype: "Prototype",
  specs: "Specs",
};

function documentSummary(
  type: DocumentType,
  versionNo: number,
): string {
  return `${DELIVERABLE_LABEL[type]} generated — v${versionNo}`;
}

export function registerConversationRunRoutes(
  router: Router,
  db: Database,
): void {
  // Persist a user message (+ optional attachments).
  router.post("/api/conversations/:id/messages", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      content?: string;
      attachmentIds?: string[];
    } | null;
    if (!body || typeof body.content !== "string" || !body.content.trim()) {
      sendJson(res, 400, { error: "content is required" });
      return;
    }

    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((x) => typeof x === "string")
      : [];

    // Chat quota (starter) — follow-up messages are metered per month.
    const sub = await getActiveSubscription(db, auth.userId);
    const plan = sub?.planSlug ? PLANS[sub.planSlug as keyof typeof PLANS] : undefined;
    if (!plan) {
      sendJson(res, 403, { error: "active subscription required" });
      return;
    }
    if (plan.chatLimit !== null) {
      const chatUsed = await getMonthlyUsage(db, auth.userId, "chat");
      if (chatUsed >= plan.chatLimit) {
        sendJson(res, 403, { error: "chat quota reached" });
        return;
      }
    }

    try {
      const message = await createMessage(db, {
        conversationId: params.id!,
        userId: auth.userId,
        content: body.content.trim(),
        attachmentIds,
      });
      await incrementUsage(db, auth.userId, "chat");
      sendJson(res, 201, message);
    } catch (err) {
      sendCaughtError(res, err, "message creation");
    }
  });

  // Update a user message content (for edit-and-resend).
  router.patch("/api/conversations/:id/messages/:messageId", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) { sendJson(res, 401, { error: "unauthorized" }); return; }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) { sendJson(res, 404, { error: "not found" }); return; }
    const body = (await readJsonBody(req).catch(() => null)) as { content?: string } | null;
    if (!body?.content?.trim()) { sendJson(res, 400, { error: "content is required" }); return; }
    const msgId = parseInt(params.messageId!, 10);
    if (isNaN(msgId)) { sendJson(res, 400, { error: "invalid messageId" }); return; }
    await updateMessageContent(db, msgId, body.content.trim());
    sendJson(res, 200, { ok: true });
  });

  // Generate the assistant reply — reads history from the DB.
  router.post("/api/conversations/:id/generate", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const conversationId = params.id!;
    const conversation = await getConversation(db, conversationId);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }

    // Idempotent — if already running locally or on another instance, return success.
    if (inFlight.has(conversationId) || await isInFlightRemote(conversationId)) {
      sendJson(res, 200, { conversationId, started: true });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      regenerate?: boolean;
    } | null;

    // For a regenerate, drop the previous assistant reply so we re-run the
    // last user turn cleanly instead of double-stacking assistant messages.
    const isRegenerate = !!body?.regenerate;
    if (isRegenerate) {
      const history = await getMessageHistory(db, conversationId);
      const last = history[history.length - 1];
      if (last && last.role === "assistant") {
        await deleteMessage(db, last.id);
      }
      // If the conversation already produced a document, rewind the pipeline
      // stage so it re-generates that document type instead of starting over.
      if (conversation.pipelineStage === "awaiting_next" && !conversation.pendingType) {
        const linkedDocs = await listConversationDocuments(db, conversationId);
        const lastDoc = linkedDocs[linkedDocs.length - 1];
        if (lastDoc) {
          const docType = lastDoc.type;
          await updateConversation(db, conversationId, {
            pipelineStage: "generating",
            pendingType: docType,
          });
          // Re-fetch so the pipeline below sees the updated stage.
          const updated = await getConversation(db, conversationId);
          if (updated) Object.assign(conversation, updated);
        }
      }
    }

    const engine = getEngine();
    if (!engine) {
      sendJson(res, 503, {
        error:
          "No AI engine configured. Set OPENCODE_API_KEY or GROQ_API_KEY env var.",
      });
      return;
    }

    const controller = new AbortController();
    inFlight.set(conversationId, controller);
    void markInFlight(conversationId);

    const broadcast = (event: ConversationRunEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      // Publish to Redis so all instances fan out to their local SSE clients.
      void publishEvent(conversationId, data);
      // Also write directly for same-instance clients (avoids round-trip).
      const clients = sseClients.get(conversationId);
      if (!clients) return;
      for (const client of clients) {
        try {
          client.write(data);
        } catch {
          clients.delete(client);
        }
      }
    };

    // Respond immediately so the SSE stream (connecting ~100ms later) sees
    // that a run is in flight instead of closing instantly.
    sendJson(res, 200, { conversationId, started: true });

    void (async () => {
      try {
        await startSpan(
          'sandwich.generate',
          {
            'sandwich.conversation_id': conversationId,
            'sandwich.stage': String(conversation.pipelineStage ?? 'unknown'),
            'sandwich.engine': engine ?? 'none',
          },
          async () => {
            try {
              // Wait for attachment extraction (image/audio/pdf/docx -> text) so
              // the prompt includes their content.
              await waitForExtraction(db, conversationId, 30_000);

              const messages = await getMessagesForPrompt(db, conversationId);
              const turns: ConversationTurn[] = messages.map((m) => ({
                role: m.role as Role,
                content: enrichMessageContent(m),
              }));

              broadcast({
                type: "stage_start",
                stage: "generate",
                conversation: (await getConversation(db, conversationId))!,
              });

              // ── Model-driven orchestration ────────────────────────────────────
              const lastUserMessage =
                [...turns].reverse().find((t) => t.role === "user")?.content ?? "";

              // Rollback intent — DB-only, no AI call.
              const rollbackIntent = parseRollbackIntent(lastUserMessage);
              if (rollbackIntent) {
                const protoDocs = (await listConversationDocuments(db, conversationId))
                  .filter((d) => d.type === "prototype");
                const protoDoc = protoDocs[0];
                if (protoDoc) {
                  const rolledBack = await rollbackDocument(db, protoDoc.id, rollbackIntent);
                  const msg = rolledBack
                    ? `Prototype di-rollback ke versi v${rolledBack.versionNo}.`
                    : rollbackIntent === "latest"
                      ? "Prototype sudah di versi terbaru."
                      : "Tidak ada versi sebelumnya untuk di-rollback.";
                  await addChatMessage(db, { conversationId, role: "assistant", content: msg });
                  broadcast({
                    type: "done",
                    text: msg,
                    conversation: (await getConversation(db, conversationId))!,
                  });
                  return;
                }
              }

              // Preview intent — return the existing prototype's link (no AI call).
              if (detectPreviewIntent(lastUserMessage)) {
                const protoDocs = (await listConversationDocuments(db, conversationId))
                  .filter((d) => d.type === "prototype");
                const protoDoc = protoDocs[0];
                if (protoDoc) {
                  const msg = `Preview prototype: [Buka prototype](${prototypePreviewUrl(protoDoc.id)})`;
                  await addChatMessage(db, { conversationId, role: "assistant", content: msg });
                  broadcast({
                    type: "done",
                    text: msg,
                    conversation: (await getConversation(db, conversationId))!,
                  });
                  return;
                }
                // No prototype to preview yet — fall through to normal flow.
              }

              let stage = conversation.pipelineStage as PipelineStage;
              let pendingType = (conversation.pendingType ?? null) as DocumentType | null;
              let refineInstruction: string | null = null;

              if (stage === "choosing_deliverable") {
                // A pre-selected type (dropdown) means the deliverable is already
                // known — skip detection and go straight to clarifying questions.
                const detected = pendingType ?? detectDeliverableType(lastUserMessage);
                if (detected) {
                  pendingType = detected;
                  stage = "clarifying";
                }
              } else if (stage === "clarifying") {
                // Prototype-only hard gate: don't advance to generating until the
                // conversation has covered both logo and color/palette — keeps the
                // model asking instead of silently skipping ahead.
                const readyToGenerate =
                  pendingType !== "prototype" ||
                  hasLogoAndColorDetails(composePrototypeBrief(turns));
                if (readyToGenerate) {
                  stage = "generating";
                }
              } else if (stage === "awaiting_next") {
                const detected = detectDeliverableType(lastUserMessage);
                if (detected) {
                  pendingType = detected;
                  stage = "clarifying";
                } else {
                  // Refine intent — revise the most recently updated deliverable as
                  // a new version (same document), using the full conversation context.
                  const existingDocs = await listConversationDocuments(db, conversationId);
                  if (detectRefineIntent(lastUserMessage) && existingDocs.length > 0) {
                    existingDocs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
                    pendingType = existingDocs[0]!.type as DocumentType;
                    stage = "generating";
                    refineInstruction = lastUserMessage;
                  }
                }
              }

              // Enforce the document/prototype quota before generating. Prototypes
              // have their own (smaller) quota; everything else shares the document
              // quota (PRD / quotation / specs).
              if (stage === "generating" && pendingType) {
                const sub = await getActiveSubscription(db, auth.userId);
                const plan = sub?.planSlug ? PLANS[sub.planSlug as keyof typeof PLANS] : undefined;
                if (!plan) throw new Error("active subscription required");
                const isPrototype = pendingType === "prototype";
                const kind = isPrototype ? "prototype" : "doc";
                const limit = isPrototype ? plan.prototypeLimit : plan.documentLimit;
                if (limit !== null) {
                  const used = await getMonthlyUsage(db, auth.userId, kind);
                  if (used >= limit) {
                    throw new Error(isPrototype ? "prototype quota reached" : "monthly quota reached");
                  }
                }
              }

              // For a prototype, create (or reuse) the document up front so the
              // prototype engine has a document id to write files under.
              let prototypeDocId: string | null = null;
              let prototypeVersionNo: number | null = null;
              if (stage === "generating" && pendingType === "prototype") {
                const title = conversation.title.trim() || "Prototype";
                const existing = await listConversationDocuments(db, conversationId);
                const existingDoc = existing.find((d) => d.type === "prototype");
                if (existingDoc) {
                  prototypeDocId = existingDoc.id;
                } else {
                  const doc = await createDocument(db, { userId: auth.userId, type: "prototype", title });
                  await linkConversationDocument(db, conversationId, doc.id);
                  prototypeDocId = doc.id;
                }
                prototypeVersionNo = await getNextVersionNo(db, prototypeDocId);
              }

              const useOpenCode = engine === "opencode";
              const hasGroqFallback = !!process.env.GROQ_API_KEY;

              const run = prototypeDocId
                ? async () => {
                    const result = await generatePrototypeDocument(
                      db,
                      {
                        documentId: prototypeDocId!,
                        versionNo: prototypeVersionNo!,
                        brief: composePrototypeBrief(turns),
                        ...(refineInstruction ? { refine: { instruction: refineInstruction } } : {}),
                      },
                      controller.signal,
                    );
                    return formatPrototypeSummary(result.summary, result.glowupWarning);
                  }
                : useOpenCode
                  ? () =>
                      runWithOpenCode(turns, controller.signal, stage, pendingType).catch((err) => {
                        if (hasGroqFallback) {
                          console.log(
                            `OpenCode failed, falling back to Groq: ${err instanceof Error ? err.message : "unknown"}`,
                          );
                          return runWithGroq(turns, controller.signal, stage, pendingType, isRegenerate);
                        }
                        throw err;
                      })
                  : () => runWithGroq(turns, controller.signal, stage, pendingType, isRegenerate);

              const output = await startSpan(
                'sandwich.ai.run',
                {
                  'sandwich.engine': engine ?? 'none',
                  'sandwich.pending_type': pendingType ?? 'none',
                },
                () => run(),
              );

              if (!output) {
                const msg = "Model returned no response. Try again.";
                await addChatMessage(db, { conversationId, role: "assistant", content: msg }).catch(() => {});
                broadcast({
                  type: "error",
                  conversation: (await getConversation(db, conversationId))!,
                  text: msg,
                });
                return;
              }

              let chatOutput = output;
              let nextStage: PipelineStage = stage;
              let documentRef: DocumentRef | null = null;
              if (stage === "generating" && pendingType) {
                const isPrototype = pendingType === "prototype";
                // Persist the deliverable as a versioned document.
                const fallbackTitle =
                  conversation.title.trim() || `${pendingType.toUpperCase()} document`;
                const existing = await listConversationDocuments(db, conversationId);
                const existingDoc = existing.find((d) => d.type === pendingType);
                let documentId: string;
                let versionNo: number;
                if (existingDoc) {
                  documentId = existingDoc.id;
                  versionNo = prototypeVersionNo ?? (await getNextVersionNo(db, existingDoc.id));
                  await createDocumentVersion(db, {
                    documentId,
                    versionNo,
                    content: output,
                    promptUsed: lastUserMessage,
                  });
                } else {
                  const doc = await createDocument(db, {
                    userId: auth.userId,
                    type: pendingType,
                    title: fallbackTitle,
                  });
                  documentId = doc.id;
                  versionNo = prototypeVersionNo ?? 1;
                  await createDocumentVersion(db, {
                    documentId,
                    versionNo,
                    content: output,
                    promptUsed: lastUserMessage,
                  });
                  await linkConversationDocument(db, conversationId, doc.id);
                }
                await incrementUsage(
                  db,
                  auth.userId,
                  pendingType === "prototype" ? "prototype" : "doc",
                );
                const docTitle = existingDoc ? existingDoc.title : fallbackTitle;
                chatOutput = documentSummary(pendingType, versionNo);
                if (isPrototype) {
                  chatOutput = `${chatOutput}\n\nPreview: [Buka prototype](${prototypePreviewUrl(documentId)})`;
                }
                documentRef = {
                  id: documentId,
                  type: pendingType,
                  title: docTitle,
                  versionNo,
                  previewUrl: isPrototype ? prototypePreviewUrl(documentId) : null,
                };
                nextStage = "awaiting_next";
                pendingType = null;
              } else if (stage === "intake") {
                nextStage = "choosing_deliverable";
              } else if (stage === "clarifying") {
                nextStage = "generating";
              }

              await updateConversation(db, conversationId, {
                pipelineStage: nextStage,
                pendingType,
              });
              await startSpan(
                'sandwich.db.write_message',
                { 'sandwich.conversation_id': conversationId, 'db.operation': 'insert' },
                () => addChatMessage(db, {
                  conversationId,
                  role: "assistant",
                  content: chatOutput,
                  documentId: documentRef?.id ?? null,
                }),
              );
              await startSpan(
                'sandwich.sse.broadcast',
                { 'sandwich.conversation_id': conversationId, 'sandwich.event_type': 'done' },
                async () => {
                  broadcast({
                    type: "done",
                    text: chatOutput,
                    document: documentRef ?? undefined,
                    conversation: (await getConversation(db, conversationId))!,
                  });
                },
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : "generation failed";
              await addChatMessage(db, { conversationId, role: "assistant", content: msg }).catch(() => {});
              broadcast({
                type: "error",
                conversation: (await getConversation(db, conversationId))!,
                text: msg,
              });
            }
          },
        );
      } finally {
        closeInFlight(conversationId);
      }
    })();
  });

  // Message history (with attachments).
  router.get("/api/conversations/:id/messages", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }
    sendJson(res, 200, await getMessages(db, params.id!));
  });

  // SSE stream for generation progress.
  router.get("/api/conversations/:id/stream", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const conversationId = params.id!;
    const conversation = await getConversation(db, conversationId);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    res.write(
      `data: ${JSON.stringify({ type: "current", conversation })}\n\n`,
    );

    if (!sseClients.has(conversationId)) {
      sseClients.set(conversationId, new Set());
    }
    sseClients.get(conversationId)!.add(res);

    const locallyInFlight = inFlight.has(conversationId);
    const remotelyInFlight = locallyInFlight ? false : await isInFlightRemote(conversationId);

    if (!locallyInFlight && !remotelyInFlight) {
      res.write(
        `data: ${JSON.stringify({ type: "done", conversation })}\n\n`,
      );
      res.end();
      sseClients.get(conversationId)?.delete(res);
      return;
    }

    // For runs on another instance, subscribe via Redis so events fan out here.
    const unsubscribe = remotelyInFlight
      ? subscribeToConversation(conversationId, (data) => {
          try {
            res.write(data);
            // Terminal events close this client's stream.
            if (data.includes('"type":"done"') || data.includes('"type":"abort"')) {
              sseClients.get(conversationId)?.delete(res);
              res.end();
            }
          } catch {
            sseClients.get(conversationId)?.delete(res);
          }
        })
      : () => {};

    req.on("close", () => {
      unsubscribe();
      sseClients.get(conversationId)?.delete(res);
      res.end();
    });
  });
}
