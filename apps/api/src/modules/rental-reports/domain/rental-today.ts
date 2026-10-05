import {
  PAYMENT_METHODS,
  centsToMoney,
  civilDateOfInstant,
  moneyToCents,
} from '@elite/shared';
import type {
  AgreementStatus,
  PaymentMethod,
  RentalToday,
  TodayRow,
  TodayVehicle,
  VehicleAvailability,
} from '@elite/shared';

import { vehicleAvailability } from '../../rentals/domain/vehicle-availability';
import type { DayAgreement } from '../../rentals/domain/vehicle-availability';

/** Una renta abierta, como la lee Hoy. Sin cuentas: el ingreso no entra acá. */
export interface TodayAgreementRecord {
  id: string;
  contractNumber: number | null;
  vehicleId: string;
  status: AgreementStatus;
  customerName: string;
  customerPhone: string;
  plannedPickupAt: string;
  plannedReturnAt: string;
}

/** Un pago de renta, anulado o no. Hoy suma los de hoy que siguen vigentes. */
export interface ReportPayment {
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  voidedAt: string | null;
}

/** Lo que Hoy necesita de un carro. `ReportVehicle` de shared lo cumple. */
export interface TodayVehicleSource {
  id: string;
  plate: string | null;
  make: string;
  model: string;
  status: 'ACTIVE' | 'IN_SHOP' | 'RETIRED';
}

/**
 * spec 107 — Hoy junta salidas, regresos, atrasos, lo cobrado y la tira de
 * carros. El día es el civil del taller (RN-1). El estado de cada carro sale
 * de `vehicleAvailability` (RN-2).
 */

const AVAILABILITY_ORDER: Record<VehicleAvailability, number> = {
  OVERDUE: 0,
  RESERVED: 1,
  RENTED: 2,
  FREE: 3,
  WORKSHOP: 4,
};

export function buildRentalToday(input: {
  vehicles: readonly TodayVehicleSource[];
  agreements: readonly TodayAgreementRecord[];
  payments: readonly ReportPayment[];
  now: Date;
}): RentalToday {
  const today = civilDateOfInstant(input.now);
  const vehicles = new Map(input.vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const departures: TodayRow[] = [];
  const returns: TodayRow[] = [];
  const overdue: TodayRow[] = [];

  for (const agreement of input.agreements) {
    const vehicle = vehicles.get(agreement.vehicleId);
    if (vehicle === undefined || vehicle.status === 'RETIRED') continue;

    const pickupDay = civilDateOfInstant(new Date(agreement.plannedPickupAt));
    const returnDay = civilDateOfInstant(new Date(agreement.plannedReturnAt));

    if (agreement.status === 'RESERVED' && pickupDay === today) {
      departures.push(toRow(agreement, vehicle, 'DEPARTURE', agreement.plannedPickupAt));
    } else if (agreement.status === 'IN_PROGRESS' && returnDay === today) {
      returns.push(toRow(agreement, vehicle, 'RETURN', agreement.plannedReturnAt));
    } else if (agreement.status === 'RESERVED' && pickupDay < today) {
      overdue.push(toRow(agreement, vehicle, 'OVERDUE', agreement.plannedPickupAt));
    } else if (agreement.status === 'IN_PROGRESS' && returnDay < today) {
      overdue.push(toRow(agreement, vehicle, 'OVERDUE', agreement.plannedReturnAt));
    }
  }

  departures.sort(byAt);
  returns.sort(byAt);
  overdue.sort(byAt);

  const byVehicle = new Map<string, DayAgreement[]>();
  for (const agreement of input.agreements) {
    const list = byVehicle.get(agreement.vehicleId) ?? [];
    list.push(agreement);
    byVehicle.set(agreement.vehicleId, list);
  }

  const fleet: TodayVehicle[] = input.vehicles.flatMap((vehicle) => {
    const state = vehicleAvailability(vehicle, byVehicle.get(vehicle.id) ?? [], input.now);
    if (state === null) return [];

    return [
      {
        vehicleId: vehicle.id,
        plate: vehicle.plate ?? '',
        vehicleName: `${vehicle.make} ${vehicle.model}`,
        availability: state.availability,
        ...(state.agreementId === null ? {} : { agreementId: state.agreementId }),
      },
    ];
  });
  fleet.sort(
    (left, right) =>
      AVAILABILITY_ORDER[left.availability] - AVAILABILITY_ORDER[right.availability] ||
      left.plate.localeCompare(right.plate, 'es'),
  );

  return {
    date: today,
    departures,
    returns,
    overdue,
    collected: collectedOn(input.payments, today),
    fleet,
  };
}

function toRow(
  agreement: TodayAgreementRecord,
  vehicle: TodayVehicleSource,
  kind: TodayRow['kind'],
  at: string,
): TodayRow {
  return {
    agreementId: agreement.id,
    contractNumber: agreement.contractNumber,
    vehicleId: vehicle.id,
    plate: vehicle.plate ?? '',
    vehicleName: `${vehicle.make} ${vehicle.model}`,
    customerName: agreement.customerName,
    customerPhone: agreement.customerPhone,
    at,
    kind,
  };
}

function byAt(left: TodayRow, right: TodayRow): number {
  return left.at.localeCompare(right.at);
}

function collectedOn(payments: readonly ReportPayment[], today: string): RentalToday['collected'] {
  const cents: Record<PaymentMethod, number> = {
    CASH: 0,
    CARD: 0,
    TRANSFER: 0,
    OTHER: 0,
  };

  for (const payment of payments) {
    if (payment.voidedAt !== null) continue;
    if (civilDateOfInstant(new Date(payment.paidAt)) !== today) continue;
    cents[payment.method] += moneyToCents(payment.amount);
  }

  const byMethod = Object.fromEntries(
    PAYMENT_METHODS.map((method) => [method, centsToMoney(cents[method])]),
  ) as Record<PaymentMethod, string>;
  const total = PAYMENT_METHODS.reduce((sum, method) => sum + cents[method], 0);

  return { total: centsToMoney(total), byMethod };
}
