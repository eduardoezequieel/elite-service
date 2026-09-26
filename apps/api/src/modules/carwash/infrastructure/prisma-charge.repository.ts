import type {
  Charge,
  ChargePayment,
  InventoryLowStockPayload,
  PaymentMethod,
  Ticket,
  WorkOrderStatus,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { WorkOrderStatus as PrismaStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { fromQuantityString } from '../../inventory/domain/stock';
import { saleLineTotal } from '../../sales/domain/counter-sale';
import {
  voidCounterSaleOfCharge,
  writeCounterSale,
} from '../../sales/infrastructure/counter-sale-ledger';
import { CashSessionGoneError } from '../application/ports/cash-session.repository';
import {
  ChargeNotVoidableError,
  TicketsNotChargeableError,
  type ChargeRepository,
  type ChargeWriteResult,
  type NewChargeData,
  type VoidChargeData,
  type VoidChargeResult,
  type VoidChargeTarget,
} from '../application/ports/charge.repository';
import type { StatusActor } from '../application/ports/ticket.repository';
import { fromDecimalString, toDecimalString } from '../domain/money';
import { CHARGE_PREFIX, nextNumber } from '../domain/numbering';
import { TICKET_INCLUDE, statusEventData, toTicket } from './ticket-row';

const CHARGE_INCLUDE = {
  chargedBy: { select: { id: true, fullName: true } },
  payments: { orderBy: { paidAt: 'asc' } },
  // Los productos sueltos de la cuenta (066), resumidos para el cobro.
  counterSale: {
    select: {
      id: true,
      number: true,
      customerName: true,
      total: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: { name: true, quantity: true, unitPrice: true },
      },
    },
  },
} satisfies Prisma.ChargeInclude;

type ChargeRow = Prisma.ChargeGetPayload<{ include: typeof CHARGE_INCLUDE }>;

/**
 * Los renglones de la cuenta, como los pidio el cajero.
 *
 * En la base hay una fila por metodo **y por lavado** (RN-5), asi que para
 * volver a los renglones se suman por metodo: dos lavados pagados con la misma
 * tarjeta son un solo renglon de tarjeta, que es lo que se tecleo.
 */
function toChargePayments(rows: ChargeRow['payments']): ChargePayment[] {
  const byMethod = new Map<PaymentMethod, ChargePayment>();

  for (const row of rows) {
    const method = row.method as PaymentMethod;
    const line = byMethod.get(method);

    if (line === undefined) {
      byMethod.set(method, { id: row.id, method, amount: row.amount.toFixed(2) });
      continue;
    }

    // Suma en centavos enteros: dos cadenas decimales sumadas como `number`
    // son justo el error que el modulo `money` existe para evitar.
    line.amount = toDecimalString(
      fromDecimalString(line.amount) + fromDecimalString(row.amount.toFixed(2)),
    );
  }

  return [...byMethod.values()];
}

/**
 * Los lavados de una cuenta, sin repetir. Un pago de venta suelta no tiene
 * lavado (065 RN-20) y no entra: esta cuenta no lo devuelve como ticket.
 */
function workOrderIdsOf(payments: readonly { workOrderId: string | null }[]): string[] {
  const ids = payments
    .map((payment) => payment.workOrderId)
    .filter((id): id is string => id !== null);

  return [...new Set(ids)];
}

function toCharge(row: ChargeRow, tickets: Ticket[]): Charge {
  return {
    id: row.id,
    number: row.number,
    total: row.total.toFixed(2),
    cashTendered: row.cashTendered === null ? null : row.cashTendered.toFixed(2),
    changeGiven: row.changeGiven === null ? null : row.changeGiven.toFixed(2),
    chargedAt: row.chargedAt.toISOString(),
    chargedBy: { id: row.chargedBy.id, fullName: row.chargedBy.fullName },
    payments: toChargePayments(row.payments),
    tickets,
    counterSale:
      row.counterSale === null
        ? null
        : {
            id: row.counterSale.id,
            number: row.counterSale.number,
            customerName: row.counterSale.customerName,
            total: row.counterSale.total.toFixed(2),
            items: row.counterSale.items.map((item) => {
              const unitPrice = item.unitPrice.toFixed(2);
              const quantity = item.quantity.toFixed(3);

              return {
                name: item.name,
                quantity,
                unitPrice,
                total: toDecimalString(
                  saleLineTotal(fromDecimalString(unitPrice), fromQuantityString(quantity)),
                ),
              };
            }),
          },
  };
}

@Injectable()
export class PrismaChargeRepository implements ChargeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * La cuenta entera en una sola transaccion (RN-7, 066): lavados a `PAID`,
   * comisiones congeladas, la venta suelta con su salida del kardex, una fila
   * de pago por metodo y por parte —cada lavado y la venta—, y la cuenta con
   * su correlativo. Si algo falla, no se cobra nada.
   */
  async create(data: NewChargeData, actor: StatusActor): Promise<ChargeWriteResult> {
    const ids = data.tickets.map((ticket) => ticket.workOrderId);

    const { row, tickets, lowStock } = await this.prisma.$transaction(async (tx) => {
      const open = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM cash_sessions
        WHERE id = ${data.cashSessionId}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (open.length === 0) {
        throw new CashSessionGoneError();
      }

      // Se vuelve a mirar dentro de la transaccion (RN-4): entre que el caso de
      // uso valido y esta escritura, otra caja pudo cobrar uno de los lavados.
      const chargeable = await tx.workOrder.findMany({
        where: { id: { in: ids }, status: PrismaStatus.READY, payments: { none: {} } },
        select: { id: true },
      });

      if (chargeable.length !== ids.length) {
        const taken = new Set(chargeable.map((ticket) => ticket.id));

        throw new TicketsNotChargeableError(ids.filter((id) => !taken.has(id)));
      }

      const last = await tx.charge.findFirst({
        orderBy: { number: 'desc' },
        select: { number: true },
      });

      const charge = await tx.charge.create({
        data: {
          number: nextNumber(CHARGE_PREFIX, last?.number ?? null),
          total: toDecimalString(data.total),
          cashTendered: data.cashTendered === null ? null : toDecimalString(data.cashTendered),
          changeGiven: data.changeGiven === null ? null : toDecimalString(data.changeGiven),
          chargedByUserId: data.userId,
          cashSessionId: data.cashSessionId,
        },
        include: CHARGE_INCLUDE,
      });

      const chargedAt = new Date();
      const lowStock: InventoryLowStockPayload[] = [];

      // La venta primero: si un producto no alcanza, el kardex lanza antes de
      // tocar ningun lavado (065 RN-19).
      if (data.sale !== null) {
        const written = await writeCounterSale(tx, {
          chargeId: charge.id,
          customerName: data.sale.customerName,
          total: data.sale.total,
          lines: data.sale.lines,
          userId: data.userId,
        });

        await tx.payment.createMany({
          data: data.sale.payments.map((payment) => ({
            counterSaleId: written.saleId,
            chargeId: charge.id,
            method: payment.method,
            amount: toDecimalString(payment.amount),
            recordedByUserId: data.userId,
            cashSessionId: data.cashSessionId,
          })),
        });

        lowStock.push(...written.lowStock);
      }

      for (const ticket of data.tickets) {
        await tx.payment.createMany({
          data: ticket.payments.map((payment) => ({
            workOrderId: ticket.workOrderId,
            chargeId: charge.id,
            method: payment.method,
            amount: toDecimalString(payment.amount),
            recordedByUserId: data.userId,
            cashSessionId: data.cashSessionId,
          })),
        });

        if (ticket.entries.length > 0) {
          await tx.commissionEntry.createMany({
            data: ticket.entries.map((entry) => ({
              workOrderId: ticket.workOrderId,
              employeeId: entry.employeeId,
              amount: toDecimalString(entry.amount),
            })),
          });
        }

        await tx.workOrder.update({
          where: { id: ticket.workOrderId },
          data: {
            status: PrismaStatus.PAID,
            chargedByUserId: data.userId,
            chargedAt,
            commissionTotal: toDecimalString(ticket.commissionTotal),
          },
        });

        await tx.workOrderStatusEvent.create({
          data: statusEventData(ticket.workOrderId, 'READY', 'PAID', actor),
        });
      }

      return {
        row: await tx.charge.findUniqueOrThrow({
          where: { id: charge.id },
          include: CHARGE_INCLUDE,
        }),
        tickets: await readTickets(tx, ids),
        lowStock,
      };
    });

    return { charge: toCharge(row, tickets), lowStock };
  }

  async findById(id: string): Promise<Charge | null> {
    const row = await this.prisma.charge.findUnique({ where: { id }, include: CHARGE_INCLUDE });

    if (row === null) return null;

    const ids = workOrderIdsOf(row.payments);

    return toCharge(row, await readTickets(this.prisma, ids));
  }

  /**
   * Deshace un cobro entero (RN-8, 066): sus lavados vuelven a `READY` —con sus
   * productos puestos: el kardex del lavado no se mueve—, su venta suelta queda
   * `VOID` con sus productos de vuelta al inventario, sus pagos salen del turno
   * y las comisiones se borran. La cuenta se borra con ellos —los pagos se van
   * en cascada— porque una cuenta deshecha no es un cobro que paso: es un
   * cobro que no debio existir.
   *
   * Se exige que el cobro sea del turno abierto: la caja de ayer ya cuadro, y
   * sacarle un pago hacia atras descuadraria un cierre firmado.
   */
  async void(
    target: VoidChargeTarget,
    data: VoidChargeData,
    actor: StatusActor,
  ): Promise<VoidChargeResult> {
    return this.prisma.$transaction(async (tx) => {
      const open = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM cash_sessions
        WHERE id = ${data.cashSessionId}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (open.length === 0) {
        throw new CashSessionGoneError();
      }

      const payments = await tx.payment.findMany({
        where: 'chargeId' in target ? { chargeId: target.chargeId } : target,
        select: { id: true, workOrderId: true, chargeId: true, cashSessionId: true },
      });

      if (
        payments.length === 0 ||
        payments.some((payment) => payment.cashSessionId !== data.cashSessionId)
      ) {
        throw new ChargeNotVoidableError();
      }

      const ids = workOrderIdsOf(payments);
      const chargeId = payments[0].chargeId;

      await tx.payment.deleteMany({ where: { id: { in: payments.map((row) => row.id) } } });

      // La venta se suelta de la cuenta antes de borrarla: queda `VOID` y
      // firmada, porque el kardex la referencia (065 RN-22).
      const sale =
        chargeId === null ? null : await voidCounterSaleOfCharge(tx, chargeId, data.sale);

      if (chargeId !== null) {
        await tx.charge.delete({ where: { id: chargeId } });
      }

      await tx.commissionEntry.deleteMany({ where: { workOrderId: { in: ids } } });

      for (const id of ids) {
        const current = await tx.workOrder.findUniqueOrThrow({ where: { id } });
        const note = `Reverso: ${data.reason}`;

        // Igual que en `setStatus`: la vuelta a READY se anota antes de releer,
        // para que el ticket que sale del reverso ya traiga su `readyAt` (049).
        await tx.workOrderStatusEvent.create({
          data: statusEventData(id, current.status as WorkOrderStatus, 'READY', actor),
        });

        await tx.workOrder.update({
          where: { id },
          data: {
            status: PrismaStatus.READY,
            chargedByUserId: null,
            chargedAt: null,
            commissionTotal: null,
            notes:
              current.notes === null || current.notes.trim() === ''
                ? note
                : `${current.notes}\n${note}`,
          },
        });
      }

      return {
        tickets: await readTickets(tx, ids),
        counterSaleId: sale?.saleId ?? null,
        lowStock: sale?.lowStock ?? [],
      };
    });
  }
}

/** Los lavados pedidos, en el orden en que llegaron los ids. */
async function readTickets(
  tx: Prisma.TransactionClient,
  ids: readonly string[],
): Promise<Ticket[]> {
  const rows = await tx.workOrder.findMany({
    where: { id: { in: [...ids] } },
    include: TICKET_INCLUDE,
  });
  const byId = new Map(rows.map((row) => [row.id, toTicket(row)]));

  return ids.flatMap((id) => {
    const ticket = byId.get(id);

    return ticket === undefined ? [] : [ticket];
  });
}
