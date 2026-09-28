import { API_ERROR_CODES, createInventoryDeliverySchema } from '@elite/shared';

import { ApplicationError } from '../../../common/errors/application-error';
import { applicationErrorStatus } from '../../../common/filters/application-error-status';
import type { Employee } from '../../employees/domain/employee';
import { InMemoryEmployeeRepository } from '../../employees/application/testing/in-memory-employee.repository';
import { InventoryBatchUseCases } from './inventory-batch.usecases';
import { InventoryCatalogUseCases } from './inventory-catalog.usecases';
import type { InventoryActor } from './inventory-movement.usecases';
import { InMemoryInventoryRepository } from './testing/in-memory-inventory.repository';
import { InMemoryLowStockEvents } from './testing/in-memory-low-stock-events';

async function failure(
  promise: Promise<unknown>,
): Promise<{ status: number; code: string; details?: unknown }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApplicationError) {
      return { status: applicationErrorStatus(error), code: error.code, details: error.details };
    }
    throw error;
  }
  throw new Error('se esperaba un error');
}

function employee(id: string, fullName: string, isActive = true): Employee {
  const now = new Date();

  return {
    id,
    username: id,
    pinHash: `hash-${id}`,
    fullName,
    isActive,
    pinChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

const actor: InventoryActor = {
  userId: 'user-1',
  event: { kind: 'user', id: 'user-1', name: 'Oficina' },
};

describe('InventoryBatchUseCases (091)', () => {
  let repo: InMemoryInventoryRepository;
  let events: InMemoryLowStockEvents;
  let catalog: InventoryCatalogUseCases;
  let batch: InventoryBatchUseCases;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository({ 'user-1': 'Oficina', juan: 'Juan Pérez' });
    events = new InMemoryLowStockEvents();
    catalog = new InventoryCatalogUseCases(repo);
    batch = new InventoryBatchUseCases(
      repo,
      new InMemoryEmployeeRepository([
        employee('juan', 'Juan Pérez'),
        employee('baja', 'De baja', false),
      ]),
      events,
    );
  });

  const product = (minStock?: string) =>
    catalog.createItem({ kind: 'PRODUCT', name: 'Coca cola', price: '1.25', minStock });
  const supply = (minStock?: string) =>
    catalog.createItem({ kind: 'SUPPLY', name: 'Franela', minStock });
  const stockOf = async (id: string) => (await catalog.findItem(id)).stockOnHand;

  describe('entrada de varios artículos', () => {
    it('suma cada uno, con la misma referencia, en el orden pedido', async () => {
      const soda = await product();
      const cloth = await supply();

      const { results } = await batch.recordEntries(
        {
          reference: 'Factura 4471',
          lines: [
            { itemId: soda.id, quantity: '24', unitCost: '0.70' },
            { itemId: cloth.id, quantity: '10' },
          ],
        },
        actor,
      );

      expect(results.map((result) => result.movement.itemId)).toEqual([soda.id, cloth.id]);
      expect(results[0]).toMatchObject({
        item: { stockOnHand: '24.000', averageCost: '0.70' },
        movement: {
          type: 'ENTRY',
          quantity: '24.000',
          unitCost: '0.70',
          reference: 'Factura 4471',
        },
      });
      expect(results[1].movement).toMatchObject({ unitCost: null, reference: 'Factura 4471' });
      expect(await stockOf(cloth.id)).toBe('10.000');
    });

    it('todo o nada (RN-2): con una línea inactiva no entra ninguna', async () => {
      const soda = await product();
      const cloth = await supply();
      await catalog.updateItem(cloth.id, { isActive: false });

      expect(
        await failure(
          batch.recordEntries(
            {
              lines: [
                { itemId: soda.id, quantity: '5' },
                { itemId: cloth.id, quantity: '5' },
              ],
            },
            actor,
          ),
        ),
      ).toMatchObject({
        status: 409,
        code: API_ERROR_CODES.ITEM_INACTIVE,
        details: { itemId: cloth.id },
      });
      expect(await stockOf(soda.id)).toBe('0.000');
      expect(repo.movements).toHaveLength(0);
    });

    it('404 con el artículo nombrado si una línea no existe, sin escribir nada', async () => {
      const soda = await product();

      expect(
        await failure(
          batch.recordEntries(
            {
              lines: [
                { itemId: soda.id, quantity: '5' },
                { itemId: 'nope', quantity: '1' },
              ],
            },
            actor,
          ),
        ),
      ).toMatchObject({ status: 404, details: { itemId: 'nope' } });
      expect(repo.movements).toHaveLength(0);
    });
  });

  describe('entrega a un trabajador', () => {
    async function stocked(minStock?: { product?: string; supply?: string }) {
      const soda = await product(minStock?.product);
      const cloth = await supply(minStock?.supply);
      await batch.recordEntries(
        {
          lines: [
            { itemId: soda.id, quantity: '10' },
            { itemId: cloth.id, quantity: '10' },
          ],
        },
        actor,
      );
      repo.movements.splice(0);

      return { soda, cloth };
    }

    it('el tipo decide (RN-1): producto → CONSUMPTION con precio, insumo → DISPATCH', async () => {
      const { soda, cloth } = await stocked();

      const { results } = await batch.deliver(
        {
          employeeId: 'juan',
          note: 'Almuerzo',
          lines: [
            { itemId: soda.id, quantity: '2' },
            { itemId: cloth.id, quantity: '3' },
          ],
        },
        actor,
      );

      expect(results[0].movement).toMatchObject({
        type: 'CONSUMPTION',
        quantity: '-2.000',
        unitPrice: '1.25',
        reason: 'Almuerzo',
        employee: { id: 'juan', fullName: 'Juan Pérez' },
      });
      expect(results[1].movement).toMatchObject({
        type: 'DISPATCH',
        quantity: '-3.000',
        unitPrice: null,
        employee: { id: 'juan' },
      });
      expect(await stockOf(soda.id)).toBe('8.000');
      expect(await stockOf(cloth.id)).toBe('7.000');
    });

    it('todo o nada (RN-2): si una no alcanza, no sale ninguna', async () => {
      const { soda, cloth } = await stocked();

      expect(
        await failure(
          batch.deliver(
            {
              employeeId: 'juan',
              lines: [
                { itemId: soda.id, quantity: '2' },
                { itemId: cloth.id, quantity: '11' },
              ],
            },
            actor,
          ),
        ),
      ).toMatchObject({
        status: 409,
        code: API_ERROR_CODES.INSUFFICIENT_STOCK,
        details: { itemId: cloth.id },
      });
      expect(await stockOf(soda.id)).toBe('10.000');
      expect(repo.movements).toHaveLength(0);
    });

    it('avisa del mínimo de cada línea que lo cruza, después de escribir', async () => {
      const { soda, cloth } = await stocked({ product: '9', supply: '9' });

      await batch.deliver(
        {
          employeeId: 'juan',
          lines: [
            { itemId: soda.id, quantity: '1' },
            { itemId: cloth.id, quantity: '1' },
          ],
        },
        actor,
      );

      expect(events.published.map((event) => event.itemId).sort()).toEqual(
        [soda.id, cloth.id].sort(),
      );
    });

    it('404 EMPLOYEE_NOT_FOUND con un empleado desactivado', async () => {
      const { soda } = await stocked();

      expect(
        await failure(
          batch.deliver({ employeeId: 'baja', lines: [{ itemId: soda.id, quantity: '1' }] }, actor),
        ),
      ).toMatchObject({ status: 404, code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND });
      expect(repo.movements).toHaveLength(0);
    });
  });

  it('un artículo va una sola vez (RN-3): lo corta el schema del contrato', () => {
    const id = '0b7e3f7a-8c1d-4c2b-9f0a-1a2b3c4d5e6f';
    const parsed = createInventoryDeliverySchema.safeParse({
      employeeId: id,
      lines: [
        { itemId: id, quantity: '1' },
        { itemId: id, quantity: '2' },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});
