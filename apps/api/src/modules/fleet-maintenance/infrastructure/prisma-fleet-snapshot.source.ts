import { Injectable } from '@nestjs/common';
import type { FleetVehicle } from '@prisma/client';

import { dateToCivil } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { FleetSnapshotSource } from '../application/ports/fleet-snapshot.source';
import type { FinishedTrip, MaintenanceVehicle } from '../domain/vehicle-status';

const VEHICLE_SELECT = {
  id: true,
  plate: true,
  make: true,
  model: true,
  year: true,
  odometerKm: true,
  status: true,
  insuranceExpiresAt: true,
  registrationExpiresAt: true,
} as const;

type VehicleRow = Pick<FleetVehicle, keyof typeof VEHICLE_SELECT>;

function toMaintenanceVehicle(row: VehicleRow): MaintenanceVehicle {
  return {
    id: row.id,
    plate: row.plate,
    make: row.make,
    model: row.model,
    year: row.year,
    odometerKm: row.odometerKm,
    status: row.status,
    insuranceExpiresAt: dateToCivil(row.insuranceExpiresAt),
    registrationExpiresAt: dateToCivil(row.registrationExpiresAt),
  };
}

/**
 * La flota y las rentas finalizadas, leídas directo de `fleet_vehicles` y
 * `rental_agreements` (099): el módulo no importa `fleet` ni `rentals`.
 */
@Injectable()
export class PrismaFleetSnapshotSource implements FleetSnapshotSource {
  constructor(private readonly prisma: PrismaService) {}

  async findVehicle(id: string): Promise<MaintenanceVehicle | null> {
    const row = await this.prisma.fleetVehicle.findUnique({
      where: { id },
      select: VEHICLE_SELECT,
    });

    return row === null ? null : toMaintenanceVehicle(row);
  }

  async activeVehicles(): Promise<MaintenanceVehicle[]> {
    const rows = await this.prisma.fleetVehicle.findMany({
      where: { status: { not: 'RETIRED' } },
      select: VEHICLE_SELECT,
      orderBy: [{ make: 'asc' }, { model: 'asc' }, { plate: 'asc' }],
    });

    return rows.map(toMaintenanceVehicle);
  }

  async finishedTrips(vehicleIds: readonly string[], since: Date): Promise<FinishedTrip[]> {
    if (vehicleIds.length === 0) return [];

    const rows = await this.prisma.rentalAgreement.findMany({
      where: {
        vehicleId: { in: [...vehicleIds] },
        status: 'FINISHED',
        actualReturnAt: { gte: since },
        pickupOdometerKm: { not: null },
        returnOdometerKm: { not: null },
      },
      select: {
        vehicleId: true,
        actualPickupAt: true,
        actualReturnAt: true,
        plannedPickupAt: true,
        pickupOdometerKm: true,
        returnOdometerKm: true,
      },
    });

    return rows.flatMap((row) =>
      row.actualReturnAt === null || row.pickupOdometerKm === null || row.returnOdometerKm === null
        ? []
        : [
            {
              vehicleId: row.vehicleId,
              pickupAt: row.actualPickupAt ?? row.plannedPickupAt,
              returnAt: row.actualReturnAt,
              pickupKm: row.pickupOdometerKm,
              returnKm: row.returnOdometerKm,
            },
          ],
    );
  }
}
