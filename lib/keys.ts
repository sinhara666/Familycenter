import { hashToken } from "@/lib/sync";

/**
 * License keys, one per buying family. Only SHA-256 hashes live here,
 * never a plaintext key. To issue a new family a key: generate the key,
 * hash its canonical form (uppercase, dashes removed) with sha256, and
 * append the hex hash below. The buyer types the key once per device;
 * the board file checks it against /family/key-check and then works
 * offline on that device.
 */
const LICENSE_KEY_HASHES: ReadonlySet<string> = new Set([
  // TC Lace family, issued 2026-11-22.
  "fd3b5ee320e1e67151526c969f345b0a2506cb8a2f0bb61976b7a24ef216d200",
]);

export function canonicalKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidLicenseKey(raw: string): boolean {
  const canon = canonicalKey(raw);
  if (canon.length < 8) return false;
  return LICENSE_KEY_HASHES.has(hashToken(canon));
}
