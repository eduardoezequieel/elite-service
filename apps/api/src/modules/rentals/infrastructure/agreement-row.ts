import { additionalDriverSchema, rentalInspectionSchema } from '@elite/shared';
import type { AdditionalDriver, RentalAgreementVehicle, RentalInspection } from '@elite/shared';
import { Prisma } from '@prisma/client';
import type { FleetVehicle as FleetVehicleRow } from '@prisma/client';

import { dateToCivil } from '../../../common/prisma/date-column';
import type { AgreementRecord } from '../domain/agreement';

/**
 * Cómo se lee una renta de la base (096). Lo usan el repositorio y la
 * secuencia de contratos: si cada uno armara la suya, el mismo monto podría
 * salir con otro formato.
 */

export const AGREEMENT_INCLUDE = {
  customer: true,
  vehicle: true,
  payments: { orderBy: { paidAt: 'asc' } },
  fines: { orderBy: { occurredAt: 'asc' } },
  extensions: { orderBy: { createdAt: 'asc' } },
  next: { select: { id: true } },
} satisfies Prisma.RentalAgreementInclude;

export type AgreementRow = Prisma.RentalAgreementGetPayload<{
  include: typeof AGREEMENT_INCLUDE;
}>;

const money = (value: Prisma.Decimal): string => value.toFixed(2);
const optionalMoney = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : value.toFixed(2);
const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString());

/** Un JSON guardado que ya no cumple el contrato se lee como `null`, no como 500. */
function inspectionOf(value: Prisma.JsonValue | null): RentalInspection | null {
  if (value === null) return null;
  const parsed = rentalInspectionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function driverOf(value: Prisma.JsonValue | null): AdditionalDriver | null {
  if (value === null) return null;
  const parsed = additionalDriverSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** El carro resumido que viaja dentro de una renta y en disponibilidad. */
export function toAgreementVehicle(row: FleetVehicleRow): RentalAgreementVehicle {
  return {
    id: row.id,
    plate: row.plate,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    category: row.category,
    status: row.status,
    odometerKm: row.odometerKm,
    dailyRate: money(row.dailyRate),
    weeklyRate: optionalMoney(row.weeklyRate),
    monthlyRate: optionalMoney(row.monthlyRate),
    freeKmPerDay: row.freeKmPerDay,
    extraKmPrice: optionalMoney(row.extraKmPrice),
  };
}

export function toAgreementRecord(row: AgreementRow): AgreementRecord {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    status: row.status,
    customerId: row.customerId,
    vehicleId: row.vehicleId,
    customer: {
      id: row.customer.id,
      fullName: row.customer.fullName,
      documentId: row.customer.documentId,
      licenseNumber: row.customer.licenseNumber,
      licenseExpiresAt: dateToCivil(row.customer.licenseExpiresAt),
      birthDate: dateToCivil(row.customer.birthDate),
      mobilePhone: row.customer.mobilePhone,
      phone: row.customer.phone,
      isBlocked: row.customer.isBlocked,
    },
    vehicle: toAgreementVehicle(row.vehicle),
    plannedPickupAt: row.plannedPickupAt.toISOString(),
    plannedReturnAt: row.plannedReturnAt.toISOString(),
    actualPickupAt: iso(row.actualPickupAt),
    actualReturnAt: iso(row.actualReturnAt),
    pickupLocation: row.pickupLocation,
    returnLocation: row.returnLocation,
    dailyRate: money(row.dailyRate),
    billableDays: row.billableDays,
    cdwPerDay: money(row.cdwPerDay),
    deductible: money(row.deductible),
    coverage: row.coverage,
    includesVat: row.includesVat,
    extraCharges: money(row.extraCharges),
    extraChargesNote: row.extraChargesNote,
    discount: money(row.discount),
    extraKmCharge: money(row.extraKmCharge),
    deposit: money(row.deposit),
    depositMethod: row.depositMethod,
    depositReturnedAmount: optionalMoney(row.depositReturnedAmount),
    depositReturnedAt: iso(row.depositReturnedAt),
    depositReturnNote: row.depositReturnNote,
    depositTransferredToId: row.depositTransferredToId,
    cardLast4: row.cardLast4,
    authorizationCode: row.authorizationCode,
    authorizationAmount: optionalMoney(row.authorizationAmount),
    authorizationDate: dateToCivil(row.authorizationDate),
    additionalDriver: driverOf(row.additionalDriver),
    pickupInspection: inspectionOf(row.pickupInspection),
    returnInspection: inspectionOf(row.returnInspection),
    pickupOdometerKm: row.pickupOdometerKm,
    returnOdometerKm: row.returnOdometerKm,
    previousAgreementId: row.previousAgreementId,
    nextAgreementId: row.next?.id ?? null,
    swapReason: row.swapReason,
    cancelReason: row.cancelReason,
    cancelledAt: iso(row.cancelledAt),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      amount: money(payment.amount),
      method: payment.method,
      reference: payment.reference,
      note: payment.note,
      paidAt: payment.paidAt.toISOString(),
      voidedAt: iso(payment.voidedAt),
      voidReason: payment.voidReason,
    })),
    fines: row.fines.map((fine) => ({
      id: fine.id,
      occurredAt: fine.occurredAt.toISOString(),
      amount: money(fine.amount),
      description: fine.description,
      chargedToCustomer: fine.chargedToCustomer,
    })),
    extensions: row.extensions.map((extension) => ({
      id: extension.id,
      previousReturnAt: extension.previousReturnAt.toISOString(),
      newReturnAt: extension.newReturnAt.toISOString(),
      addedDays: extension.addedDays,
      note: extension.note,
      createdAt: extension.createdAt.toISOString(),
    })),
  };
}

/** Un JSON opcional para escribir: `null` es `DbNull` (la columna vacía). */
export function jsonColumn(value: object | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}
