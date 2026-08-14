CREATE TABLE "conversation_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"document_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"content" text NOT NULL,
	"prompt_used" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"current_version_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_documents" ADD CONSTRAINT "conversation_documents_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_documents" ADD CONSTRAINT "conversation_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conversation_documents_conv_doc" ON "conversation_documents" USING btree ("conversation_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_files_path" ON "document_files" USING btree ("document_id","path");--> statement-breakpoint
CREATE INDEX "idx_document_versions_doc" ON "document_versions" USING btree ("document_id","version_no");--> statement-breakpoint
CREATE INDEX "idx_documents_user_created" ON "documents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_documents_user_title" ON "documents" USING btree ("user_id","title");