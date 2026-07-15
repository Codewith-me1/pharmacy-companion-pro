import { eq } from "drizzle-orm";
import { getDb } from "./client.server";
import { withTenant } from "./tenant.server";
import { hashPassword } from "../auth/password.server";
import { users, suppliers, medicines, batches, doctors, doctorMedicines, customers } from "./schema";

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const db = getDb();

  const demoEmail = "demo@medios.local";
  const [existing] = await db.select().from(users).where(eq(users.email, demoEmail));
  let demoUserId: number;
  if (existing) {
    demoUserId = existing.id;
    console.log("Reusing existing demo account:", demoEmail);
  } else {
    const passwordHash = await hashPassword("demo12345");
    const [inserted] = await db
      .insert(users)
      .values({ email: demoEmail, passwordHash, name: "Demo User", pharmacyName: "Demo Pharmacy" })
      .returning();
    demoUserId = inserted.id;
    console.log("Created demo account — email: demo@medios.local  password: demo12345");
  }

  await withTenant(demoUserId, async (db) => {
    const [supplier1, supplier2] = await db
      .insert(suppliers)
      .values([
        { name: "Sun Pharma Distributors", gstNumber: "27AAACS1234F1Z5", address: "MIDC, Mumbai", phone: "9820012345", creditDays: 30, outstanding: 42500 },
        { name: "Cipla Regional Agency", gstNumber: "27AAACC5678D1Z2", address: "Andheri, Mumbai", phone: "9820098765", creditDays: 15, outstanding: 12800 },
      ])
      .returning();

    const medicineRows = [
      { name: "Paracetamol 650", brand: "Crocin", company: "GSK", category: "Tablet", mrp: 36, sellingPrice: 34, purchasePrice: 18, gstPercent: 12, hsnCode: "3004" },
      { name: "Azithromycin 500", brand: "Azithral", company: "Alembic", category: "Tablet", mrp: 120, sellingPrice: 112, purchasePrice: 68, gstPercent: 12, hsnCode: "3004" },
      { name: "Montair LC", brand: "Montair LC", company: "Cipla", category: "Tablet", mrp: 145, sellingPrice: 138, purchasePrice: 82, gstPercent: 12, hsnCode: "3004" },
      { name: "Pantoprazole 40", brand: "Pantocid", company: "Sun Pharma", category: "Tablet", mrp: 95, sellingPrice: 90, purchasePrice: 52, gstPercent: 12, hsnCode: "3004" },
      { name: "Vitamin D3 60K", brand: "Uprise D3", company: "Alkem", category: "Capsule", mrp: 32, sellingPrice: 30, purchasePrice: 16, gstPercent: 5, hsnCode: "3004" },
      { name: "Amoxiclav 625", brand: "Augmentin", company: "GSK", category: "Tablet", mrp: 210, sellingPrice: 198, purchasePrice: 128, gstPercent: 12, hsnCode: "3004" },
      { name: "Cetirizine 10", brand: "Cetzine", company: "GSK", category: "Tablet", mrp: 18, sellingPrice: 17, purchasePrice: 8, gstPercent: 12, hsnCode: "3004" },
      { name: "ORS Sachet", brand: "Electral", company: "FDC", category: "Syrup", mrp: 22, sellingPrice: 21, purchasePrice: 11, gstPercent: 5, hsnCode: "3004" },
    ];
    const insertedMedicines = await db.insert(medicines).values(medicineRows).returning();

    const batchRows = [
      { medicineId: insertedMedicines[0].id, batchNo: "A2312", expiryDate: daysFromNow(400), quantity: 52, purchasePrice: 18, mrp: 36, supplierId: supplier1.id },
      { medicineId: insertedMedicines[1].id, batchNo: "AZ1187", expiryDate: daysFromNow(25), quantity: 18, purchasePrice: 68, mrp: 120, supplierId: supplier2.id },
      { medicineId: insertedMedicines[2].id, batchNo: "ML0921", expiryDate: daysFromNow(12), quantity: 9, purchasePrice: 82, mrp: 145, supplierId: supplier2.id },
      { medicineId: insertedMedicines[3].id, batchNo: "PT4471", expiryDate: daysFromNow(180), quantity: 40, purchasePrice: 52, mrp: 95, supplierId: supplier1.id },
      { medicineId: insertedMedicines[4].id, batchNo: "VD3390", expiryDate: daysFromNow(5), quantity: 3, purchasePrice: 16, mrp: 32, supplierId: supplier1.id },
      { medicineId: insertedMedicines[5].id, batchNo: "AC7712", expiryDate: daysFromNow(300), quantity: 0, purchasePrice: 128, mrp: 210, supplierId: supplier2.id },
      { medicineId: insertedMedicines[6].id, batchNo: "CT2231", expiryDate: daysFromNow(60), quantity: 75, purchasePrice: 8, mrp: 18, supplierId: supplier1.id },
      { medicineId: insertedMedicines[7].id, batchNo: "OR9981", expiryDate: daysFromNow(-4), quantity: 6, purchasePrice: 11, mrp: 22, supplierId: supplier1.id },
    ];
    await db.insert(batches).values(batchRows);

    const [doc1, doc2] = await db
      .insert(doctors)
      .values([
        { name: "Dr. Sharma", hospital: "City Care Hospital", clinic: "Sharma Clinic", phone: "9811122233", licenseNumber: "MH-12345", specialization: "General Physician" },
        { name: "Dr. Iyer", hospital: "Lotus Multispeciality", clinic: "Iyer ENT Clinic", phone: "9822233344", licenseNumber: "MH-67890", specialization: "ENT" },
      ])
      .returning();

    await db.insert(doctorMedicines).values([
      { doctorId: doc1.id, medicineId: insertedMedicines[0].id, defaultQty: 10, rank: 1 },
      { doctorId: doc1.id, medicineId: insertedMedicines[1].id, defaultQty: 6, rank: 2 },
      { doctorId: doc1.id, medicineId: insertedMedicines[2].id, defaultQty: 10, rank: 3 },
      { doctorId: doc1.id, medicineId: insertedMedicines[3].id, defaultQty: 10, rank: 4 },
      { doctorId: doc1.id, medicineId: insertedMedicines[4].id, defaultQty: 15, rank: 5 },
      { doctorId: doc2.id, medicineId: insertedMedicines[6].id, defaultQty: 10, rank: 1 },
      { doctorId: doc2.id, medicineId: insertedMedicines[2].id, defaultQty: 10, rank: 2 },
    ]);

    await db.insert(customers).values([
      { name: "Walk-in Customer", phone: "", creditBalance: 0, loyaltyPoints: 0 },
      { name: "Rakesh Mehta", phone: "9833344455", creditBalance: 500, loyaltyPoints: 120 },
    ]);
  });

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
