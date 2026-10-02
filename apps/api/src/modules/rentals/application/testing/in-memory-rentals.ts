import { OCCUPYING_STATUSES, occupiedInterval } from '@elite/shared';
import type {
  FleetVehicleCategory,
  FleetVehicleStatus,
  Page,
  PageQuery,
  RentalAgreementCustomer,
  RentalAgreementVehicle,
} from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import { AgreementStatusChangedError, nextContractNumber } from '../../domain/agreement';
import type { AgreementRecord } from '../../domain/agreement';
import type {
  AgreementChanges,
  AgreementListFilter,
  AgreementRepository,
  CheckinWrite,
  CheckoutWrite,
  ExtendWrite,
  NewAgreementData,
  OccupancyCheck,
  PaymentWrite,
  SwapWrite,
} from '../ports/agreement.repository';
import type {
  Clock,
  ContractNumberSequence,
  FleetVehicleReader,
  RentalSettingsReader,
  RentalTerms,
  RenterReader,
  RenterSummary,
} from '../ports/readers';

/**
 * Las rentas en memoria (096) y lo que leen de la flota, los clientes y los
 * ajustes. Mismo comportamiento que Prisma: el chequeo de choque recibe las
 * rentas que ocupan el carro, y una escritura sobre una renta que cambió de
 * estado lanza `AgreementStatusChangedError`.
 */

export class FixedClock implements Clock {
  constructor(public current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }
}

export class InMemorySettings implements RentalSettingsReader {
  terms: RentalTerms = {
    bufferHours: 1,
    graceHours: 1,
    defaultCdwPerDay: null,
    defaultDeductible: null,
    contractStartNumber: 733,
  };

  current(): Promise<RentalTerms> {
    return Promise.resolve({ ...this.terms });
  }
}

export class InMemoryFleet implements FleetVehicleReader {
  readonly rows: RentalAgreementVehicle[] = [];
  private sequence = 0;

  add(overrides: Partial<RentalAgreementVehicle> = {}): RentalAgreementVehicle {
    this.sequence += 1;
    const vehicle: RentalAgreementVehicle = {
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      plate: `P${this.sequence}00`,
      make: 'Toyota',
      model: 'Yaris',
      year: 2022,
      color: null,
      category: 'SEDAN',
      status: 'ACTIVE',
      odometerKm: 10_000,
      dailyRate: '35.00',
      weeklyRate: null,
      monthlyRate: null,
      freeKmPerDay: null,
      extraKmPrice: null,
      ...overrides,
    };
    this.rows.push(vehicle);
    return vehicle;
  }

  findById(id: string): Promise<RentalAgreementVehicle | null> {
    const row = this.rows.find((candidate) => candidate.id === id);
    return Promise.resolve(row === undefined ? null : { ...row });
  }

  list(filter: {
    statuses: readonly FleetVehicleStatus[];
    category?: FleetVehicleCategory;
  }): Promise<RentalAgreementVehicle[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => filter.statuses.includes(row.status))
        .filter((row) => filter.category === undefined || row.category === filter.category)
        .map((row) => ({ ...row })),
    );
  }
}

export class InMemoryRenters implements RenterReader {
  readonly rows: (RenterSummary & RentalAgreementCustomer)[] = [];
  private sequence = 0;

  add(overrides: Partial<RenterSummary & RentalAgreementCustomer> = {}) {
    this.sequence += 1;
    const renter = {
      id: `10000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      fullName: `Cliente ${this.sequence}`,
      documentId: null,
      licenseNumber: null,
      licenseExpiresAt: null,
      birthDate: null,
      mobilePhone: '7777-8888',
      phone: null,
      isBlocked: false,
      blockReason: null,
      ...overrides,
    };
    this.rows.push(renter);
    return renter;
  }

  findById(id: string): Promise<RenterSummary | null> {
    const row = this.rows.find((candidate) => candidate.id === id);
    return Promise.resolve(row === undefined ? null : { ...row });
  }
}

export class InMemoryAgreementRepository implements AgreementRepository {
  readonly rows: AgreementRecord[] = [];
  private sequence = 0;

  constructor(
    private readonly fleet: InMemoryFleet,
    private readonly renters: InMemoryRenters,
    private readonly clock: Clock,
  ) {}

  list(filter: AgreementListFilter, page: PageQuery): Promise<Page<AgreementRecord>> {
    const term = filter.q?.toLowerCase();
    const rows = this.rows
      .filter((row) => filter.statuses === undefined || filter.statuses.includes(row.status))
      .filter(
        (row) =>
          filter.lateBefore === undefined ||
          (row.status === 'IN_PROGRESS' &&
            new Date(row.plannedReturnAt).getTime() < filter.lateBefore.getTime()),
      )
      .filter((row) => filter.customerId === undefined || row.customerId === filter.customerId)
      .filter((row) => filter.vehicleId === undefined || row.vehicleId === filter.vehicleId)
      .filter((row) => {
        if (filter.touching === undefined) return true;
        const interval = occupiedInterval(row, filter.touching.now);
        return (
          interval.start.getTime() < filter.touching.to.getTime() &&
          interval.end.getTime() > filter.touching.from.getTime()
        );
      })
      .filter(
        (row) =>
          term === undefined ||
          row.customer.fullName.toLowerCase().includes(term) ||
          (row.vehicle.plate ?? '').toLowerCase().includes(term) ||
          String(row.contractNumber ?? '') === term,
      )
      .sort(
        (left, right) =>
          right.plannedPickupAt.localeCompare(left.plannedPickupAt) ||
          right.createdAt.localeCompare(left.createdAt) ||
          left.id.localeCompare(right.id),
      );

    return Promise.resolve(slicePage(rows.map(clone), page));
  }

  findById(id: string): Promise<AgreementRecord | null> {
    const row = this.rows.find((candidate) => candidate.id === id);
    return Promise.resolve(row === undefined ? null : clone(row));
  }

  listOccupying(vehicleIds?: readonly string[]): Promise<AgreementRecord[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => OCCUPYING_STATUSES.includes(row.status))
        .filter((row) => vehicleIds === undefined || vehicleIds.includes(row.vehicleId))
        .map(clone),
    );
  }

  listTouching(from: Date, to: Date, now: Date): Promise<AgreementRecord[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.status !== 'CANCELLED')
        .filter((row) => {
          const interval = occupiedInterval(row, now);
          return interval.start < to && interval.end > from;
        })
        .map(clone),
    );
  }

  async create(data: NewAgreementData, check: OccupancyCheck): Promise<AgreementRecord> {
    this.runCheck(check);
    const row = await this.build(data);
    this.rows.push(row);
    return clone(row);
  }

  update(
    id: string,
    from: AgreementRecord['status'],
    changes: AgreementChanges,
    check: OccupancyCheck | null,
  ): Promise<AgreementRecord> {
    const row = this.locked(id, from);
    if (check !== null) this.runCheck(check);

    const { plannedPickupAt, plannedReturnAt, vehicleId, ...terms } = changes;
    Object.assign(row, terms);
    if (plannedPickupAt !== undefined) row.plannedPickupAt = plannedPickupAt.toISOString();
    if (plannedReturnAt !== undefined) row.plannedReturnAt = plannedReturnAt.toISOString();
    if (vehicleId !== undefined) {
      row.vehicleId = vehicleId;
      row.vehicle = this.vehicleOf(vehicleId);
    }
    return Promise.resolve(clone(row));
  }

  checkout(id: string, data: CheckoutWrite, check: OccupancyCheck): Promise<AgreementRecord> {
    const row = this.locked(id, 'RESERVED');
    this.runCheck(check);
    this.applyCheckout(row, data);
    return Promise.resolve(clone(row));
  }

  checkin(id: string, data: CheckinWrite): Promise<AgreementRecord> {
    const row = this.locked(id, 'IN_PROGRESS');
    row.status = 'FINISHED';
    row.actualReturnAt = data.actualReturnAt.toISOString();
    row.returnInspection = data.inspection;
    row.returnOdometerKm = data.inspection.odometerKm;
    row.billableDays = data.billableDays;
    row.extraKmCharge = data.extraKmCharge;
    row.notes = data.notes;
    this.bumpOdometer(row.vehicleId, data.inspection.odometerKm);
    if (data.payment !== undefined) this.pay(row, data.payment);
    if (data.depositReturn !== undefined) {
      row.depositReturnedAmount = data.depositReturn.amount;
      row.depositReturnedAt = data.actualReturnAt.toISOString();
      row.depositReturnNote = data.depositReturn.note;
    }
    return Promise.resolve(clone(row));
  }

  extend(id: string, data: ExtendWrite, check: OccupancyCheck): Promise<AgreementRecord> {
    const row = this.locked(id, 'IN_PROGRESS');
    this.runCheck(check);
    this.sequence += 1;
    row.extensions.push({
      id: `30000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      previousReturnAt: data.previousReturnAt.toISOString(),
      newReturnAt: data.newReturnAt.toISOString(),
      addedDays: data.addedDays,
      note: data.note,
      createdAt: this.clock.now().toISOString(),
    });
    row.plannedReturnAt = data.newReturnAt.toISOString();
    row.billableDays = data.billableDays;
    if (data.dailyRate !== undefined) row.dailyRate = data.dailyRate;
    return Promise.resolve(clone(row));
  }

  async swap(
    id: string,
    data: SwapWrite,
    check: OccupancyCheck,
  ): Promise<{ closed: AgreementRecord; opened: AgreementRecord }> {
    const row = this.locked(id, 'IN_PROGRESS');
    this.runCheck(check);
    const opened = await this.build({ ...data.opened });
    opened.previousAgreementId = row.id;
    opened.swapReason = data.reason;
    this.rows.push(opened);

    row.status = 'FINISHED';
    row.actualReturnAt = data.at.toISOString();
    row.billableDays = data.closedBillableDays;
    row.swapReason = data.reason;
    row.nextAgreementId = opened.id;
    row.depositTransferredToId = opened.id;

    return { closed: clone(row), opened: clone(opened) };
  }

  cancel(
    id: string,
    from: AgreementRecord['status'],
    reason: string,
    at: Date,
  ): Promise<AgreementRecord> {
    const row = this.locked(id, from);
    row.status = 'CANCELLED';
    row.cancelReason = reason;
    row.cancelledAt = at.toISOString();
    return Promise.resolve(clone(row));
  }

  // -------------------------------------------------------------------------

  /** Simula otra persona cambiando el estado entre la lectura y la escritura. */
  forceStatus(id: string, status: AgreementRecord['status']): void {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row !== undefined) row.status = status;
  }

  private locked(id: string, from: AgreementRecord['status']): AgreementRecord {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined || row.status !== from) throw new AgreementStatusChangedError(id);
    return row;
  }

  private runCheck(check: OccupancyCheck): void {
    check.assertFree(
      this.rows
        .filter((row) => row.vehicleId === check.vehicleId)
        .filter((row) => OCCUPYING_STATUSES.includes(row.status))
        .filter((row) => !check.excludeIds.includes(row.id))
        .map(clone),
    );
  }

  private async build(data: NewAgreementData): Promise<AgreementRecord> {
    const renter = await this.renters.findById(data.customerId);
    const customer = this.renters.rows.find((row) => row.id === renter?.id);
    if (customer === undefined) throw new Error('renter not found');

    this.sequence += 1;
    const now = this.clock.now().toISOString();
    const { checkout, customerId, vehicleId, plannedPickupAt, plannedReturnAt, ...terms } = data;
    const row: AgreementRecord = {
      id: `20000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      contractNumber: null,
      status: 'RESERVED',
      customerId,
      vehicleId,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        documentId: customer.documentId,
        licenseNumber: customer.licenseNumber,
        licenseExpiresAt: customer.licenseExpiresAt,
        birthDate: customer.birthDate,
        mobilePhone: customer.mobilePhone,
        phone: customer.phone,
        isBlocked: customer.isBlocked,
      },
      vehicle: this.vehicleOf(vehicleId),
      plannedPickupAt: plannedPickupAt.toISOString(),
      plannedReturnAt: plannedReturnAt.toISOString(),
      actualPickupAt: null,
      actualReturnAt: null,
      ...terms,
      extraKmCharge: '0.00',
      depositReturnedAmount: null,
      depositReturnedAt: null,
      depositReturnNote: null,
      depositTransferredToId: null,
      pickupInspection: null,
      returnInspection: null,
      pickupOdometerKm: null,
      returnOdometerKm: null,
      previousAgreementId: null,
      nextAgreementId: null,
      swapReason: null,
      cancelReason: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      payments: [],
      fines: [],
      extensions: [],
    };
    if (checkout !== undefined) this.applyCheckout(row, checkout);
    return row;
  }

  private applyCheckout(row: AgreementRecord, data: CheckoutWrite): void {
    row.status = 'IN_PROGRESS';
    row.actualPickupAt = data.actualPickupAt.toISOString();
    row.pickupInspection = data.inspection;
    row.pickupOdometerKm = data.odometerKm;
    row.billableDays = data.billableDays;
    if (data.deposit !== undefined) row.deposit = data.deposit;
    if (data.depositMethod !== undefined) row.depositMethod = data.depositMethod;
    this.bumpOdometer(row.vehicleId, data.odometerKm);
    if (data.payment !== undefined) this.pay(row, data.payment);
  }

  private pay(row: AgreementRecord, payment: PaymentWrite): void {
    this.sequence += 1;
    const now = this.clock.now().toISOString();
    row.payments.push({
      id: `40000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      agreementId: row.id,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      paidAt: now,
      note: payment.note,
      receivedByUserId: payment.receivedByUserId,
      receivedByName: 'Usuario de prueba',
      voidedAt: null,
      voidReason: null,
      voidedByUserId: null,
      voidedByName: null,
      createdAt: now,
    });
  }

  private bumpOdometer(vehicleId: string, km: number): void {
    const vehicle = this.fleet.rows.find((row) => row.id === vehicleId);
    if (vehicle !== undefined && vehicle.odometerKm < km) vehicle.odometerKm = km;
  }

  private vehicleOf(vehicleId: string): RentalAgreementVehicle {
    const vehicle = this.fleet.rows.find((row) => row.id === vehicleId);
    if (vehicle === undefined) throw new Error('vehicle not found');
    return { ...vehicle };
  }
}

export class InMemoryContractNumbers implements ContractNumberSequence {
  constructor(private readonly agreements: InMemoryAgreementRepository) {}

  assign(agreementId: string, startNumber: number): Promise<number> {
    const row = this.agreements.rows.find((candidate) => candidate.id === agreementId);
    if (row === undefined) throw new Error('agreement not found');
    if (row.contractNumber !== null) return Promise.resolve(row.contractNumber);

    const numbers = this.agreements.rows
      .map((candidate) => candidate.contractNumber)
      .filter((value): value is number => value !== null);
    row.contractNumber = nextContractNumber(
      numbers.length === 0 ? null : Math.max(...numbers),
      startNumber,
    );
    return Promise.resolve(row.contractNumber);
  }
}

function clone(row: AgreementRecord): AgreementRecord {
  return structuredClone(row);
}
