import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prismaWithRetry } from "../../../../../lib/prisma-retry";

type RouteParams = {
  params: {
    id: string;
  };
};

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

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Identificador inválido.");
  }
  return id;
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

export async function GET(_request: Request, context: RouteParams) {
  const companyId = parseId(context.params.id);

  const entries = await prismaWithRetry((client) =>
    client.cashEntry.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
    }),
  );

  return NextResponse.json(entries.map(formatEntry));
}

export async function POST(request: Request, context: RouteParams) {
  const companyId = parseId(context.params.id);
  const payload = (await request.json()) as CreateEntryPayload;

  const errors: string[] = [];

  const rawDate = typeof payload.date === "string" ? payload.date : undefined;
  const rawAmount = typeof payload.amount === "string" || typeof payload.amount === "number" ? payload.amount : undefined;
  const counterpart = typeof payload.counterpart === "string" ? payload.counterpart.trim() : "";
  const productService = typeof payload.productService === "string" ? payload.productService.trim() : "";
  const movement = typeof payload.movement === "string" ? payload.movement.toUpperCase().trim() : "";
  const type = typeof payload.type === "string" ? payload.type.toUpperCase().trim() : "";
  const paymentMethod = typeof payload.paymentMethod === "string" ? payload.paymentMethod.trim() : "";
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

  if (!paymentMethod) {
    errors.push("Informe a forma de pagamento.");
  }

  const amountNumber =
    typeof rawAmount === "string" ? Number(rawAmount.replace(/\./g, "").replace(",", ".")) : typeof rawAmount === "number" ? rawAmount : NaN;

  if (!Number.isFinite(amountNumber) || amountNumber === 0) {
    errors.push("Informe um valor válido.");
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

  try {
    const entry = await prismaWithRetry((client) =>
      client.cashEntry.create({
        data: {
          companyId,
          date: parsedDate!,
          counterpart,
          productService,
          movement: movement as any,
          type: type as any,
          paymentMethod,
          amount: new Prisma.Decimal(amountNumber),
          notes,
        },
      }),
    );

    return NextResponse.json(formatEntry(entry), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    console.error("[POST /api/clients/:id/cash-entries]", error);
    return NextResponse.json({ error: "Não foi possível registrar o lançamento." }, { status: 500 });
  }
}
