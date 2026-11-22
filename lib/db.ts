import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

export function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    client = createClient({ url: `file:${path.join(dir, "family-sync.db")}` });
  }
  return client;
}

export function ensureSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const c = getClient();
      await c.executeMultiple(`
        CREATE TABLE IF NOT EXISTS families (
          code TEXT PRIMARY KEY, state TEXT,
          version INTEGER DEFAULT 0,
          created_at INTEGER, updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS devices (
          token_hash TEXT PRIMARY KEY, family_code TEXT, device_name TEXT,
          created_at INTEGER, last_seen INTEGER DEFAULT 0
        );
      `);
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Read one column from a libsql row, tolerating object or array rows. */
export function col(row: unknown, name: string, idx: number): unknown {
  if (row != null && typeof row === "object" && !Array.isArray(row)) {
    return (row as Record<string, unknown>)[name];
  }
  return (row as unknown[])[idx];
}
