import { getSessionUserId } from "./session.server";

export async function requireUserId(): Promise<number> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Not authenticated. Please log in.");
  return userId;
}
