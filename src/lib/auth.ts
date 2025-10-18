import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(plain: string): string {
  if (!plain) {
    throw new Error("Senha vazia não é permitida.");
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(plain, salt, KEY_LENGTH);

  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

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
