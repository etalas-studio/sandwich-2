import type { Database } from "../db/connection.js";
import { getPendingAttachmentIds } from "../db/repo/attachments.js";
import type { DocumentType } from "../documents/db.js";
import type { PipelineStage } from "./orchestrate.js";
import { resolveInsideProject, DELIVERABLE_FILES } from "../projects/workspace.js";
import { openConversationSession, sessionExists } from "../projects/sessions.js";
import { createToolBudget, TOOL_BUDGETS } from "./budget.js";
import { buildReferenceBlock } from "../notifications/references.js";
import {
  Spectr_PRD_GUIDE,
  Spectr_QUOTATION_GUIDE,
  Spectr_SPECS_GUIDE,
  GETOKUI_PROTOTYPE_GUIDE,
} from "./prompts.js";
import { stageInstruction } from "./orchestrate.js";
import { existsSync } from "node:fs";

type Role = "system" | "user" | "assistant";
type ConversationTurn = { role: Role; content: string };

const DELIVERABLE_LABEL: Record<DocumentType, string> = {
  prd: "PRD",
  quotation: "Quotation",
  prototype: "Prototype",
  specs: "Specs",
  mom: "MOM",
};

function buildMessages(
  history: ConversationTurn[],
  stage: PipelineStage,
  pendingType: DocumentType | null,
  refineInstruction?: string | null,
): ConversationTurn[] {
  const instruction = stageInstruction(stage, pendingType);

  const base = [
    `You are Spectr, an expert product consultant AI built by Etalas.`,
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
            ? Spectr_QUOTATION_GUIDE
            : guideKind === "specs"
              ? Spectr_SPECS_GUIDE
              : Spectr_PRD_GUIDE;

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

// ── Engine selection ─────────────────────────────────────────────────────────
// Single harness (Pi SDK). The provider/model per stage comes from
// engine_settings (admin panel) with 9router/Claude defaults — see model-runtime.ts.

export const ENGINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — hard stop for any engine call

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

export async function runTextGeneration(opts: {
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
  let lastEventType = "(none)";
  const runTag = `[text convId=${conversationId} stage=${stage} relPath=${relPath ?? "none"}]`;
  console.log(`${runTag} starting`);
  const guardBudget = (v: "ok" | "ceiling" | "stalled") => {
    if (v !== "ok" && budgetVerdict === "ok") {
      budgetVerdict = v;
      console.warn(`${runTag} budget ${v} after ${budget.toolCalls} tool calls, last event=${lastEventType}`);
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
    lastEventType = event.type;
    console.debug(`${runTag} event=${event.type} toolCalls=${budget.toolCalls}`);
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
        setTimeout(() => {
          console.error(`${runTag} ENGINE_TIMEOUT_MS (${ENGINE_TIMEOUT_MS}ms) hit — toolCalls=${budget.toolCalls} lastEvent=${lastEventType}`);
          reject(new Error("AI generation timed out"));
        }, ENGINE_TIMEOUT_MS),
      ),
    ]);
    await new Promise((r) => setTimeout(r, 100));
    session.dispose();

    const wroteFile = !!relPath && existsSync(resolveInsideProject(projectDir, relPath));
    if (!wroteFile && !responseText && errorMessage) {
      console.error(`${runTag} failed with model error: ${errorMessage}`);
      throw new Error(errorMessage);
    }
    if (relPath && !wroteFile) {
      if (budgetVerdict !== "ok") {
        console.error(`${runTag} ${budgetVerdict} before writing ${relPath} — toolCalls=${budget.toolCalls} lastEvent=${lastEventType}`);
        throw new Error(`text generation ${budgetVerdict} before writing ${relPath}`);
      }
      console.error(`${runTag} session ended without writing ${relPath} — toolCalls=${budget.toolCalls} lastEvent=${lastEventType} errorMessage=${errorMessage || "(none)"}`);
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
      `Spectr-Deliverable: ${type}`,
      `Spectr-Conversation: ${conversationId}`,
      `Spectr-Stage: ${stage}`,
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

export async function waitForExtraction(
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

export function enrichMessageContent(m: {
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

export { DELIVERABLE_LABEL };
