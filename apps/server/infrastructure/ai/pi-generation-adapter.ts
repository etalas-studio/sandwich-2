// ponytail: remove runTextGeneration delegation in Task 12 when AI layer moves fully into infrastructure
import type { GenerationPort, GenerationRequest, GenerationResult } from "../../application/ports/generation-port.js";
import { runTextGeneration } from "../../generation/run.js";

export class PiGenerationAdapter implements GenerationPort {
  async run(request: GenerationRequest): Promise<GenerationResult> {
    // ponytail: DocumentType / PipelineStage imported via domain in GenerationRequest;
    // run.ts imports same types from legacy paths — structurally identical, no cast needed
    return runTextGeneration(request);
  }
}
