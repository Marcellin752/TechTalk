CREATE TABLE IF NOT EXISTS "kairos_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kairos_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(12) NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"model" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kairos_conversations" ADD CONSTRAINT "kairos_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kairos_messages" ADD CONSTRAINT "kairos_messages_conversation_id_kairos_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."kairos_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kairos_messages" ADD CONSTRAINT "kairos_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kairos_conversations_user_updated_idx" ON "kairos_conversations" ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kairos_messages_conversation_idx" ON "kairos_messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kairos_messages_user_day_idx" ON "kairos_messages" ("user_id","created_at");