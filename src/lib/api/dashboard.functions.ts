import { createServerFn } from "@tanstack/react-start";
import { withTenant } from "../db/tenant.server";
import { dashboardStats } from "../db/dashboard-stats.server";
import { requireUserId } from "../auth/require-user.server";

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, (db) => dashboardStats(db));
});
