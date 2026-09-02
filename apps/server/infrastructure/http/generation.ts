import type { ServerResponse } from "node:http";
import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import {
  markInFlight,
  clearInFlight,
  isInFlightRemote,
  publishEvent,
  subscribeToConversation,
} from "../../redis.js";
import { getConversation, updateConversation, type Conversation } from "../../conversations/db.js";
import {
  addChatMessage,
  createMessage,
  getMessages,
  getMessageHistory,
  getMessagesForPrompt,
  deleteMessage,
  updateMessageContent,
} from "../../db/repo/chat-messages.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { getActiveSubscription } from "../../db/repo/subscriptions.js";
import { incrementUsage, getMonthlyUsage } from "../../db/repo/usage.js";
import { PLANS } from "../../billing/plans.js";
import {
  detectDeliverableType,
  detectPreviewIntent,
  detectCancelIntent,
  hasLogoAndColorDetails,
  type PipelineStage,
} from "../../generation/orchestrate.js";
import {
  upsertDocument,
  findProjectDocument,
  listConversationDocuments,
  type DocumentType,
} from "../../documents/db.js";
import { formatPrototypeSummary, generatePrototypeDocument } from "../../prototype/engine.js";
import { parseRollbackIntent } from "../../prototype/rollback.js";
import { getProjectDir } from "../../projects/workspace.js";
import {
  BRIEF_FILE,
  resolveInsideProject,
  commitPaths,
  rollbackDeliverable,
} from "../../projects/workspace.js";
import { buildBriefMarkdown, writeBrief, type BriefRole } from "../../projects/brief.js";
import { acquireProjectLease, isLease, type ProjectLease } from "../../projects/locks.js";
import { ensureProjectForConversation } from "../../projects/db.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { sendCaughtErrorExpress } from "../../http-utils.js";
import {
  runTextGeneration,
  deliverablePathFor,
  commitMessageFor,
  chatOutputFor,
  composePrototypeBrief,
  composeRefineInstruction,
  waitForExtraction,
  enrichMessageContent,
  DELIVERABLE_LABEL,
} from "../../generation/run.js";
// ponytail: wire runGeneration from application layer after generation/run.ts helpers move to domain


export interface DocumentRef {
  id: string;
  type: DocumentType;
  title: string;
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

const inFlight = new Map<string, AbortController>();
const sseClients = new Map<string, Set<ServerResponse>>();

export function closeInFlight(conversationId: string): void {
  inFlight.delete(conversationId);
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

export function prototypePreviewUrl(docId: string): string {
  const domain = process.env.PREVIEW_DOMAIN;
  if (domain) return `https://${domain.replace(/\/+$/, "")}/p/${docId}/`;
  return `/p/${docId}/`;
}

export function registerGenerationRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  // Persist user message (+ optional attachments).
  router.post("/api/conversations/:id/messages", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const body = req.body as {
      content?: string;
      attachmentIds?: string[];
    } | null;
    if (!body?.content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const attachmentIds = Array.isArray(body.attachmentIds)
      ? (body.attachmentIds as string[])
      : [];

    const sub = await getActiveSubscription(db, auth.userId);
    const plan = sub?.planSlug ? PLANS[sub.planSlug as keyof typeof PLANS] : undefined;
    if (!plan) {
      res.status(403).json({ error: "active subscription required" });
      return;
    }
    if (plan.chatLimit !== null) {
      const chatUsed = await getMonthlyUsage(db, auth.userId, "chat");
      if (chatUsed >= plan.chatLimit) {
        res.status(403).json({ error: "chat quota reached" });
        return;
      }
    }

    try {
      const message = await createMessage(db, {
        conversationId: req.params.id!,
        userId: auth.userId,
        content: body.content.trim(),
        attachmentIds,
      });
      await incrementUsage(db, auth.userId, "chat");
      res.status(201).json(message);
    } catch (err) {
      sendCaughtErrorExpress(res, err, "message creation");
    }
  });

  // Update user message content (for edit-and-resend).
  router.patch("/api/conversations/:id/messages/:messageId", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) { res.status(401).json({ error: "unauthorized" }); return; }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) { res.status(404).json({ error: "not found" }); return; }
    const body = req.body as { content?: string } | null;
    if (!body?.content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
    const msgId = req.params.messageId!;
    if (!msgId) { res.status(400).json({ error: "invalid messageId" }); return; }
    await updateMessageContent(db, msgId, body.content.trim());
    res.status(200).json({ ok: true });
  });

  // Generate assistant reply — reads history from DB.
  router.post("/api/conversations/:id/generate", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const conversationId = req.params.id!;
    const conversation = await getConversation(db, conversationId);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (inFlight.has(conversationId) || await isInFlightRemote(conversationId)) {
      res.status(200).json({ conversationId, started: true });
      return;
    }

    // Claim the slot NOW — before any async setup — so an SSE connection that
    // arrives while ensureProjectForConversation (git init) is still running
    // finds inFlight set and stays open instead of closing immediately.
    const controller = new AbortController();
    inFlight.set(conversationId, controller);
    void markInFlight(conversationId);

    let projectId: string;
    let projectDir: string;
    try {
      projectId = await ensureProjectForConversation(db, auth.userId, conversation);
      projectDir = await getProjectDir(auth.userId, projectId);
    } catch (err) {
      console.error("[generate] workspace setup failed:", err);
      const msg =
        "Gagal menyiapkan workspace proyek. Coba lagi sebentar — kalau terus terjadi, hubungi support.";
      await addChatMessage(db, { conversationId, role: "assistant", content: msg }).catch(() => {});
      res.status(200).json({ conversationId, started: false, error: "workspace setup failed" });
      void publishEvent(
        conversationId,
        `data: ${JSON.stringify({ type: "error", text: msg })}\n\n`,
      );
      closeInFlight(conversationId);
      return;
    }

    const leaseResult = await acquireProjectLease(projectId, conversationId);
    if (!isLease(leaseResult)) {
      closeInFlight(conversationId);
      res.status(409).json({
        error: "project busy",
        conversationId: leaseResult.busyWith,
      });
      return;
    }
    const lease: ProjectLease = leaseResult;

    const body = req.body as {
      regenerate?: boolean;
    } | null;

    const isRegenerate = !!body?.regenerate;
    if (isRegenerate) {
      const history = await getMessageHistory(db, conversationId);
      const last = history[history.length - 1];
      if (last && last.role === "assistant") {
        await deleteMessage(db, last.id);
      }
      if (conversation.pipelineStage === "awaiting_next" && !conversation.pendingType) {
        const linkedDocs = await listConversationDocuments(db, conversationId);
        const lastDoc = linkedDocs[linkedDocs.length - 1];
        if (lastDoc) {
          const docType = lastDoc.type;
          await updateConversation(db, conversationId, {
            pipelineStage: "generating",
            pendingType: docType,
          });
          const updated = await getConversation(db, conversationId);
          if (updated) Object.assign(conversation, updated);
        }
      }
    }

    const finishRun = () => {
      void lease.release();
      closeInFlight(conversationId);
    };

    const broadcast = (event: ConversationRunEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      void publishEvent(conversationId, data);
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

    res.status(200).json({ conversationId, started: true });

    void (async () => {
      try {
        await waitForExtraction(db, conversationId, 30_000);

        const messages = await getMessagesForPrompt(db, conversationId);
        const turns: ConversationTurn[] = messages.map((m) => ({
          role: m.role as Role,
          content: enrichMessageContent(m),
        }));

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

        // Preview intent — return existing prototype's link (no AI call).
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
        }

        let stage = conversation.pipelineStage as PipelineStage;
        let pendingType = (conversation.pendingType ?? null) as DocumentType | null;
        let refineInstruction: string | null = null;

        const existingDocs = await listConversationDocuments(db, conversationId);
        const mostRecentDoc =
          existingDocs.length > 0
            ? [...existingDocs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
            : null;

        if (stage === "intake" || stage === "choosing_deliverable") {
          const detected = pendingType ?? detectDeliverableType(lastUserMessage);
          if (detected) {
            pendingType = detected;
            stage = "clarifying";
          }
        } else if (stage === "clarifying") {
          const readyToGenerate =
            pendingType !== "prototype" ||
            hasLogoAndColorDetails(composePrototypeBrief(turns));
          if (readyToGenerate) {
            stage = "generating";
          }
        } else if (stage === "awaiting_next") {
          if (detectCancelIntent(lastUserMessage)) {
            // stay in awaiting_next
          } else if (mostRecentDoc) {
            const detected = detectDeliverableType(lastUserMessage);
            const docExists =
              detected !== null && existingDocs.some((d) => d.type === detected);
            if (detected && !docExists) {
              pendingType = detected;
              stage = "clarifying";
            } else {
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
          if (detectCancelIntent(lastUserMessage)) {
            stage = "awaiting_next";
          } else if (
            detectDeliverableType(lastUserMessage) &&
            !existingDocs.some((d) => d.type === detectDeliverableType(lastUserMessage)!)
          ) {
            const detected = detectDeliverableType(lastUserMessage)!;
            pendingType = detected;
            stage = "clarifying";
          } else {
            stage = "generating";
            pendingType = mostRecentDoc?.type as DocumentType ?? pendingType;
            refineInstruction = composeRefineInstruction(turns) || lastUserMessage;
          }
        }

        // Enforce document/prototype quota before generating.
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

        // ponytail: Task 10 keeps original runOnce for full fidelity; runGeneration
        // integration deferred to a follow-up task once port signatures stabilize.
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

          // Non-generating stages: plain chat reply (read-only tools).
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
  router.get("/api/conversations/:id/messages", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.status(200).json(await getMessages(db, req.params.id!));
  });

  // SSE stream for generation progress.
  router.get("/api/conversations/:id/stream", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const conversationId = req.params.id!;
    const conversation = await getConversation(db, conversationId);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "Conversation not found" });
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

    const unsubscribe = remotelyInFlight
      ? subscribeToConversation(conversationId, (data) => {
          try {
            res.write(data);
            if (data.includes('"type":"done"') || data.includes('"type":"abort"')) {
              sseClients.get(conversationId)?.delete(res);
              res.end();
            }
          } catch {
            sseClients.get(conversationId)?.delete(res);
          }
        })
      : () => {};

    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* connection gone */
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
