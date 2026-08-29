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
import { PLANS } from "../billing/plans.js";
import { stageInstruction, detectDeliverableType, detectPreviewIntent, detectCancelIntent, hasLogoAndColorDetails, type PipelineStage } from "../generation/orchestrate.js";
import {
  upsertDocument,
  findProjectDocument,
  listConversationDocuments,
  type DocumentType,
} from "../db/documents.js";
import { formatPrototypeSummary, generatePrototypeDocument } from "../prototype/engine.js";
import { parseRollbackIntent } from "../prototype/rollback.js";
import { getProjectDir } from "../projects/workspace.js";
import {
  DELIVERABLE_FILES,
  BRIEF_FILE,
  resolveInsideProject,
  commitPaths,
  rollbackDeliverable,
} from "../projects/workspace.js";
import { buildBriefMarkdown, writeBrief, type BriefRole } from "../projects/brief.js";
import { acquireProjectLease, isLease, type ProjectLease } from "../projects/locks.js";
import { openConversationSession, sessionExists } from "../projects/sessions.js";
import { ensureProjectForConversation } from "../db/projects.js";
import { createToolBudget, TOOL_BUDGETS } from "../engine/tool-budget.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import {
  SANDWICH_PRD_GUIDE,
  SANDWICH_QUOTATION_GUIDE,
  SANDWICH_SPECS_GUIDE,
  GETOKUI_PROTOTYPE_GUIDE,
} from "../generation/prompts.js";
import { buildReferenceBlock } from "../notifications/references.js";

export interface DocumentRef {
  id: string;
  type: DocumentType;
  title: string;
  /** Short git sha of the commit behind the file, or null. */
  commitSha: string | null;
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
  refineInstruction?: string | null,
): ConversationTurn[] {
  const instruction = stageInstruction(stage, pendingType);

  const base = [
    `You are SANDWICH, an expert product consultant AI built by Etalas.`,
    `You help clients turn ideas and briefs into structured product documents.`,
    `Reply in the same language as the client (Indonesian or English).`,
    `Your working directory holds BRIEF.md (the consolidated brief, clarifying Q&A, and attachment summaries) and any deliverables generated so far — read them with your tools when you need context.`,
  ];

  let system: string;
  if (stage === "generating" && pendingType) {
    // Refine pass: the user gave feedback on the document that was just
    // generated. Feed ONLY that feedback, not the original brief — the full
    // brief is what makes the model regenerate everything from scratch.
    if (refineInstruction) {
      system = [
        ...base,
        ``,
        `You are revising the ${DELIVERABLE_LABEL[pendingType]} document that was just generated in this conversation.`,
        ``,
        `## Client feedback`,
        refineInstruction,
        ``,
        `Revise the EXISTING document in place based on this feedback. Change ONLY what the feedback asks for. Keep all other sections, structure, copy, and details exactly as they are. Do NOT regenerate the whole document from scratch. Output ONLY the revised document content — no preamble, no meta-commentary.`,
      ].join("\n");
    } else {
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
    }
  } else {
    system = [...base, ``, instruction].join("\n");
  }

  return [{ role: "system", content: system }, ...history];
}

const inFlight = new Map<string, AbortController>();
const sseClients = new Map<string, Set<ServerResponse>>();

// ── Engine selection ─────────────────────────────────────────────────────────
// Single harness (Pi SDK). The provider/model per stage comes from
// engine_settings (admin panel) with 9router/Claude defaults — see model-runtime.ts.

const ENGINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — hard stop for any engine call

/** The fixed on-disk filename for a text deliverable. */
export function deliverablePathFor(type: DocumentType): string {
  return DELIVERABLE_FILES[type];
}

const READONLY_TOOLS = ["read", "ls", "grep", "find"] as const;
const WRITE_TOOLS = ["read", "write", "edit", "ls", "grep", "find"] as const;

/** Tools for a text-engine run at a given stage, honouring the kill switch. */
export function textEngineTools(stage: PipelineStage): readonly string[] {
  if (process.env.TEXT_ENGINE_TOOLS === "off") return [];
  return stage === "generating" ? WRITE_TOOLS : READONLY_TOOLS;
}

async function runTextGeneration(opts: {
  projectDir: string;
  conversationId: string;
  history: ConversationTurn[];
  signal: AbortSignal;
  stage: PipelineStage;
  pendingType: DocumentType | null;
  refineInstruction?: string | null;
}): Promise<{ text: string; wroteFile: boolean }> {
  const { projectDir, conversationId, history, signal, stage, pendingType, refineInstruction } = opts;
  const pi = await import("@earendil-works/pi-coding-agent");
  const { resolveModel } = await import("../model-runtime.js");

  const { runtime, model } = await resolveModel("chat");
  const tools = textEngineTools(stage);
  const isFileWrite = stage === "generating" && !!pendingType && pendingType !== "prototype";
  const relPath = isFileWrite ? deliverablePathFor(pendingType!) : null;

  // Disk-backed session per conversation (M2-05). On a resumed turn the session
  // already carries the transcript, so we send only the new turn's content —
  // re-sending the whole history would double-feed it. Compaction is ON: a
  // persistent chat session grows unbounded otherwise and eventually dies on a
  // context-window error with no recovery.
  const resume = sessionExists(conversationId);
  const { session } = await pi.createAgentSession({
    cwd: projectDir,
    model: model as never,
    modelRuntime: runtime as never,
    tools: tools as string[],
    sessionManager: (await openConversationSession(conversationId, projectDir)) as never,
    settingsManager: pi.SettingsManager.inMemory({
      compaction: { enabled: true },
    }),
  });

  let responseText = "";
  let errorMessage = "";
  const budget = createToolBudget(
    stage === "generating" ? TOOL_BUDGETS.text : TOOL_BUDGETS.chat,
  );
  let budgetVerdict: "ok" | "ceiling" | "stalled" = "ok";
  const guardBudget = (v: "ok" | "ceiling" | "stalled") => {
    if (v !== "ok" && budgetVerdict === "ok") {
      budgetVerdict = v;
      console.warn(`[text] budget ${v} after ${budget.toolCalls} tool calls`);
      session.abort();
    }
  };

  session.subscribe((event: {
    type: string;
    assistantMessageEvent?: { type?: string; delta?: string };
    errorMessage?: string;
    messages?: unknown;
  }) => {
    if (signal.aborted) return;
    guardBudget(budget.onEvent(event.type, Date.now()));

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

  const built = buildMessages(history, stage, pendingType, refineInstruction);
  const systemContent = built[0]!.content;
  const lastUser =
    [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const parts = resume
    ? // Resumed turn: system block (carries the stage instruction + any
      // deliverable guide) + only the new user message. The session has the rest.
      [systemContent, `User: ${lastUser}`]
    : built.map((m) =>
        m.role === "system"
          ? m.content
          : `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
      );
  if (relPath) {
    parts.push(
      refineInstruction
        ? `The document already exists at \`${relPath}\` in your working directory. Read it, apply the change in place with the edit tool, and reply with only "DONE".`
        : `Write the complete document to \`${relPath}\` in your working directory using the write tool (overwrite it if it exists). Do not print the document in your reply. After writing, reply with only "DONE".`,
    );
  }
  const prompt = parts.join("\n\n");

  const poll = setInterval(() => guardBudget(budget.check(Date.now())), 5_000);
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

    const wroteFile = !!relPath && existsSync(resolveInsideProject(projectDir, relPath));
    if (!wroteFile && !responseText && errorMessage) {
      throw new Error(errorMessage);
    }
    if (relPath && !wroteFile) {
      if (budgetVerdict !== "ok") throw new Error(`text generation ${budgetVerdict} before writing ${relPath}`);
      throw new Error(`text generation did not write ${relPath}`);
    }
    return { text: responseText, wroteFile };
  } catch (err) {
    session.dispose();
    throw err;
  } finally {
    clearInterval(poll);
  }
}

/** Commit-message subject/body for a deliverable run — trailers drive M3-03. */
export function commitMessageFor(
  type: DocumentType,
  mode: "generate" | "refine",
  conversationId: string,
  stage: PipelineStage,
  promptSummary: string,
): { subject: string; body: string } {
  const oneLine = promptSummary.replace(/\s+/g, " ").trim().slice(0, 200);
  return {
    subject: `${type}: ${mode}`,
    body: [
      oneLine ? `Prompt: ${oneLine}` : "",
      "",
      `Sandwich-Deliverable: ${type}`,
      `Sandwich-Conversation: ${conversationId}`,
      `Sandwich-Stage: ${stage}`,
    ]
      .join("\n")
      .trim(),
  };
}

/** Max deliverable size we inline into the chat bubble; above this, a card only. */
export const CHAT_INLINE_CAP = 40_000;

/** What the assistant chat message says after a generation run. */
export function chatOutputFor(
  type: DocumentType,
  fileContent: string,
  previewUrl: string | null,
): string {
  if (type === "prototype") {
    return `${DELIVERABLE_LABEL[type]} ${previewUrl ? `siap. Preview: [Buka prototype](${previewUrl})` : "siap."}`;
  }
  if (fileContent.length <= CHAT_INLINE_CAP) return fileContent;
  return `${DELIVERABLE_LABEL[type]} selesai — dokumen terlalu panjang untuk ditampilkan di chat. Buka panel dokumen untuk melihatnya.`;
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

/**
 * Extracted attachment text at or below this many characters is inlined into
 * the prompt; anything larger only gets a summary in BRIEF.md (M2-02) so it
 * doesn't blow up the context on every turn.
 */
const ATTACHMENT_INLINE_CAP = 2_000;

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
    .map((a) =>
      a.extractedText!.length <= ATTACHMENT_INLINE_CAP
        ? `[attachment: ${a.filename}]\n${a.extractedText}`
        : `[attachment: ${a.filename} — full text summarised in BRIEF.md]`,
    );
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
 * Compose the refine instruction handed to the prototype engine. Unlike
 * composePrototypeBrief (which folds the WHOLE brief), refine must contain only
 * the feedback that arrived AFTER the most recent document was generated —
 * feeding the original brief back into a refine pass is what causes the model
 * to regenerate the whole thing. We walk the turns backwards until we hit the
 * assistant message that produced the last document, then take every user
 * message after it.
 */
export function composeRefineInstruction(turns: ConversationTurn[]): string {
  // Find the last assistant turn that generated a document ("Prototype
  // generated — vN" / "PRD generated"). Turns don't carry documentId, so we
  // detect the summary marker as the boundary.
  let boundary = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t && t.role === "assistant" && /generated — v\d+/i.test(t.content)) {
      boundary = i;
      break;
    }
  }

  const parts: string[] = [];
  for (let i = boundary + 1; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.role !== "user") continue;
    const text = t.content.trim();
    if (!text) continue;
    if (parts[parts.length - 1] === text) continue;
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
  mom: "MOM",
};

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
    const msgId = params.messageId!;
    if (!msgId) { sendJson(res, 400, { error: "invalid messageId" }); return; }
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

    // Resolve the project workspace + serialise runs across the project's
    // conversations (M2-06). The conversation-level idempotency check above
    // runs first, so a legitimate reconnect retry never hits this 409.
    let projectId: string;
    let projectDir: string;
    try {
      projectId = await ensureProjectForConversation(db, auth.userId, conversation);
      projectDir = await getProjectDir(auth.userId, projectId);
    } catch (err) {
      // Workspace setup failed (e.g. git unavailable, volume not writable).
      // Surface it as a chat error instead of a bare 500 the client swallows.
      console.error("[generate] workspace setup failed:", err);
      const msg =
        "Gagal menyiapkan workspace proyek. Coba lagi sebentar — kalau terus terjadi, hubungi support.";
      await addChatMessage(db, { conversationId, role: "assistant", content: msg }).catch(() => {});
      sendJson(res, 200, { conversationId, started: false, error: "workspace setup failed" });
      void publishEvent(
        conversationId,
        `data: ${JSON.stringify({ type: "error", text: msg })}\n\n`,
      );
      return;
    }
    const leaseResult = await acquireProjectLease(projectId, conversationId);
    if (!isLease(leaseResult)) {
      sendJson(res, 409, {
        error: "project busy",
        conversationId: leaseResult.busyWith,
      });
      return;
    }
    const lease: ProjectLease = leaseResult;

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

    const controller = new AbortController();
    inFlight.set(conversationId, controller);
    void markInFlight(conversationId);

    // Release the project lease alongside the in-flight markers on every exit.
    const finishRun = () => {
      void lease.release();
      closeInFlight(conversationId);
    };

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
        // Wait for attachment extraction (image/audio/pdf/docx -> text) so
        // the prompt includes their content.
        await waitForExtraction(db, conversationId, 30_000);

        const messages = await getMessagesForPrompt(db, conversationId);
        const turns: ConversationTurn[] = messages.map((m) => ({
          role: m.role as Role,
          content: enrichMessageContent(m),
        }));

        // BRIEF.md — the only user-originated context that lands on disk. Written
        // fresh every run so the engines' read/ls tools always see current
        // context; committed alongside the deliverable in the generating path.
        await writeBrief(
          projectDir,
          buildBriefMarkdown({
            title: conversation.title,
            turns: messages.map((m) => ({ role: m.role as BriefRole, content: m.content })),
            attachments: messages.flatMap((m) => m.attachments),
          }),
        );

        broadcast({
          type: "stage_start",
          stage: "generate",
          conversation: (await getConversation(db, conversationId))!,
        });

        // ── Model-driven orchestration ────────────────────────────────────
        const lastUserMessage =
          [...turns].reverse().find((t) => t.role === "user")?.content ?? "";

        // Rollback intent — git operation, no AI call.
        const rollbackIntent = parseRollbackIntent(lastUserMessage);
        if (rollbackIntent) {
          const protoDoc = await findProjectDocument(db, projectId, "prototype");
          if (protoDoc) {
            const rolledBack = await rollbackDeliverable(
              projectDir,
              protoDoc.relativePath,
              rollbackIntent,
            );
            if (rolledBack.restored) {
              await upsertDocument(db, {
                projectId,
                conversationId,
                type: "prototype",
                title: protoDoc.title,
                relativePath: protoDoc.relativePath,
                lastCommitSha: rolledBack.sha,
              });
            }
            const msg = rolledBack.restored
              ? "Prototype dikembalikan ke versi sebelumnya."
              : rollbackIntent === "latest"
                ? "Prototype sudah di versi terbaru."
                : "Tidak ada versi sebelumnya untuk di-rollback.";
            await addChatMessage(db, { conversationId, role: "assistant", content: msg });
            broadcast({
              type: "done",
              text: msg,
              conversation: (await getConversation(db, conversationId))!,
            });
            finishRun();
            return;
          }
        }

        // Preview intent — return the existing prototype's link (no AI call).
        if (detectPreviewIntent(lastUserMessage)) {
          const protoDoc = await findProjectDocument(db, projectId, "prototype");
          if (protoDoc) {
            const msg = `Preview prototype: [Buka prototype](${prototypePreviewUrl(protoDoc.id)})`;
            await addChatMessage(db, { conversationId, role: "assistant", content: msg });
            broadcast({
              type: "done",
              text: msg,
              conversation: (await getConversation(db, conversationId))!,
            });
            finishRun();
            return;
          }
          // No prototype to preview yet — fall through to normal flow.
        }

        let stage = conversation.pipelineStage as PipelineStage;
        let pendingType = (conversation.pendingType ?? null) as DocumentType | null;
        let refineInstruction: string | null = null;

        const existingDocs = await listConversationDocuments(db, conversationId);
        const mostRecentDoc = existingDocs.length > 0
          ? [...existingDocs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]!
          : null;

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
          // model asking instead of silently skipping ahead. The stage stays
          // in clarifying until the gate passes (or the pending type isn't a
          // prototype), and ONLY the current user turn advances it — there is
          // no silent auto-advance after the assistant's clarifying reply.
          const readyToGenerate =
            pendingType !== "prototype" ||
            hasLogoAndColorDetails(composePrototypeBrief(turns));
          if (readyToGenerate) {
            stage = "generating";
          }
        } else if (stage === "awaiting_next") {
          // Refine-by-default: a conversation that already produced a document
          // treats follow-ups as refinements UNLESS the user explicitly asks
          // for a deliverable that doesn't exist here yet, or cancels. This is
          // deliberate — feedback wording is unbounded ("marquee salah",
          // "geser dong", "itu dulu aja") and can't be covered by regex.
          if (detectCancelIntent(lastUserMessage)) {
            // stay in awaiting_next — no-op turn, handled by the AI below
          } else if (mostRecentDoc) {
            const detected = detectDeliverableType(lastUserMessage);
            const docExists = detected !== null && existingDocs.some((d) => d.type === detected);
            if (detected && !docExists) {
              // Explicit new deliverable that isn't here yet — start fresh.
              pendingType = detected;
              stage = "clarifying";
            } else {
              // Any other follow-up with an existing doc = refine it.
              pendingType = mostRecentDoc.type as DocumentType;
              stage = "refining";
              refineInstruction = lastUserMessage;
            }
          } else {
            const detected = detectDeliverableType(lastUserMessage);
            if (detected) {
              pendingType = detected;
              stage = "clarifying";
            }
          }
        } else if (stage === "refining") {
          // The assistant already acknowledged feedback and asked "anything
          // else?". The user now either confirms ("itu dulu aja"), adds more
          // feedback, or cancels.
          if (detectCancelIntent(lastUserMessage)) {
            stage = "awaiting_next";
          } else if (detectDeliverableType(lastUserMessage) && !existingDocs.some((d) => d.type === detectDeliverableType(lastUserMessage)!)) {
            // Mid-refine pivot to a brand-new deliverable.
            const detected = detectDeliverableType(lastUserMessage)!;
            pendingType = detected;
            stage = "clarifying";
          } else {
            // Confirmation ("itu dulu aja"), more feedback, anything else —
            // accumulate ALL feedback since the last generation into the
            // refine instruction and generate. Fall back to the last message
            // if no prior generation marker exists in the history.
            stage = "generating";
            pendingType = mostRecentDoc?.type as DocumentType ?? pendingType;
            refineInstruction = composeRefineInstruction(turns) || lastUserMessage;
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

        // The agent writes the deliverable file itself; we commit it and update
        // the documents index row. No pre-created document / version number.
        const runOnce = async (): Promise<{
          chatOutput: string;
          documentRef: DocumentRef | null;
          nextStage: PipelineStage;
        }> => {
          if (stage === "generating" && pendingType) {
            const type = pendingType;
            const isPrototype = type === "prototype";
            const relPath = deliverablePathFor(type);
            const title = conversation.title.trim() || DELIVERABLE_LABEL[type];
            const mode: "generate" | "refine" = refineInstruction ? "refine" : "generate";

            let warning: string | undefined;
            if (isPrototype) {
              const result = await generatePrototypeDocument(
                {
                  projectDir,
                  conversationId,
                  brief: composePrototypeBrief(turns),
                  ...(refineInstruction ? { refine: { instruction: refineInstruction } } : {}),
                },
                controller.signal,
              );
              warning = result.warning;
            } else {
              const r = await runTextGeneration({
                projectDir,
                conversationId,
                history: turns,
                signal: controller.signal,
                stage,
                pendingType: type,
                refineInstruction,
              });
              if (!r.wroteFile) throw new Error(`${DELIVERABLE_LABEL[type]} tidak berhasil dibuat.`);
            }

            const fileAbs = resolveInsideProject(projectDir, relPath);
            if (!existsSync(fileAbs)) throw new Error(`file ${relPath} tidak ditemukan setelah generate.`);
            const fileContent = await readFile(fileAbs, "utf8");

            const commit = await commitPaths(
              projectDir,
              [BRIEF_FILE, relPath],
              commitMessageFor(type, mode, conversationId, stage, lastUserMessage),
            );
            const doc = await upsertDocument(db, {
              projectId,
              conversationId,
              type,
              title,
              relativePath: relPath,
              lastCommitSha: commit.sha,
            });
            await incrementUsage(db, auth.userId, isPrototype ? "prototype" : "doc");

            const previewUrl = isPrototype ? prototypePreviewUrl(doc.id) : null;
            let chatOutput = chatOutputFor(type, fileContent, previewUrl);
            if (warning) chatOutput = formatPrototypeSummary(chatOutput, warning);

            return {
              chatOutput,
              documentRef: {
                id: doc.id,
                type,
                title: doc.title,
                commitSha: commit.sha.slice(0, 7),
                previewUrl,
              },
              nextStage: "awaiting_next",
            };
          }

          // Non-generating stages: a plain chat reply (read-only tools).
          const r = await runTextGeneration({
            projectDir,
            conversationId,
            history: turns,
            signal: controller.signal,
            stage,
            pendingType,
            refineInstruction,
          });
          if (!r.text) throw new Error("Model returned no response. Try again.");
          return {
            chatOutput: r.text,
            documentRef: null,
            // NOTE: no auto-advance from clarifying — only the user's next turn
            // passes the gate.
            nextStage: stage === "intake" ? "choosing_deliverable" : stage,
          };
        };

        runOnce()
          .then(async ({ chatOutput, documentRef, nextStage }) => {
            await updateConversation(db, conversationId, {
              pipelineStage: nextStage,
              pendingType: documentRef ? null : pendingType,
            });
            await addChatMessage(db, {
              conversationId,
              role: "assistant",
              content: chatOutput,
              documentId: documentRef?.id ?? null,
            });
            broadcast({
              type: "done",
              text: chatOutput,
              document: documentRef ?? undefined,
              conversation: (await getConversation(db, conversationId))!,
            });
          })
          .catch(async (err) => {
            const msg = err instanceof Error ? err.message : "generation failed";
            broadcast({
              type: "error",
              conversation: (await getConversation(db, conversationId))!,
              text: msg,
            });
          })
          .finally(() => finishRun());
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "generation setup failed";
        await addChatMessage(db, { conversationId, role: "assistant", content: msg }).catch(() => {});
        broadcast({
          type: "error",
          conversation: (await getConversation(db, conversationId))!,
          text: msg,
        });
        finishRun();
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

    // Heartbeat: prototype generation can run 10+ minutes. Proxies (Railway,
    // nginx) kill idle connections after a few minutes, which silently drops
    // the stream before the "done" event arrives — the user then sees nothing
    // and has to ask "mana hasilnya?". A comment ping keeps the connection
    // alive (SSE clients ignore comment lines).
    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* connection gone — cleaned up on close */
      }
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      sseClients.get(conversationId)?.delete(res);
      res.end();
    });
  });
}
