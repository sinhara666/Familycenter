import { NextResponse } from "next/server";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { col, ensureSchema, getClient } from "@/lib/db";

export const MAX_STATE_BYTES = 512 * 1024;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // same alphabet as MemberRead
const DIGITS = "0123456789";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json(status: number, obj: unknown): NextResponse {
  return NextResponse.json(obj, { status, headers: CORS_HEADERS });
}

export function optionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Content-Length": "0" },
  });
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newFamilyCode(): string {
  let letters = "";
  for (let i = 0; i < 4; i++) letters += ALPHABET[randomInt(ALPHABET.length)];
  let digits = "";
  for (let i = 0; i < 2; i++) digits += DIGITS[randomInt(DIGITS.length)];
  return `FAM-${letters}-${digits}`;
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function parseJson(raw: string): Record<string, unknown> {
  try {
    const data = JSON.parse(raw || "{}");
    if (data != null && typeof data === "object") return data as Record<string, unknown>;
  } catch {
    /* fall through: bad JSON reads as an empty body, like the bridge */
  }
  return {};
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** The family a device token belongs to, or null. Minting ties a token
 *  to one family only, so push and latest check the token's family
 *  against the requested family code. Also refreshes last_seen. */
export async function deviceFamily(token: string): Promise<string | null> {
  if (!token) return null;
  await ensureSchema();
  const c = getClient();
  const hash = hashToken(token);
  const res = await c.execute({
    sql: "SELECT family_code FROM devices WHERE token_hash = ?",
    args: [hash],
  });
  if (!res.rows.length) return null;
  const fam = col(res.rows[0], "family_code", 0);
  await c.execute({
    sql: "UPDATE devices SET last_seen = ? WHERE token_hash = ?",
    args: [nowSeconds(), hash],
  });
  return String(fam);
}

/** Mint a device token for a family and store only its hash.
 *  Returns the raw token, shown to the device once. */
export async function registerDevice(
  familyCode: string,
  deviceName: string,
): Promise<string> {
  const c = getClient();
  const token = newDeviceToken();
  const now = nowSeconds();
  await c.execute({
    sql: "INSERT INTO devices (token_hash, family_code, device_name, created_at, last_seen) VALUES (?, ?, ?, ?, ?)",
    args: [hashToken(token), familyCode, deviceName, now, now],
  });
  return token;
}

function isConstraintError(err: unknown): boolean {
  const code = String((err as { code?: unknown } | null)?.code ?? "");
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /CONSTRAINT/i.test(code) || /UNIQUE constraint/i.test(message);
}

export async function createFamily(
  deviceName: string,
): Promise<{ code: string; token: string } | null> {
  await ensureSchema();
  const c = getClient();
  const now = nowSeconds();
  for (let i = 0; i < 10; i++) {
    const cand = newFamilyCode();
    try {
      await c.execute({
        sql: "INSERT INTO families (code, state, version, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
        args: [cand, "{}", now, now],
      });
      const token = await registerDevice(cand, deviceName);
      return { code: cand, token };
    } catch (err) {
      if (!isConstraintError(err)) throw err;
    }
  }
  return null;
}
