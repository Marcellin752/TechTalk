ALTER TABLE "contents" ALTER COLUMN "title" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "url" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "source" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" SET DATA TYPE varchar(255);--> statement-breakpoint
--> statement-breakpoint
-- Temporary default so the column can be added to tables that already contain rows,
-- then removed so new registrations must provide a name (final state matches the schema).
ALTER TABLE "users" ADD COLUMN "name" varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contents_created_at_idx" ON "contents" ("created_at");
