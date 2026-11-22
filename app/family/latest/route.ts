import { col, ensureSchema, getClient } from "@/lib/db";
import { deviceFamily, json, optionsResponse } from "@/lib/sync";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("family_code") ?? "").trim().toUpperCase();
  const token = (searchParams.get("device_token") ?? "").trim();
  if (!code || !token) {
    return json(400, { error: "missing family_code or device_token" });
  }
  if ((await deviceFamily(token)) !== code) {
    return json(403, { error: "invalid device token" });
  }
  await ensureSchema();
  const c = getClient();
  const res = await c.execute({
    sql: "SELECT code, state, version, updated_at FROM families WHERE code = ?",
    args: [code],
  });
  if (!res.rows.length) {
    return json(404, { error: "family not found" });
  }
  const row = res.rows[0];
  let state: unknown = {};
  try {
    state = JSON.parse(String(col(row, "state", 1) ?? "{}"));
  } catch {
    state = {};
  }
  return json(200, {
    ok: true,
    state,
    version: Number(col(row, "version", 2) ?? 0),
    updated_at: Number(col(row, "updated_at", 3) ?? 0),
  });
}
