import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/definir-senha", "/solicitar-acesso"]);
const AUTH_PATH_PREFIXES = ["/admin", "/dashboard"];
const API_PROTECTED_PREFIXES = ["/api/clients", "/api/importar-extrato"];
const SESSION_COOKIE_NAME = "dbcont_session";

function isProtectedPath(pathname: string) {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApi(pathname: string) {
  return API_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function decodeSession(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const json = decodeBase64Url(encoded);
  const expectedSignature = await signPayload(json);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = JSON.parse(json) as {
    userId: string;
    admin: boolean;
    companyId: number | null;
    exp: number;
  };

  if (Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function signPayload(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado nas variáveis de ambiente.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bufferToHex(signatureBuffer);
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = token ? await decodeSession(token) : null;

  if (session) {
    if (pathname === "/") {
      const destination = session.admin ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  } else {
    if (!PUBLIC_PATHS.has(pathname) && (isProtectedPath(pathname) || isProtectedApi(pathname))) {
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (session && pathname.startsWith("/admin") && !session.admin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session && pathname.startsWith("/dashboard") && session.admin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
