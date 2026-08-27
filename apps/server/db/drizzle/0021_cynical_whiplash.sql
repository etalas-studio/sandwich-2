CREATE TABLE "projects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_projects_user_created" ON "projects" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conversations_project_created" ON "conversations" USING btree ("project_id","created_at");--> statement-breakpoint
-- Backfill: one project per existing conversation (see ROADMAP M1-02).
-- Runs after the FK + index above, in the same transaction, so the rows it
-- writes are validated by the constraint for free.
-- WITH ... AS MATERIALIZED is required: gen_random_uuid() is VOLATILE and the
-- CTE is referenced twice — without MATERIALIZED, Postgres may inline the
-- SELECT and generate DIFFERENT uuids for the INSERT and the UPDATE.
WITH seeded AS MATERIALIZED (
  SELECT c.id AS conversation_id,
         gen_random_uuid()::text AS project_id,
         c.user_id, c.title, c.created_at, c.updated_at
  FROM conversations c
  WHERE c.project_id IS NULL
),
inserted AS (
  INSERT INTO projects (id, user_id, title, created_at, updated_at)
  SELECT project_id, user_id, title, created_at, updated_at FROM seeded
)
UPDATE conversations c
SET project_id = s.project_id
FROM seeded s
WHERE c.id = s.conversation_id;