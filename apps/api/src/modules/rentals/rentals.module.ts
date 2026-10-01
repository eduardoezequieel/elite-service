import { Module } from '@nestjs/common';

import { AgreementUseCases } from './application/agreement.usecases';
import { AvailabilityUseCases } from './application/availability.usecases';
import { AGREEMENT_REPOSITORY } from './application/ports/agreement.repository';
import type { AgreementRepository } from './application/ports/agreement.repository';
import {
  CLOCK,
  CONTRACT_NUMBER_SEQUENCE,
  FLEET_VEHICLE_READER,
  RENTAL_SETTINGS_READER,
  RENTER_READER,
} from './application/ports/readers';
import type {
  Clock,
  ContractNumberSequence,
  FleetVehicleReader,
  RentalSettingsReader,
  RenterReader,
} from './application/ports/readers';
import { PrismaAgreementRepository } from './infrastructure/prisma-agreement.repository';
import {
  PrismaContractNumberSequence,
  PrismaFleetVehicleReader,
  PrismaRentalSettingsReader,
  PrismaRenterReader,
  SystemClock,
} from './infrastructure/prisma-readers';
import { RentalsController } from './presentation/rentals.controller';

/**
 * Rentas de la rentadora (096): reserva, entrega, recepción, extensión,
 * cambio de carro, reasignación, cancelación, disponibilidad y calendario.
 * Lee la flota, los clientes y los ajustes de la 095 con lectores propios.
 */
@Module({
  controllers: [RentalsController],
  providers: [
    { provide: AGREEMENT_REPOSITORY, useClass: PrismaAgreementRepository },
    { provide: FLEET_VEHICLE_READER, useClass: PrismaFleetVehicleReader },
    { provide: RENTER_READER, useClass: PrismaRenterReader },
    { provide: RENTAL_SETTINGS_READER, useClass: PrismaRentalSettingsReader },
    { provide: CONTRACT_NUMBER_SEQUENCE, useClass: PrismaContractNumberSequence },
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: AgreementUseCases,
      useFactory: (
        agreements: AgreementRepository,
        vehicles: FleetVehicleReader,
        renters: RenterReader,
        settings: RentalSettingsReader,
        contracts: ContractNumberSequence,
        clock: Clock,
      ) => new AgreementUseCases(agreements, vehicles, renters, settings, contracts, clock),
      inject: [
        AGREEMENT_REPOSITORY,
        FLEET_VEHICLE_READER,
        RENTER_READER,
        RENTAL_SETTINGS_READER,
        CONTRACT_NUMBER_SEQUENCE,
        CLOCK,
      ],
    },
    {
      provide: AvailabilityUseCases,
      useFactory: (
        agreements: AgreementRepository,
        vehicles: FleetVehicleReader,
        settings: RentalSettingsReader,
        clock: Clock,
      ) => new AvailabilityUseCases(agreements, vehicles, settings, clock),
      inject: [AGREEMENT_REPOSITORY, FLEET_VEHICLE_READER, RENTAL_SETTINGS_READER, CLOCK],
    },
  ],
  exports: [AgreementUseCases],
})
export class RentalsModule {}
