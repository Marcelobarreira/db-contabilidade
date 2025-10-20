import { NextResponse, type NextRequest } from "next/server";
import { Prisma, MovementCategory, ActivityType } from "@prisma/client";
import { prismaWithRetry } from "../../../../../lib/prisma-retry";
import { normalizeCurrencyToNumber } from "../../../../../lib/currency";

type CreateEntryPayload = {
  date?: unknown;
  counterpart?: unknown;
  productService?: unknown;
  movement?: unknown;
  type?: unknown;
  paymentMethod?: unknown;
  amount?: unknown;
  notes?: unknown;
};

const VALID_MOVEMENTS = new Set(["RECEITA", "COMPRA", "DESPESA", "RETIRADA"]);
const VALID_TYPES = new Set(["COMERCIO", "INDUSTRIA", "SERVICO", "TRANSPORTE"]);
const VALID_PAYMENTS = new Set([
  "PIX",
  "DINHEIRO",
  "BOLETO",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "CHEQUE",
  "OUTROS",
]);

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Identificador inválido.");
  }
  return id;
}

function normalizePayment(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatEntry(entry: {
  id: number;
  companyId: number;
  date: Date;
  counterpart: string;
  productService: string;
  movement: string;
  type: string;
  paymentMethod: string;
  amount: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...entry,
    amount: Number(entry.amount),
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const companyId = parseId(params.id);

  const entries = await prismaWithRetry((client) =>
    client.cashEntry.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
    }),
  );

  return NextResponse.json(entries.map(formatEntry));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const companyId = parseId(params.id);
  const payload = (await request.json()) as CreateEntryPayload;

  const errors: string[] = [];

  const rawDate = typeof payload.date === "string" ? payload.date : "";
  const rawAmount = payload.amount;
  const counterpart = typeof payload.counterpart === "string" ? payload.counterpart.trim() : "";
  const productService = typeof payload.productService === "string" ? payload.productService.trim() : "";
  const movement = typeof payload.movement === "string" ? payload.movement.toUpperCase().trim() : "";
  const type = typeof payload.type === "string" ? payload.type.toUpperCase().trim() : "";
  const paymentMethod = typeof payload.paymentMethod === "string" ? normalizePayment(payload.paymentMethod) : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : undefined;

  if (!rawDate) {
    errors.push("Informe a data do lançamento.");
  }
  if (!counterpart) {
    errors.push("Informe a empresa ou fornecedor.");
  }
  if (!productService) {
    errors.push("Informe o produto ou serviço.");
  }
  if (!VALID_MOVEMENTS.has(movement)) {
    errors.push("Selecione uma movimentação válida.");
  }
  if (!VALID_TYPES.has(type)) {
    errors.push("Selecione um tipo válido.");
  }
  if (!VALID_PAYMENTS.has(paymentMethod)) {
    errors.push("Selecione uma forma de pagamento válida.");
  }

  const amountNumber = normalizeCurrencyToNumber(rawAmount);
  if (!Number.isFinite(amountNumber) || amountNumber === 0) {
    errors.push("Informe um valor válido diferente de zero.");
  }

  let parsedDate: Date | null = null;
  if (rawDate) {
    const testDate = new Date(rawDate);
    if (Number.isNaN(testDate.getTime())) {
      errors.push("Data inválida.");
    } else {
      parsedDate = testDate;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const movementValue = movement as MovementCategory;
  const typeValue = type as ActivityType;

  try {
    const entry = await prismaWithRetry((client) =>
      client.cashEntry.create({
        data: {
          companyId,
          date: parsedDate!,
          counterpart,
          productService,
          movement: movementValue,
          type: typeValue,
          paymentMethod,
          amount: new Prisma.Decimal(amountNumber),
          notes,
        },
      }),
    );

    return NextResponse.json(formatEntry(entry), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    console.error("[POST /api/clients/:id/cash-entries]", error);
    return NextResponse.json({ error: "Não foi possível registrar o lançamento." }, { status: 500 });
  }
}
