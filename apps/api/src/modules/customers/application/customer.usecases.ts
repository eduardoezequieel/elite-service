import { API_ERROR_CODES } from '@elite/shared';
import type { CreateCustomerInput, Customer, UpdateCustomerInput } from '@elite/shared';
import { NotFoundException } from '@nestjs/common';

import type { CustomerChanges, CustomerRepository } from './ports/customer.repository';

/**
 * Clientes. Se desactivan, nunca se eliminan (RN-13): tienen vehiculos y
 * tickets colgando, y borrarlos perderia el historial del carro.
 *
 * Los tres casos de uso viven en un archivo porque son tres lineas cada uno y
 * comparten el mismo puerto; separarlos solo agregaria ceremonia.
 */
export class ListCustomersUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  execute(query?: string): Promise<Customer[]> {
    return this.customers.search(query);
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
