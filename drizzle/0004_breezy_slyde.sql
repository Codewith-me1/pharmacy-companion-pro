ALTER TABLE "batches" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_settings" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "medicines" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
-- Row-Level Security: enforce tenant isolation at the database layer so application code
-- cannot leak another tenant's rows even if a WHERE clause is forgotten somewhere. FORCE is
-- required because the connecting role owns these tables, and RLS is skipped for table owners
-- by default. The DEFAULT lets INSERTs omit owner_id entirely — it's filled in automatically
-- from the same per-transaction session variable that the USING/WITH CHECK clauses read.
ALTER TABLE "batches" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "bill_settings" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "business_settings" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "email_settings" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "medicines" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "owner_id" SET DEFAULT nullif(current_setting('app.current_user_id', true), '')::int;--> statement-breakpoint
ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "batches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "batches" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "bill_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "bill_settings" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "business_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "business_settings" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "customers" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "doctor_medicines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "doctor_medicines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "doctor_medicines" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "doctors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "doctors" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "doctors" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "email_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "email_settings" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "medicines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medicines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "medicines" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "purchase_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchase_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "purchase_items" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchases" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "purchases" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sale_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sale_items" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sales" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "stock_movements" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "suppliers" USING (owner_id = current_setting('app.current_user_id', true)::int) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);