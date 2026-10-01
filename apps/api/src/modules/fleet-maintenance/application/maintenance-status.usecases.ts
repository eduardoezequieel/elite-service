import { API_ERROR_CODES, fleetVehicleName } from '@elite/shared';
import type { MaintenanceStatusQuery, VehicleMaintenanceStatus } from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import { maintenanceWhatsappText, remindersCalendar } from '../domain/reminders';
import {
  KM_PER_DAY_WINDOW_DAYS,
  vehicleMaintenanceStatus,
  worstStatusRank,
} from '../domain/vehicle-status';
import type { MaintenanceVehicle } from '../domain/vehicle-status';
import type { FleetSnapshotSource } from './ports/fleet-snapshot.source';
import type { MaintenanceLogRepository } from './ports/maintenance-log.repository';
import type { MaintenancePlanRepository } from './ports/maintenance-plan.repository';
import type { MaintenanceSettingsSource } from './ports/maintenance-settings';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Qué le toca a cada carro (099 RN-1, RN-2, RN-6), y lo que sale de eso hacia
 * afuera: el texto para el taller y el calendario de recordatorios.
 */
export class MaintenanceStatusUseCases {
  constructor(
    private readonly fleet: FleetSnapshotSource,
    private readonly plan: MaintenancePlanRepository,
    private readonly logs: MaintenanceLogRepository,
    private readonly settings: MaintenanceSettingsSource,
    private readonly today: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Sin `vehicleId`, los carros que no están retirados, lo más urgente arriba.
   * Con `vehicleId`, ese carro aunque esté retirado (su ficha lo muestra).
   */
  async status(query: MaintenanceStatusQuery = {}): Promise<VehicleMaintenanceStatus[]> {
    const vehicles = await this.vehiclesFor(query.vehicleId);
    const ids = vehicles.map((vehicle) => vehicle.id);
    const today = this.today();
    const since = new Date(this.now().getTime() - KM_PER_DAY_WINDOW_DAYS * DAY_MS);

    const [settings, plan, lastServices, trips] = await Promise.all([
      this.settings.current(),
      this.plan.list(),
      this.logs.lastServices(ids),
      this.fleet.finishedTrips(ids, since),
    ]);
    const active = plan.filter((task) => task.isActive);

    return vehicles
      .map((vehicle) =>
        vehicleMaintenanceStatus({
          vehicle,
          plan: active,
          lastServices: lastServices.filter((service) => service.vehicleId === vehicle.id),
          trips: trips.filter((trip) => trip.vehicleId === vehicle.id),
          today,
          alerts: settings,
          days: query.days,
        }),
      )
      .sort(
        (left, right) =>
          worstStatusRank(left) - worstStatusRank(right) ||
          fleetVehicleName(left.vehicle).localeCompare(fleetVehicleName(right.vehicle), 'es'),
      );
  }

  /** `{ text }` para `wa.me`: los pendientes por carro (099). */
  async whatsappText(): Promise<{ text: string }> {
    const [statuses, settings] = await Promise.all([this.status(), this.settings.current()]);

    return {
      text: maintenanceWhatsappText(statuses, {
        companyName: settings.companyName,
        today: this.today(),
      }),
    };
  }

  /** El `.ics` con un evento por tarea vencida o próxima y por documento por vencer. */
  async remindersCalendar(): Promise<string> {
    const [statuses, settings] = await Promise.all([this.status(), this.settings.current()]);

    return remindersCalendar(statuses, {
      companyName: settings.companyName,
      today: this.today(),
      now: this.now(),
    });
  }

  private async vehiclesFor(vehicleId: string | undefined): Promise<MaintenanceVehicle[]> {
    if (vehicleId === undefined) return this.fleet.activeVehicles();

    const vehicle = await this.fleet.findVehicle(vehicleId);

    if (vehicle === null) {
      throw new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese carro no existe.' });
    }

    return [vehicle];
  }
}
