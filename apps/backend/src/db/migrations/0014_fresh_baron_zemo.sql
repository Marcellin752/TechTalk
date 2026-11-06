CREATE TABLE IF NOT EXISTS "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"goal" varchar(30) NOT NULL,
	"level" varchar(20) NOT NULL,
	"hours_per_week" integer NOT NULL,
	"total_minutes" integer NOT NULL,
	"stages" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"goal" varchar(30) NOT NULL,
	"level" varchar(20) NOT NULL,
	"languages" text[] NOT NULL,
	"hours_per_week" integer NOT NULL,
	"style" varchar(20) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"stage" integer NOT NULL,
	"position" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"minutes" integer NOT NULL,
	"status" varchar(12) DEFAULT 'todo' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_profiles" ADD CONSTRAINT "learning_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_steps" ADD CONSTRAINT "learning_steps_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_steps" ADD CONSTRAINT "learning_steps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_steps" ADD CONSTRAINT "learning_steps_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_paths_user_active_idx" ON "learning_paths" ("user_id","active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_steps_path_position_idx" ON "learning_steps" ("path_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_steps_path_content_unique" ON "learning_steps" ("path_id","content_id");