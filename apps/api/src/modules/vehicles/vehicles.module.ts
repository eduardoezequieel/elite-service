import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { VEHICLE_REPOSITORY } from './application/ports/vehicle.repository';
import type { VehicleRepository } from './application/ports/vehicle.repository';
import {
  CreateVehicleUseCase,
  ListBodyTypesUseCase,
  ListVehiclesUseCase,
  UpdateVehicleUseCase,
} from './application/vehicle.usecases';
import { PrismaVehicleRepository } from './infrastructure/prisma-vehicle.repository';
import { VehicleBodyTypesController, VehiclesController } from './presentation/vehicles.controller';

/**
 * Vehiculos y tipos de carroceria. Exporta el repositorio porque la pista da de
 * alta vehiculos al vuelo al abrir un ticket (RN-7).
 */
@Module({
  imports: [PrismaModule],
  controllers: [VehiclesController, VehicleBodyTypesController],
  providers: [
    { provide: VEHICLE_REPOSITORY, useClass: PrismaVehicleRepository },
    {
      provide: ListVehiclesUseCase,
      useFactory: (vehicles: VehicleRepository) => new ListVehiclesUseCase(vehicles),
      inject: [VEHICLE_REPOSITORY],
    },
    {
      provide: ListBodyTypesUseCase,
      useFactory: (vehicles: VehicleRepository) => new ListBodyTypesUseCase(vehicles),
      inject: [VEHICLE_REPOSITORY],
    },
    {
      provide: CreateVehicleUseCase,
      useFactory: (vehicles: VehicleRepository) => new CreateVehicleUseCase(vehicles),
      inject: [VEHICLE_REPOSITORY],
    },
    {
      provide: UpdateVehicleUseCase,
      useFactory: (vehicles: VehicleRepository) => new UpdateVehicleUseCase(vehicles),
      inject: [VEHICLE_REPOSITORY],
    },
  ],
  exports: [VEHICLE_REPOSITORY, ListBodyTypesUseCase, ListVehiclesUseCase],
})
export class VehiclesModule {}
