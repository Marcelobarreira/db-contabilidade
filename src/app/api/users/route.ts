import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prismaWithRetry } from "../../../lib/prisma-retry";
import { hashPassword } from "../../../lib/auth";

type CreateUserPayload = {
  email?: unknown;
  cnpj?: unknown;
  temporaryPassword?: unknown;
  admin?: unknown;
};

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function normalizeCnpj(raw: string) {
  return raw.replace(/\D/g, "");
}

function formatCnpj(raw: string) {
  const digits = normalizeCnpj(raw);
  if (digits.length !== 14) {
    return raw;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateUserPayload;

  const rawEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const rawCnpj = typeof payload.cnpj === "string" ? payload.cnpj.trim() : "";
  const temporaryPassword = typeof payload.temporaryPassword === "string" ? payload.temporaryPassword.trim() : "";
  const isAdmin = typeof payload.admin === "boolean" ? payload.admin : payload.admin === "true";

  if (!rawEmail || !emailRegex.test(rawEmail)) {
    return NextResponse.json({ error: "Informe um e-mail valido." }, { status: 400 });
  }

  if (!temporaryPassword || temporaryPassword.length < 6) {
    return NextResponse.json({ error: "Defina uma senha temporaria com pelo menos 6 caracteres." }, { status: 400 });
  }

  let companyId: number | null = null;
  let companySummary: { id: number; name: string; cnpj: string } | null = null;

  if (!isAdmin) {
    const normalizedCnpj = normalizeCnpj(rawCnpj);
    if (normalizedCnpj.length !== 14) {
      return NextResponse.json({ error: "Informe um CNPJ com 14 digitos." }, { status: 400 });
    }

    const company = await prismaWithRetry((client) =>
      client.company.findUnique({
        where: { cnpj: normalizedCnpj },
        select: { id: true, name: true, cnpj: true },
      }),
    );

    if (!company) {
      return NextResponse.json({ error: "Nenhum cliente encontrado para este CNPJ." }, { status: 404 });
    }

    companyId = company.id;
    companySummary = company;
  }

  try {
    const hashedPassword = hashPassword(temporaryPassword);

    const user = await prismaWithRetry((client) =>
      client.user.create({
        data: {
          email: rawEmail,
          password: hashedPassword,
          admin: isAdmin,
          mustChangePassword: true,
          passwordResetToken: null,
          companyId,
        },
        select: {
          id: true,
          email: true,
          admin: true,
          mustChangePassword: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              name: true,
              cnpj: true,
            },
          },
        },
      }),
    );

    return NextResponse.json(
      {
        ...user,
        company: user.company ? { ...user.company, cnpj: formatCnpj(user.company.cnpj) } : companySummary,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ja existe um usuario cadastrado com este e-mail." }, { status: 409 });
    }

    console.error("[POST /api/users]", error);
    return NextResponse.json({ error: "Nao foi possivel criar o usuario." }, { status: 500 });
  }
}