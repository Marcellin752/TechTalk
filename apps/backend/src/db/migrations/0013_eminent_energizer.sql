CREATE TABLE IF NOT EXISTS "github_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"login" varchar(100) NOT NULL,
	"name" varchar(200),
	"bio" text,
	"avatar_url" varchar(500),
	"html_url" varchar(300),
	"public_repos" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"total_stars" integer DEFAULT 0 NOT NULL,
	"languages" jsonb NOT NULL,
	"top_repos" jsonb NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_login" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_profiles" ADD CONSTRAINT "github_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
