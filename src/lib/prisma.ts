import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const logLevels: ("query" | "error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"];

function createPrismaClient() {
  return new PrismaClient({ log: logLevels });
}

let prisma: PrismaClient | undefined = globalForPrisma.prisma;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prisma;
    }
  }

  return prisma;
}

export async function resetPrismaClient(): Promise<PrismaClient> {
  if (prisma) {
    await prisma.$disconnect();
  }

  prisma = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}
