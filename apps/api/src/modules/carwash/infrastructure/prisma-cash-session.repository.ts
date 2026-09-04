import type { PaymentMethod } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { CashSessionStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CashSessionAlreadyOpenError,
  type CashSessionRecord,
  type CashSessionRepository,
  type CloseCashData,
  type OpenCashData,
} from '../application/ports/cash-session.repository';
import { closeSnapshot } from '../domain/cash-session';
import { fromDecimalString, toDecimalString } from '../domain/money';

const INCLUDE = {
  openedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  payments: {
    include: { workOrder: { select: { id: true, number: true } } },
    orderBy: { paidAt: 'asc' as const },
  },
} satisfies Prisma.CashSessionInclude;

type SessionRow = Prisma.CashSessionGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: SessionRow): CashSessionRecord {
  return {
    id: row.id,
    status: row.status,
    openingFloat: fromDecimalString(row.openingFloat.toFixed(2)),
    openedAt: row.openedAt,
    openedBy: row.openedBy,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    countedCash: row.countedCash === null ? null : fromDecimalString(row.countedCash.toFixed(2)),
    cashTotal: row.cashTotal === null ? null : fromDecimalString(row.cashTotal.toFixed(2)),
    cardTotal: row.cardTotal === null ? null : fromDecimalString(row.cardTotal.toFixed(2)),
    transferTotal:
      row.transferTotal === null ? null : fromDecimalString(row.transferTotal.toFixed(2)),
    expectedCash: row.expectedCash === null ? null : fromDecimalString(row.expectedCash.toFixed(2)),
    differenceCash:
      row.differenceCash === null ? null : fromDecimalString(row.differenceCash.toFixed(2)),
    notes: row.notes,
    payments: row.payments.map((payment) => ({
      id: payment.id,
      workOrderId: payment.workOrderId,
      ticketNumber: payment.workOrder.number,
      method: payment.method as PaymentMethod,
      amount: fromDecimalString(payment.amount.toFixed(2)),
      paidAt: payment.paidAt,
    })),
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
export class PrismaCashSessionRepository implements CashSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpen(): Promise<CashSessionRecord | null> {
    const row = await this.prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      include: INCLUDE,
    });

    return row === null ? null : toRecord(row);
  }

  async findById(id: string): Promise<CashSessionRecord | null> {
    const row = await this.prisma.cashSession.findUnique({ where: { id }, include: INCLUDE });

    return row === null ? null : toRecord(row);
  }

  async list(limit: number): Promise<CashSessionRecord[]> {
    const rows = await this.prisma.cashSession.findMany({
      orderBy: { openedAt: 'desc' },
      take: limit,
      include: INCLUDE,
    });

    return rows.map(toRecord);
  }

  async open(data: OpenCashData): Promise<CashSessionRecord> {
    try {
      const row = await this.prisma.cashSession.create({
        data: {
          status: CashSessionStatus.OPEN,
          openingFloat: toDecimalString(data.openingFloat),
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

  async close(id: string, data: CloseCashData): Promise<CashSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the OPEN row so a concurrent charge cannot land after we snapshot.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM cash_sessions
        WHERE id = ${id}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (locked.length === 0) return null;

      const current = await tx.cashSession.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      const record = toRecord(current);
      const snapshot = closeSnapshot(record.openingFloat, record.payments, data.countedCash);

      const row = await tx.cashSession.update({
        where: { id },
        data: {
          status: CashSessionStatus.CLOSED,
          closedByUserId: data.userId,
          closedAt: new Date(),
          countedCash: toDecimalString(data.countedCash),
          cashTotal: toDecimalString(snapshot.cashTotal),
          cardTotal: toDecimalString(snapshot.cardTotal),
          transferTotal: toDecimalString(snapshot.transferTotal),
          expectedCash: toDecimalString(snapshot.expectedCash),
          differenceCash: toDecimalString(snapshot.differenceCash),
          notes: emptyToNull(data.notes),
        },
        include: INCLUDE,
      });

      return toRecord(row);
    });
  }
}
