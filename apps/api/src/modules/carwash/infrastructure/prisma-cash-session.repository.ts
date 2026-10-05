import type { PaymentMethod } from '@elite/shared';
import type { Page, PageQuery } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { CashSessionStatus, Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { decimalToCents } from '../../../common/prisma/decimal';
import {
  PAYMENT_BANK_ACCOUNT_SELECT,
  paymentDetailsOf,
} from '../../banking/infrastructure/bank-account-row';
import {
  CashSessionAlreadyOpenError,
  type CashSessionRecord,
  type CashSessionRepository,
  type CloseCashData,
  type OpenCashData,
} from '../application/ports/cash-session.repository';
import { closeSnapshot } from '../domain/cash-session';
import { toDecimalString } from '../domain/money';

const INCLUDE = {
  openedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  payments: {
    include: {
      workOrder: { select: { id: true, number: true } },
      // Los pagos de una venta suelta tambien entran al turno (065 RN-20).
      counterSale: { select: { id: true, number: true } },
      // Y los abonos a una cuenta abierta (106).
      tab: { select: { id: true, number: true } },
      // La cuenta de cada transferencia: el desglose del turno (069 RN-7).
      bankAccount: PAYMENT_BANK_ACCOUNT_SELECT,
    },
    orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.CashSessionInclude;

type SessionRow = Prisma.CashSessionGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: SessionRow): CashSessionRecord {
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
    payments: row.payments.map((payment) => ({
      id: payment.id,
      workOrderId: payment.workOrderId,
      ticketNumber: payment.workOrder?.number ?? null,
      counterSaleId: payment.counterSaleId,
      saleNumber: payment.counterSale?.number ?? null,
      tabId: payment.tabId,
      tabNumber: payment.tab?.number ?? null,
      method: payment.method as PaymentMethod,
      amount: decimalToCents(payment.amount),
      paidAt: payment.paidAt,
      ...paymentDetailsOf(payment),
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

  async listPage(query: PageQuery): Promise<Page<CashSessionRecord>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cashSession.findMany({
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
        include: INCLUDE,
      }),
      this.prisma.cashSession.count(),
    ]);

    return pageOf(rows.map(toRecord), total, query);
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
          otherTotal: toDecimalString(snapshot.otherTotal),
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
