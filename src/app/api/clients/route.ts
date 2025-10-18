import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prismaWithRetry } from "../../../lib/prisma-retry";

type CreateClientPayload = {
  name?: unknown;
  email?: unknown;
  cnpj?: unknown;
};

const emailRegex =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function normalizeCnpj(raw: string) {
  return raw.replace(/\D/g, "");
}

function formatCnpj(raw: string) {
  const digits = normalizeCnpj(raw);
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

export async function GET() {
  const clients = await prismaWithRetry((client) =>
    client.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        cnpj: true,
        createdAt: true,
      },
    }),
  );

  return NextResponse.json(
    clients.map((client) => ({
      ...client,
      cnpj: formatCnpj(client.cnpj),
    })),
  );
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateClientPayload;
  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  const rawEmail = typeof payload.email === "string" ? payload.email.trim() : "";
  const rawCnpj = typeof payload.cnpj === "string" ? payload.cnpj.trim() : "";

  if (!rawName || rawName.length < 2) {
    return NextResponse.json(
      { error: "Informe o nome do cliente." },
      { status: 400 },
    );
  }

  if (!emailRegex.test(rawEmail)) {
    return NextResponse.json(
      { error: "E-mail inválido." },
      { status: 400 },
    );
  }

  const normalizedCnpj = normalizeCnpj(rawCnpj);

  if (normalizedCnpj.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ deve conter 14 dígitos." },
      { status: 400 },
    );
  }

  try {
    const client = await prismaWithRetry((db) =>
      db.company.create({
        data: {
          name: rawName,
          email: rawEmail.toLowerCase(),
          cnpj: normalizedCnpj,
        },
        select: {
          id: true,
          name: true,
          email: true,
          cnpj: true,
          createdAt: true,
        },
      }),
    );

    return NextResponse.json(
      { ...client, cnpj: formatCnpj(client.cnpj) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targetMeta = error.meta?.target;
      const targets = Array.isArray(targetMeta)
        ? targetMeta.map(String)
        : typeof targetMeta === "string"
          ? [targetMeta]
          : [];

      const message = targets.some((field) => field.includes("email"))
        ? "Já existe um cliente com este e-mail."
        : targets.some((field) => field.includes("cnpj"))
          ? "Já existe um cliente com este CNPJ."
          : targets.some((field) => field.includes("name"))
            ? "Já existe um cliente com este nome."
            : "Cliente duplicado.";

      return NextResponse.json(
        { error: message },
        { status: 409 },
      );
    }

    console.error("[POST /api/clients]", error);
    return NextResponse.json(
      { error: "Não foi possível criar o cliente." },
      { status: 500 },
    );
  }
}
