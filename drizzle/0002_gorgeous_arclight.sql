CREATE TABLE "bill_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"show_doctor" boolean DEFAULT true NOT NULL,
	"show_customer_address" boolean DEFAULT false NOT NULL,
	"show_batch_no" boolean DEFAULT true NOT NULL,
	"show_expiry" boolean DEFAULT true NOT NULL,
	"show_mrp" boolean DEFAULT true NOT NULL,
	"show_discount_percent" boolean DEFAULT true NOT NULL,
	"footer_note" text,
	"terms_text" text,
	"custom_fields_json" text
);
--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "discount" double precision DEFAULT 0 NOT NULL;