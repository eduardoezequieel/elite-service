import { API_ERROR_CODES, centsToMoney, moneyToCents } from '@elite/shared';
import type {
  CashSessionsQuery,
  CloseCashInput,
  DepositHeldRow,
  DepositsHeldList,
  OpenCashInput,
  Page,
  PageQuery,
  ReceivableRow,
  ReceivablesList,
  RentalCashPayment,
  RentalCashSession,
  RentalCashSessionDetail,
} from '@elite/shared';

import { ConflictError, NotFoundError } from '../../../common/errors/application-error';
import { slicePage } from '../../../common/pagination/page';
import { differenceCash, expectedCash, methodTotals } from '../domain/cash-shift';
import { isReceivable } from '../domain/billing-rules';
import { heldDepositOf, totalsOf } from './billing-view';
import type { AgreementReader, BillingAgreementRecord } from './ports/agreement-reader';
import {
  CashSessionAlreadyOpenError,
  type RentalCashPaymentRecord,
  type RentalCashSessionRecord,
  type RentalCashSessionRepository,
} from './ports/rental-cash-session.repository';

const CHARGE_WITHOUT_CASH = 'Abrí la caja para cobrar.';
const CLOSE_WITHOUT_CASH = 'No hay un turno abierto.';

/**
 * La caja de la rentadora (109): un turno con fondo, cobros y cierre con
 * arqueo. Nada compartido con `cash_sessions` del lavado. Las cuentas por
 * cobrar y las garantías en custodia siguen siendo listas aparte (098).
 */
export class RentalCashUseCases {
  constructor(
    private readonly agreements: AgreementReader,
    private readonly sessions: RentalCashSessionRepository,
  ) {}

  async current(): Promise<RentalCashSession | null> {
    const open = await this.sessions.findOpen();

    return open === null ? null : toSession(open);
  }

  async list(query: CashSessionsQuery): Promise<Page<RentalCashSession>> {
    const page = await this.sessions.listPage(query);

    return { ...page, items: page.items.map(toSession) };
  }

  async getById(id: string, query: CashSessionsQuery): Promise<RentalCashSessionDetail> {
    const row = await this.sessions.findById(id);

    if (row === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese turno de caja no existe.',
      });
    }

    const payments = row.payments.map(toPayment);

    return {
      ...toSession(row),
      payments: slicePage(payments, query),
      otherPayments: payments.filter((payment) => payment.method === 'OTHER'),
    };
  }

  async open(input: OpenCashInput, userId: string): Promise<RentalCashSession> {
    const existing = await this.sessions.findOpen();

    if (existing !== null) throw alreadyOpen(existing);

    try {
      const created = await this.sessions.open({
        openingFloat: moneyToCents(input.openingFloat),
        userId,
      });

      return toSession(created);
    } catch (error) {
      if (error instanceof CashSessionAlreadyOpenError) throw alreadyOpen(error.existing);

      throw error;
    }
  }

  async close(input: CloseCashInput, userId: string): Promise<RentalCashSession> {
    const open = await this.sessions.findOpen();

    if (open === null) throw cashNotOpen(CLOSE_WITHOUT_CASH);

    const closed = await this.sessions.close(open.id, {
      countedCash: moneyToCents(input.countedCash),
      userId,
      notes: input.notes,
    });

    if (closed === null) throw cashNotOpen(CLOSE_WITHOUT_CASH);

    return toSession(closed);
  }

  /** RN-2 de a una página (101); `totalAmount` es de todas las filas. */
  async depositsHeld(query: PageQuery): Promise<DepositsHeldList> {
    const rows = depositsHeld(await this.agreements.listOpenAccounts());

    return { ...slicePage(rows, query), totalAmount: sumOf(rows, (row) => row.amount) };
  }

  /** RN-3 de a una página (101); `totalBalance` es de todas las filas. */
  async receivables(query: PageQuery): Promise<ReceivablesList> {
    const rows = receivables(await this.agreements.listOpenAccounts());

    return { ...slicePage(rows, query), totalBalance: sumOf(rows, (row) => row.balance) };
  }
}

export function toSession(record: RentalCashSessionRecord): RentalCashSession {
  const totals = totalsOfSession(record);

  return {
    id: record.id,
    status: record.status,
    openingFloat: centsToMoney(record.openingFloat),
    openedAt: record.openedAt.toISOString(),
    openedBy: record.openedBy,
    closedAt: record.closedAt === null ? null : record.closedAt.toISOString(),
    closedBy: record.closedBy,
    countedCash: record.countedCash === null ? null : centsToMoney(record.countedCash),
    cashTotal: centsToMoney(totals.cashTotal),
    cardTotal: centsToMoney(totals.cardTotal),
    transferTotal: centsToMoney(totals.transferTotal),
    otherTotal: centsToMoney(totals.otherTotal),
    transferByAccount: [],
    expectedCash: centsToMoney(totals.expectedCash),
    differenceCash: record.differenceCash === null ? null : centsToMoney(record.differenceCash),
    notes: record.notes,
    paymentCount: record.payments.length,
  };
}

function toPayment(payment: RentalCashPaymentRecord): RentalCashPayment {
  return {
    id: payment.id,
    workOrderId: null,
    ticketNumber: null,
    counterSaleId: null,
    saleNumber: null,
    tabId: null,
    tabNumber: null,
    method: payment.method,
    amount: centsToMoney(payment.amount),
    paidAt: payment.paidAt.toISOString(),
    bankAccount: null,
    reference: payment.reference,
    description: payment.description,
    detail: payment.detail,
  };
}

function totalsOfSession(record: RentalCashSessionRecord): {
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
  expectedCash: number;
} {
  if (record.status === 'CLOSED') {
    const cashTotal = record.cashTotal ?? 0;

    return {
      cashTotal,
      cardTotal: record.cardTotal ?? 0,
      transferTotal: record.transferTotal ?? 0,
      otherTotal: record.otherTotal ?? 0,
      expectedCash: record.expectedCash ?? expectedCash(record.openingFloat, cashTotal),
    };
  }

  const live = methodTotals(record.payments);

  return { ...live, expectedCash: expectedCash(record.openingFloat, live.cashTotal) };
}

function alreadyOpen(session: RentalCashSessionRecord): never {
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
  throw new ConflictError({ code: API_ERROR_CODES.CASH_NOT_OPEN, message });
}

/** El mensaje del cobro sin turno. Lo usa el caso de uso de pagos. */
export function cashNotOpenForCharge(): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.CASH_NOT_OPEN,
    message: CHARGE_WITHOUT_CASH,
  });
}

function sumOf<T>(rows: readonly T[], amount: (row: T) => string): string {
  return centsToMoney(rows.reduce((sum, row) => sum + moneyToCents(amount(row)), 0));
}

/** RN-2, por número de contrato y después por `id`. */
function depositsHeld(accounts: readonly BillingAgreementRecord[]): DepositHeldRow[] {
  return accounts
    .map((agreement) => ({ agreement, held: heldDepositOf(agreement) }))
    .filter(({ held }) => held > 0)
    .sort((left, right) => byContract(left.agreement, right.agreement))
    .map(({ agreement, held }) => ({
      agreementId: agreement.id,
      contractNumber: agreement.contractNumber,
      plate: agreement.plate,
      customer: agreement.customerName,
      amount: centsToMoney(held),
    }));
}

/** RN-3, de la que más debe a la que menos. */
function receivables(accounts: readonly BillingAgreementRecord[]): ReceivableRow[] {
  const rows: (ReceivableRow & { cents: number })[] = [];

  for (const agreement of accounts) {
    if (agreement.status !== 'IN_PROGRESS' && agreement.status !== 'FINISHED') continue;

    const totals = totalsOf(agreement);
    const cents = moneyToCents(totals.balance);

    if (!isReceivable(agreement.status, cents)) continue;

    rows.push({
      agreementId: agreement.id,
      contractNumber: agreement.contractNumber,
      plate: agreement.plate,
      customer: agreement.customerName,
      total: totals.total,
      paid: totals.paid,
      balance: totals.balance,
      status: agreement.status,
      cents,
    });
  }

  return rows
    .sort(
      (left, right) =>
        right.cents - left.cents || left.agreementId.localeCompare(right.agreementId),
    )
    .map(({ cents: _cents, ...row }) => row);
}

function byContract(left: BillingAgreementRecord, right: BillingAgreementRecord): number {
  return (
    (left.contractNumber ?? Number.MAX_SAFE_INTEGER) -
      (right.contractNumber ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id)
  );
}

export { differenceCash };
