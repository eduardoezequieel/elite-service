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
 * Puerto de persistencia de clientes.
 *
 * `search` acepta un texto libre porque asi se usa: en el mostrador se escribe
 * un pedazo del nombre o del telefono, no un id.
 */
export interface CustomerRepository {
  search(query?: string): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  create(data: NewCustomerData): Promise<Customer>;
  update(id: string, changes: CustomerChanges): Promise<Customer>;
}

export const CUSTOMER_REPOSITORY = Symbol('customers.CustomerRepository');
