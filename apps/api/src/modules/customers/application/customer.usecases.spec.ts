import type { Customer } from '@elite/shared';

import {
  FindCustomerMatchUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
} from './customer.usecases';
import { InMemoryCustomerRepository } from './testing/in-memory-customer.repository';

const juan: Customer = { id: 'c1', fullName: 'Juan Pérez', phone: '7777-8888', isActive: true };
const ana: Customer = { id: 'c2', fullName: 'Ana Ramos', phone: '2222-1111', isActive: true };
const baja: Customer = { id: 'c3', fullName: 'Pedro Baja', phone: '3333-4444', isActive: false };

function repository(): InMemoryCustomerRepository {
  return new InMemoryCustomerRepository([juan, ana, baja]);
}

describe('ListCustomersUseCase (004: activeOnly)', () => {
  it('por omision no devuelve desactivados', async () => {
    const list = new ListCustomersUseCase(repository());

    const found = await list.execute();

    expect(found.map((customer) => customer.id)).toEqual(['c2', 'c1']);
  });

  it('con activeOnly=false devuelve tambien los desactivados', async () => {
    const list = new ListCustomersUseCase(repository());

    const found = await list.execute({ activeOnly: false });

    expect(found.map((customer) => customer.id)).toEqual(['c2', 'c1', 'c3']);
  });

  it('filtra por texto libre, sobre nombre o telefono', async () => {
    const list = new ListCustomersUseCase(repository());

    expect(await list.execute({ query: 'ana' })).toEqual([ana]);
    expect(await list.execute({ query: '7777' })).toEqual([juan]);
  });
});

describe('GetCustomerUseCase', () => {
  it('devuelve el cliente', async () => {
    await expect(new GetCustomerUseCase(repository()).execute('c1')).resolves.toEqual(juan);
  });

  it('un id que no existe es 404', async () => {
    await expect(new GetCustomerUseCase(repository()).execute('nadie')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('FindCustomerMatchUseCase (RN-1, RN-4)', () => {
  const match = () => new FindCustomerMatchUseCase(repository());

  it('coincide por nombre escrito de otra forma', async () => {
    await expect(match().execute({ fullName: 'juan  perez' })).resolves.toEqual({
      customer: juan,
      on: 'name',
    });
  });

  it('coincide por telefono con otra puntuacion, y el telefono gana', async () => {
    await expect(match().execute({ fullName: 'Ana Ramos', phone: '7777 8888' })).resolves.toEqual({
      customer: juan,
      on: 'phone',
    });
  });

  it('no propone a un cliente desactivado (RN-4)', async () => {
    await expect(
      match().execute({ fullName: 'Pedro Baja', phone: '3333-4444' }),
    ).resolves.toBeNull();
  });

  it('sin coincidencia devuelve null', async () => {
    await expect(match().execute({ fullName: 'Nadie Nuevo' })).resolves.toBeNull();
  });
});
