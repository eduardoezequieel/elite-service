import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateCustomerInput,
  Customer,
  CustomerMatch,
  CustomerMatchQuery,
  UpdateCustomerInput,
} from '@elite/shared';
import { NotFoundException } from '@nestjs/common';

import { findCustomerMatch } from '../domain/customer-match';
import type {
  CustomerChanges,
  CustomerFilter,
  CustomerRepository,
} from './ports/customer.repository';

/**
 * Clientes. Se desactivan, nunca se eliminan (RN-13): tienen vehiculos y
 * tickets colgando, y borrarlos perderia el historial del carro.
 *
 * Los casos de uso viven en un archivo porque son tres lineas cada uno y
 * comparten el mismo puerto; separarlos solo agregaria ceremonia.
 */
export class ListCustomersUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  execute(filter: CustomerFilter = {}): Promise<Customer[]> {
    return this.customers.search(filter);
  }
}

/** Un cliente por id, para su ficha. Si no existe, 404 (004). */
export class GetCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);

    if (customer === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese cliente no existe.',
      });
    }

    return customer;
  }
}

/**
 * ¿Ya existe alguien asi? (004 RN-1, RN-2).
 *
 * Se pregunta justo antes de crear un cliente, para no duplicarlo en silencio.
 * Devuelve `null` cuando no hay nadie parecido: no es un error, es la respuesta
 * normal la mayoria de las veces.
 *
 * Compara contra **todos los clientes activos** cargados en memoria, y no con
 * un `WHERE` normalizado, porque normalizar en SQL —digitos del telefono,
 * nombre sin acentos— pediria la extension `unaccent` y una migracion que esta
 * spec no tiene. El taller tiene miles de clientes, no millones, y la
 * comparacion corre una sola vez por alta.
 */
export class FindCustomerMatchUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(query: CustomerMatchQuery): Promise<CustomerMatch | null> {
    // Un desactivado no se sugiere ni se propone como «el mismo» (RN-4): si
    // alguien vuelve, se lo reactiva desde Clientes, no desde un lavado.
    const candidates = await this.customers.search({ activeOnly: true });
    const found = findCustomerMatch(candidates, query);

    return found === null ? null : { customer: found.candidate, on: found.on };
  }
}

export class CreateCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  execute(input: CreateCustomerInput): Promise<Customer> {
    return this.customers.create(input);
  }
}

export class UpdateCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(id: string, input: UpdateCustomerInput): Promise<Customer> {
    if ((await this.customers.findById(id)) === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese cliente no existe.',
      });
    }

    const changes: CustomerChanges = {};

    if (input.fullName !== undefined) changes.fullName = input.fullName;
    if (input.phone !== undefined) changes.phone = input.phone;
    if (input.isActive !== undefined) changes.isActive = input.isActive;

    return this.customers.update(id, changes);
  }
}
