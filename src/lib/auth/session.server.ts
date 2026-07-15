import process from "node:process";
import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";

type SessionData = { userId: number };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET is not set (or too short). Add a random string of at least 32 characters to your .env file.",
    );
  }
  return {
    password,
    name: "medios_session",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

export async function getSessionUserId(): Promise<number | null> {
  const session = await getSession<SessionData>(sessionConfig());
  return session.data.userId ?? null;
}

export async function setSessionUser(userId: number): Promise<void> {
  await updateSession<SessionData>(sessionConfig(), { userId });
}

export async function clearSessionUser(): Promise<void> {
  await clearSession(sessionConfig());
}
