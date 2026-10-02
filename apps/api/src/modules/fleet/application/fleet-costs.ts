import { API_ERROR_CODES, FLEET_COST_FIELDS } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';

import { ForbiddenError } from '../../../common/errors/application-error';

/**
 * Quién ve y escribe los costos de un carro (103, RN-1): quien tiene
 * `rentals.reports`. Es EL lugar de la regla; el controlador solo pasa el
 * permiso de quien pide.
 */
export interface FleetCostAccess {
  canSeeCosts: boolean;
}

/** El carro como lo ve quien no tiene `rentals.reports`: costos en `null` y `costsHidden`. */
export function hideCosts(vehicle: FleetVehicle): FleetVehicle {
  return {
    ...vehicle,
    purchasePrice: null,
    purchasedAt: null,
    financed: false,
    downPayment: null,
    installment: null,
    termMonths: null,
    financingStartedAt: null,
    installmentIncludesExtras: false,
    insuranceMonthly: null,
    gpsMonthly: null,
    otherFixedMonthly: null,
    costsHidden: true,
  };
}

export function withCostAccess(vehicle: FleetVehicle, access: FleetCostAccess): FleetVehicle {
  return access.canSeeCosts ? vehicle : hideCosts(vehicle);
}

/**
 * Los campos de costo que trae un pedido. En la edición cuenta todo lo que
 * viene; en el alta, lo que no es el valor por defecto (`financed: false`,
 * `null`), porque el schema del alta rellena esos dos booleanos solo.
 */
export function costFieldsIn(
  input: Partial<Record<(typeof FLEET_COST_FIELDS)[number], unknown>>,
  mode: 'create' | 'update',
): string[] {
  return FLEET_COST_FIELDS.filter((field) => {
    const value = input[field];

    if (value === undefined) return false;
    if (mode === 'update') return true;

    return value !== null && value !== false;
  });
}

/** 403 si quien escribe no ve costos y el pedido trae alguno (RN-1). */
export function assertCanWriteCosts(
  input: Partial<Record<(typeof FLEET_COST_FIELDS)[number], unknown>>,
  mode: 'create' | 'update',
  access: FleetCostAccess,
): void {
  if (access.canSeeCosts) return;

  const fields = costFieldsIn(input, mode);

  if (fields.length > 0) {
    throw new ForbiddenError({
      code: API_ERROR_CODES.FORBIDDEN,
      message: 'Los costos del carro solo los cambia quien tiene permiso de rentabilidad.',
      details: { fields },
    });
  }
}
