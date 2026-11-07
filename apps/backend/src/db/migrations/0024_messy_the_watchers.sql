ALTER TABLE "review_items" DROP CONSTRAINT "review_items_quiz_id_learning_quizzes_id_fk";
--> statement-breakpoint
ALTER TABLE "review_items" ALTER COLUMN "quiz_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "review_items" ADD COLUMN "card" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_quiz_id_learning_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."learning_quizzes"("id") ON DELETE set null ON UPDATE no action;