import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Strict server-only module guard
if (typeof window !== "undefined") {
  throw new Error("recoveryCodes helper cannot be imported in browser bundles.");
}

// 32-character unambiguous uppercase alphabet (omits 0, O, 1, I) -> 80 bits entropy per 16-char code
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 6;
export const INTERNAL_EMAIL_DOMAIN = "users.miora.invalid";

export interface GeneratedRecoveryCode {
  plainCode: string; // Formatted XXXX-XXXX-XXXX-XXXX, shown ONCE to user
  salt: string;      // 32-char hex (128-bit random salt)
  hash: string;      // 64-char hex SHA-256(salt + ":" + normalizedCode)
}

export function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(normalizedCode: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt}:${normalizedCode}`, "utf8")
    .digest("hex");
}

export function verifyRecoveryCodeHash(
  rawInput: string,
  storedSalt: string,
  storedHashHex: string
): boolean {
  const normalized = normalizeRecoveryCode(rawInput);
  if (normalized.length < 8 || storedHashHex.length !== 64) {
    return false;
  }
  const computedHex = hashRecoveryCode(normalized, storedSalt);
  try {
    return timingSafeEqual(
      Buffer.from(computedHex, "hex"),
      Buffer.from(storedHashHex, "hex")
    );
  } catch {
    return false;
  }
}

export function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT
): GeneratedRecoveryCode[] {
  const results: GeneratedRecoveryCode[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(16);
    let raw = "";
    for (let j = 0; j < 16; j++) {
      raw += CODE_ALPHABET[bytes[j] & 31];
    }
    const plainCode = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
    const salt = randomBytes(16).toString("hex");
    const hash = hashRecoveryCode(raw, salt);
    results.push({ plainCode, salt, hash });
  }
  return results;
}

/**
 * Generates a unique, non-routable RFC 2606 internal email identity for Supabase Auth
 * decoupled from the mutable `profiles.username` column so username edits never collide.
 */
export function generateInternalAuthEmail(): string {
  const id = randomBytes(12).toString("hex");
  return `u_${id}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}
