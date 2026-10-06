import { moneyToCents } from '@elite/shared';
import type { Page, PageQuery } from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import { differenceCash, expectedCash, methodTotals } from '../../domain/cash-shift';
import type {
  AgreementReader,
  AgreementSpan,
  BillingAgreementRecord,
  BillingFineRecord,
  BillingPaymentRecord,
} from '../ports/agreement-reader';
import {
  CashSessionAlreadyOpenError,
  CashSessionClosedError,
  CashSessionGoneError,
  type CloseRentalCashData,
  type OpenRentalCashData,
  type LoadedRentalCashSession,
  type RentalCashPaymentRecord,
  type RentalCashSessionRecord,
  type RentalCashSessionRepository,
} from '../ports/rental-cash-session.repository';
import type {
  FineFilter,
  NewRentalFine,
  RentalFineRepository,
} from '../ports/rental-fine.repository';
import type {
  DepositReturn,
  NewRentalPayment,
  PaymentVoid,
  RentalPaymentRepository,
} from '../ports/rental-payment.repository';
import type { UserDirectory } from '../ports/user-directory';

const UNKNOWN_USER = 'Usuario eliminado';

interface StoredSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingFloat: number;
  openedAt: Date;
  openedByUserId: string;
  closedAt: Date | null;
  closedByUserId: string | null;
  countedCash: number | null;
  cashTotal: number | null;
  cardTotal: number | null;
  transferTotal: number | null;
  otherTotal: number | null;
  expectedCash: number | null;
  differenceCash: number | null;
  notes: string | null;
}

/** Una renta en memoria. Lo que no se pasa sale en cero o vacío. */
export function agreementRecord(
  overrides: Partial<BillingAgreementRecord> & { id: string },
): BillingAgreementRecord {
  return {
    contractNumber: null,
    status: 'IN_PROGRESS',
    vehicleId: 'vehicle-1',
    plate: 'P123456',
    customerName: 'Ana Pérez',
    plannedPickupAt: new Date('2026-10-01T10:00:00Z'),
    plannedReturnAt: new Date('2026-10-03T10:00:00Z'),
    actualPickupAt: null,
    actualReturnAt: null,
    dailyRate: '25.00',
    cdwPerDay: '0.00',
    billableDays: 2,
    extraCharges: '0.00',
    extraKmCharge: '0.00',
    discount: '0.00',
    deposit: '0.00',
    depositReturnedAmount: null,
    depositTransferredToId: null,
    payments: [],
    fines: [],
    ...overrides,
  };
}

/**
 * Las piezas del módulo sobre un mismo arreglo de rentas, como la base: un
 * pago o una multa nuevos se ven en la siguiente lectura de la renta. El turno
 * de caja (109) vive aparte y los cobros lo referencian.
 */
export class InMemoryBilling
  implements AgreementReader, RentalPaymentRepository, RentalFineRepository, UserDirectory
{
  readonly agreements: BillingAgreementRecord[] = [];
  /** Multas sin renta (gasto del carro). */
  readonly looseFines: BillingFineRecord[] = [];
  readonly vehicles = new Map<string, { plate: string | null; make: string; model: string }>([
    ['vehicle-1', { plate: 'P123456', make: 'Toyota', model: 'Yaris' }],
  ]);
  readonly users = new Map<string, string>([['user-1', 'Caja Uno']]);
  private readonly sessions: StoredSession[] = [];
  private sequence = 0;

  add(agreement: BillingAgreementRecord): this {
    this.agreements.push(agreement);
    return this;
  }

  /** Abre un turno de prueba. Los cobros de los tests entran acá. */
  seedOpenShift(userId = 'user-1', openingFloatCents = 0): string {
    const existing = this.openStored();

    if (existing !== undefined) return existing.id;

    return this.insertOpen(userId, openingFloatCents);
  }

  /** Quita el turno abierto para probar el cobro sin caja. */
  removeOpenShift(): void {
    const index = this.sessions.findIndex((session) => session.status === 'OPEN');

    if (index >= 0) this.sessions.splice(index, 1);
  }

  // --- AgreementReader ---

  async findById(id: string): Promise<BillingAgreementRecord | null> {
    return this.agreements.find((agreement) => agreement.id === id) ?? null;
  }

  async listHoldingVehicle(vehicleId: string): Promise<AgreementSpan[]> {
    return this.agreements.filter(
      (agreement) =>
        agreement.vehicleId === vehicleId &&
        (agreement.status === 'IN_PROGRESS' || agreement.status === 'FINISHED'),
    );
  }

  async listOpenAccounts(): Promise<BillingAgreementRecord[]> {
    return this.agreements.filter(
      (agreement) =>
        agreement.status === 'IN_PROGRESS' ||
        agreement.status === 'FINISHED' ||
        (agreement.depositReturnedAmount === null && agreement.depositTransferredToId === null),
    );
  }

  // --- RentalPaymentRepository ---

  async addPayment(
    agreementId: string,
    payment: NewRentalPayment,
    check: (agreement: BillingAgreementRecord) => void,
  ): Promise<BillingPaymentRecord | null> {
    const agreement = await this.findById(agreementId);

    if (agreement === null) return null;

    check(agreement);

    const open = this.openStored();

    if (open === undefined) throw new CashSessionGoneError();

    const record: BillingPaymentRecord = {
      id: this.nextId('payment'),
      agreementId,
      ...payment,
      voidedAt: null,
      voidReason: null,
      voidedByUserId: null,
      cashSessionId: open.id,
      createdAt: payment.paidAt,
    };

    agreement.payments.push(record);

    return record;
  }

  async voidPayment(
    paymentId: string,
    data: PaymentVoid,
    check: (payment: BillingPaymentRecord) => void,
  ): Promise<BillingPaymentRecord | null> {
    const payment = this.allPayments().find((row) => row.id === paymentId);

    if (payment === undefined) return null;

    check(payment);

    if (payment.cashSessionId !== null) {
      const session = this.sessions.find((row) => row.id === payment.cashSessionId);

      if (session === undefined || session.status !== 'OPEN') throw new CashSessionClosedError();
    }

    payment.voidedAt = data.voidedAt;
    payment.voidReason = data.reason;
    payment.voidedByUserId = data.voidedByUserId;

    return payment;
  }

  async returnDeposit(
    agreementId: string,
    data: DepositReturn,
    check: (agreement: BillingAgreementRecord) => void,
  ): Promise<boolean> {
    const agreement = await this.findById(agreementId);

    if (agreement === null) return false;

    check(agreement);
    agreement.depositReturnedAmount = data.amount;

    return true;
  }

  async listByAgreement(agreementId: string, page: PageQuery): Promise<Page<BillingPaymentRecord>> {
    const payments = this.allPayments()
      .filter((payment) => payment.agreementId === agreementId)
      .sort(newestPaymentFirst);

    return slicePage(payments, page);
  }

  /**
   * El repositorio del turno. No puede ser la misma clase: `findById` ya es el
   * de las rentas.
   */
  sessionsRepo(): RentalCashSessionRepository {
    return {
      findOpen: () => this.findOpen(),
      findById: (id, query) => this.findSession(id, query),
      listPage: (query) => this.listSessions(query),
      open: (data) => this.openSession(data),
      close: (id, data) => this.closeSession(id, data),
    };
  }

  // --- turno de caja (109) ---

  async findOpen(): Promise<RentalCashSessionRecord | null> {
    const open = this.openStored();

    return open === undefined ? null : this.toSession(open);
  }

  async findSession(id: string, query: PageQuery): Promise<LoadedRentalCashSession | null> {
    const session = this.sessions.find((row) => row.id === id);

    if (session === undefined) return null;

    const all = this.paymentsOf(session.id);
    const page = slicePage(all, query);

    return {
      session: this.toSession(session, page.items),
      otherPayments: all.filter((payment) => payment.method === 'OTHER'),
    };
  }

  async listSessions(query: PageQuery): Promise<Page<RentalCashSessionRecord>> {
    const rows = [...this.sessions].sort(
      (left, right) =>
        right.openedAt.getTime() - left.openedAt.getTime() || right.id.localeCompare(left.id),
    );

    return slicePage(
      rows.map((row) => this.toSession(row)),
      query,
    );
  }

  async openSession(data: OpenRentalCashData): Promise<RentalCashSessionRecord> {
    const existing = this.openStored();

    if (existing !== undefined) throw new CashSessionAlreadyOpenError(this.toSession(existing));

    return this.toSession(this.storedById(this.insertOpen(data.userId, data.openingFloat)));
  }

  async closeSession(
    id: string,
    data: CloseRentalCashData,
  ): Promise<RentalCashSessionRecord | null> {
    const session = this.sessions.find((row) => row.id === id && row.status === 'OPEN');

    if (session === undefined) return null;

    const payments = this.paymentsOf(session.id);
    const totals = methodTotals(payments);
    const expected = expectedCash(session.openingFloat, totals.cashTotal);

    session.status = 'CLOSED';
    session.closedAt = new Date('2026-10-01T20:00:00Z');
    session.closedByUserId = data.userId;
    session.countedCash = data.countedCash;
    session.cashTotal = totals.cashTotal;
    session.cardTotal = totals.cardTotal;
    session.transferTotal = totals.transferTotal;
    session.otherTotal = totals.otherTotal;
    session.expectedCash = expected;
    session.differenceCash = differenceCash(data.countedCash, expected);
    session.notes = emptyToNull(data.notes);

    return this.toSession(session);
  }

  // --- RentalFineRepository ---

  async vehicleExists(vehicleId: string): Promise<boolean> {
    return this.vehicles.has(vehicleId);
  }

  async create(fine: NewRentalFine): Promise<BillingFineRecord> {
    const agreement =
      fine.agreementId === null ? null : ((await this.findById(fine.agreementId)) ?? null);
    const record: BillingFineRecord = {
      id: this.nextId('fine'),
      ...fine,
      vehicle: this.vehicles.get(fine.vehicleId) ?? { plate: null, make: '', model: '' },
      agreement:
        agreement === null
          ? null
          : {
              id: agreement.id,
              contractNumber: agreement.contractNumber,
              customerName: agreement.customerName,
            },
      createdAt: new Date('2026-10-01T12:00:00Z'),
    };

    if (agreement === null) this.looseFines.push(record);
    else agreement.fines.push(record);

    return record;
  }

  async list(filter: FineFilter, page: PageQuery): Promise<Page<BillingFineRecord>> {
    const fines = [...this.looseFines, ...this.agreements.flatMap((agreement) => agreement.fines)]
      .filter((fine) => filter.vehicleId === undefined || fine.vehicleId === filter.vehicleId)
      .filter((fine) => filter.agreementId === undefined || fine.agreementId === filter.agreementId)
      .filter((fine) => filter.from === undefined || fine.occurredAt >= filter.from)
      .filter((fine) => filter.to === undefined || fine.occurredAt < filter.to)
      .sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime() || left.id.localeCompare(right.id),
      );

    return slicePage(fines, page);
  }

  // --- UserDirectory ---

  async namesOf(ids: readonly string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();

    for (const id of ids) {
      const name = this.users.get(id);
      if (name !== undefined) names.set(id, name);
    }

    return names;
  }

  private openStored(): StoredSession | undefined {
    return this.sessions.find((session) => session.status === 'OPEN');
  }

  private insertOpen(userId: string, openingFloat: number): string {
    const id = this.nextId('cash');

    this.sessions.push({
      id,
      status: 'OPEN',
      openingFloat,
      openedAt: new Date('2026-10-01T18:00:00Z'),
      openedByUserId: userId,
      closedAt: null,
      closedByUserId: null,
      countedCash: null,
      cashTotal: null,
      cardTotal: null,
      transferTotal: null,
      otherTotal: null,
      expectedCash: null,
      differenceCash: null,
      notes: null,
    });

    return id;
  }

  private storedById(id: string): StoredSession {
    const session = this.sessions.find((row) => row.id === id);

    if (session === undefined) throw new Error(`Missing cash session ${id}`);

    return session;
  }

  private toSession(
    session: StoredSession,
    payments: RentalCashPaymentRecord[] = [],
  ): RentalCashSessionRecord {
    const all = this.paymentsOf(session.id);
    const live = methodTotals(all);
    const open = session.status === 'OPEN';

    return {
      id: session.id,
      status: session.status,
      openingFloat: session.openingFloat,
      openedAt: session.openedAt,
      openedBy: this.actor(session.openedByUserId),
      closedAt: session.closedAt,
      closedBy: session.closedByUserId === null ? null : this.actor(session.closedByUserId),
      countedCash: session.countedCash,
      cashTotal: open ? live.cashTotal : session.cashTotal,
      cardTotal: open ? live.cardTotal : session.cardTotal,
      transferTotal: open ? live.transferTotal : session.transferTotal,
      otherTotal: open ? live.otherTotal : session.otherTotal,
      expectedCash: session.expectedCash,
      differenceCash: session.differenceCash,
      notes: session.notes,
      payments,
      paymentCount: all.length,
    };
  }

  private paymentsOf(sessionId: string): RentalCashPaymentRecord[] {
    return this.agreements
      .flatMap((agreement) =>
        agreement.payments
          .filter((payment) => payment.cashSessionId === sessionId && payment.voidedAt === null)
          .map((payment) => ({
            id: payment.id,
            method: payment.method,
            amount: moneyToCents(payment.amount),
            paidAt: payment.paidAt,
            reference: payment.reference,
            description: payment.method === 'OTHER' ? payment.note : null,
            detail: {
              agreementId: agreement.id,
              contractNumber: agreement.contractNumber,
              plate: agreement.plate,
              customerName: agreement.customerName,
            },
          })),
      )
      .sort(
        (left, right) =>
          right.paidAt.getTime() - left.paidAt.getTime() || right.id.localeCompare(left.id),
      );
  }

  private actor(userId: string): { id: string; fullName: string } {
    return { id: userId, fullName: this.users.get(userId) ?? UNKNOWN_USER };
  }

  private allPayments(): BillingPaymentRecord[] {
    return this.agreements.flatMap((agreement) => agreement.payments);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }
}

function newestPaymentFirst(
  left: Pick<BillingPaymentRecord, 'id' | 'paidAt'>,
  right: Pick<BillingPaymentRecord, 'id' | 'paidAt'>,
): number {
  return right.paidAt.getTime() - left.paidAt.getTime() || left.id.localeCompare(right.id);
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}
