import { API_ERROR_CODES } from '@elite/shared';
import type {
  CashSession,
  CashSessionDetail,
  CashSessionPayment,
  CloseCashInput,
  OpenCashInput,
} from '@elite/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { expectedCash, paymentTotals } from '../domain/cash-session';
import { toCents, toDecimalString } from '../domain/money';
import {
  CashSessionAlreadyOpenError,
  type CashSessionRecord,
  type CashSessionRepository,
} from './ports/cash-session.repository';

const LIST_LIMIT = 50;

const CASH_NOT_OPEN_CLOSE = 'No hay un turno abierto.';

export class CashSessionUseCases {
  constructor(private readonly sessions: CashSessionRepository) {}

  async current(): Promise<CashSession | null> {
    const open = await this.sessions.findOpen();

    return open === null ? null : toCashSession(open);
  }

  async list(): Promise<CashSession[]> {
    const rows = await this.sessions.list(LIST_LIMIT);

    return rows.map(toCashSession);
  }

  async getById(id: string): Promise<CashSessionDetail> {
    const row = await this.sessions.findById(id);

    if (row === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese turno de caja no existe.',
      });
    }

    return toCashSessionDetail(row);
  }

  async open(input: OpenCashInput, userId: string): Promise<CashSession> {
    const existing = await this.sessions.findOpen();

    if (existing !== null) {
      throw alreadyOpen(existing);
    }

    try {
      const created = await this.sessions.open({
        openingFloat: toCents(input.openingFloat),
        userId,
      });

      return toCashSession(created);
    } catch (error) {
      if (error instanceof CashSessionAlreadyOpenError) {
        throw alreadyOpen(error.existing);
      }

      throw error;
    }
  }

  async close(input: CloseCashInput, userId: string): Promise<CashSession> {
    const open = await this.sessions.findOpen();

    if (open === null) {
      throw cashNotOpen(CASH_NOT_OPEN_CLOSE);
    }

    const closed = await this.sessions.close(open.id, {
      countedCash: toCents(input.countedCash),
      userId,
      notes: input.notes,
    });

    if (closed === null) {
      throw cashNotOpen(CASH_NOT_OPEN_CLOSE);
    }

    return toCashSession(closed);
  }
}

export function toCashSession(record: CashSessionRecord): CashSession {
  const totals = totalsOf(record);

  return {
    id: record.id,
    status: record.status,
    openingFloat: toDecimalString(record.openingFloat),
    openedAt: record.openedAt.toISOString(),
    openedBy: record.openedBy,
    closedAt: record.closedAt === null ? null : record.closedAt.toISOString(),
    closedBy: record.closedBy,
    countedCash: record.countedCash === null ? null : toDecimalString(record.countedCash),
    cashTotal: toDecimalString(totals.cashTotal),
    cardTotal: toDecimalString(totals.cardTotal),
    transferTotal: toDecimalString(totals.transferTotal),
    expectedCash: toDecimalString(totals.expectedCash),
    differenceCash: record.differenceCash === null ? null : toDecimalString(record.differenceCash),
    notes: record.notes,
    paymentCount: record.payments.length,
  };
}

function toCashSessionDetail(record: CashSessionRecord): CashSessionDetail {
  return {
    ...toCashSession(record),
    payments: record.payments.map(toPayment),
  };
}

function toPayment(payment: CashSessionRecord['payments'][number]): CashSessionPayment {
  return {
    id: payment.id,
    workOrderId: payment.workOrderId,
    ticketNumber: payment.ticketNumber,
    method: payment.method,
    amount: toDecimalString(payment.amount),
    paidAt: payment.paidAt.toISOString(),
  };
}

function totalsOf(record: CashSessionRecord): {
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  expectedCash: number;
} {
  if (record.status === 'CLOSED') {
    return {
      cashTotal: record.cashTotal ?? 0,
      cardTotal: record.cardTotal ?? 0,
      transferTotal: record.transferTotal ?? 0,
      expectedCash: record.expectedCash ?? expectedCash(record.openingFloat, record.cashTotal ?? 0),
    };
  }

  const live = paymentTotals(record.payments);

  return {
    ...live,
    expectedCash: expectedCash(record.openingFloat, live.cashTotal),
  };
}

function alreadyOpen(session: CashSessionRecord): never {
  throw new ConflictException({
    code: API_ERROR_CODES.CASH_ALREADY_OPEN,
    message: `Ya hay un turno abierto por ${session.openedBy.fullName}.`,
    details: {
      openedBy: session.openedBy,
      openedAt: session.openedAt.toISOString(),
    },
  });
}

function cashNotOpen(message: string): never {
  throw new ConflictException({
    code: API_ERROR_CODES.CASH_NOT_OPEN,
    message,
  });
}
