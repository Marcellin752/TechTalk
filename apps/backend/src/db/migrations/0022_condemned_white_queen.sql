ALTER TABLE "learning_paths" ADD COLUMN "kind" varchar(10) DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD COLUMN "settings" jsonb;