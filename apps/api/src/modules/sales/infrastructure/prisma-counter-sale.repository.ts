import type { CounterSale, CounterSaleStatus, Page, PaymentMethod } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { decimalToCents, decimalToMilli } from '../../../common/prisma/decimal';
import {
  PAYMENT_BANK_ACCOUNT_SELECT,
  paymentDetailsOf,
} from '../../banking/infrastructure/bank-account-row';
import { civilRange } from '../../carwash/domain/civil-range';
import { toDecimalString } from '../../carwash/domain/money';
import { isSaleVoidable, saleLineTotal } from '../domain/counter-sale';
import type {
  CounterSaleDayFilter,
  CounterSaleListFilter,
  CounterSaleRepository,
} from '../application/ports/counter-sale.repository';

const PERSON = { select: { id: true, fullName: true } } as const;

const SALE_INCLUDE = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { priceAuthorizedBy: PERSON },
  },
  payments: {
    orderBy: { paidAt: 'asc' },
    // El estado del turno decide `isVoidable` (RN-22); la cuenta de una
    // transferencia (069) sale en el detalle de la venta.
    include: {
      cashSession: { select: { status: true } },
      bankAccount: PAYMENT_BANK_ACCOUNT_SELECT,
    },
  },
  charge: {
    select: {
      id: true,
      number: true,
      cashTendered: true,
      changeGiven: true,
      // Los lavados de la misma cuenta (066): «Cobrada con #7, #8».
      payments: {
        where: { workOrderId: { not: null } },
        select: { workOrder: { select: { id: true, number: true } } },
      },
    },
  },
  createdBy: PERSON,
  voidedBy: PERSON,
} satisfies Prisma.CounterSaleInclude;

type SaleRow = Prisma.CounterSaleGetPayload<{ include: typeof SALE_INCLUDE }>;

/** Los lavados de la cuenta, sin repetir (un pago por metodo y por lavado) y por folio. */
function accountTicketsOf(row: SaleRow): { id: string; number: string }[] {
  const byId = new Map<string, { id: string; number: string }>();

  for (const payment of row.charge?.payments ?? []) {
    if (payment.workOrder !== null) byId.set(payment.workOrder.id, payment.workOrder);
  }

  return [...byId.values()].sort((a, b) => a.number.localeCompare(b.number));
}

function toCounterSale(row: SaleRow): CounterSale {
  return {
    id: row.id,
    number: row.number,
    status: row.status as CounterSaleStatus,
    customerName: row.customerName,
    total: row.total.toFixed(2),
    items: row.items.map((item) => {
      const unitPrice = item.unitPrice.toFixed(2);
      const quantity = item.quantity.toFixed(3);

      return {
        id: item.id,
        inventoryItemId: item.inventoryItemId,
        code: item.code,
        name: item.name,
        catalogPrice: item.catalogPrice.toFixed(2),
        unitPrice,
        quantity,
        total: toDecimalString(
          saleLineTotal(decimalToCents(item.unitPrice), decimalToMilli(item.quantity)),
        ),
        priceAuthorizedBy: item.priceAuthorizedBy,
        priceReason: item.priceReason,
        sortOrder: item.sortOrder,
      };
    }),
    // Lo que le toco a la venta: un renglon por metodo de su cuenta. Si la cuenta
    // llevaba lavados, es su parte del reparto (059 RN-5, 066), no el total.
    payments: row.payments.map((payment) => ({
      id: payment.id,
      method: payment.method as PaymentMethod,
      amount: payment.amount.toFixed(2),
      ...paymentDetailsOf(payment),
    })),
    charge: row.charge === null ? null : { id: row.charge.id, number: row.charge.number },
    accountTickets: accountTicketsOf(row),
    cashTendered: row.charge?.cashTendered?.toFixed(2) ?? null,
    changeGiven: row.charge?.changeGiven?.toFixed(2) ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    voidedBy: row.voidedBy,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
    isVoidable: isSaleVoidable(
      row.status as CounterSaleStatus,
      row.payments.map((payment) => ({ isOpen: payment.cashSession?.status === 'OPEN' })),
    ),
  };
}

@Injectable()
export class PrismaCounterSaleRepository implements CounterSaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CounterSale | null> {
    const row = await this.prisma.counterSale.findUnique({ where: { id }, include: SALE_INCLUDE });

    return row === null ? null : toCounterSale(row);
  }

  async list(filter: CounterSaleListFilter): Promise<Page<CounterSale>> {
    const where = dayWhere(filter);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.counterSale.count({ where }),
      this.prisma.counterSale.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    return {
      items: rows.map(toCounterSale),
      page: filter.page,
      pageSize: filter.pageSize,
      total,
    };
  }

  async listDay(filter: CounterSaleDayFilter): Promise<CounterSale[]> {
    const rows = await this.prisma.counterSale.findMany({
      where: dayWhere(filter),
      include: SALE_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
    });

    return rows.map(toCounterSale);
  }
}

function dayWhere(filter: CounterSaleDayFilter): Prisma.CounterSaleWhereInput {
  return {
    createdAt: civilRange(filter.date, filter.date),
    ...(filter.status === undefined ? {} : { status: filter.status }),
  };
}
