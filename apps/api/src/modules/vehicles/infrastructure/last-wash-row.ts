import type { Prisma } from '@prisma/client';

import type { LastWashSource } from '../domain/last-wash';

/**
 * Lo que hay que traer del ticket anterior para armar el `lastWash` del
 * contrato (057): **todas** sus líneas en el orden en que se cobraron, el pago
 * y quiénes lo lavaron.
 *
 * Vive acá y no dentro de cada repositorio porque el lookup de placa y el
 * ticket leen el mismo bloque: si uno trajera una línea sola, la ficha «Ya lo
 * conocemos» mostraría medio desglose según de dónde viniera.
 *
 * Del empleado y del pago se seleccionan columnas, no la fila entera: por ahí
 * viajarían el `pinHash` del lavador y el turno de caja del cobro, que la ficha
 * no necesita.
 */
export const LAST_WASH_INCLUDE = {
  items: { orderBy: { sortOrder: 'asc' } },
  payment: { select: { method: true, paidAt: true } },
  assignments: {
    orderBy: { assignedAt: 'asc' },
    select: { employee: { select: { fullName: true } } },
  },
} satisfies Prisma.WorkOrderInclude;

export type LastWashRow = Prisma.WorkOrderGetPayload<{ include: typeof LAST_WASH_INCLUDE }>;

/** Traduce la fila de Prisma al candidato puro que consume `lastWashOf`. */
export function toLastWashSource(row: LastWashRow): LastWashSource {
  return {
    id: row.id,
    number: row.number,
    createdAt: row.createdAt,
    notes: row.notes,
    items: row.items.map((item) => ({
      serviceName: item.serviceName,
      // `Decimal` se serializa acá, en el borde: el dominio solo ve cadenas.
      unitPrice: item.unitPrice.toFixed(2),
    })),
    washers: row.assignments.map((assignment) => ({ fullName: assignment.employee.fullName })),
    payment:
      row.payment === null ? null : { method: row.payment.method, paidAt: row.payment.paidAt },
  };
}
