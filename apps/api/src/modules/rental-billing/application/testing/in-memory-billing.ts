import type {
  AgreementReader,
  AgreementSpan,
  BillingAgreementRecord,
  BillingFineRecord,
  BillingPaymentRecord,
} from '../ports/agreement-reader';
import type {
  FineFilter,
  NewRentalFine,
  RentalFineRepository,
} from '../ports/rental-fine.repository';
import type {
  CashPaymentRecord,
  DepositReturn,
  NewRentalPayment,
  PaymentVoid,
  RentalPaymentRepository,
} from '../ports/rental-payment.repository';
import type { UserDirectory } from '../ports/user-directory';

/** Una renta en memoria. Lo que no se pasa sale en cero o vacío. */
export function agreementRecord(
  overrides: Partial<BillingAgreementRecord> & { id: string },
): BillingAgreementRecord {
  return {
    contractNumber: null,
    status: 'IN_PROGRESS',
    vehicleId: 'vehicle-1',
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
 * Las cuatro piezas del módulo sobre un mismo arreglo de rentas, como la base:
 * un pago o una multa nuevos se ven en la siguiente lectura de la renta.
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
  private sequence = 0;

  add(agreement: BillingAgreementRecord): this {
    this.agreements.push(agreement);
    return this;
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

    const record: BillingPaymentRecord = {
      id: this.nextId('payment'),
      agreementId,
      ...payment,
      voidedAt: null,
      voidReason: null,
      voidedByUserId: null,
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

  async listPaidBetween(start: Date, end: Date): Promise<CashPaymentRecord[]> {
    return this.agreements
      .flatMap((agreement) =>
        agreement.payments.map((payment) => ({
          ...payment,
          contractNumber: agreement.contractNumber,
          customerName: agreement.customerName,
        })),
      )
      .filter((payment) => payment.paidAt >= start && payment.paidAt < end)
      .sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime());
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

  async list(filter: FineFilter): Promise<BillingFineRecord[]> {
    return [...this.looseFines, ...this.agreements.flatMap((agreement) => agreement.fines)]
      .filter((fine) => filter.vehicleId === undefined || fine.vehicleId === filter.vehicleId)
      .filter((fine) => filter.agreementId === undefined || fine.agreementId === filter.agreementId)
      .filter((fine) => filter.from === undefined || fine.occurredAt >= filter.from)
      .filter((fine) => filter.to === undefined || fine.occurredAt < filter.to)
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
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

  private allPayments(): BillingPaymentRecord[] {
    return this.agreements.flatMap((agreement) => agreement.payments);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }
}
