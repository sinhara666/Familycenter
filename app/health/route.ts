import { json, optionsResponse } from "@/lib/sync";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return json(200, { ok: true });
}
