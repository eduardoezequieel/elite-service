import { civilDateOfInstant, derivedStatus } from '@elite/shared';
import type { AgreementStatus, FleetVehicleStatus, VehicleAvailability } from '@elite/shared';

/**
 * spec 107, RN-2 — El estado del día de un carro, en un solo lugar.
 *
 * Lo usa Hoy y lo va a usar la lista de Carros (110). `null` es un carro
 * retirado: no sale en Hoy. Una reserva que debía salir antes de hoy y no
 * salió no está libre: es un atraso, igual que una renta `LATE`.
 */

export interface DayVehicle {
  status: FleetVehicleStatus;
}

/** Lo mínimo de una renta para saber si el carro está ocupado hoy. */
export interface DayAgreement {
  id: string;
  status: AgreementStatus;
  plannedPickupAt: string;
  plannedReturnAt: string;
}

export interface VehicleDayState {
  availability: VehicleAvailability;
  /** La renta que define el estado. `null` si está libre o en el taller. */
  agreementId: string | null;
}

/**
 * RN-2: `IN_SHOP` → taller; renta `LATE` → atrasado; `IN_PROGRESS` → en renta;
 * reserva que sale hoy → reservado; reserva no retirada → atrasado; si no, libre.
 * `RETIRED` no tiene estado de día.
 */
export function vehicleAvailability(
  vehicle: DayVehicle,
  agreements: readonly DayAgreement[],
  now: Date,
): VehicleDayState | null {
  if (vehicle.status === 'RETIRED') return null;
  if (vehicle.status === 'IN_SHOP') return { availability: 'WORKSHOP', agreementId: null };

  const today = civilDateOfInstant(now);
  const inProgress = agreements.filter((agreement) => agreement.status === 'IN_PROGRESS');
  const late = inProgress.find((agreement) => derivedStatus(agreement, now) === 'LATE');

  if (late !== undefined) return { availability: 'OVERDUE', agreementId: late.id };

  const active = inProgress[0];
  if (active !== undefined) return { availability: 'RENTED', agreementId: active.id };

  const reserved = agreements
    .filter((agreement) => agreement.status === 'RESERVED')
    .sort((left, right) => left.plannedPickupAt.localeCompare(right.plannedPickupAt));
  const missed = reserved.find(
    (agreement) => civilDateOfInstant(new Date(agreement.plannedPickupAt)) < today,
  );

  if (missed !== undefined) return { availability: 'OVERDUE', agreementId: missed.id };

  const startingToday = reserved.find(
    (agreement) => civilDateOfInstant(new Date(agreement.plannedPickupAt)) === today,
  );

  if (startingToday !== undefined) {
    return { availability: 'RESERVED', agreementId: startingToday.id };
  }

  return { availability: 'FREE', agreementId: null };
}
