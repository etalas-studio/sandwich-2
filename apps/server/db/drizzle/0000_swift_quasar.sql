CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"stage" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_path" text,
	"first_run_completed_at" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"order_id" text PRIMARY KEY NOT NULL,
	"transaction_status" text NOT NULL,
	"status_code" text NOT NULL,
	"gross_amount" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"key" text PRIMARY KEY NOT NULL,
	"type" text,
	"summary" text,
	"description" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"stage" text,
	"needs_human_category" text,
	"needs_human_reason" text,
	"pr_url" text,
	"pr_summary" text,
	"pr_title" text,
	"pr_description" text,
	"started_at" text,
	"finished_at" text,
	"worktree_path" text,
	"branch_name" text,
	"quick_win_choices" text,
	"quick_win_attempts" integer DEFAULT 0 NOT NULL,
	"issue_type" text,
	"priority" text,
	"sprint" text,
	"story_points" real,
	"team" text,
	"assignee" text,
	"parent_key" text,
	"attachments" text,
	"jira_status" text,
	"feedback" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"year_month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_tickets_key_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_usage_user_month" ON "usage" USING btree ("user_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_prefs_user_key" ON "user_preferences" USING btree ("user_id","key");