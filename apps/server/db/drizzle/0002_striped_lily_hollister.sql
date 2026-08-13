ALTER TABLE "attachments" ADD COLUMN "extracted_text" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "extract_status" text DEFAULT 'pending' NOT NULL;