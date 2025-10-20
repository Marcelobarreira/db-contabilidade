import { cookies } from "next/headers";
import { createHmac } from "crypto";

export const SESSION_COOKIE_NAME = "dbcont_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

type SessionPayload = {
  userId: string;
  admin: boolean;
  companyId: number | null;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "local-development-secret";
    }
    throw new Error("AUTH_SECRET não configurado nas variáveis de ambiente.");
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function encodeSession(data: SessionPayload): string {
  const json = JSON.stringify(data);
  const signature = signPayload(json);
  const base = Buffer.from(json).toString("base64url");
  return `${base}.${signature}`;
}

export function decodeSessionToken(value: string): SessionPayload | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    return null;
  }
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  const expectedSignature = signPayload(json);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }
  const payload = JSON.parse(json) as SessionPayload;
  if (Date.now() > payload.exp) {
    return null;
  }
  return payload;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createSessionCookie(data: {
  userId: string;
  admin: boolean;
  companyId: number | null;
}) {
  const payload: SessionPayload = {
    userId: data.userId,
    admin: data.admin,
    companyId: data.companyId,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const token = encodeSession(payload);
  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return payload;
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return decodeSessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Sessão inválida.");
  }
  return session;
}
