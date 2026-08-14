CREATE TABLE "prototype_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"prototype_id" text NOT NULL,
	"version" integer NOT NULL,
	"files" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prototypes" ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "prototype_versions" ADD CONSTRAINT "prototype_versions_prototype_id_prototypes_id_fk" FOREIGN KEY ("prototype_id") REFERENCES "public"."prototypes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prototype_versions_version" ON "prototype_versions" USING btree ("prototype_id","version");