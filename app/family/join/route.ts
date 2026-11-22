import { col, ensureSchema, getClient } from "@/lib/db";
import {
  json,
  optionsResponse,
  parseJson,
  registerDevice,
} from "@/lib/sync";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: Request) {
  const data = parseJson(await req.text());
  const code = String(data.family_code ?? "").trim().toUpperCase();
  const deviceName = String(data.device_name ?? "").trim() || "Device";
  if (!code) {
    return json(400, { error: "missing family_code" });
  }
  await ensureSchema();
  const c = getClient();
  const res = await c.execute({
    sql: "SELECT code, state, version FROM families WHERE code = ?",
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
  const token = await registerDevice(code, deviceName);
  return json(200, {
    ok: true,
    family_code: code,
    device_token: token,
    state,
    version: Number(col(row, "version", 2) ?? 0),
  });
}
