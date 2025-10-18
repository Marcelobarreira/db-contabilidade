import { NextResponse } from "next/server";
import { Prisma, MovementCategory, ActivityType } from "@prisma/client";
import { prismaWithRetry } from "../../../../../../lib/prisma-retry";
import { normalizeCurrencyToNumber } from "../../../../../../lib/currency";

type RouteParams = {
  params: {
    id: string;
    entryId: string;
  };
};

type UpdateEntryPayload = {
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

export async function PATCH(request: Request, context: RouteParams) {
  const companyId = parseId(context.params.id);
  const entryId = parseId(context.params.entryId);

  const payload = (await request.json()) as UpdateEntryPayload;

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
    errors.push("Informe o cliente ou fornecedor.");
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
      client.cashEntry.update({
        where: {
          id: entryId,
          companyId,
        },
        data: {
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

    return NextResponse.json(formatEntry(entry));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    }

    console.error("[PATCH /api/clients/:id/cash-entries/:entryId]", error);
    return NextResponse.json({ error: "Não foi possível atualizar o lançamento." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  const companyId = parseId(context.params.id);
  const entryId = parseId(context.params.entryId);

  try {
    await prismaWithRetry((client) =>
      client.cashEntry.delete({
        where: {
          id: entryId,
          companyId,
        },
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    }

    console.error("[DELETE /api/clients/:id/cash-entries/:entryId]", error);
    return NextResponse.json({ error: "Não foi possível excluir o lançamento." }, { status: 500 });
  }
}
