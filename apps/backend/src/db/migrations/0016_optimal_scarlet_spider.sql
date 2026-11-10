CREATE TABLE IF NOT EXISTS "profile_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"handle" varchar(30),
	"is_public" boolean DEFAULT false NOT NULL,
	"show_projects" boolean DEFAULT true NOT NULL,
	"show_interests" boolean DEFAULT true NOT NULL,
	"path_public" boolean DEFAULT false NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_settings_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_settings" ADD CONSTRAINT "profile_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_settings_public_idx" ON "profile_settings" ("is_public","updated_at");