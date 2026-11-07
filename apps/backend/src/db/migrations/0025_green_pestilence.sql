CREATE TABLE "concept_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"type" varchar(12) NOT NULL,
	"source" varchar(10) DEFAULT 'curated' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"text" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"feedback" text,
	"score" real NOT NULL,
	"revised" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(80) NOT NULL,
	"area" varchar(20) DEFAULT 'general' NOT NULL,
	"description" varchar(300),
	"curated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "concepts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "edge_feedback" (
	"user_id" uuid NOT NULL,
	"edge_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"type" varchar(12) NOT NULL,
	"outcome" real DEFAULT 1 NOT NULL,
	"ref" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_from_id_concepts_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_to_id_concepts_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evaluations" ADD CONSTRAINT "concept_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evaluations" ADD CONSTRAINT "concept_evaluations_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edge_feedback" ADD CONSTRAINT "edge_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edge_feedback" ADD CONSTRAINT "edge_feedback_edge_id_concept_edges_id_fk" FOREIGN KEY ("edge_id") REFERENCES "public"."concept_edges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "concept_edges_unique" ON "concept_edges" USING btree ("from_id","to_id","type");--> statement-breakpoint
CREATE INDEX "concept_evaluations_user_concept_idx" ON "concept_evaluations" USING btree ("user_id","concept_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "edge_feedback_pk" ON "edge_feedback" USING btree ("user_id","edge_id");--> statement-breakpoint
CREATE INDEX "skill_evidence_user_concept_idx" ON "skill_evidence" USING btree ("user_id","concept_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_evidence_ref_unique" ON "skill_evidence" USING btree ("user_id","concept_id","type","ref");