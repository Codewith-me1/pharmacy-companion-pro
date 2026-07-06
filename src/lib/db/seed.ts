import { getDb } from "./client.server";
import { suppliers, medicines, batches, doctors, doctorMedicines, customers } from "./schema";

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const db = getDb();

  const [supplier1, supplier2] = await db
    .insert(suppliers)
    .values([
      { name: "Sun Pharma Distributors", gstNumber: "27AAACS1234F1Z5", address: "MIDC, Mumbai", phone: "9820012345", creditDays: 30, outstanding: 42500 },
      { name: "Cipla Regional Agency", gstNumber: "27AAACC5678D1Z2", address: "Andheri, Mumbai", phone: "9820098765", creditDays: 15, outstanding: 12800 },
    ])
    .returning();

  const medicineRows = [
    { name: "Paracetamol 650", salt: "Paracetamol", brand: "Crocin", company: "GSK", category: "Analgesic", mrp: 36, sellingPrice: 34, purchasePrice: 18, gstPercent: 12, hsnCode: "3004", rackNumber: "B-12", schedule: "OTC" },
    { name: "Azithromycin 500", salt: "Azithromycin", brand: "Azithral", company: "Alembic", category: "Antibiotic", mrp: 120, sellingPrice: 112, purchasePrice: 68, gstPercent: 12, hsnCode: "3004", rackNumber: "C-04", schedule: "H" },
    { name: "Montair LC", salt: "Montelukast + Levocetirizine", brand: "Montair LC", company: "Cipla", category: "Antihistamine", mrp: 145, sellingPrice: 138, purchasePrice: 82, gstPercent: 12, hsnCode: "3004", rackNumber: "C-11", schedule: "H" },
    { name: "Pantoprazole 40", salt: "Pantoprazole", brand: "Pantocid", company: "Sun Pharma", category: "Antacid", mrp: 95, sellingPrice: 90, purchasePrice: 52, gstPercent: 12, hsnCode: "3004", rackNumber: "B-02", schedule: "H" },
    { name: "Vitamin D3 60K", salt: "Cholecalciferol", brand: "Uprise D3", company: "Alkem", category: "Supplement", mrp: 32, sellingPrice: 30, purchasePrice: 16, gstPercent: 5, hsnCode: "3004", rackNumber: "D-06", schedule: "OTC" },
    { name: "Amoxiclav 625", salt: "Amoxicillin + Clavulanate", brand: "Augmentin", company: "GSK", category: "Antibiotic", mrp: 210, sellingPrice: 198, purchasePrice: 128, gstPercent: 12, hsnCode: "3004", rackNumber: "C-05", schedule: "H" },
    { name: "Cetirizine 10", salt: "Cetirizine", brand: "Cetzine", company: "GSK", category: "Antihistamine", mrp: 18, sellingPrice: 17, purchasePrice: 8, gstPercent: 12, hsnCode: "3004", rackNumber: "D-01", schedule: "OTC" },
    { name: "ORS Sachet", salt: "Oral Rehydration Salts", brand: "Electral", company: "FDC", category: "Electrolyte", mrp: 22, sellingPrice: 21, purchasePrice: 11, gstPercent: 5, hsnCode: "3004", rackNumber: "D-09", schedule: "OTC" },
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

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
