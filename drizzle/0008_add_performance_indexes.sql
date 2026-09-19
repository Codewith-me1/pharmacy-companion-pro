-- Performance indexes.
--
-- Before this migration every table carried exactly one index: its primary key. That is a problem
-- specific to how this schema enforces tenancy — Row-Level Security adds
--   owner_id = current_setting('app.current_user_id')::int
-- to EVERY read and write of EVERY tenant table, so without an index on owner_id, Postgres has to
-- scan the whole table just to decide which rows the current pharmacy is allowed to see. That is
-- invisible while the database is small and becomes the dominant cost as the sales and
-- stock_movements ledgers grow.
--
-- The foreign-key columns are indexed for the same reason: Postgres does not create an index for a
-- foreign key automatically, so joins (batches -> medicine, sale_items -> sale) and cascade checks
-- on delete both degrade to sequential scans.
--
-- Written as a custom migration rather than in schema.ts because it is purely physical: it changes
-- no column, constraint or type, and nothing in application code refers to it.

-- Tenant scoping: the column every RLS policy tests.
CREATE INDEX IF NOT EXISTS "idx_medicines_owner" ON "medicines" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_suppliers_owner" ON "suppliers" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_customers_owner" ON "customers" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_doctors_owner" ON "doctors" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_batches_owner" ON "batches" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_sales_owner" ON "sales" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_owner" ON "sale_items" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_purchases_owner" ON "purchases" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_owner" ON "purchase_items" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_owner" ON "stock_movements" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_doctor_medicines_owner" ON "doctor_medicines" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_business_settings_owner" ON "business_settings" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_bill_settings_owner" ON "bill_settings" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_email_settings_owner" ON "email_settings" ("owner_id");
--> statement-breakpoint

-- Joins and lookups. Composite (owner_id, <fk>) so one index serves both the RLS predicate and the
-- join condition in a single scan.
CREATE INDEX IF NOT EXISTS "idx_batches_medicine" ON "batches" ("owner_id", "medicine_id");
CREATE INDEX IF NOT EXISTS "idx_batches_supplier" ON "batches" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_medicine" ON "stock_movements" ("owner_id", "medicine_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_batch" ON "stock_movements" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_sale" ON "sale_items" ("sale_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_medicine" ON "sale_items" ("medicine_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_batch" ON "sale_items" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_purchase" ON "purchase_items" ("purchase_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_medicine" ON "purchase_items" ("medicine_id");
-- (purchase_items has no batch_id: it records the supplier-printed batch number as
-- batch_no text, so there is no foreign key to index here.)
CREATE INDEX IF NOT EXISTS "idx_purchases_supplier" ON "purchases" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_sales_customer" ON "sales" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_sales_doctor" ON "sales" ("doctor_id");
CREATE INDEX IF NOT EXISTS "idx_doctor_medicines_doctor" ON "doctor_medicines" ("doctor_id");
CREATE INDEX IF NOT EXISTS "idx_doctor_medicines_medicine" ON "doctor_medicines" ("medicine_id");
--> statement-breakpoint

-- Hot query paths.
-- The expiry dashboard scans batches by expiry date on every load; stock movements are read
-- newest-first; the ledger of written-off expiry stock filters by type.
CREATE INDEX IF NOT EXISTS "idx_batches_expiry" ON "batches" ("owner_id", "expiry_date");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_type" ON "stock_movements" ("owner_id", "type");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_created" ON "stock_movements" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_sales_created" ON "sales" ("owner_id", "created_at" DESC);
-- Barcode scanning at the till must be instant; partial index keeps it small since most
-- medicines have no barcode recorded.
CREATE INDEX IF NOT EXISTS "idx_medicines_barcode" ON "medicines" ("owner_id", "barcode") WHERE "barcode" IS NOT NULL;
-- Case-insensitive medicine name search (the Inventory and Billing search boxes).
CREATE INDEX IF NOT EXISTS "idx_medicines_name_lower" ON "medicines" ("owner_id", lower("name"));
