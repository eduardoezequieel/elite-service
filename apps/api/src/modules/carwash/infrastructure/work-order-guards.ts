import type { WorkOrderStatus } from '@elite/shared';
import { WorkOrderStatus as PrismaStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { uniqueViolationOnIndex } from '../../../common/prisma/unique-violation';
import type { UnchargedWash } from '../application/ports/ticket.repository';

/**
 * Los frenos del ciclo del lavado en la base (090).
 *
 * El caso de uso ya valida con lo que leyo; esto es lo que vale cuando dos
 * pantallas escriben a la vez sobre el mismo lavado o el mismo carro.
 */

/** El unico parcial de la migracion: un lavado sin cobrar por carro (RN-1). */
const ONE_ACTIVE_PER_VEHICLE_INDEX = 'work_orders_one_active_per_vehicle';

/** Los estados que ocupan al carro. Los mismos del indice. */
export const UNCHARGED_STATUSES = [
  PrismaStatus.OPEN,
  PrismaStatus.WASHING,
  PrismaStatus.READY,
] as const;

/** `true` si el error es el indice de un lavado sin cobrar por carro. */
export function isVehicleBusyViolation(error: unknown): boolean {
  return uniqueViolationOnIndex(error, ONE_ACTIVE_PER_VEHICLE_INDEX);
}

/**
 * Bloquea varios lavados y devuelve el estado de cada uno. En orden de id: dos
 * cobros con los mismos lavados los piden igual y no se cruzan (RN-2).
 */
export async function lockWorkOrders(
  tx: Prisma.TransactionClient,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const sorted = [...new Set(ids)].sort();
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id::text AS id, status::text AS status FROM work_orders
    WHERE id = ANY(${sorted}::uuid[])
    ORDER BY id
    FOR UPDATE
  `;

  return new Map(rows.map((row) => [row.id, row.status]));
}

/** El lavado sin cobrar de ese carro que no sea uno de `exceptIds`, o `null`. */
export async function unchargedWashOf(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  exceptIds: readonly string[] = [],
): Promise<UnchargedWash | null> {
  const row = await tx.workOrder.findFirst({
    where: {
      vehicleId,
      status: { in: [...UNCHARGED_STATUSES] },
      id: { notIn: [...exceptIds] },
    },
    select: { id: true, number: true, status: true, vehicle: { select: { plate: true } } },
  });

  return row === null
    ? null
    : {
        id: row.id,
        number: row.number,
        plate: row.vehicle.plate,
        status: row.status as WorkOrderStatus,
      };
}
