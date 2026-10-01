import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  UpdateFleetVehicleInput,
} from '@elite/shared';

/**
 * Puerto de persistencia de la flota (095). En producción lo implementa
 * Prisma; en los tests, una implementación en memoria.
 *
 * Recibe los tipos del contrato tal cual salen del schema: la placa ya viene
 * normalizada y los montos como cadena de dos decimales.
 */
export interface FleetVehicleRepository {
  /** Orden: estado (disponibles primero), marca, modelo. */
  list(query: FleetVehiclesQuery): Promise<FleetVehicle[]>;
  findById(id: string): Promise<FleetVehicle | null>;
  /** `exceptId` deja editar un carro sin chocar contra sí mismo. */
  existsByPlate(plate: string, exceptId?: string): Promise<boolean>;
  /** Nace `ACTIVE`. @throws FleetPlateTakenError si el índice único choca. */
  create(data: CreateFleetVehicleInput): Promise<FleetVehicle>;
  /** Lo que no viene no se toca. @throws FleetPlateTakenError si el índice único choca. */
  update(id: string, changes: UpdateFleetVehicleInput): Promise<FleetVehicle>;
}

export const FLEET_VEHICLE_REPOSITORY = Symbol('fleet.FleetVehicleRepository');
