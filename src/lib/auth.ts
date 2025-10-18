import crypto from "node:crypto";

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");

  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");

  const derivedKey = crypto.scryptSync(plain, salt, storedHash.length);

  return crypto.timingSafeEqual(storedHash, derivedKey);
}
