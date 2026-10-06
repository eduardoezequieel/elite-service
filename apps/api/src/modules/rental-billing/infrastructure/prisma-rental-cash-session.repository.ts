import { centsToMoney } from '@elite/shared';
import type { Page, PageQuery, PaymentMethod } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { CashSessionStatus, Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { decimalToCents } from '../../../common/prisma/decimal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CashSessionAlreadyOpenError,
  type CloseRentalCashData,
  type LoadedRentalCashSession,
  type OpenRentalCashData,
  type RentalCashPaymentRecord,
  type RentalCashSessionRecord,
  type RentalCashSessionRepository,
} from '../application/ports/rental-cash-session.repository';
import { differenceCash, expectedCash, methodTotals } from '../domain/cash-shift';
import type { MethodTotals } from '../domain/cash-shift';

const ZERO: MethodTotals = { cashTotal: 0, cardTotal: 0, transferTotal: 0, otherTotal: 0 };

const HEAD = {
  openedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  _count: { select: { payments: { where: { voidedAt: null } } } },
} satisfies Prisma.RentalCashSessionInclude;

const PAYMENT_INCLUDE = {
  agreement: {
    select: {
      id: true,
      contractNumber: true,
      customer: { select: { fullName: true } },
      vehicle: { select: { plate: true } },
    },
  },
} satisfies Prisma.RentalPaymentInclude;

type SessionHead = Prisma.RentalCashSessionGetPayload<{ include: typeof HEAD }>;
type PaymentRow = Prisma.RentalPaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;
type CashDb = PrismaService | Prisma.TransactionClient;

const PAYMENT_ORDER = [{ paidAt: 'desc' as const }, { id: 'desc' as const }];

function toRecord(
  row: SessionHead,
  live: MethodTotals | null,
  payments: RentalCashPaymentRecord[],
): RentalCashSessionRecord {
  const open = row.status === 'OPEN';
  const totals = open ? (live ?? ZERO) : null;

  return {
    id: row.id,
    status: row.status,
    openingFloat: decimalToCents(row.openingFloat),
    openedAt: row.openedAt,
    openedBy: row.openedBy,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    countedCash: row.countedCash === null ? null : decimalToCents(row.countedCash),
    cashTotal: totals === null ? decimalOrNull(row.cashTotal) : totals.cashTotal,
    cardTotal: totals === null ? decimalOrNull(row.cardTotal) : totals.cardTotal,
    transferTotal: totals === null ? decimalOrNull(row.transferTotal) : totals.transferTotal,
    otherTotal: totals === null ? decimalOrNull(row.otherTotal) : totals.otherTotal,
    expectedCash: row.expectedCash === null ? null : decimalToCents(row.expectedCash),
    differenceCash: row.differenceCash === null ? null : decimalToCents(row.differenceCash),
    notes: row.notes,
    payments,
    paymentCount: row._count.payments,
  };
}

function decimalOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : decimalToCents(value);
}

function toPayment(payment: PaymentRow): RentalCashPaymentRecord {
  return {
    id: payment.id,
    method: payment.method as PaymentMethod,
    amount: decimalToCents(payment.amount),
    paidAt: payment.paidAt,
    reference: payment.reference,
    description: payment.method === 'OTHER' ? payment.note : null,
    detail: {
      agreementId: payment.agreement.id,
      contractNumber: payment.agreement.contractNumber,
      plate: payment.agreement.vehicle.plate,
      customerName: payment.agreement.customer.fullName,
    },
  };
}

/** Sumas de los cobros vigentes, por turno. Un turno cerrado no las necesita. */
async function liveTotals(
  db: CashDb,
  sessionIds: readonly string[],
): Promise<Map<string, MethodTotals>> {
  const totals = new Map<string, MethodTotals>();

  if (sessionIds.length === 0) return totals;

  const groups = await db.rentalPayment.groupBy({
    by: ['cashSessionId', 'method'],
    where: { cashSessionId: { in: [...sessionIds] }, voidedAt: null },
    _sum: { amount: true },
  });

  for (const group of groups) {
    if (group.cashSessionId === null) continue;

    const current = totals.get(group.cashSessionId) ?? { ...ZERO };
    const amount = decimalToCents(group._sum.amount ?? new Prisma.Decimal(0));
    const next = methodTotals([{ method: group.method as PaymentMethod, amount }]);

    totals.set(group.cashSessionId, {
      cashTotal: current.cashTotal + next.cashTotal,
      cardTotal: current.cardTotal + next.cardTotal,
      transferTotal: current.transferTotal + next.transferTotal,
      otherTotal: current.otherTotal + next.otherTotal,
    });
  }

  return totals;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class PrismaRentalCashSessionRepository implements RentalCashSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpen(): Promise<RentalCashSessionRecord | null> {
    const row = await this.prisma.rentalCashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      include: HEAD,
    });

    if (row === null) return null;

    const live = await liveTotals(this.prisma, [row.id]);

    return toRecord(row, live.get(row.id) ?? ZERO, []);
  }

  async findById(id: string, query: PageQuery): Promise<LoadedRentalCashSession | null> {
    const row = await this.prisma.rentalCashSession.findUnique({ where: { id }, include: HEAD });

    if (row === null) return null;

    const active = { cashSessionId: id, voidedAt: null };
    const [live, payments, otherPayments] = await Promise.all([
      row.status === 'OPEN'
        ? liveTotals(this.prisma, [id])
        : Promise.resolve(new Map<string, MethodTotals>()),
      this.prisma.rentalPayment.findMany({
        where: active,
        orderBy: PAYMENT_ORDER,
        ...skipTake(query),
        include: PAYMENT_INCLUDE,
      }),
      this.prisma.rentalPayment.findMany({
        where: { ...active, method: 'OTHER' },
        orderBy: PAYMENT_ORDER,
        include: PAYMENT_INCLUDE,
      }),
    ]);

    return {
      session: toRecord(row, live.get(id) ?? null, payments.map(toPayment)),
      otherPayments: otherPayments.map(toPayment),
    };
  }

  async listPage(query: PageQuery): Promise<Page<RentalCashSessionRecord>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.rentalCashSession.findMany({
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
        include: HEAD,
      }),
      this.prisma.rentalCashSession.count(),
    ]);
    const live = await liveTotals(
      this.prisma,
      rows.filter((row) => row.status === 'OPEN').map((row) => row.id),
    );

    return pageOf(
      rows.map((row) => toRecord(row, live.get(row.id) ?? null, [])),
      total,
      query,
    );
  }

  async open(data: OpenRentalCashData): Promise<RentalCashSessionRecord> {
    try {
      const row = await this.prisma.rentalCashSession.create({
        data: {
          status: CashSessionStatus.OPEN,
          openingFloat: centsToMoney(data.openingFloat),
          openedByUserId: data.userId,
        },
        include: HEAD,
      });

      return toRecord(row, ZERO, []);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const existing = await this.findOpen();

      if (existing === null) throw error;

      throw new CashSessionAlreadyOpenError(existing);
    }
  }

  async close(id: string, data: CloseRentalCashData): Promise<RentalCashSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM rental_cash_sessions
        WHERE id = ${id}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (locked.length === 0) return null;

      const live = await liveTotals(tx, [id]);
      const current = await tx.rentalCashSession.findUniqueOrThrow({
        where: { id },
        include: HEAD,
      });
      const totals = live.get(id) ?? ZERO;
      const expected = expectedCash(decimalToCents(current.openingFloat), totals.cashTotal);

      const row = await tx.rentalCashSession.update({
        where: { id },
        data: {
          status: CashSessionStatus.CLOSED,
          closedByUserId: data.userId,
          closedAt: new Date(),
          countedCash: centsToMoney(data.countedCash),
          cashTotal: centsToMoney(totals.cashTotal),
          cardTotal: centsToMoney(totals.cardTotal),
          transferTotal: centsToMoney(totals.transferTotal),
          otherTotal: centsToMoney(totals.otherTotal),
          expectedCash: centsToMoney(expected),
          differenceCash: centsToMoney(differenceCash(data.countedCash, expected)),
          notes: emptyToNull(data.notes),
        },
        include: HEAD,
      });

      return toRecord(row, null, []);
    });
  }
}
