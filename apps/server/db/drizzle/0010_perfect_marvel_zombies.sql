DROP INDEX "idx_document_files_path";--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "version_no" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_files_version_path" ON "document_files" USING btree ("document_id","version_no","path");