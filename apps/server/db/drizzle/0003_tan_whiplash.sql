CREATE TABLE "prototype_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"prototype_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prototypes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"share_id" text NOT NULL,
	"name" text NOT NULL,
	"brief" text NOT NULL,
	"logo_data" text,
	"palette" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "prototypes_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
ALTER TABLE "prototype_files" ADD CONSTRAINT "prototype_files_prototype_id_prototypes_id_fk" FOREIGN KEY ("prototype_id") REFERENCES "public"."prototypes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prototypes" ADD CONSTRAINT "prototypes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prototype_files_path" ON "prototype_files" USING btree ("prototype_id","path");