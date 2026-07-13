import { pgTable, text, integer, doublePrecision, boolean, serial } from "drizzle-orm/pg-core";

const id = () => serial("id").primaryKey();
const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const suppliers = pgTable("suppliers", {
  id: id(),
  name: text("name").notNull(),
  gstNumber: text("gst_number"),
  dlNo: text("dl_no"),
  address: text("address"),
  phone: text("phone"),
  creditDays: integer("credit_days").notNull().default(0),
  outstanding: doublePrecision("outstanding").notNull().default(0),
  createdAt: createdAt(),
});

export const medicines = pgTable("medicines", {
  id: id(),
  name: text("name").notNull(),
  brand: text("brand"),
  company: text("company"),
  category: text("category"),
  pack: text("pack"),
  mrp: doublePrecision("mrp").notNull().default(0),
  sellingPrice: doublePrecision("selling_price").notNull().default(0),
  purchasePrice: doublePrecision("purchase_price").notNull().default(0),
  gstPercent: doublePrecision("gst_percent").notNull().default(12),
  hsnCode: text("hsn_code"),
  barcode: text("barcode"),
  createdAt: createdAt(),
});

export const batches = pgTable("batches", {
  id: id(),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id),
  batchNo: text("batch_no").notNull(),
  expiryDate: text("expiry_date").notNull(),
  manufactureDate: text("manufacture_date"),
  quantity: integer("quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  purchasePrice: doublePrecision("purchase_price").notNull().default(0),
  mrp: doublePrecision("mrp").notNull().default(0),
  ptr: doublePrecision("ptr").default(0),
  pts: doublePrecision("pts").default(0),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  purchaseId: integer("purchase_id"),
  createdAt: createdAt(),
});

export const purchases = pgTable("purchases", {
  id: id(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  invoiceNumber: text("invoice_number"),
  serialNumber: text("serial_number"),
  invoiceDate: text("invoice_date"),
  billNumber: text("bill_number"),
  invoiceTotal: doublePrecision("invoice_total").notNull().default(0),
  netAmount: doublePrecision("net_amount").notNull().default(0),
  taxAmount: doublePrecision("tax_amount").notNull().default(0),
  discount: doublePrecision("discount").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | verified
  ocrConfidence: doublePrecision("ocr_confidence"),
  sourceLabel: text("source_label"), // camera | webcam | pdf | scanner | email
  createdAt: createdAt(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: id(),
  purchaseId: integer("purchase_id")
    .notNull()
    .references(() => purchases.id),
  medicineId: integer("medicine_id").references(() => medicines.id),
  medicineNameRaw: text("medicine_name_raw").notNull(),
  pack: text("pack"),
  batchNo: text("batch_no"),
  expiryDate: text("expiry_date"),
  manufactureDate: text("manufacture_date"),
  hsnCode: text("hsn_code"),
  mrp: doublePrecision("mrp").notNull().default(0),
  ptr: doublePrecision("ptr").default(0),
  pts: doublePrecision("pts").default(0),
  purchasePrice: doublePrecision("purchase_price").notNull().default(0),
  sellingPrice: doublePrecision("selling_price").default(0),
  gstPercent: doublePrecision("gst_percent").notNull().default(12),
  cgst: doublePrecision("cgst").default(0),
  sgst: doublePrecision("sgst").default(0),
  igst: doublePrecision("igst").default(0),
  discount: doublePrecision("discount").default(0),
  scheme: text("scheme"),
  freeQty: integer("free_qty").default(0),
  quantity: integer("quantity").notNull().default(0),
  confidence: doublePrecision("confidence").default(1),
  flags: text("flags"), // JSON array of warning flags
  createdAt: createdAt(),
});

export const doctors = pgTable("doctors", {
  id: id(),
  name: text("name").notNull(),
  hospital: text("hospital"),
  clinic: text("clinic"),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  specialization: text("specialization"),
  createdAt: createdAt(),
});

export const doctorMedicines = pgTable("doctor_medicines", {
  id: id(),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => doctors.id),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id),
  defaultQty: integer("default_qty").notNull().default(1),
  rank: integer("rank").notNull().default(0),
});

export const customers = pgTable("customers", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  gstNumber: text("gst_number"),
  creditBalance: doublePrecision("credit_balance").notNull().default(0),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  createdAt: createdAt(),
});

export const sales = pgTable("sales", {
  id: id(),
  customerId: integer("customer_id").references(() => customers.id),
  doctorId: integer("doctor_id").references(() => doctors.id),
  billNumber: text("bill_number").notNull(),
  billType: text("bill_type").notNull().default("retail"), // retail|gst|wholesale|estimate|quotation|credit
  subtotal: doublePrecision("subtotal").notNull().default(0),
  discount: doublePrecision("discount").notNull().default(0),
  gstAmount: doublePrecision("gst_amount").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  paymentMode: text("payment_mode").notNull().default("cash"), // cash|upi|card|credit|split
  paymentStatus: text("payment_status").notNull().default("paid"), // paid|pending|partial
  createdAt: createdAt(),
});

export const saleItems = pgTable("sale_items", {
  id: id(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id),
  batchId: integer("batch_id")
    .notNull()
    .references(() => batches.id),
  quantity: integer("quantity").notNull().default(1),
  mrp: doublePrecision("mrp").notNull().default(0),
  salePrice: doublePrecision("sale_price").notNull().default(0),
  gstPercent: doublePrecision("gst_percent").notNull().default(12),
  discount: doublePrecision("discount").notNull().default(0),
});

export const businessSettings = pgTable("business_settings", {
  id: id(),
  firmName: text("firm_name"),
  dlNo: text("dl_no"),
  gstNumber: text("gst_number"),
  mobile: text("mobile"),
  address: text("address"),
  aiAssistantEnabled: boolean("ai_assistant_enabled").notNull().default(true),
});

export const emailSettings = pgTable("email_settings", {
  id: id(),
  email: text("email"),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port").notNull().default(993),
  useTls: boolean("use_tls").notNull().default(true),
  password: text("password"), // app password, stored locally in plaintext — see settings UI note
  enabled: boolean("enabled").notNull().default(false),
});

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id),
  batchId: integer("batch_id").references(() => batches.id),
  type: text("type").notNull(), // in|out|adjustment|damage|lost|expired|return|transfer
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  createdAt: createdAt(),
});
