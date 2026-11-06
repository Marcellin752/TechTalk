ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_id" varchar(64);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_github_id_unique" UNIQUE("github_id");
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
