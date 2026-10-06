import { Module } from '@nestjs/common';

import { FleetVehicleUseCases } from './application/fleet-vehicle.usecases';
import { FLEET_DAY_SOURCE } from './application/ports/fleet-day.source';
import type { FleetDaySource } from './application/ports/fleet-day.source';
import { FLEET_VEHICLE_REPOSITORY } from './application/ports/fleet-vehicle.repository';
import type { FleetVehicleRepository } from './application/ports/fleet-vehicle.repository';
import { PrismaFleetDaySource } from './infrastructure/prisma-fleet-day.source';
import { PrismaFleetVehicleRepository } from './infrastructure/prisma-fleet-vehicle.repository';
import { FleetController } from './presentation/fleet.controller';

/**
 * La flota de la rentadora (095). Exporta el caso de uso para que las rentas
 * (096) y el mantenimiento (099) lean un carro sin armar su propio repositorio.
 */
@Module({
  controllers: [FleetController],
  providers: [
    { provide: FLEET_VEHICLE_REPOSITORY, useClass: PrismaFleetVehicleRepository },
    { provide: FLEET_DAY_SOURCE, useClass: PrismaFleetDaySource },
    {
      provide: FleetVehicleUseCases,
      useFactory: (vehicles: FleetVehicleRepository, days: FleetDaySource): FleetVehicleUseCases =>
        new FleetVehicleUseCases(vehicles, days),
      inject: [FLEET_VEHICLE_REPOSITORY, FLEET_DAY_SOURCE],
    },
  ],
  exports: [FleetVehicleUseCases],
})
export class FleetModule {}
