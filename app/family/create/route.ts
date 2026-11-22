import {
  createFamily,
  json,
  optionsResponse,
  parseJson,
} from "@/lib/sync";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: Request) {
  const data = parseJson(await req.text());
  const deviceName =
    String(data.device_name ?? "").trim() || "First device";
  try {
    const created = await createFamily(deviceName);
    if (!created) {
      return json(500, { error: "could not create family" });
    }
    return json(200, {
      ok: true,
      family_code: created.code,
      device_token: created.token,
      state: {},
      version: 0,
    });
  } catch (err) {
    console.error("create failed:", err);
    return json(500, { error: "could not create family" });
  }
}
