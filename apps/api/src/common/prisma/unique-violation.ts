import { Prisma } from '@prisma/client';

/** Que campo unico choco en un P2002, segun lo que Prisma deja en `meta`. */
export function uniqueViolationOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  return JSON.stringify(error.meta ?? {}).includes(field);
}
