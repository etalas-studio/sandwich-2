ALTER TABLE "payments" ALTER COLUMN "transaction_status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status_code" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "plan_slug" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "local_status" text DEFAULT 'creating_payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_type" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fraud_status" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "snap_token" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "redirect_url" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "period_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;