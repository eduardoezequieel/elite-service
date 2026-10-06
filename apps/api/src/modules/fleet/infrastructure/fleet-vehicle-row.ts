import type { FleetVehicle } from '@elite/shared';
import type { FleetVehicle as FleetVehicleRow, Prisma } from '@prisma/client';

import { dateToCivil } from '../../../common/prisma/date-column';

/**
 * Cómo se lee un carro de la flota de la base (095).
 *
 * Vive aparte del repositorio porque lo van a usar también las rentas (096),
 * el mantenimiento (099) y la rentabilidad (100): si cada uno armara su
 * `FleetVehicle`, la misma tarifa podría salir con otro formato.
 */

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function optionalMoney(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

export function toFleetVehicle(row: FleetVehicleRow): FleetVehicle {
  return {
    id: row.id,
    plate: row.plate,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    category: row.category,
    status: row.status,
    dailyRate: money(row.dailyRate),
    weeklyRate: optionalMoney(row.weeklyRate),
    monthlyRate: optionalMoney(row.monthlyRate),
    freeKmPerDay: row.freeKmPerDay,
    extraKmPrice: optionalMoney(row.extraKmPrice),
    odometerKm: row.odometerKm,
    purchasePrice: optionalMoney(row.purchasePrice),
    purchasedAt: dateToCivil(row.purchasedAt),
    financed: row.financed,
    downPayment: optionalMoney(row.downPayment),
    installment: optionalMoney(row.installment),
    termMonths: row.termMonths,
    financingStartedAt: dateToCivil(row.financingStartedAt),
    installmentIncludesExtras: row.installmentIncludesExtras,
    insuranceMonthly: optionalMoney(row.insuranceMonthly),
    gpsMonthly: optionalMoney(row.gpsMonthly),
    otherFixedMonthly: optionalMoney(row.otherFixedMonthly),
    insurer: row.insurer,
    policyNumber: row.policyNumber,
    insuranceExpiresAt: dateToCivil(row.insuranceExpiresAt),
    registrationExpiresAt: dateToCivil(row.registrationExpiresAt),
    notes: row.notes,
    /**
     * El caso de uso los pisa con el día y los avisos (110). Acá van vacíos
     * para que el tipo cierre antes de ese paso.
     */
    availability: null,
    alerts: [],
    /** Se lee entero; `FleetCostsInterceptor` lo esconde para quien no ve costos (103). */
    costsHidden: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
