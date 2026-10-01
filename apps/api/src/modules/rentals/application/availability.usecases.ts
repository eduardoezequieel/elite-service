import {
  billableDays,
  bufferMsOf,
  centsToMoney,
  intervalsClash,
  moneyToCents,
  occupiedInterval,
  rateForDays,
  vehicleAvailability,
} from '@elite/shared';
import type {
  Availability,
  AvailabilityQuery,
  AvailabilityRow,
  CalendarQuery,
  CalendarRow,
  RentalAgreementVehicle,
} from '@elite/shared';

import { civilDayEnd, civilDayStart, toSlot } from '../domain/agreement';
import type { AgreementRecord } from '../domain/agreement';
import type { AgreementRepository } from './ports/agreement.repository';
import type { Clock, FleetVehicleReader, RentalSettingsReader } from './ports/readers';

const AVAILABILITY_ORDER: Record<Availability, number> = {
  FREE: 0,
  FREE_IF_RETURNED: 1,
  BUSY: 2,
};

/**
 * «¿Qué hay libre?» y el calendario de la flota (096): solo lectura, sobre las
 * mismas rentas y la misma regla de choque que el alta (RN-2, RN-5).
 */
export class AvailabilityUseCases {
  constructor(
    private readonly agreements: AgreementRepository,
    private readonly vehicles: FleetVehicleReader,
    private readonly settings: RentalSettingsReader,
    private readonly clock: Clock,
  ) {}

  /** Cada carro `ACTIVE` con su disponibilidad en el rango, la tarifa y el total estimado. */
  async availability(query: AvailabilityQuery): Promise<AvailabilityRow[]> {
    const now = this.clock.now();
    const terms = await this.settings.current();
    const vehicles = await this.vehicles.list({
      statuses: ['ACTIVE'],
      ...(query.category === undefined ? {} : { category: query.category }),
    });
    const occupying = byVehicle(
      await this.agreements.listOccupying(vehicles.map((vehicle) => vehicle.id)),
    );
    const range = { start: new Date(query.from), end: new Date(query.to) };
    const days = billableDays(range.start, range.end, terms.graceHours);
    const bufferMs = bufferMsOf(terms.bufferHours);

    return vehicles
      .map((vehicle): AvailabilityRow => {
        const { availability, blocking } = vehicleAvailability(
          occupying.get(vehicle.id) ?? [],
          range,
          bufferMs,
          now,
        );
        const dailyRate = rateForDays(vehicle, days);

        return {
          vehicle,
          availability,
          blocking: blocking === null ? null : toSlot(blocking, now),
          billableDays: days,
          dailyRate,
          estimatedTotal: centsToMoney(moneyToCents(dailyRate) * days),
        };
      })
      .sort(
        (left, right) =>
          AVAILABILITY_ORDER[left.availability] - AVAILABILITY_ORDER[right.availability],
      );
  }

  /**
   * Una fila por carro (los que no están retirados, más cualquiera que tenga
   * una renta en el rango) con las rentas no canceladas que tocan los días.
   */
  async calendar(query: CalendarQuery): Promise<CalendarRow[]> {
    const now = this.clock.now();
    const range = { start: civilDayStart(query.from), end: civilDayEnd(query.to) };
    const vehicles = await this.vehicles.list({ statuses: ['ACTIVE', 'IN_SHOP'] });
    const touching = (await this.agreements.listTouching(range.start, range.end, now)).filter(
      (agreement) =>
        agreement.status !== 'CANCELLED' &&
        intervalsClash(occupiedInterval(agreement, now), range, 0),
    );

    const rows = new Map<
      string,
      { vehicle: RentalAgreementVehicle; agreements: AgreementRecord[] }
    >(vehicles.map((vehicle) => [vehicle.id, { vehicle, agreements: [] }]));

    for (const agreement of touching) {
      const row = rows.get(agreement.vehicleId);

      if (row === undefined) {
        rows.set(agreement.vehicleId, { vehicle: agreement.vehicle, agreements: [agreement] });
      } else {
        row.agreements.push(agreement);
      }
    }

    return [...rows.values()].map(({ vehicle, agreements }) => ({
      vehicle,
      agreements: agreements
        .map((agreement) => toSlot(agreement, now))
        .sort((left, right) => left.start.localeCompare(right.start)),
    }));
  }
}

function byVehicle(agreements: readonly AgreementRecord[]): Map<string, AgreementRecord[]> {
  const grouped = new Map<string, AgreementRecord[]>();

  for (const agreement of agreements) {
    grouped.set(agreement.vehicleId, [...(grouped.get(agreement.vehicleId) ?? []), agreement]);
  }

  return grouped;
}
