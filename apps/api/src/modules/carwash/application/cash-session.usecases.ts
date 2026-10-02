import { API_ERROR_CODES } from '@elite/shared';
import type {
  CashSession,
  CashSessionDetail,
  CashSessionPayment,
  CashSessionsQuery,
  CloseCashInput,
  OpenCashInput,
  Page,
} from '@elite/shared';

import { ConflictError, NotFoundError } from '../../../common/errors/application-error';
import { slicePage } from '../../../common/pagination/page';
import { expectedCash, paymentTotals, transferByAccount } from '../domain/cash-session';
import { toCents, toDecimalString } from '../domain/money';
import {
  CashSessionAlreadyOpenError,
  type CashSessionRecord,
  type CashSessionRepository,
} from './ports/cash-session.repository';

const CASH_NOT_OPEN_CLOSE = 'No hay un turno abierto.';

export class CashSessionUseCases {
  constructor(private readonly sessions: CashSessionRepository) {}

  async current(): Promise<CashSession | null> {
    const open = await this.sessions.findOpen();

    return open === null ? null : toCashSession(open);
  }

  /** Los turnos, de a una pagina (102). */
  async list(query: CashSessionsQuery): Promise<Page<CashSession>> {
    const page = await this.sessions.listPage(query);

    return { ...page, items: page.items.map(toCashSession) };
  }

  /**
   * Un turno con sus pagos de a una pagina (102). Los totales salen de todos
   * los pagos del turno, no de la pagina, y «Otro» trae todos los suyos.
   */
  async getById(id: string, query: CashSessionsQuery): Promise<CashSessionDetail> {
    const row = await this.sessions.findById(id);

    if (row === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese turno de caja no existe.',
      });
    }

    return toCashSessionDetail(row, query);
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
    otherTotal: toDecimalString(totals.otherTotal),
    // Se arma de los pagos tambien en un turno cerrado: sus pagos ya no se
    // mueven (solo se deshace un cobro del turno abierto), asi que el desglose
    // suma lo mismo que el `transferTotal` congelado (069 RN-7).
    transferByAccount: transferByAccount(record.payments).map((line) => ({
      bankAccountId: line.bankAccountId,
      label: line.label,
      total: toDecimalString(line.total),
    })),
    expectedCash: toDecimalString(totals.expectedCash),
    differenceCash: record.differenceCash === null ? null : toDecimalString(record.differenceCash),
    notes: record.notes,
    paymentCount: record.payments.length,
  };
}

function toCashSessionDetail(
  record: CashSessionRecord,
  query: CashSessionsQuery,
): CashSessionDetail {
  const payments = record.payments.map(toPayment);

  return {
    ...toCashSession(record),
    payments: slicePage(payments, query),
    otherPayments: payments.filter((payment) => payment.method === 'OTHER'),
  };
}

function toPayment(payment: CashSessionRecord['payments'][number]): CashSessionPayment {
  return {
    id: payment.id,
    workOrderId: payment.workOrderId,
    ticketNumber: payment.ticketNumber,
    counterSaleId: payment.counterSaleId,
    saleNumber: payment.saleNumber,
    method: payment.method,
    amount: toDecimalString(payment.amount),
    paidAt: payment.paidAt.toISOString(),
    bankAccount: payment.bankAccount,
    reference: payment.reference,
    description: payment.description,
  };
}

function totalsOf(record: CashSessionRecord): {
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
  expectedCash: number;
} {
  if (record.status === 'CLOSED') {
    return {
      cashTotal: record.cashTotal ?? 0,
      cardTotal: record.cardTotal ?? 0,
      transferTotal: record.transferTotal ?? 0,
      // Un turno cerrado antes de la 069 no tenia «Otro»: cero, no un hueco.
      otherTotal: record.otherTotal ?? 0,
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
  throw new ConflictError({
    code: API_ERROR_CODES.CASH_ALREADY_OPEN,
    message: `Ya hay un turno abierto por ${session.openedBy.fullName}.`,
    details: {
      openedBy: session.openedBy,
      openedAt: session.openedAt.toISOString(),
    },
  });
}

function cashNotOpen(message: string): never {
  throw new ConflictError({
    code: API_ERROR_CODES.CASH_NOT_OPEN,
    message,
  });
}
