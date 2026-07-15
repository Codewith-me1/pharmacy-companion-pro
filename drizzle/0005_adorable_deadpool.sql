ALTER TABLE "batches" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "bill_settings" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "business_settings" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "email_settings" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "medicines" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "owner_id" SET DEFAULT (nullif(current_setting('app.current_user_id', true), ''))::integer;