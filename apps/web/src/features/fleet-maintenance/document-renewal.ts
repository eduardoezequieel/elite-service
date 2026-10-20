import { createFleetExpenseSchema } from '@elite/shared';
import type {
  CreateFleetExpenseInput,
  UpdateFleetVehicleInput,
  VehicleDocumentKind,
} from '@elite/shared';

import { moneyOrNull } from '../rentals/form-draft';

/**
 * «Ya se renovó» (122): el seguro o la tarjeta de circulación. La fecha nueva
 * va al carro; el costo, si hay, a un gasto aparte. Puro.
 */

export interface RenewalValues {
  cost: string;
  paidAt: string;
  expiresAt: string;
}

export type RenewalErrors = Partial<Record<keyof RenewalValues, string>>;

/** El vencimiento que se propone: un año después del que había, o de hoy. */
export function suggestedExpiry(current: string | null, today: string): string {
  const base = current !== null && current >= today ? current : today;
  const year = Number(base.slice(0, 4));
  const month = base.slice(5, 7);
  const day = base.slice(8, 10);

  return `${year + 1}-${month}-${month === '02' && day === '29' ? '28' : day}`;
}

export function validateRenewal(values: RenewalValues, today: string): RenewalErrors {
  const errors: RenewalErrors = {};

  if (values.cost.trim() !== '') {
    const amount = createFleetExpenseSchema.shape.amount.safeParse(moneyOrNull(values.cost));
    if (!amount.success) errors.cost = amount.error.issues[0]?.message ?? 'Revise el monto.';
  }
  if (values.paidAt === '') errors.paidAt = 'Elija la fecha.';
  if (values.expiresAt === '') errors.expiresAt = 'Elija la nueva fecha de vencimiento.';
  else if (values.expiresAt < today) errors.expiresAt = 'No puede ser antes de hoy.';

  return errors;
}

/** El cambio del carro: solo la fecha del papel que se renovó. */
export function renewalVehicleInput(
  kind: VehicleDocumentKind,
  expiresAt: string,
): UpdateFleetVehicleInput {
  return kind === 'INSURANCE'
    ? { insuranceExpiresAt: expiresAt }
    : { registrationExpiresAt: expiresAt };
}

/** El gasto del pago, o `null` si no se escribió costo. */
export function renewalExpenseInput(
  kind: VehicleDocumentKind,
  vehicleId: string,
  values: RenewalValues,
): CreateFleetExpenseInput | null {
  const amount = values.cost.trim() === '' ? null : moneyOrNull(values.cost);

  if (amount === null) return null;

  return kind === 'INSURANCE'
    ? { vehicleId, type: 'INSURANCE', amount, incurredAt: values.paidAt }
    : {
        vehicleId,
        type: 'OTHER',
        amount,
        incurredAt: values.paidAt,
        description: 'Tarjeta de circulación',
      };
}
