CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"pharmacy_name" text,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "bill_settings" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_settings" ADD CONSTRAINT "bill_settings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_medicines" ADD CONSTRAINT "doctor_medicines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;