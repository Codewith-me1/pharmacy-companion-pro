CREATE TABLE "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"identifier" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" text NOT NULL,
	"locked_until" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_bucket_identifier_idx" ON "rate_limits" USING btree ("bucket","identifier");