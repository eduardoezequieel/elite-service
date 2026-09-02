import type { VehicleBodyType, VehicleWithOwner } from '@elite/shared';

export interface NewVehicleData {
  plate: string;
  bodyTypeId: string;
  customerId: string;
  make?: string;
  color?: string;
}

export interface VehicleChanges {
  plate?: string;
  bodyTypeId?: string;
  make?: string;
  color?: string;
  isActive?: boolean;
  /** Si viene, dispara la transferencia de propiedad con historial (RN-12). */
  customerId?: string;
}

/**
 * Puerto de persistencia de vehiculos y de tipos de carroceria.
 *
 * Los tipos van aca y no en su propio modulo porque son un catalogo cerrado de
 * tres filas que solo el vehiculo usa; darles un modulo entero seria mas
 * estructura que contenido.
 */
export interface VehicleRepository {
  search(query?: string): Promise<VehicleWithOwner[]>;
  findById(id: string): Promise<VehicleWithOwner | null>;
  findByPlate(plate: string): Promise<VehicleWithOwner | null>;
  /** `exceptId` deja editar un vehiculo sin chocar contra su propia placa. */
  existsByPlate(plate: string, exceptId?: string): Promise<boolean>;
  create(data: NewVehicleData): Promise<VehicleWithOwner>;
  update(id: string, changes: VehicleChanges): Promise<VehicleWithOwner>;
  listBodyTypes(): Promise<VehicleBodyType[]>;
  bodyTypeExists(id: string): Promise<boolean>;
}

export const VEHICLE_REPOSITORY = Symbol('vehicles.VehicleRepository');
