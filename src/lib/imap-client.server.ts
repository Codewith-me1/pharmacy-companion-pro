import { emailSettings } from "./db/schema";
import type { getDb } from "./db/client.server";

export async function getImapClient(db: ReturnType<typeof getDb>) {
  const [row] = await db.select().from(emailSettings).limit(1);
  if (!row || !row.email || !row.imapHost || !row.password) {
    throw new Error("Email is not connected yet. Add your IMAP details in Settings first.");
  }
  const { ImapFlow } = await import("imapflow");
  return new ImapFlow({
    host: row.imapHost,
    port: 993,
    secure: true,
    auth: { user: row.email, pass: row.password },
    logger: false,
    greetingTimeout: 15000,
    socketTimeout: 60000,
    tls: { servername: row.imapHost },
  });
}
