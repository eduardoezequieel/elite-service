import type { Prisma } from '@prisma/client';

import { CashSessionGoneError } from '../application/ports/rental-cash-session.repository';

/**
 * El único punto que ata un cobro de renta al turno OPEN (109).
 * Lo usan el checkout y el checkin, y también `POST /payments`.
 * Sin turno, lanza `CashSessionGoneError` para que el caso de uso
 * responda 409 `CASH_NOT_OPEN`.
 */
export async function requireOpenRentalCashSession(tx: Prisma.TransactionClient): Promise<string> {
  const open = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM rental_cash_sessions WHERE status = 'OPEN' FOR UPDATE
  `;
  const id = open[0]?.id;

  if (id === undefined) throw new CashSessionGoneError();

  return id;
}
