import type { ConversationRepository } from "../ports/conversation-repository.js";
import type { DocumentRepository } from "../ports/document-repository.js";
import type { ProjectRepository } from "../ports/project-repository.js";
import type { GenerationPort } from "../ports/generation-port.js";
import type { PipelineStage } from "../../domain/generation/index.js";
import type { DocumentType } from "../../domain/documents/index.js";
import type { ConversationTurn } from "../../domain/conversations/index.js";
import {
  detectDeliverableType,
  detectPreviewIntent,
  detectCancelIntent,
  hasLogoAndColorDetails,
  INITIAL_STAGE,
} from "../../domain/generation/index.js";
// ponytail: move to domain/generation/index.js or application/generation/ helpers after Task 9
import {
  deliverablePathFor,
  commitMessageFor,
  chatOutputFor,
  composePrototypeBrief,
  composeRefineInstruction,
  DELIVERABLE_LABEL,
} from "../../generation/run.js";

export interface RunGenerationInput {
  userId: string;
  conversationId: string;
  projectId: string;
  projectDir: string;
  signal: AbortSignal;
  /** Called for every generation event; infra (SSE route) provides this. */
  onEvent: (event: GenerationEvent) => void;
}

export type GenerationEvent =
  | { type: "stage"; stage: PipelineStage }
  | { type: "text"; text: string }
  | { type: "done"; wroteFile: boolean; documentId?: string }
  | { type: "error"; message: string };

export interface RunGenerationDeps {
  conversations: ConversationRepository;
  documents: DocumentRepository;
  projects: ProjectRepository;
  generation: GenerationPort;
}

export async function runGeneration(
  deps: RunGenerationDeps,
  input: RunGenerationInput,
): Promise<void> {
  const { conversationId, projectId, projectDir, signal } = input;

  // Load conversation and history via ports.
  const conversation = await deps.conversations.findById(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  const turns: ConversationTurn[] = await deps.conversations.getMessagesForPrompt(conversationId);

  const lastUserMessage =
    [...turns].reverse().find((t) => t.role === "user")?.content ?? "";

  // ── Existing documents for this conversation ──────────────────────────────
  // The CA doc repo doesn't yet expose listForConversation, so we derive the
  // set we need from what the conversation's pipelineStage / pendingType hold.
  // Full document listing is an infrastructure concern left to Task 9.
  // ponytail: replace with deps.documents.listForConversation(conversationId) after Task 9

  let stage = (conversation.pipelineStage as PipelineStage) ?? INITIAL_STAGE;
  let pendingType = (conversation.pendingType ?? null) as DocumentType | null;
  let refineInstruction: string | null = null;

  // ── Stage transitions ─────────────────────────────────────────────────────
  if (stage === "intake" || stage === "choosing_deliverable") {
    // Allow pendingType already set (e.g. from a dropdown that pre-fills it)
    // to bypass detection and jump straight to clarifying questions.
    const detected = pendingType ?? detectDeliverableType(lastUserMessage);
    if (detected) {
      pendingType = detected;
      stage = "clarifying";
    }
  } else if (stage === "clarifying") {
    // Prototype hard gate: don't advance to generating until the conversation
    // has covered logo and colour palette.
    const readyToGenerate =
      pendingType !== "prototype" ||
      hasLogoAndColorDetails(composePrototypeBrief(turns));
    if (readyToGenerate) {
      stage = "generating";
    }
  } else if (stage === "awaiting_next") {
    if (detectCancelIntent(lastUserMessage)) {
      // stay in awaiting_next — no-op turn, handled by AI below
    } else {
      const detected = detectDeliverableType(lastUserMessage);
      // ponytail: replace existingDocs check with deps.documents.listForConversation after Task 9
      // For now, assume any detected type that equals the current pendingType already exists;
      // a detected type that differs is treated as a new deliverable request.
      const isKnownPending = detected !== null && detected === pendingType;
      if (detected && !isKnownPending) {
        // Explicit new deliverable — start fresh clarification.
        pendingType = detected;
        stage = "clarifying";
      } else {
        // Any other follow-up = refine whatever was most recently produced.
        if (pendingType) {
          stage = "refining";
          refineInstruction = lastUserMessage;
        }
      }
    }
  } else if (stage === "refining") {
    if (detectCancelIntent(lastUserMessage)) {
      stage = "awaiting_next";
    } else if (
      detectDeliverableType(lastUserMessage) !== null &&
      detectDeliverableType(lastUserMessage) !== pendingType
    ) {
      // Mid-refine pivot to a brand-new deliverable.
      pendingType = detectDeliverableType(lastUserMessage)!;
      stage = "clarifying";
    } else {
      // Confirmation or more feedback — accumulate and generate.
      stage = "generating";
      refineInstruction = composeRefineInstruction(turns) || lastUserMessage;
    }
  }

  // Emit current stage so SSE can forward it.
  input.onEvent({ type: "stage", stage });

  // ── Preview intent (no AI call) ───────────────────────────────────────────
  if (detectPreviewIntent(lastUserMessage)) {
    // Preview URL is an HTTP concern; emit done without a documentId so the
    // route handler can build the URL. The route knows the doc from its own
    // DB query.
    input.onEvent({ type: "done", wroteFile: false });
    await deps.conversations.updateStage(conversationId, stage, pendingType);
    return;
  }

  // ── Persist stage before the (potentially long) AI call ──────────────────
  await deps.conversations.updateStage(conversationId, stage, pendingType);

  // ── Generate or chat ──────────────────────────────────────────────────────
  if (stage === "generating" && pendingType) {
    const type = pendingType;
    const relPath = deliverablePathFor(type);
    const title = conversation.title.trim() || DELIVERABLE_LABEL[type];
    const mode: "generate" | "refine" = refineInstruction ? "refine" : "generate";

    const result = await deps.generation.run({
      projectDir,
      conversationId,
      history: turns,
      signal,
      stage,
      pendingType: type,
      refineInstruction,
    });

    if (!result.wroteFile && stage === "generating") {
      throw new Error(`${DELIVERABLE_LABEL[type]} tidak berhasil dibuat.`);
    }

    const doc = await deps.documents.upsert({
      userId: input.userId,
      projectId,
      conversationId,
      title,
      type,
      relativePath: relPath,
    });

    const chatOutput = chatOutputFor(type, result.text, null);

    await deps.conversations.addMessage(conversationId, "assistant", chatOutput);
    await deps.conversations.updateStage(conversationId, "awaiting_next", null);

    input.onEvent({
      type: "done",
      wroteFile: result.wroteFile,
      documentId: doc.id,
    });
  } else {
    // Non-generating stages: plain chat reply.
    const result = await deps.generation.run({
      projectDir,
      conversationId,
      history: turns,
      signal,
      stage,
      pendingType,
      refineInstruction,
    });

    if (!result.text) throw new Error("Model returned no response. Try again.");

    const nextStage: PipelineStage =
      stage === "intake" ? "choosing_deliverable" : stage;

    await deps.conversations.addMessage(conversationId, "assistant", result.text);
    await deps.conversations.updateStage(conversationId, nextStage, pendingType);

    input.onEvent({ type: "text", text: result.text });
    input.onEvent({ type: "done", wroteFile: false });
  }
}
