import { isValidLicenseKey } from "@/lib/keys";
import { json, optionsResponse, parseJson } from "@/lib/sync";

export const runtime = "nodejs";

/** Tiny per-instance attempt bucket: 10 key tries per 10 minutes per IP. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const bucket = attempts.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > ATTEMPT_LIMIT;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: Request) {
  const data = parseJson(await req.text());
  const key = String(data.key ?? "").trim();
  if (!key) {
    return json(400, { error: "missing key" });
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) {
    return json(429, { error: "too many tries, wait a little and try again" });
  }
  if (!isValidLicenseKey(key)) {
    return json(403, { error: "invalid key" });
  }
  return json(200, { ok: true });
}
