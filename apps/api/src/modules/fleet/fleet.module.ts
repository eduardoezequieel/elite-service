import { Module } from '@nestjs/common';

import { FleetVehicleUseCases } from './application/fleet-vehicle.usecases';
import { FLEET_VEHICLE_REPOSITORY } from './application/ports/fleet-vehicle.repository';
import type { FleetVehicleRepository } from './application/ports/fleet-vehicle.repository';
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
    {
      provide: FleetVehicleUseCases,
      useFactory: (vehicles: FleetVehicleRepository): FleetVehicleUseCases =>
        new FleetVehicleUseCases(vehicles),
      inject: [FLEET_VEHICLE_REPOSITORY],
    },
  ],
  exports: [FleetVehicleUseCases],
})
export class FleetModule {}
