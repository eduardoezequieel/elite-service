import type {
  FleetVehicleCategory,
  FleetVehicleStatus,
  RentalAgreementVehicle,
} from '@elite/shared';

/**
 * Lo que las rentas (096) leen de la flota, de los clientes y de los ajustes
 * (095). Se implementan con Prisma dentro de este módulo, leyendo las tablas
 * directo, sin importar los módulos de la 095.
 */

export interface FleetVehicleReader {
  findById(id: string): Promise<RentalAgreementVehicle | null>;
  /** Orden: marca, modelo, placa. */
  list(filter: {
    statuses: readonly FleetVehicleStatus[];
    category?: FleetVehicleCategory;
  }): Promise<RentalAgreementVehicle[]>;
}

/** Lo que hace falta del cliente para dejarlo rentar (RN-6 de la 095). */
export interface RenterSummary {
  id: string;
  fullName: string;
  isBlocked: boolean;
  blockReason: string | null;
}

export interface RenterReader {
  findById(id: string): Promise<RenterSummary | null>;
}

/** Los ajustes que usan las rentas. */
export interface RentalTerms {
  bufferHours: number;
  graceHours: number;
  defaultCdwPerDay: string | null;
  defaultDeductible: string | null;
  contractStartNumber: number;
}

export interface RentalSettingsReader {
  current(): Promise<RentalTerms>;
}

/** RN-3: el número de contrato. */
export interface ContractNumberSequence {
  /**
   * Le da número a la renta si no tenía y devuelve el que quedó. Idempotente:
   * una renta con número lo conserva.
   */
  assign(agreementId: string, startNumber: number): Promise<number>;
}

/** El reloj, para que el atraso derivado se pruebe sin esperar. */
export interface Clock {
  now(): Date;
}

export const FLEET_VEHICLE_READER = Symbol('rentals.FleetVehicleReader');
export const RENTER_READER = Symbol('rentals.RenterReader');
export const RENTAL_SETTINGS_READER = Symbol('rentals.RentalSettingsReader');
export const CONTRACT_NUMBER_SEQUENCE = Symbol('rentals.ContractNumberSequence');
export const CLOCK = Symbol('rentals.Clock');
