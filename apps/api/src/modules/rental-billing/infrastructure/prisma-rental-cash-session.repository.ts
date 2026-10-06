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
  type OpenRentalCashData,
  type RentalCashPaymentRecord,
  type RentalCashSessionRecord,
  type RentalCashSessionRepository,
} from '../application/ports/rental-cash-session.repository';
import { differenceCash, expectedCash, methodTotals } from '../domain/cash-shift';

const INCLUDE = {
  openedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  payments: {
    where: { voidedAt: null },
    orderBy: [{ paidAt: 'desc' as const }, { id: 'desc' as const }],
    include: {
      agreement: {
        select: {
          id: true,
          contractNumber: true,
          customer: { select: { fullName: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
  },
} satisfies Prisma.RentalCashSessionInclude;

type SessionRow = Prisma.RentalCashSessionGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: SessionRow): RentalCashSessionRecord {
  return {
    id: row.id,
    status: row.status,
    openingFloat: decimalToCents(row.openingFloat),
    openedAt: row.openedAt,
    openedBy: row.openedBy,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    countedCash: row.countedCash === null ? null : decimalToCents(row.countedCash),
    cashTotal: row.cashTotal === null ? null : decimalToCents(row.cashTotal),
    cardTotal: row.cardTotal === null ? null : decimalToCents(row.cardTotal),
    transferTotal: row.transferTotal === null ? null : decimalToCents(row.transferTotal),
    otherTotal: row.otherTotal === null ? null : decimalToCents(row.otherTotal),
    expectedCash: row.expectedCash === null ? null : decimalToCents(row.expectedCash),
    differenceCash: row.differenceCash === null ? null : decimalToCents(row.differenceCash),
    notes: row.notes,
    payments: row.payments.map(toPayment),
  };
}

function toPayment(payment: SessionRow['payments'][number]): RentalCashPaymentRecord {
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
      include: INCLUDE,
    });

    return row === null ? null : toRecord(row);
  }

  async findById(id: string): Promise<RentalCashSessionRecord | null> {
    const row = await this.prisma.rentalCashSession.findUnique({ where: { id }, include: INCLUDE });

    return row === null ? null : toRecord(row);
  }

  async listPage(query: PageQuery): Promise<Page<RentalCashSessionRecord>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.rentalCashSession.findMany({
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
        include: INCLUDE,
      }),
      this.prisma.rentalCashSession.count(),
    ]);

    return pageOf(rows.map(toRecord), total, query);
  }

  async open(data: OpenRentalCashData): Promise<RentalCashSessionRecord> {
    try {
      const row = await this.prisma.rentalCashSession.create({
        data: {
          status: CashSessionStatus.OPEN,
          openingFloat: centsToMoney(data.openingFloat),
          openedByUserId: data.userId,
        },
        include: INCLUDE,
      });

      return toRecord(row);
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

      const current = await tx.rentalCashSession.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      const record = toRecord(current);
      const totals = methodTotals(record.payments);
      const expected = expectedCash(record.openingFloat, totals.cashTotal);

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
        include: INCLUDE,
      });

      return toRecord(row);
    });
  }
}
