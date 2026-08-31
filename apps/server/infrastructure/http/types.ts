import type { Database } from "../../db/connection.js";
import type { ConversationRepository } from "../../application/ports/conversation-repository.js";
import type { ProjectRepository } from "../../application/ports/project-repository.js";
import type { DocumentRepository } from "../../application/ports/document-repository.js";
import type { GenerationPort } from "../../application/ports/generation-port.js";

export interface HttpDeps {
  db: Database;
  conversations: ConversationRepository;
  projects: ProjectRepository;
  documents: DocumentRepository;
  generation: GenerationPort;
}
