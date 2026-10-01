import type { CreateRenterInput, Renter, RentersQuery, UpdateRenterInput } from '@elite/shared';

/**
 * Puerto de persistencia de los clientes de renta (095). Es otra tabla que los
 * clientes del lavado (RN-1). No hay borrar: se desactivan o se bloquean (RN-6).
 */
export interface RenterRepository {
  /** Orden: nombre. */
  list(query: RentersQuery): Promise<Renter[]>;
  findById(id: string): Promise<Renter | null>;
  create(data: CreateRenterInput): Promise<Renter>;
  /** Varias altas de una vez (importación). Devuelve cuántas quedaron. */
  createMany(data: readonly CreateRenterInput[]): Promise<number>;
  /** Lo que no viene no se toca. */
  update(id: string, changes: UpdateRenterInput): Promise<Renter>;
}

export const RENTER_REPOSITORY = Symbol('renters.RenterRepository');
