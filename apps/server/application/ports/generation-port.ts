import type { ConversationTurn } from "../../domain/conversations/index.js";
import type { PipelineStage } from "../../domain/generation/index.js";
import type { DocumentType } from "../../domain/documents/index.js";

export interface GenerationRequest {
  projectDir: string;
  conversationId: string;
  history: ConversationTurn[];
  signal: AbortSignal;
  stage: PipelineStage;
  pendingType: DocumentType | null;
  refineInstruction?: string | null;
}

export interface GenerationResult {
  text: string;
  wroteFile: boolean;
}

export interface GenerationPort {
  run(request: GenerationRequest): Promise<GenerationResult>;
}
