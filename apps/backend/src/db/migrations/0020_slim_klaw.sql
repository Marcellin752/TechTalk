CREATE TABLE "school_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"title" varchar(160) NOT NULL,
	"kind" varchar(12) NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"notes" varchar(500),
	"year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"contact_email" varchar(255),
	"curriculum" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"api_key_hash" varchar(64),
	"api_key_prefix" varchar(12),
	"api_key_created_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug"),
	CONSTRAINT "schools_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD COLUMN "share_with_school" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD COLUMN "share_for_recommendations" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "school_events_school_external_unique" ON "school_events" USING btree ("school_id","external_id");--> statement-breakpoint
CREATE INDEX "school_events_school_start_idx" ON "school_events" USING btree ("school_id","starts_at");--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD CONSTRAINT "learning_profiles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;