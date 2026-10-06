import {
  API_ERROR_CODES,
  billableDays,
  bufferMsOf,
  depositHeldOf,
  extraKmOf,
  moneyToCents,
  rateForDays,
} from '@elite/shared';
import type {
  AgreementSwapResult,
  AgreementsQuery,
  CancelInput,
  CheckinInput,
  CheckoutInput,
  CreateAgreementInput,
  ExtendInput,
  Interval,
  Page,
  ReassignInput,
  RentalAgreement,
  RentalAgreementVehicle,
  SwapInput,
  UpdateAgreementInput,
} from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import { CashSessionGoneError } from '../../rental-billing/application/ports/rental-cash-session.repository';
import { cashNotOpenForCharge } from '../../rental-billing/application/rental-cash.usecases';
import {
  AgreementStatusChangedError,
  checkinNotesOf,
  civilDayEnd,
  civilDayStart,
  depositReturnNoteOf,
  findClash,
  hasLivePayments,
  toRentalAgreement,
  transitionBlock,
} from '../domain/agreement';
import type { AgreementAction, AgreementRecord } from '../domain/agreement';
import type {
  AgreementChanges,
  AgreementListFilter,
  AgreementRepository,
  AgreementTermsWrite,
  CheckoutWrite,
  OccupancyCheck,
  PaymentWrite,
} from './ports/agreement.repository';
import type {
  Clock,
  ContractNumberSequence,
  FleetVehicleReader,
  RentalSettingsReader,
  RentalTerms,
  RenterReader,
} from './ports/readers';

/**
 * Las rentas de la rentadora (096): reservar, entregar, recibir, extender,
 * cambiar de carro, reasignar y cancelar. Las reglas de estado y de choque
 * viven en `domain/agreement.ts`; acá se leen los datos, se decide el error y
 * se escribe.
 */
export class AgreementUseCases {
  constructor(
    private readonly agreements: AgreementRepository,
    private readonly vehicles: FleetVehicleReader,
    private readonly renters: RenterReader,
    private readonly settings: RentalSettingsReader,
    private readonly contracts: ContractNumberSequence,
    private readonly clock: Clock,
  ) {}

  async list(query: AgreementsQuery): Promise<Page<RentalAgreement>> {
    const now = this.clock.now();
    const filter: AgreementListFilter = {
      ...(query.status === undefined || query.status.length === 0
        ? {}
        : { statuses: query.status }),
      ...(query.late === true ? { lateBefore: now } : {}),
      ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
      ...(query.vehicleId === undefined ? {} : { vehicleId: query.vehicleId }),
      ...(query.q === undefined || query.q === '' ? {} : { q: query.q }),
      ...(query.from === undefined && query.to === undefined
        ? {}
        : {
            touching: {
              from: query.from === undefined ? new Date(0) : civilDayStart(query.from),
              to: query.to === undefined ? new Date(8.64e15) : civilDayEnd(query.to),
              now,
            },
          }),
    };
    const page = await this.agreements.list(filter, query);

    return { ...page, items: page.items.map((row) => toRentalAgreement(row, now)) };
  }

  async get(id: string): Promise<RentalAgreement> {
    return toRentalAgreement(await this.load(id), this.clock.now());
  }

  async create(input: CreateAgreementInput, userId: string): Promise<RentalAgreement> {
    const renter = await this.renters.findById(input.customerId);

    if (renter === null) throw notFound('Ese cliente no existe.');
    if (renter.isBlocked) {
      throw new ConflictError({
        code: API_ERROR_CODES.RENTER_BLOCKED,
        message: renter.blockReason
          ? `${renter.fullName} está marcado «No rentar»: ${renter.blockReason}`
          : `${renter.fullName} está marcado «No rentar».`,
        details: { customerId: renter.id },
      });
    }

    const vehicle = await this.rentableVehicle(input.vehicleId);
    const terms = await this.settings.current();
    const plannedPickupAt = new Date(input.plannedPickupAt);
    const plannedReturnAt = new Date(input.plannedReturnAt);
    const checkoutInput = input.checkoutNow ? input.checkout : undefined;
    const start =
      checkoutInput === undefined ? plannedPickupAt : new Date(checkoutInput.actualPickupAt);

    if (start.getTime() >= plannedReturnAt.getTime()) throw returnBeforePickup('actualPickupAt');

    const days = input.billableDays ?? billableDays(start, plannedReturnAt, terms.graceHours);
    const termsWrite = this.termsOf(input, vehicle, days, terms);
    const checkout =
      checkoutInput === undefined ? undefined : this.checkoutWrite(checkoutInput, userId, days);

    const created = await this.withOpenCash(() =>
      this.agreements.create(
        {
          ...termsWrite,
          customerId: renter.id,
          vehicleId: vehicle.id,
          plannedPickupAt,
          plannedReturnAt,
          createdByUserId: userId,
          ...(checkout === undefined ? {} : { checkout }),
        },
        this.occupancy(vehicle.id, { start, end: plannedReturnAt }, [], terms),
      ),
    );

    if (checkout !== undefined) {
      await this.contracts.assign(created.id, terms.contractStartNumber);
      return this.get(created.id);
    }

    return toRentalAgreement(created, this.clock.now());
  }

  async update(id: string, input: UpdateAgreementInput): Promise<RentalAgreement> {
    const current = await this.load(id);
    this.assertAllowed(current, 'update');

    if (
      current.status === 'IN_PROGRESS' &&
      input.plannedPickupAt !== undefined &&
      new Date(input.plannedPickupAt).getTime() !== new Date(current.plannedPickupAt).getTime()
    ) {
      throw new ConflictError({
        code: API_ERROR_CODES.AGREEMENT_NOT_RESERVED,
        message: 'El carro ya salió: la fecha de salida no se cambia.',
      });
    }

    const terms = await this.settings.current();
    const plannedPickupAt = new Date(input.plannedPickupAt ?? current.plannedPickupAt);
    const plannedReturnAt = new Date(input.plannedReturnAt ?? current.plannedReturnAt);
    const start =
      current.actualPickupAt === null ? plannedPickupAt : new Date(current.actualPickupAt);

    if (start.getTime() >= plannedReturnAt.getTime()) throw returnBeforePickup('plannedReturnAt');

    const datesChanged = input.plannedPickupAt !== undefined || input.plannedReturnAt !== undefined;
    const changes: AgreementChanges = {
      ...stripUndefined(input),
      ...(input.plannedPickupAt === undefined ? {} : { plannedPickupAt }),
      ...(input.plannedReturnAt === undefined ? {} : { plannedReturnAt }),
      ...(input.billableDays === undefined && datesChanged
        ? { billableDays: billableDays(start, plannedReturnAt, terms.graceHours) }
        : {}),
    };

    return this.write(id, 'update', () =>
      this.agreements.update(
        id,
        current.status,
        changes,
        datesChanged
          ? this.occupancy(current.vehicleId, { start, end: plannedReturnAt }, [id], terms)
          : null,
      ),
    );
  }

  async checkout(id: string, input: CheckoutInput, userId: string): Promise<RentalAgreement> {
    const current = await this.load(id);
    this.assertAllowed(current, 'checkout');
    await this.rentableVehicle(current.vehicleId);

    const terms = await this.settings.current();
    const plannedReturnAt = new Date(current.plannedReturnAt);
    const actualPickupAt = new Date(input.actualPickupAt);

    if (actualPickupAt.getTime() >= plannedReturnAt.getTime()) {
      throw returnBeforePickup('actualPickupAt');
    }

    // RN-3: el número se da antes de entregar; si la entrega falla, la reserva
    // se queda con su número, que igual iba a necesitar para imprimirse (097).
    await this.contracts.assign(id, terms.contractStartNumber);

    const days = billableDays(actualPickupAt, plannedReturnAt, terms.graceHours);
    const data = this.checkoutWrite(input, userId, days);

    return this.write(id, 'checkout', () =>
      this.agreements.checkout(
        id,
        data,
        this.occupancy(
          current.vehicleId,
          { start: actualPickupAt, end: plannedReturnAt },
          [id],
          terms,
        ),
      ),
    );
  }

  async checkin(id: string, input: CheckinInput, userId: string): Promise<RentalAgreement> {
    const current = await this.load(id);
    this.assertAllowed(current, 'checkin');

    const terms = await this.settings.current();
    const actualReturnAt = new Date(input.actualReturnAt);
    const actualPickupAt = new Date(current.actualPickupAt ?? current.plannedPickupAt);

    if (actualReturnAt.getTime() <= actualPickupAt.getTime()) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'El regreso tiene que ser después de la salida.',
        details: { actualReturnAt: 'El regreso tiene que ser después de la salida.' },
      });
    }

    const pickupKm = current.pickupOdometerKm;
    if (pickupKm !== null && input.inspection.odometerKm < pickupKm) {
      const message = `El kilometraje de regreso no puede ser menor que el de salida (${pickupKm} km).`;
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message,
        details: { 'inspection.odometerKm': message },
      });
    }

    const days =
      input.billableDays ?? billableDays(actualPickupAt, actualReturnAt, terms.graceHours);
    const extra = extraKmOf({
      pickupKm,
      returnKm: input.inspection.odometerKm,
      freeKmPerDay: current.vehicle.freeKmPerDay,
      extraKmPrice: current.vehicle.extraKmPrice,
      billableDays: days,
    });

    if (input.depositReturn !== undefined) {
      const held = depositHeldOf(current);
      if (moneyToCents(input.depositReturn.amount) > moneyToCents(held)) {
        throw new ConflictError({
          code: API_ERROR_CODES.DEPOSIT_EXCEEDS_HELD,
          message: `Solo hay $${held} de depósito para devolver.`,
          details: { held },
        });
      }
    }

    return this.write(id, 'checkin', () =>
      this.agreements.checkin(id, {
        actualReturnAt,
        inspection: input.inspection,
        billableDays: days,
        extraKmCharge: input.chargeExtraKm ? extra.charge : '0.00',
        notes: checkinNotesOf({
          current: current.notes,
          notes: input.notes,
          overriddenDays: input.billableDays ?? null,
          daysNote: input.billableDaysNote,
        }),
        ...(input.payment === undefined ? {} : { payment: paymentOf(input.payment, userId) }),
        ...(input.depositReturn === undefined
          ? {}
          : {
              depositReturn: {
                amount: input.depositReturn.amount,
                note: depositReturnNoteOf(input.depositReturn.method, input.depositReturn.note),
              },
            }),
      }),
    );
  }

  async extend(id: string, input: ExtendInput, userId: string): Promise<RentalAgreement> {
    const current = await this.load(id);
    this.assertAllowed(current, 'extend');

    const terms = await this.settings.current();
    const previousReturnAt = new Date(current.plannedReturnAt);
    const newReturnAt = new Date(input.newReturnAt);

    if (newReturnAt.getTime() <= previousReturnAt.getTime()) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'La nueva fecha de regreso tiene que ser después de la actual.',
        details: { newReturnAt: 'La nueva fecha de regreso tiene que ser después de la actual.' },
      });
    }

    const start = new Date(current.actualPickupAt ?? current.plannedPickupAt);
    const days = billableDays(start, newReturnAt, terms.graceHours);

    return this.write(id, 'extend', () =>
      this.agreements.extend(
        id,
        {
          previousReturnAt,
          newReturnAt,
          billableDays: days,
          addedDays: Math.max(0, days - current.billableDays),
          ...(input.dailyRate === undefined ? {} : { dailyRate: input.dailyRate }),
          note: input.note ?? null,
          createdByUserId: userId,
        },
        this.occupancy(current.vehicleId, { start, end: newReturnAt }, [id], terms),
      ),
    );
  }

  async swap(id: string, input: SwapInput, userId: string): Promise<AgreementSwapResult> {
    const current = await this.load(id);
    this.assertAllowed(current, 'swap');

    if (input.newVehicleId === current.vehicleId) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Elegí un carro distinto al que tiene.',
        details: { newVehicleId: 'Elegí un carro distinto al que tiene.' },
      });
    }

    const vehicle = await this.rentableVehicle(input.newVehicleId);
    const terms = await this.settings.current();
    const at = new Date(input.at);
    const pickedUpAt = new Date(current.actualPickupAt ?? current.plannedPickupAt);

    if (at.getTime() <= pickedUpAt.getTime()) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'El cambio tiene que ser después de la salida.',
        details: { at: 'El cambio tiene que ser después de la salida.' },
      });
    }

    const plannedReturn = new Date(current.plannedReturnAt);
    // Si ya iba atrasada, la nueva renta arranca con un día por delante.
    const plannedReturnAt =
      plannedReturn.getTime() > at.getTime() ? plannedReturn : new Date(at.getTime() + DAY_MS);
    const openedDays = billableDays(at, plannedReturnAt, terms.graceHours);

    const result = await this.guarded(id, 'swap', () =>
      this.agreements.swap(
        id,
        {
          at,
          closedBillableDays: billableDays(pickedUpAt, at, terms.graceHours),
          reason: input.reason,
          opened: {
            ...termsOfRecord(current),
            dailyRate: input.dailyRate ?? rateForDays(vehicle, openedDays),
            billableDays: openedDays,
            extraCharges: '0.00',
            extraChargesNote: null,
            discount: '0.00',
            customerId: current.customerId,
            vehicleId: vehicle.id,
            plannedPickupAt: at,
            plannedReturnAt,
            createdByUserId: userId,
            checkout: {
              actualPickupAt: at,
              inspection: null,
              odometerKm: vehicle.odometerKm,
              billableDays: openedDays,
            },
          },
        },
        this.occupancy(vehicle.id, { start: at, end: plannedReturnAt }, [], terms),
      ),
    );

    await this.contracts.assign(result.opened.id, terms.contractStartNumber);
    const now = this.clock.now();
    const [closed, opened] = await Promise.all([this.load(id), this.load(result.opened.id)]);

    return { closed: toRentalAgreement(closed, now), opened: toRentalAgreement(opened, now) };
  }

  async reassign(id: string, input: ReassignInput): Promise<RentalAgreement> {
    const current = await this.load(id);
    this.assertAllowed(current, 'reassign');

    const vehicle = await this.rentableVehicle(input.vehicleId);
    const terms = await this.settings.current();
    const interval = {
      start: new Date(current.plannedPickupAt),
      end: new Date(current.plannedReturnAt),
    };

    return this.write(id, 'reassign', () =>
      this.agreements.update(
        id,
        current.status,
        {
          vehicleId: vehicle.id,
          ...(input.dailyRate === undefined ? {} : { dailyRate: input.dailyRate }),
        },
        this.occupancy(vehicle.id, interval, [id], terms),
      ),
    );
  }

  async cancel(id: string, input: CancelInput): Promise<RentalAgreement> {
    const current = await this.load(id);
    this.assertAllowed(current, 'cancel');

    if (current.status === 'IN_PROGRESS' && hasLivePayments(current)) {
      throw new ConflictError({
        code: API_ERROR_CODES.AGREEMENT_NOT_RESERVED,
        message: 'La renta ya tiene pagos: recibí el carro o anulá los pagos antes de cancelarla.',
      });
    }

    return this.write(id, 'cancel', () =>
      this.agreements.cancel(id, current.status, input.reason, this.clock.now()),
    );
  }

  /** RN-3: idempotente. Una renta con número lo devuelve tal cual. */
  async assignContractNumber(id: string): Promise<RentalAgreement> {
    const current = await this.load(id);

    if (current.contractNumber !== null) return toRentalAgreement(current, this.clock.now());
    if (current.status === 'CANCELLED') throw closed();

    const terms = await this.settings.current();
    await this.contracts.assign(id, terms.contractStartNumber);

    return this.get(id);
  }

  // -------------------------------------------------------------------------

  private async load(id: string): Promise<AgreementRecord> {
    const record = await this.agreements.findById(id);

    if (record === null) throw notFound('Esa renta no existe.');

    return record;
  }

  private assertAllowed(record: AgreementRecord, action: AgreementAction): void {
    const block = transitionBlock(record.status, action);

    if (block === 'CLOSED') throw closed();
    if (block === 'NOT_RESERVED') {
      throw new ConflictError({
        code: API_ERROR_CODES.AGREEMENT_NOT_RESERVED,
        message: 'Eso solo se puede con una renta reservada: el carro ya salió.',
      });
    }
    if (block === 'NOT_IN_PROGRESS') {
      throw new ConflictError({
        code: API_ERROR_CODES.AGREEMENT_NOT_IN_PROGRESS,
        message: 'Eso solo se puede con una renta en curso: el carro todavía no salió.',
      });
    }
  }

  /** El carro existe y se puede rentar (no está en taller ni retirado). */
  private async rentableVehicle(id: string): Promise<RentalAgreementVehicle> {
    const vehicle = await this.vehicles.findById(id);

    if (vehicle === null) throw notFound('Ese carro no existe.');
    if (vehicle.status !== 'ACTIVE') {
      throw new ConflictError({
        code: API_ERROR_CODES.VEHICLE_NOT_RENTABLE,
        message:
          vehicle.status === 'IN_SHOP'
            ? 'Ese carro está en el taller: no se renta.'
            : 'Ese carro está retirado: no se renta.',
        details: { vehicleId: vehicle.id, status: vehicle.status },
      });
    }

    return vehicle;
  }

  /** RN-2: el chequeo que corre el repositorio con el carro bloqueado. */
  private occupancy(
    vehicleId: string,
    candidate: Interval,
    excludeIds: readonly string[],
    terms: RentalTerms,
  ): OccupancyCheck {
    const now = this.clock.now();
    const bufferMs = bufferMsOf(terms.bufferHours);

    return {
      vehicleId,
      excludeIds,
      assertFree: (occupying) => {
        const clash = findClash(
          candidate,
          occupying.filter((agreement) => !excludeIds.includes(agreement.id)),
          bufferMs,
          now,
        );

        if (clash !== null) {
          throw new ConflictError({
            code: API_ERROR_CODES.VEHICLE_UNAVAILABLE,
            message: `El carro ya está ${
              clash.status === 'IN_PROGRESS' ? 'rentado' : 'reservado'
            } a ${clash.customer.fullName} en esas fechas (con ${terms.bufferHours} h de margen).`,
            details: {
              agreementId: clash.id,
              contractNumber: clash.contractNumber,
              customerName: clash.customer.fullName,
              start: clash.actualPickupAt ?? clash.plannedPickupAt,
              end: clash.plannedReturnAt,
            },
          });
        }
      },
    };
  }

  private termsOf(
    input: CreateAgreementInput,
    vehicle: RentalAgreementVehicle,
    days: number,
    terms: RentalTerms,
  ): AgreementTermsWrite {
    return {
      pickupLocation: input.pickupLocation,
      returnLocation: input.returnLocation,
      dailyRate: input.dailyRate ?? rateForDays(vehicle, days),
      billableDays: days,
      cdwPerDay: input.cdwPerDay ?? terms.defaultCdwPerDay ?? '0.00',
      deductible: input.deductible ?? terms.defaultDeductible ?? '0.00',
      coverage: input.coverage,
      includesVat: input.includesVat,
      extraCharges: input.extraCharges,
      extraChargesNote: input.extraChargesNote ?? null,
      discount: input.discount,
      deposit: input.deposit,
      depositMethod: input.depositMethod ?? null,
      cardLast4: input.cardLast4 ?? null,
      authorizationCode: input.authorizationCode ?? null,
      authorizationAmount: input.authorizationAmount ?? null,
      authorizationDate: input.authorizationDate ?? null,
      additionalDriver: input.additionalDriver ?? null,
      notes: input.notes ?? null,
    };
  }

  private checkoutWrite(input: CheckoutInput, userId: string, days: number): CheckoutWrite {
    return {
      actualPickupAt: new Date(input.actualPickupAt),
      inspection: input.inspection,
      odometerKm: input.inspection.odometerKm,
      billableDays: days,
      ...(input.deposit === undefined ? {} : { deposit: input.deposit }),
      ...(input.depositMethod === undefined ? {} : { depositMethod: input.depositMethod }),
      ...(input.payment === undefined ? {} : { payment: paymentOf(input.payment, userId) }),
    };
  }

  /**
   * Corre la escritura y, si la renta cambió de estado entre la lectura y la
   * transacción, responde con el mismo 409 que habría dado leyéndola de nuevo.
   */
  private async guarded<T>(id: string, action: AgreementAction, run: () => Promise<T>): Promise<T> {
    try {
      return await this.withOpenCash(run);
    } catch (error) {
      if (error instanceof AgreementStatusChangedError) {
        this.assertAllowed(await this.load(id), action);
        throw closed();
      }
      throw error;
    }
  }

  /** Checkout, checkin y el alta con entrega traducen la falta de turno al 409 del cobro. */
  private async withOpenCash<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof CashSessionGoneError) throw cashNotOpenForCharge();
      throw error;
    }
  }

  private async write(
    id: string,
    action: AgreementAction,
    run: () => Promise<AgreementRecord>,
  ): Promise<RentalAgreement> {
    return toRentalAgreement(await this.guarded(id, action, run), this.clock.now());
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function notFound(message: string): NotFoundError {
  return new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message });
}

function closed(): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.AGREEMENT_CLOSED,
    message: 'La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.',
  });
}

function returnBeforePickup(field: string): ValidationError {
  return new ValidationError({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message: 'El regreso tiene que ser después de la salida.',
    details: { [field]: 'El regreso tiene que ser después de la salida.' },
  });
}

function paymentOf(payment: NonNullable<CheckoutInput['payment']>, userId: string): PaymentWrite {
  return {
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference ?? null,
    note: payment.note ?? null,
    receivedByUserId: userId,
  };
}

/** Las condiciones de una renta que pasan a la nueva en un cambio de carro. */
function termsOfRecord(record: AgreementRecord): AgreementTermsWrite {
  return {
    pickupLocation: record.pickupLocation,
    returnLocation: record.returnLocation,
    dailyRate: record.dailyRate,
    billableDays: record.billableDays,
    cdwPerDay: record.cdwPerDay,
    deductible: record.deductible,
    coverage: record.coverage,
    includesVat: record.includesVat,
    extraCharges: record.extraCharges,
    extraChargesNote: record.extraChargesNote,
    discount: record.discount,
    deposit: depositHeldOf(record),
    depositMethod: record.depositMethod,
    cardLast4: record.cardLast4,
    authorizationCode: record.authorizationCode,
    authorizationAmount: record.authorizationAmount,
    authorizationDate: record.authorizationDate,
    additionalDriver: record.additionalDriver,
    notes: record.notes,
  };
}

/** Un PATCH sin las claves que no vinieron: lo que no viene no se toca. */
function stripUndefined(input: UpdateAgreementInput): AgreementChanges {
  const { plannedPickupAt, plannedReturnAt, ...rest } = input;
  void plannedPickupAt;
  void plannedReturnAt;

  return Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  ) as AgreementChanges;
}
