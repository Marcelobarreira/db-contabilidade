import { NextRequest, NextResponse } from "next/server";
import { MovementCategory } from "@prisma/client";
import { decodeSessionToken, SESSION_COOKIE_NAME } from "../../../lib/session";

type PaymentMethod =
  | "PIX"
  | "DINHEIRO"
  | "BOLETO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "CHEQUE"
  | "OUTROS";

type ParsedTransaction = {
  date: string;
  amount: number;
  description: string;
  reference: string;
  counterpart: string;
  productService: string;
  paymentMethod: PaymentMethod;
  movement: MovementCategory;
  raw: Record<string, unknown>;
};

type ParsedExtract = {
  filename: string;
  format: "csv" | "ofx";
  currency?: string;
  account?: {
    bankId?: string;
    branchId?: string;
    accountId?: string;
    type?: string;
  };
  transactions: ParsedTransaction[];
};

const CSV_EXTENSIONS = new Set([".csv"]);
const OFX_EXTENSIONS = new Set([".ofx"]);

function normalizeExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

function decodeLatin1(buffer: Buffer) {
  return new TextDecoder("latin1").decode(buffer);
}

function decodeUtf8(buffer: Buffer) {
  return new TextDecoder("utf-8").decode(buffer);
}

function normalizeWhitespaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripObfuscation(value: string) {
  return value.replace(/[•*]/g, "").trim();
}

function normalizeAmount(value: string) {
  const trimmed = value.replace(/\s/g, "");
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let sanitized = trimmed;

  if (hasComma && hasDot) {
    if (trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")) {
      sanitized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      sanitized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    sanitized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    sanitized = trimmed.replace(/,/g, "");
  }

  return Number(sanitized);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractCounterpart(description: string) {
  const cleaned = stripObfuscation(normalizeWhitespaces(description));
  const parts = cleaned.split(" - ").map((part) => part.trim()).filter(Boolean);
  const candidate = parts.find((part, index) => index > 0 && /[a-zA-ZÀ-ÿ]/.test(part) && !/\d{3}\.\d{3}/.test(part));
  if (candidate) {
    return stripObfuscation(candidate).replace(/[^\p{L}\s'.-]/gu, "").trim();
  }
  if (parts.length > 1) {
    return stripObfuscation(parts[1]).replace(/[^\p{L}\s'.-]/gu, "").trim();
  }
  return cleaned.slice(0, 80) || "Nao identificado";
}

function inferPaymentMethod(description: string): PaymentMethod {
  const normalized = normalizeText(description);
  if (normalized.includes("pix")) {
    return "PIX";
  }
  if (normalized.includes("boleto")) {
    return "BOLETO";
  }
  if (normalized.includes("credito")) {
    return "CARTAO_CREDITO";
  }
  if (normalized.includes("debito")) {
    return "CARTAO_DEBITO";
  }
  if (normalized.includes("cheque")) {
    return "CHEQUE";
  }
  if (normalized.includes("dinheiro") || normalized.includes("saque")) {
    return "DINHEIRO";
  }
  return "OUTROS";
}

function parseCsv(buffer: Buffer, filename: string): ParsedExtract {
  const text = decodeLatin1(buffer);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("Arquivo CSV sem conteudo suficiente.");
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("data");
  const valueIdx = header.indexOf("valor");
  const idIdx = header.indexOf("identificador");
  const descriptionIdx = header.findIndex((h) => h.startsWith("descri"));

  if (dateIdx === -1 || valueIdx === -1 || idIdx === -1 || descriptionIdx === -1) {
    throw new Error("Cabecalho do CSV invalido ou fora do padrao esperado.");
  }

  const transactions: ParsedTransaction[] = lines.slice(1).map((line, index) => {
    const columns = line.split(",").map((c) => c.trim());
    const rawDate = columns[dateIdx];
    const [day, month, year] = rawDate.split("/");
    const isoDate = `${year}-${month}-${day}`;
    const amount = normalizeAmount(columns[valueIdx]);
    const description = normalizeWhitespaces(columns[descriptionIdx]);
    const counterpart = extractCounterpart(description);
    const paymentMethod = inferPaymentMethod(description);
    const productService = "Nao identificado (NI)";
    const reference = columns[idIdx];

    return {
      date: isoDate,
      amount,
      description,
      reference,
      counterpart,
      productService,
      paymentMethod,
      movement: amount >= 0 ? "RECEITA" : "DESPESA",
      raw: {
        originalLineNumber: index + 2,
        date: rawDate,
        amountRaw: columns[valueIdx],
        description,
        reference,
      },
    };
  });

  return {
    filename,
    format: "csv",
    currency: "BRL",
    transactions,
  };
}

function extractTag(text: string, tag: string) {
  const regex = new RegExp(`<${tag}>([^<]+)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : undefined;
}

function parseOfx(buffer: Buffer, filename: string): ParsedExtract {
  const text = decodeUtf8(buffer);
  const accountSectionMatch = text.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i);
  const transactionsSectionMatch = text.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i);

  if (!transactionsSectionMatch) {
    throw new Error("Arquivo OFX invalido: transacoes nao encontradas.");
  }

  const account = accountSectionMatch
    ? {
        bankId: extractTag(accountSectionMatch[1], "BANKID"),
        branchId: extractTag(accountSectionMatch[1], "BRANCHID"),
        accountId: extractTag(accountSectionMatch[1], "ACCTID"),
        type: extractTag(accountSectionMatch[1], "ACCTTYPE"),
      }
    : undefined;

  const currency = extractTag(text, "CURDEF") ?? "BRL";

  const transactions: ParsedTransaction[] = [];
  const stmtRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = stmtRegex.exec(transactionsSectionMatch[1])) !== null) {
    const block = match[1];
    const posted = extractTag(block, "DTPOSTED") ?? "";
    const amountRaw = extractTag(block, "TRNAMT") ?? "0";
    const memo = extractTag(block, "MEMO") ?? "";
    const fitid = extractTag(block, "FITID") ?? "";

    const dateIso = (() => {
      const digits = posted.replace(/\D/g, "");
      if (digits.length >= 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
      return "";
    })();

    const amount = normalizeAmount(amountRaw);
    const description = normalizeWhitespaces(memo);
    const counterpart = extractCounterpart(description);
    const paymentMethod = inferPaymentMethod(description);
    const productService = "Nao identificado (NI)";

    transactions.push({
      date: dateIso,
      amount,
      description,
      reference: fitid,
      counterpart,
      productService,
      paymentMethod,
      movement: amount >= 0 ? "RECEITA" : "DESPESA",
      raw: {
        posted,
        amountRaw,
        memo: description,
        fitid,
        type: extractTag(block, "TRNTYPE"),
      },
    });
  }

  if (transactions.length === 0) {
    throw new Error("Nenhuma transacao encontrada no arquivo OFX.");
  }

  return {
    filename,
    format: "ofx",
    currency,
    account,
    transactions,
  };
}

function detectFormat(file: File, buffer: Buffer): "csv" | "ofx" | "pdf" | null {
  const name = file.name ?? "upload";
  const extension = normalizeExtension(name);

  if (CSV_EXTENSIONS.has(extension)) {
    return "csv";
  }

  if (OFX_EXTENSIONS.has(extension)) {
    return "ofx";
  }

  const contentType = file.type.toLowerCase();
  if (contentType.includes("csv")) {
    return "csv";
  }
  if (contentType.includes("ofx")) {
    return "ofx";
  }
  if (contentType.includes("pdf") || extension === ".pdf") {
    return "pdf";
  }

  const snippet = buffer.slice(0, 32).toString("utf-8");
  if (snippet.trimStart().toUpperCase().startsWith("OFXHEADER")) {
    return "ofx";
  }
  if (snippet.includes(",") && snippet.toLowerCase().includes("data")) {
    return "csv";
  }

  return null;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' e obrigatorio." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const format = detectFormat(file, buffer);

  if (!format) {
    return NextResponse.json({ error: "Formato de arquivo nao suportado." }, { status: 400 });
  }

  if (format === "pdf") {
    return NextResponse.json(
      { error: "Importacao de PDF ainda nao esta disponivel. Utilize arquivos CSV ou OFX." },
      { status: 422 },
    );
  }

  try {
    const parsed: ParsedExtract = format === "csv" ? parseCsv(buffer, file.name) : parseOfx(buffer, file.name);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[POST /api/importar-extrato]", error);
    return NextResponse.json(
      { error: "Falha ao processar o arquivo. Verifique o formato e tente novamente." },
      { status: 422 },
    );
  }
}
