CREATE TABLE "credit_note_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer NOT NULL,
	"credit_note_id" integer NOT NULL,
	"purchase_id" integer NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"note_number" text,
	"note_date" text,
	"amount" double precision DEFAULT 0 NOT NULL,
	"applied_amount" double precision DEFAULT 0 NOT NULL,
	"reason" text,
	"batch_ids_json" text,
	"file_name" text,
	"file_mime_type" text,
	"file_data" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "credit_note_amount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_note_applications" ADD CONSTRAINT "credit_note_applications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_applications" ADD CONSTRAINT "credit_note_applications_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_applications" ADD CONSTRAINT "credit_note_applications_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Tenant isolation, same policy as every other tenant table (see 0004_breezy_slyde.sql). Without
-- this, scripts/verify-db-security.ts fails and one pharmacy could read another's credit notes.
ALTER TABLE "credit_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_notes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "credit_notes" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "credit_note_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_note_applications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "credit_note_applications" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
-- Indexes on the RLS column and lookup keys, as in 0008_add_performance_indexes.sql.
CREATE INDEX IF NOT EXISTS "idx_credit_notes_supplier" ON "credit_notes" ("owner_id", "supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_note_applications_owner" ON "credit_note_applications" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_note_applications_note" ON "credit_note_applications" ("credit_note_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_note_applications_purchase" ON "credit_note_applications" ("purchase_id");
