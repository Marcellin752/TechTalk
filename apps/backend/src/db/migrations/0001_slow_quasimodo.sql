ALTER TABLE "articles" RENAME TO "contents";--> statement-breakpoint
ALTER TABLE "contents" DROP CONSTRAINT "articles_url_unique";--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "embed_code" text;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_url_unique" UNIQUE("url");