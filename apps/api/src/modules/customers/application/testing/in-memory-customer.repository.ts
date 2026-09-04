import type { Customer } from '@elite/shared';

import type {
  CustomerChanges,
  CustomerFilter,
  CustomerRepository,
  NewCustomerData,
} from '../ports/customer.repository';

/**
 * Repositorio en memoria para los tests. Mismo contrato que el de Prisma,
 * incluida la busqueda por texto libre y el filtro `activeOnly` (004 RN-4).
 */
export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly rows = new Map<string, Customer>();
  private sequence = 0;

  constructor(seed: Customer[] = []) {
    for (const customer of seed) this.rows.set(customer.id, customer);
  }

  async search(filter: CustomerFilter = {}): Promise<Customer[]> {
    const { query, activeOnly = true } = filter;
    const needle = query?.trim().toLowerCase() ?? '';

    return [...this.rows.values()]
      .filter((row) => (activeOnly ? row.isActive : true))
      .filter(
        (row) =>
          needle === '' ||
          row.fullName.toLowerCase().includes(needle) ||
          (row.phone ?? '').includes(needle),
      )
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  async findById(id: string): Promise<Customer | null> {
    return this.rows.get(id) ?? null;
  }

  async create(data: NewCustomerData): Promise<Customer> {
    const customer: Customer = {
      id: `customer-${++this.sequence}`,
      fullName: data.fullName,
      phone: data.phone ?? null,
      isActive: true,
    };

    this.rows.set(customer.id, customer);

    return customer;
  }

  async update(id: string, changes: CustomerChanges): Promise<Customer> {
    const current = this.rows.get(id);

    if (current === undefined) throw new Error(`No existe el cliente ${id}`);

    const updated: Customer = { ...current, ...changes };

    this.rows.set(id, updated);

    return updated;
  }
}
