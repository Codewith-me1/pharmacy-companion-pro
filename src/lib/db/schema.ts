import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () => text("created_at").notNull().default(sql`(current_timestamp)`);

export const suppliers = sqliteTable("suppliers", {
  id: id(),
  name: text("name").notNull(),
  gstNumber: text("gst_number"),
  address: text("address"),
  phone: text("phone"),
  creditDays: integer("credit_days").notNull().default(0),
  outstanding: real("outstanding").notNull().default(0),
  createdAt: createdAt(),
});

export const medicines = sqliteTable("medicines", {
  id: id(),
  name: text("name").notNull(),
  salt: text("salt"),
  brand: text("brand"),
  company: text("company"),
  category: text("category"),
  mrp: real("mrp").notNull().default(0),
  sellingPrice: real("selling_price").notNull().default(0),
  purchasePrice: real("purchase_price").notNull().default(0),
  gstPercent: real("gst_percent").notNull().default(12),
  hsnCode: text("hsn_code"),
  barcode: text("barcode"),
  storage: text("storage"),
  schedule: text("schedule"),
  rackNumber: text("rack_number"),
  createdAt: createdAt(),
});

export const batches = sqliteTable("batches", {
  id: id(),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  batchNo: text("batch_no").notNull(),
  expiryDate: text("expiry_date").notNull(),
  manufactureDate: text("manufacture_date"),
  quantity: integer("quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  purchasePrice: real("purchase_price").notNull().default(0),
  mrp: real("mrp").notNull().default(0),
  ptr: real("ptr").default(0),
  pts: real("pts").default(0),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  purchaseId: integer("purchase_id"),
  createdAt: createdAt(),
});

export const purchases = sqliteTable("purchases", {
  id: id(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date"),
  billNumber: text("bill_number"),
  invoiceTotal: real("invoice_total").notNull().default(0),
  netAmount: real("net_amount").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  discount: real("discount").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | verified
  ocrConfidence: real("ocr_confidence"),
  sourceLabel: text("source_label"), // camera | webcam | pdf | scanner
  createdAt: createdAt(),
});

export const purchaseItems = sqliteTable("purchase_items", {
  id: id(),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id),
  medicineId: integer("medicine_id").references(() => medicines.id),
  medicineNameRaw: text("medicine_name_raw").notNull(),
  batchNo: text("batch_no"),
  expiryDate: text("expiry_date"),
  manufactureDate: text("manufacture_date"),
  hsnCode: text("hsn_code"),
  mrp: real("mrp").notNull().default(0),
  ptr: real("ptr").default(0),
  pts: real("pts").default(0),
  purchasePrice: real("purchase_price").notNull().default(0),
  sellingPrice: real("selling_price").default(0),
  gstPercent: real("gst_percent").notNull().default(12),
  cgst: real("cgst").default(0),
  sgst: real("sgst").default(0),
  igst: real("igst").default(0),
  discount: real("discount").default(0),
  scheme: text("scheme"),
  freeQty: integer("free_qty").default(0),
  quantity: integer("quantity").notNull().default(0),
  confidence: real("confidence").default(1),
  flags: text("flags"), // JSON array of warning flags
  createdAt: createdAt(),
});

export const doctors = sqliteTable("doctors", {
  id: id(),
  name: text("name").notNull(),
  hospital: text("hospital"),
  clinic: text("clinic"),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  specialization: text("specialization"),
  createdAt: createdAt(),
});

export const doctorMedicines = sqliteTable("doctor_medicines", {
  id: id(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  defaultQty: integer("default_qty").notNull().default(1),
  rank: integer("rank").notNull().default(0),
});

export const customers = sqliteTable("customers", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  gstNumber: text("gst_number"),
  creditBalance: real("credit_balance").notNull().default(0),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  createdAt: createdAt(),
});

export const sales = sqliteTable("sales", {
  id: id(),
  customerId: integer("customer_id").references(() => customers.id),
  doctorId: integer("doctor_id").references(() => doctors.id),
  billNumber: text("bill_number").notNull(),
  billType: text("bill_type").notNull().default("retail"), // retail|gst|wholesale|estimate|quotation|credit
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").notNull().default(0),
  gstAmount: real("gst_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  paymentMode: text("payment_mode").notNull().default("cash"), // cash|upi|card|credit|split
  paymentStatus: text("payment_status").notNull().default("paid"), // paid|pending|partial
  createdAt: createdAt(),
});

export const saleItems = sqliteTable("sale_items", {
  id: id(),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  quantity: integer("quantity").notNull().default(1),
  mrp: real("mrp").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  gstPercent: real("gst_percent").notNull().default(12),
  discount: real("discount").notNull().default(0),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: id(),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  batchId: integer("batch_id").references(() => batches.id),
  type: text("type").notNull(), // in|out|adjustment|damage|lost|expired|return|transfer
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  createdAt: createdAt(),
});
