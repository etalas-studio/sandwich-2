ALTER TABLE "conversations" ADD COLUMN "pipeline_stage" text DEFAULT 'intake' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "pending_type" text;