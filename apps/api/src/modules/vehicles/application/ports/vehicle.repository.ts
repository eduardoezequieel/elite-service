import type { VehicleBodyType, VehicleWithOwner, WorkOrderStatus } from '@elite/shared';

export interface NewVehicleData {
  plate: string;
  bodyTypeId: string;
  /** Ausente: el carro nace sin responsable (040). */
  customerId?: string;
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
 * Filtro de busqueda de vehiculos.
 *
 * `customerId` trae los carros de un cliente —los que hoy son suyos, no los que
 * fueron (RN-12)—: es lo que la ficha del cliente muestra (004).
 */
export interface VehicleFilter {
  query?: string;
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
  search(filter?: VehicleFilter): Promise<VehicleWithOwner[]>;
  findById(id: string): Promise<VehicleWithOwner | null>;
  /**
   * La ficha con esa placa, activa o no: la placa es unica en la base, asi que
   * una sola consulta dice si esta tomada y por quien (079).
   */
  findByPlate(plate: string): Promise<VehicleWithOwner | null>;
  /** `exceptId` deja editar un vehiculo sin chocar contra su propia placa. */
  existsByPlate(plate: string, exceptId?: string): Promise<boolean>;
  create(data: NewVehicleData): Promise<VehicleWithOwner>;
  update(id: string, changes: VehicleChanges): Promise<VehicleWithOwner>;
  listBodyTypes(): Promise<VehicleBodyType[]>;
  bodyTypeExists(id: string): Promise<boolean>;
  /** Su lavado en `OPEN`, `WASHING` o `READY`, o `null`. Hay uno como maximo (090). */
  findUnchargedWash(vehicleId: string): Promise<VehicleWash | null>;
}

/** El lavado sin cobrar de un carro (090). */
export interface VehicleWash {
  id: string;
  number: string;
  status: WorkOrderStatus;
}

export const VEHICLE_REPOSITORY = Symbol('vehicles.VehicleRepository');
