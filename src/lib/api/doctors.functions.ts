import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { doctors, doctorMedicines, medicines } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const listDoctors = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => db.select().from(doctors).orderBy(asc(doctors.name)));
});

export const getDoctorWithMedicines = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
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
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      if (data.id) {
        await db.update(doctors).set(data).where(eq(doctors.id, data.id));
        return { id: data.id };
      }
      const [inserted] = await db.insert(doctors).values(data).returning();
      return { id: inserted.id };
    });
  });

export const deleteDoctor = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      await db.delete(doctors).where(eq(doctors.id, data.id));
      return { ok: true };
    });
  });

export const addDoctorFavoriteMedicine = createServerFn({ method: "POST" })
  .inputValidator(z.object({ doctorId: z.number(), medicineId: z.number(), defaultQty: z.number().default(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const existing = await db.select().from(doctorMedicines).where(eq(doctorMedicines.doctorId, data.doctorId));
      const [inserted] = await db
        .insert(doctorMedicines)
        .values({ ...data, rank: existing.length })
        .returning();
      return inserted;
    });
  });

export const removeDoctorFavoriteMedicine = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      await db.delete(doctorMedicines).where(eq(doctorMedicines.id, data.id));
      return { ok: true };
    });
  });
