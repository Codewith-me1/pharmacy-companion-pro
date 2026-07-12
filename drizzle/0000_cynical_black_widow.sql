CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"medicine_id" integer NOT NULL,
	"batch_no" text NOT NULL,
	"expiry_date" text NOT NULL,
	"manufacture_date" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"purchase_price" double precision DEFAULT 0 NOT NULL,
	"mrp" double precision DEFAULT 0 NOT NULL,
	"ptr" double precision DEFAULT 0,
	"pts" double precision DEFAULT 0,
	"supplier_id" integer,
	"purchase_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_name" text,
	"dl_no" text,
	"gst_number" text,
	"mobile" text,
	"address" text,
	"ai_assistant_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"gst_number" text,
	"credit_balance" double precision DEFAULT 0 NOT NULL,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_medicines" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" integer NOT NULL,
	"medicine_id" integer NOT NULL,
	"default_qty" integer DEFAULT 1 NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hospital" text,
	"clinic" text,
	"phone" text,
	"license_number" text,
	"specialization" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"imap_host" text,
	"imap_port" integer DEFAULT 993 NOT NULL,
	"use_tls" boolean DEFAULT true NOT NULL,
	"password" text,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"salt" text,
	"brand" text,
	"company" text,
	"category" text,
	"pack" text,
	"mrp" double precision DEFAULT 0 NOT NULL,
	"selling_price" double precision DEFAULT 0 NOT NULL,
	"purchase_price" double precision DEFAULT 0 NOT NULL,
	"gst_percent" double precision DEFAULT 12 NOT NULL,
	"hsn_code" text,
	"barcode" text,
	"storage" text,
	"schedule" text,
	"rack_number" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"medicine_id" integer,
	"medicine_name_raw" text NOT NULL,
	"pack" text,
	"batch_no" text,
	"expiry_date" text,
	"manufacture_date" text,
	"hsn_code" text,
	"mrp" double precision DEFAULT 0 NOT NULL,
	"ptr" double precision DEFAULT 0,
	"pts" double precision DEFAULT 0,
	"purchase_price" double precision DEFAULT 0 NOT NULL,
	"selling_price" double precision DEFAULT 0,
	"gst_percent" double precision DEFAULT 12 NOT NULL,
	"cgst" double precision DEFAULT 0,
	"sgst" double precision DEFAULT 0,
	"igst" double precision DEFAULT 0,
	"discount" double precision DEFAULT 0,
	"scheme" text,
	"free_qty" integer DEFAULT 0,
	"quantity" integer DEFAULT 0 NOT NULL,
	"confidence" double precision DEFAULT 1,
	"flags" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer,
	"invoice_number" text,
	"serial_number" text,
	"invoice_date" text,
	"bill_number" text,
	"invoice_total" double precision DEFAULT 0 NOT NULL,
	"net_amount" double precision DEFAULT 0 NOT NULL,
	"tax_amount" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"ocr_confidence" double precision,
	"source_label" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"medicine_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"mrp" double precision DEFAULT 0 NOT NULL,
	"sale_price" double precision DEFAULT 0 NOT NULL,
	"gst_percent" double precision DEFAULT 12 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"doctor_id" integer,
	"bill_number" text NOT NULL,
	"bill_type" text DEFAULT 'retail' NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"gst_amount" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"payment_mode" text DEFAULT 'cash' NOT NULL,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"medicine_id" integer NOT NULL,
	"batch_id" integer,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"reference_type" text,
	"reference_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gst_number" text,
	"dl_no" text,
	"address" text,
	"phone" text,
	"credit_days" integer DEFAULT 0 NOT NULL,
	"outstanding" double precision DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ADD CONSTRAINT "doctor_medicines_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ADD CONSTRAINT "doctor_medicines_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;