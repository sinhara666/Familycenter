import { col, ensureSchema, getClient } from "@/lib/db";
import {
  MAX_STATE_BYTES,
  deviceFamily,
  json,
  nowSeconds,
  optionsResponse,
  parseJson,
} from "@/lib/sync";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: Request) {
  const data = parseJson(await req.text());
  const code = String(data.family_code ?? "").trim().toUpperCase();
  const token = String(data.device_token ?? "").trim();
  if (!code || !token) {
    return json(400, { error: "missing family_code or device_token" });
  }
  if (!("state" in data)) {
    return json(400, { error: "missing state" });
  }
  if ((await deviceFamily(token)) !== code) {
    return json(403, { error: "invalid device token" });
  }
  const payload = JSON.stringify(data.state);
  if (Buffer.byteLength(payload, "utf8") > MAX_STATE_BYTES) {
    return json(413, { error: "state too large" });
  }
  await ensureSchema();
  const c = getClient();
  await c.execute({
    sql: "UPDATE families SET state = ?, version = version + 1, updated_at = ? WHERE code = ?",
    args: [payload, nowSeconds(), code],
  });
  const res = await c.execute({
    sql: "SELECT version FROM families WHERE code = ?",
    args: [code],
  });
  if (!res.rows.length) {
    return json(404, { error: "family not found" });
  }
  return json(200, {
    ok: true,
    version: Number(col(res.rows[0], "version", 0) ?? 0),
  });
}
