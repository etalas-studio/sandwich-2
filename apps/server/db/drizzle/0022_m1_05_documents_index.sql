ALTER TABLE "conversation_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_files" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_versions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "conversation_documents" CASCADE;--> statement-breakpoint
DROP TABLE "document_files" CASCADE;--> statement-breakpoint
DROP TABLE "document_versions" CASCADE;--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "idx_documents_user_created";--> statement-breakpoint
DROP INDEX "idx_documents_user_title";--> statement-breakpoint
-- Clean slate (ROADMAP M1-05: "No migration of existing rows"). documents is
-- now an index of files on disk; pre-launch rows have no file behind them.
-- chat_messages.document_id FKs onto documents (schema.ts) so release it first.
UPDATE "chat_messages" SET "document_id" = NULL WHERE "document_id" IS NOT NULL;--> statement-breakpoint
DELETE FROM "documents";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "project_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "relative_path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "last_commit_sha" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_documents_project_type" ON "documents" USING btree ("project_id","type");--> statement-breakpoint
CREATE INDEX "idx_documents_project_updated" ON "documents" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_documents_conversation" ON "documents" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "current_version_id";