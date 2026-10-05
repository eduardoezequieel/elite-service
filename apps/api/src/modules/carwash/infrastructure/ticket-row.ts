import type { Customer, Ticket, TicketWasher, WorkOrderStatus } from '@elite/shared';
import {
  StatusActorKind,
  WorkOrderEventKind,
  WorkOrderStatus as PrismaStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import {
  PAYMENT_BANK_ACCOUNT_SELECT,
  paymentDetailsOf,
} from '../../banking/infrastructure/bank-account-row';
import { decimalToCents, decimalToMilli } from '../../../common/prisma/decimal';
import { lastWashBefore } from '../../vehicles/domain/last-wash';
import { LAST_WASH_INCLUDE, toLastWashSource } from '../../vehicles/infrastructure/last-wash-row';
import type { StatusActor } from '../application/ports/ticket.repository';
import { toDecimalString } from '../domain/money';
import { lineTotal, totalOf } from '../domain/pricing';

/**
 * Como se lee un lavado de la base y como se escribe una fila de su historial.
 *
 * Vive aparte de los repositorios porque lo usan dos: el de tickets y el de
 * cuentas de cobro (059), que devuelve los lavados que acaba de cobrar. Si cada
 * uno armara su propio `Ticket`, el que sale del cobro y el que sale de la
 * lista dejarian de ser el mismo objeto.
 */

const AUTHORIZER = { select: { id: true, fullName: true } } as const;

export const TICKET_INCLUDE = {
  customer: true,
  vehicle: {
    include: {
      bodyType: true,
      owners: { where: { isCurrent: true }, include: { customer: true }, take: 1 },
      // Dos, no uno (052): el mas reciente no anulado de este carro suele ser
      // el ticket que se esta leyendo, y ese se descarta al mapear. Con `take:
      // 1` el «ultimo lavado» de un ticket abierto era el mismo, justo cuando
      // quien lava necesita la nota de la vez anterior. `include` trae los
      // escalares, asi que el `id` con el que se descarta ya viene.
      workOrders: {
        where: { status: { not: PrismaStatus.VOID } },
        orderBy: { createdAt: 'desc' },
        take: 2,
        include: LAST_WASH_INCLUDE,
      },
    },
  },
  bodyType: true,
  // El nombre de quien autorizo un precio viaja con la linea (060): solo `id` y
  // `fullName`, nunca el hash de contrasena ni los roles del usuario.
  items: { orderBy: { sortOrder: 'asc' }, include: { priceAuthorizedBy: AUTHORIZER } },
  openedBy: true,
  // Los pagos del lavado, con el nombre de quien cobro (053). Desde la 059 son
  // varios: uno por metodo de la cuenta, con la parte que le toco a este
  // lavado. La cuenta viene con los `workOrderId` de sus pagos porque de ahi
  // sale cuantos lavados la comparten, que es lo que decide si un reverso
  // suelto esta permitido (RN-8).
  payments: {
    include: {
      recordedBy: AUTHORIZER,
      // La cuenta de una transferencia (069), para la estampa del pago.
      bankAccount: PAYMENT_BANK_ACCOUNT_SELECT,
      charge: {
        include: {
          payments: { select: { workOrderId: true } },
          // La venta suelta de la misma cuenta (066): deshacer el cobro la anula.
          counterSale: { select: { id: true, number: true } },
        },
      },
    },
    orderBy: { paidAt: 'asc' },
  },
  assignments: { include: { employee: true }, orderBy: { assignedAt: 'asc' } },
  // Solo la ultima entrada a READY del historial de la 046: es de donde sale
  // `readyAt` (049). Viaja en el mismo `include` —no en una consulta por
  // ticket— porque la fila de hoy trae decenas de lavados y el tablero la pide
  // cada vez que el hilo SSE avisa.
  statusEvents: {
    where: { toStatus: PrismaStatus.READY, kind: WorkOrderEventKind.STATUS },
    orderBy: { occurredAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.WorkOrderInclude;

export type TicketRow = Prisma.WorkOrderGetPayload<{ include: typeof TICKET_INCLUDE }>;

function toWasher(employee: { id: string; username: string; fullName: string }): TicketWasher {
  return { id: employee.id, username: employee.username, fullName: employee.fullName };
}

function ownerOf(
  row: { id: string; fullName: string; phone: string | null } | undefined,
): Customer | null {
  if (row === undefined) return null;

  return { id: row.id, fullName: row.fullName, phone: row.phone };
}

/**
 * `unitPrice × quantity` de una linea, en centavos (065 RN-6). La cuenta es la
 * del dominio (`lineTotal`, mitad hacia arriba): el total que se lee y el que
 * congela la comision no pueden redondear distinto.
 */
function lineTotalOf(item: TicketRow['items'][number]): number {
  return lineTotal(decimalToCents(item.unitPrice), decimalToMilli(item.quantity));
}

export function toTicket(row: TicketRow): Ticket {
  const items = row.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    serviceId: item.serviceId,
    inventoryItemId: item.inventoryItemId,
    // Las columnas siguen llamandose `serviceCode` / `serviceName` (065): son
    // el snapshot de cualquier linea, servicio o producto.
    code: item.serviceCode,
    name: item.serviceName,
    serviceCode: item.serviceCode,
    serviceName: item.serviceName,
    catalogPrice: item.catalogPrice.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
    quantity: item.quantity.toFixed(3),
    total: toDecimalString(lineTotalOf(item)),
    sortOrder: item.sortOrder,
    // Firma del precio autorizado (060). Todo null = precio de catalogo, o
    // descuento hecho con el lavado abierto, que no pide autorizacion.
    priceAuthorizedBy:
      item.priceAuthorizedBy === null
        ? null
        : { id: item.priceAuthorizedBy.id, fullName: item.priceAuthorizedBy.fullName },
    priceAuthorizedAt: item.priceAuthorizedAt?.toISOString() ?? null,
    priceReason: item.priceReason,
    previousUnitPrice: item.previousUnitPrice === null ? null : item.previousUnitPrice.toFixed(2),
    comboId: item.comboId,
    comboName: item.comboName,
  }));

  // El total se recalcula al leer en vez de guardarse: una columna `total`
  // podria quedar desincronizada de sus lineas, y entonces RN-10 —que compara
  // el monto cobrado contra el total— estaria comparando contra una mentira.
  //
  // La suma pasa por centavos enteros, nunca por `number` decimal: es el motivo
  // de existir del modulo `money`.
  //
  // Cada linea entra con su total ya multiplicado por la cantidad (065 RN-6);
  // un servicio tiene cantidad 1 y queda igual que antes.
  const total = totalOf(
    row.items.map((item) => ({
      catalogPrice: decimalToCents(item.catalogPrice),
      unitPrice: decimalToCents(item.unitPrice),
      quantity: decimalToMilli(item.quantity),
    })),
  );

  const charge = row.payments.find((payment) => payment.charge !== null)?.charge ?? null;

  return {
    id: row.id,
    number: row.number,
    status: row.status as WorkOrderStatus,
    customer:
      row.customer === null
        ? null
        : {
            id: row.customer.id,
            fullName: row.customer.fullName,
            phone: row.customer.phone,
          },
    vehicle: {
      id: row.vehicle.id,
      plate: row.vehicle.plate,
      bodyType: {
        id: row.vehicle.bodyType.id,
        key: row.vehicle.bodyType.key,
        name: row.vehicle.bodyType.name,
        sortOrder: row.vehicle.bodyType.sortOrder,
      },
      make: row.vehicle.make,
      color: row.vehicle.color,
      isActive: row.vehicle.isActive,
      currentOwner: ownerOf(row.vehicle.owners[0]?.customer),
      lastWash: lastWashBefore(row.vehicle.workOrders.map(toLastWashSource), row.id),
    },
    bodyType: {
      id: row.bodyType.id,
      key: row.bodyType.key,
      name: row.bodyType.name,
      sortOrder: row.bodyType.sortOrder,
    },
    items,
    total: toDecimalString(total),
    washer: row.openedBy === null ? null : toWasher(row.openedBy),
    washers: row.assignments.map((assignment) => toWasher(assignment.employee)),
    commissionTotal: row.commissionTotal === null ? null : row.commissionTotal.toFixed(2),
    notes: row.notes,
    payments: row.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount.toFixed(2),
      paidAt: payment.paidAt.toISOString(),
      recordedBy: { id: payment.recordedBy.id, fullName: payment.recordedBy.fullName },
      ...paymentDetailsOf(payment),
    })),
    charge:
      charge === null
        ? null
        : {
            id: charge.id,
            number: charge.number,
            // Los pagos de la venta suelta no tienen lavado (065 RN-20): no cuentan.
            ticketCount: new Set(
              charge.payments.flatMap((payment) =>
                payment.workOrderId === null ? [] : [payment.workOrderId],
              ),
            ).size,
            total: charge.total.toFixed(2),
            cashTendered: charge.cashTendered === null ? null : charge.cashTendered.toFixed(2),
            changeGiven: charge.changeGiven === null ? null : charge.changeGiven.toFixed(2),
            counterSale: charge.counterSale,
          },
    washingStartedAt: row.washingStartedAt?.toISOString() ?? null,
    // El historial es de solo agregar: si el lavado volvio a la pista despues
    // de estar listo, `readyAt` sigue siendo la ultima vez que llego a READY, y
    // no se borra. `null` es «nunca llego» o «es anterior a la 046» (049).
    readyAt: row.statusEvents[0]?.occurredAt.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ACTOR_KINDS: Record<'user' | 'employee', StatusActorKind> = {
  user: StatusActorKind.USER,
  employee: StatusActorKind.EMPLOYEE,
};

/**
 * La fila del historial que acompana a un cambio de estado (046 RN-2).
 *
 * El nombre del actor se copia aca y no se vuelve a leer del usuario ni del
 * empleado: por eso la linea sobrevive a un renombre o a una baja (RN-4).
 */
export function statusEventData(
  workOrderId: string,
  fromStatus: WorkOrderStatus | null,
  toStatus: WorkOrderStatus,
  actor: StatusActor,
): Prisma.WorkOrderStatusEventUncheckedCreateInput {
  return {
    workOrderId,
    fromStatus: fromStatus === null ? null : (fromStatus as PrismaStatus),
    toStatus: toStatus as PrismaStatus,
    actorKind: actor === null ? null : ACTOR_KINDS[actor.kind],
    actorUserId: actor?.kind === 'user' ? actor.id : null,
    actorEmployeeId: actor?.kind === 'employee' ? actor.id : null,
    actorName: actor?.name ?? null,
  };
}
