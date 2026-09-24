CREATE SCHEMA "triptogether";
--> statement-breakpoint
CREATE TABLE "triptogether"."participants" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triptogether"."reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"option_id" text NOT NULL,
	"reaction" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triptogether"."responses" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"deeper_done" boolean DEFAULT false NOT NULL,
	"submitted_at" bigint,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triptogether"."tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"label" text NOT NULL,
	"owner_participant_id" text,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triptogether"."trips" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"window_start" text NOT NULL,
	"window_end" text NOT NULL,
	"trip_length_days" integer NOT NULL,
	"response_deadline" text,
	"decision_deadline" text,
	"invite_code" text NOT NULL,
	"organizer_code" text NOT NULL,
	"organizer_participant_id" text,
	"published_at" bigint,
	"locked_option_id" text,
	"locked_at" bigint,
	"locked_snapshot" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "triptogether"."participants" ADD CONSTRAINT "participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "triptogether"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triptogether"."reactions" ADD CONSTRAINT "reactions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "triptogether"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triptogether"."reactions" ADD CONSTRAINT "reactions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "triptogether"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triptogether"."responses" ADD CONSTRAINT "responses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "triptogether"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triptogether"."responses" ADD CONSTRAINT "responses_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "triptogether"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triptogether"."tasks" ADD CONSTRAINT "tasks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "triptogether"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participants_trip_idx" ON "triptogether"."participants" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_unique_idx" ON "triptogether"."reactions" USING btree ("participant_id","option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "responses_participant_idx" ON "triptogether"."responses" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "tasks_trip_idx" ON "triptogether"."tasks" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_invite_code_idx" ON "triptogether"."trips" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_organizer_code_idx" ON "triptogether"."trips" USING btree ("organizer_code");