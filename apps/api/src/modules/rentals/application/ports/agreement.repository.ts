import type {
  AdditionalDriver,
  AgreementStatus,
  PaymentMethod,
  RentalCoverage,
  RentalInspection,
} from '@elite/shared';

import type { AgreementRecord } from '../../domain/agreement';

/**
 * Puerto de persistencia de las rentas (096). En producción lo implementa
 * Prisma; en los tests, una implementación en memoria.
 *
 * Toda escritura que mueve fechas o carro recibe un {@link OccupancyCheck}: el
 * repositorio bloquea la fila del carro, lee las rentas que lo ocupan **dentro
 * de la transacción** y se las pasa al chequeo, que decide (RN-2). Así dos
 * reservas simultáneas del mismo carro no pasan las dos.
 *
 * Cada escritura sobre una renta existente recibe el estado del que parte:
 * si dentro de la transacción ya es otro, lanza `AgreementStatusChangedError`.
 */

/** Las condiciones de la renta que se escriben en el alta y se editan después. */
export interface AgreementTermsWrite {
  pickupLocation: string;
  returnLocation: string;
  dailyRate: string;
  billableDays: number;
  cdwPerDay: string;
  deductible: string;
  coverage: RentalCoverage;
  includesVat: boolean;
  extraCharges: string;
  extraChargesNote: string | null;
  discount: string;
  deposit: string;
  depositMethod: PaymentMethod | null;
  cardLast4: string | null;
  authorizationCode: string | null;
  authorizationAmount: string | null;
  authorizationDate: string | null;
  additionalDriver: AdditionalDriver | null;
  notes: string | null;
}

/** Un pago que entra junto con la entrega o la recepción. */
export interface PaymentWrite {
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  receivedByUserId: string;
}

/** La entrega: RESERVED → IN_PROGRESS. */
export interface CheckoutWrite {
  actualPickupAt: Date;
  /** `null` en la renta que abre un cambio de carro: no hubo inspección. */
  inspection: RentalInspection | null;
  odometerKm: number;
  billableDays: number;
  deposit?: string;
  depositMethod?: PaymentMethod | null;
  payment?: PaymentWrite;
}

export interface NewAgreementData extends AgreementTermsWrite {
  customerId: string;
  vehicleId: string;
  plannedPickupAt: Date;
  plannedReturnAt: Date;
  createdByUserId: string;
  /** Si viene, la renta nace entregada (`checkoutNow`). */
  checkout?: CheckoutWrite;
}

/** PATCH: lo que no viene no se toca. */
export type AgreementChanges = Partial<
  AgreementTermsWrite & { plannedPickupAt: Date; plannedReturnAt: Date; vehicleId: string }
>;

/** La recepción: IN_PROGRESS → FINISHED. */
export interface CheckinWrite {
  actualReturnAt: Date;
  inspection: RentalInspection;
  billableDays: number;
  extraKmCharge: string;
  notes: string | null;
  payment?: PaymentWrite;
  depositReturn?: { amount: string; note: string | null };
}

export interface ExtendWrite {
  previousReturnAt: Date;
  newReturnAt: Date;
  billableDays: number;
  addedDays: number;
  dailyRate?: string;
  note: string | null;
  createdByUserId: string;
}

/** El cambio de carro: cierra una renta y abre otra, en una sola transacción. */
export interface SwapWrite {
  at: Date;
  closedBillableDays: number;
  reason: string;
  opened: NewAgreementData & { checkout: CheckoutWrite };
}

/** El chequeo de choque que corre adentro de la transacción (RN-2). */
export interface OccupancyCheck {
  vehicleId: string;
  /** Las rentas que no cuentan: la que se está editando. */
  excludeIds: readonly string[];
  /** Lanza si el carro no está libre. */
  assertFree(occupying: readonly AgreementRecord[]): void;
}

/** Filtros de la lista, ya traducidos a instantes. */
export interface AgreementListFilter {
  statuses?: readonly AgreementStatus[];
  /** Solo en curso con el regreso planificado antes de este instante (atrasadas). */
  lateBefore?: Date;
  customerId?: string;
  vehicleId?: string;
  /** Rentas cuyo tramo (RN-2, con `now` para las atrasadas) toca `[from, to)`. */
  touching?: { from: Date; to: Date; now: Date };
  q?: string;
}

export interface AgreementRepository {
  /** Orden: `plannedPickupAt` descendente. */
  list(filter: AgreementListFilter): Promise<AgreementRecord[]>;
  findById(id: string): Promise<AgreementRecord | null>;
  /** Las `RESERVED` e `IN_PROGRESS`, de esos carros o de todos. */
  listOccupying(vehicleIds?: readonly string[]): Promise<AgreementRecord[]>;
  /** Las no canceladas cuyo tramo toca `[from, to)`. */
  listTouching(from: Date, to: Date, now: Date): Promise<AgreementRecord[]>;
  create(data: NewAgreementData, check: OccupancyCheck): Promise<AgreementRecord>;
  update(
    id: string,
    from: AgreementStatus,
    changes: AgreementChanges,
    check: OccupancyCheck | null,
  ): Promise<AgreementRecord>;
  checkout(id: string, data: CheckoutWrite, check: OccupancyCheck): Promise<AgreementRecord>;
  checkin(id: string, data: CheckinWrite): Promise<AgreementRecord>;
  extend(id: string, data: ExtendWrite, check: OccupancyCheck): Promise<AgreementRecord>;
  swap(
    id: string,
    data: SwapWrite,
    check: OccupancyCheck,
  ): Promise<{ closed: AgreementRecord; opened: AgreementRecord }>;
  cancel(id: string, from: AgreementStatus, reason: string, at: Date): Promise<AgreementRecord>;
}

export const AGREEMENT_REPOSITORY = Symbol('rentals.AgreementRepository');
