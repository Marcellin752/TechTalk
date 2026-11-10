CREATE TABLE "campus_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"discoverable" boolean DEFAULT false NOT NULL,
	"headline" varchar(120),
	"looking_for" varchar(12),
	"contact" varchar(60),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_resource_reports" (
	"resource_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_resource_votes" (
	"resource_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid,
	"title" varchar(140) NOT NULL,
	"kind" varchar(12) NOT NULL,
	"subject" varchar(80) NOT NULL,
	"year" integer,
	"study_year" integer,
	"url" varchar(500) NOT NULL,
	"description" varchar(500),
	"official" boolean DEFAULT false NOT NULL,
	"status" varchar(10) DEFAULT 'approved' NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"reports" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_session_members" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"subject" varchar(80) NOT NULL,
	"description" varchar(500),
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"place" varchar(120),
	"online_url" varchar(500),
	"capacity" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_profiles" ADD CONSTRAINT "campus_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_resource_reports" ADD CONSTRAINT "campus_resource_reports_resource_id_campus_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."campus_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_resource_reports" ADD CONSTRAINT "campus_resource_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_resource_votes" ADD CONSTRAINT "campus_resource_votes_resource_id_campus_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."campus_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_resource_votes" ADD CONSTRAINT "campus_resource_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_resources" ADD CONSTRAINT "campus_resources_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_resources" ADD CONSTRAINT "campus_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_session_members" ADD CONSTRAINT "campus_session_members_session_id_campus_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."campus_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_session_members" ADD CONSTRAINT "campus_session_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_sessions" ADD CONSTRAINT "campus_sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_sessions" ADD CONSTRAINT "campus_sessions_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campus_resource_reports_pk" ON "campus_resource_reports" USING btree ("resource_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_resource_votes_pk" ON "campus_resource_votes" USING btree ("resource_id","user_id");--> statement-breakpoint
CREATE INDEX "campus_resources_school_subject_idx" ON "campus_resources" USING btree ("school_id","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_resources_school_url_unique" ON "campus_resources" USING btree ("school_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_session_members_pk" ON "campus_session_members" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "campus_session_members_user_idx" ON "campus_session_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campus_sessions_school_start_idx" ON "campus_sessions" USING btree ("school_id","starts_at");