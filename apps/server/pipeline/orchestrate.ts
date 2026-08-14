import type { DocumentType } from "../db/documents.js";

/**
 * Guided-pipeline state machine (model-driven). The backend owns the stage
 * transitions; the AI only produces content for the current stage.
 *
 *   intake → choosing_deliverable → clarifying → generating → awaiting_next
 */
export type PipelineStage =
  | "intake"
  | "choosing_deliverable"
  | "clarifying"
  | "generating"
  | "awaiting_next";

export const INITIAL_STAGE: PipelineStage = "intake";

/** Best-effort detection of which deliverable the user asked for. */
export function detectDeliverableType(message: string): DocumentType | null {
  const m = message.toLowerCase();
  if (/\bprd\b|\bproduct requirement/.test(m)) return "prd";
  if (/\bquot|\bpenawaran\b|\bharga\b|\bpricing\b|\binvoice\b|\bestimasi\b/.test(m)) return "quotation";
  if (/\bprototype\b|\bprototip\b|\bui\b|\bdesign\b|\blanding/.test(m)) return "prototype";
  if (/\bspec\b|\btask\b|\bbreakdown\b|\bfeature/.test(m)) return "specs";
  return null;
}

const DELIVERABLE_LABEL: Record<DocumentType, string> = {
  prd: "PRD",
  quotation: "Quotation",
  prototype: "Prototype",
  specs: "Specs",
};

/** The instruction injected into the system prompt for the current stage. */
export function stageInstruction(stage: PipelineStage, pendingType: DocumentType | null): string {
  switch (stage) {
    case "intake":
    case "choosing_deliverable":
      return "You are in intake. Acknowledge the brief and ask the user which deliverable they want to generate first: PRD, Quotation, Prototype, or Specs. Do NOT generate anything yet.";
    case "clarifying":
      return `You are clarifying requirements for the ${DELIVERABLE_LABEL[pendingType ?? "prd"]}. Ask 3-5 focused clarifying questions (target users, scope, constraints, timeline). Do NOT generate the document yet.`;
    case "generating":
      return `Generate the full ${DELIVERABLE_LABEL[pendingType ?? "prd"]} document now. Output ONLY the document content — no preamble, no meta-commentary.`;
    case "awaiting_next":
      return "A deliverable was just generated. Ask the user what they want next: generate another deliverable (PRD, Quotation, Prototype, Specs) or refine the one just created.";
  }
}
