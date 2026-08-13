DROP INDEX "idx_usage_user_month";--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "kind" text DEFAULT 'prd' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_usage_user_month_kind" ON "usage" USING btree ("user_id","year_month","kind");