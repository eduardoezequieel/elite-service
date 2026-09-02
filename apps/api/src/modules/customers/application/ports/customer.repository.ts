import type { Customer } from '@elite/shared';

/** Datos con los que nace un cliente. */
export interface NewCustomerData {
  fullName: string;
  phone?: string;
}

/** Cambios sobre un cliente. Lo que no viene, no se toca. */
export interface CustomerChanges {
  fullName?: string;
  phone?: string;
  isActive?: boolean;
}

/**
 * Filtro de busqueda de clientes.
 *
 * `activeOnly` es `true` por omision: quien busca casi siempre esta anotando un
 * lavado, y ahi un cliente dado de baja no se ofrece ni se puede elegir (004
 * RN-4). La pantalla de oficina pide `false` explicitamente, que es la unica
 * forma de volver a ver a alguien para reactivarlo.
 */
export interface CustomerFilter {
  query?: string;
  activeOnly?: boolean;
}

/**
 * Puerto de persistencia de clientes.
 *
 * `search` acepta un texto libre porque asi se usa: en el mostrador se escribe
 * un pedazo del nombre o del telefono, no un id.
 */
export interface CustomerRepository {
  search(filter?: CustomerFilter): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  create(data: NewCustomerData): Promise<Customer>;
  update(id: string, changes: CustomerChanges): Promise<Customer>;
}

export const CUSTOMER_REPOSITORY = Symbol('customers.CustomerRepository');
