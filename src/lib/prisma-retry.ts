import { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma, resetPrismaClient } from "./prisma";

const CACHED_PLAN_FRAGMENT = "cached plan must not change result type";

function isCachedPlanError(error: unknown): error is Prisma.PrismaClientUnknownRequestError {
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    typeof error.message === "string" &&
    error.message.includes(CACHED_PLAN_FRAGMENT)
  );
}

/**
 * Wrap Prisma operations to recover automatically from the
 * "cached plan must not change result type" error that can happen
 * após alterações no schema durante o desenvolvimento.
 */
export async function prismaWithRetry<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
  const client = getPrisma();
  try {
    return await operation(client);
  } catch (error) {
    if (!isCachedPlanError(error)) {
      throw error;
    }

    try {
      await client.$executeRawUnsafe("DISCARD ALL");
      return await operation(client);
    } catch (discardError) {
      console.warn("[prismaWithRetry] Falha ao descartar planos em cache ou nova tentativa malsucedida:", discardError);
      const refreshedClient = await resetPrismaClient();
      return operation(refreshedClient);
    }
  }
}
