import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { doctors, doctorMedicines, medicines } from "../db/schema";

export const listDoctors = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  return db.select().from(doctors).orderBy(asc(doctors.name));
});

export const getDoctorWithMedicines = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, data.id));
    const favorites = await db
      .select({
        id: doctorMedicines.id,
        medicineId: doctorMedicines.medicineId,
        defaultQty: doctorMedicines.defaultQty,
        rank: doctorMedicines.rank,
        medicineName: medicines.name,
        pack: medicines.pack,
        mrp: medicines.mrp,
      })
      .from(doctorMedicines)
      .innerJoin(medicines, eq(medicines.id, doctorMedicines.medicineId))
      .where(eq(doctorMedicines.doctorId, data.id))
      .orderBy(asc(doctorMedicines.rank));
    return { doctor, favorites };
  });

export const upsertDoctor = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      hospital: z.string().optional(),
      clinic: z.string().optional(),
      phone: z.string().optional(),
      licenseNumber: z.string().optional(),
      specialization: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    if (data.id) {
      await db.update(doctors).set(data).where(eq(doctors.id, data.id));
      return { id: data.id };
    }
    const [inserted] = await db.insert(doctors).values(data).returning();
    return { id: inserted.id };
  });

export const addDoctorFavoriteMedicine = createServerFn({ method: "POST" })
  .inputValidator(z.object({ doctorId: z.number(), medicineId: z.number(), defaultQty: z.number().default(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const existing = await db.select().from(doctorMedicines).where(eq(doctorMedicines.doctorId, data.doctorId));
    const [inserted] = await db
      .insert(doctorMedicines)
      .values({ ...data, rank: existing.length })
      .returning();
    return inserted;
  });

export const removeDoctorFavoriteMedicine = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(doctorMedicines).where(eq(doctorMedicines.id, data.id));
    return { ok: true };
  });
