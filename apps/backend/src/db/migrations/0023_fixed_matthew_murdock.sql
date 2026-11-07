CREATE TABLE "kairos_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"note" varchar(160) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	"stage" integer NOT NULL,
	"questions" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"best_score" integer,
	"passed_at" timestamp,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"q_index" integer NOT NULL,
	"box" integer DEFAULT 1 NOT NULL,
	"due_at" timestamp NOT NULL,
	"last_at" timestamp,
	"lapses" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_profiles" ADD COLUMN "ambassador" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD COLUMN "codewars_username" varchar(40);--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD COLUMN "codewars_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "learning_steps" ADD COLUMN "verified_by" varchar(12);--> statement-breakpoint
ALTER TABLE "kairos_notes" ADD CONSTRAINT "kairos_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_quizzes" ADD CONSTRAINT "learning_quizzes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_quizzes" ADD CONSTRAINT "learning_quizzes_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_quiz_id_learning_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."learning_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kairos_notes_user_note_unique" ON "kairos_notes" USING btree ("user_id","note");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_quizzes_path_stage_unique" ON "learning_quizzes" USING btree ("path_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "review_items_quiz_question_unique" ON "review_items" USING btree ("quiz_id","q_index");--> statement-breakpoint
CREATE INDEX "review_items_user_due_idx" ON "review_items" USING btree ("user_id","due_at");