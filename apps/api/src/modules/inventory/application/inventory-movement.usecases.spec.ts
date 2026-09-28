import { API_ERROR_CODES } from '@elite/shared';

import { ApplicationError } from '../../../common/errors/application-error';
import { applicationErrorStatus } from '../../../common/filters/application-error-status';
import type { Employee } from '../../employees/domain/employee';
import { InMemoryEmployeeRepository } from '../../employees/application/testing/in-memory-employee.repository';
import { InventoryCatalogUseCases } from './inventory-catalog.usecases';
import { InventoryMovementUseCases, type InventoryActor } from './inventory-movement.usecases';
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
const page = { page: 1, pageSize: 50 };

describe('InventoryMovementUseCases', () => {
  let repo: InMemoryInventoryRepository;
  let events: InMemoryLowStockEvents;
  let catalog: InventoryCatalogUseCases;
  let movements: InventoryMovementUseCases;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository({ 'user-1': 'Oficina', 'emp-1': 'Juan Pérez' });
    events = new InMemoryLowStockEvents();
    catalog = new InventoryCatalogUseCases(repo);
    movements = new InventoryMovementUseCases(
      repo,
      new InMemoryEmployeeRepository([
        employee('emp-1', 'Juan Pérez'),
        employee('emp-2', 'De baja', false),
      ]),
      events,
    );
  });

  const supply = (minStock?: string) =>
    catalog.createItem({ kind: 'SUPPLY', name: 'Franela', minStock });
  const product = (minStock?: string) =>
    catalog.createItem({ kind: 'PRODUCT', name: 'Cera en pasta', price: '3.00', minStock });

  describe('entrada (RN-11)', () => {
    it('suma la existencia y deja el movimiento con saldo, costo y referencia', async () => {
      const item = await product();
      const result = await movements.registerEntry(
        item.id,
        { quantity: '3.000', unitCost: '2.00', reference: 'Factura 123' },
        actor,
      );

      expect(result.item.stockOnHand).toBe('3.000');
      expect(result.item.averageCost).toBe('2.00');
      expect(result.movement).toMatchObject({
        type: 'ENTRY',
        quantity: '3.000',
        balanceAfter: '3.000',
        unitCost: '2.00',
        reference: 'Factura 123',
        createdBy: { kind: 'user', id: 'user-1', fullName: 'Oficina' },
      });
    });

    it('recalcula el promedio ponderado con la existencia previa', async () => {
      const item = await product();
      await movements.registerEntry(item.id, { quantity: '10.000', unitCost: '2.00' }, actor);
      const result = await movements.registerEntry(
        item.id,
        { quantity: '10.000', unitCost: '3.00' },
        actor,
      );

      expect(result.item.averageCost).toBe('2.50');
    });

    it('sin costo no toca el promedio', async () => {
      const item = await product();
      await movements.registerEntry(item.id, { quantity: '2.000', unitCost: '4.00' }, actor);
      const result = await movements.registerEntry(item.id, { quantity: '2.000' }, actor);

      expect(result.item.averageCost).toBe('4.00');
      expect(result.movement.unitCost).toBeNull();
    });

    it('409 ITEM_INACTIVE en un artículo desactivado', async () => {
      const item = await product();
      await catalog.updateItem(item.id, { isActive: false });

      expect(
        await failure(movements.registerEntry(item.id, { quantity: '1.000' }, actor)),
      ).toMatchObject({
        status: 409,
        code: API_ERROR_CODES.ITEM_INACTIVE,
      });
    });

    it('404 si el artículo no existe', async () => {
      expect(
        (await failure(movements.registerEntry('nope', { quantity: '1.000' }, actor))).status,
      ).toBe(404);
    });
  });

  describe('despacho (RN-10)', () => {
    it('a quién despachar: solo empleados activos, id y nombre', async () => {
      await expect(movements.listDispatchEmployees()).resolves.toEqual([
        { id: 'emp-1', fullName: 'Juan Pérez' },
      ]);
    });

    it('saca la existencia y guarda quién recibió y quién despachó', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '10.000' }, actor);

      const result = await movements.dispatch(
        item.id,
        { quantity: '4.000', employeeId: 'emp-1', note: 'Bahía 2' },
        actor,
      );

      expect(result.item.stockOnHand).toBe('6.000');
      expect(result.movement).toMatchObject({
        type: 'DISPATCH',
        quantity: '-4.000',
        balanceAfter: '6.000',
        reason: 'Bahía 2',
        employee: { id: 'emp-1', fullName: 'Juan Pérez' },
        createdBy: { kind: 'user', id: 'user-1' },
      });
    });

    it('409 INSUFFICIENT_STOCK con lo que hay en details', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '6.000' }, actor);

      expect(
        await failure(
          movements.dispatch(item.id, { quantity: '7.000', employeeId: 'emp-1' }, actor),
        ),
      ).toEqual({
        status: 409,
        code: API_ERROR_CODES.INSUFFICIENT_STOCK,
        details: { itemId: item.id, available: '6.000' },
      });
      expect((await catalog.findItem(item.id)).stockOnHand).toBe('6.000');
    });

    it('404 EMPLOYEE_NOT_FOUND si no existe o está desactivado', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '6.000' }, actor);

      for (const employeeId of ['emp-2', 'emp-9']) {
        expect(
          await failure(movements.dispatch(item.id, { quantity: '1.000', employeeId }, actor)),
        ).toMatchObject({ status: 404, code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND });
      }
    });

    it('409 ITEM_INACTIVE en un artículo desactivado', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '6.000' }, actor);
      await catalog.updateItem(item.id, { isActive: false });

      expect(
        await failure(
          movements.dispatch(item.id, { quantity: '1.000', employeeId: 'emp-1' }, actor),
        ),
      ).toMatchObject({ status: 409, code: API_ERROR_CODES.ITEM_INACTIVE });
    });

    it('un producto no se despacha: 409 ITEM_NOT_DISPATCHABLE y nada cambia (072)', async () => {
      const item = await product('1.000');
      await movements.registerEntry(item.id, { quantity: '2.000' }, actor);

      expect(
        await failure(
          movements.dispatch(item.id, { quantity: '1.000', employeeId: 'emp-1' }, actor),
        ),
      ).toEqual({
        status: 409,
        code: API_ERROR_CODES.ITEM_NOT_DISPATCHABLE,
        details: { itemId: item.id },
      });
      expect((await catalog.findItem(item.id)).stockOnHand).toBe('2.000');
      expect((await movements.listItemMovements(item.id, page)).total).toBe(1);
      expect(events.published).toHaveLength(0);
    });

    it('404 si el artículo no existe', async () => {
      expect(
        (
          await failure(
            movements.dispatch('nope', { quantity: '1.000', employeeId: 'emp-1' }, actor),
          )
        ).status,
      ).toBe(404);
    });
  });

  describe('ajuste (RN-12)', () => {
    it('suma o resta con motivo', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '2.000' }, actor);

      const result = await movements.adjust(
        item.id,
        { quantity: '-1.500', reason: 'Conteo físico' },
        actor,
      );

      expect(result.item.stockOnHand).toBe('0.500');
      expect(result.movement).toMatchObject({
        type: 'ADJUSTMENT',
        quantity: '-1.500',
        reason: 'Conteo físico',
      });
    });

    it('−3 sobre 2 responde 409 INSUFFICIENT_STOCK', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '2.000' }, actor);

      expect(
        await failure(movements.adjust(item.id, { quantity: '-3.000', reason: 'Conteo' }, actor)),
      ).toMatchObject({ status: 409, code: API_ERROR_CODES.INSUFFICIENT_STOCK });
    });

    it('se puede ajustar un artículo desactivado', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '2.000' }, actor);
      await catalog.updateItem(item.id, { isActive: false });

      await expect(
        movements.adjust(item.id, { quantity: '-2.000', reason: 'Baja' }, actor),
      ).resolves.toMatchObject({ item: { stockOnHand: '0.000' } });
    });
  });

  describe('aviso de mínimo (RN-13)', () => {
    it('avisa una vez al cruzar y se rearma al subir', async () => {
      const item = await supply('5.000');
      await movements.registerEntry(item.id, { quantity: '6.000' }, actor);
      expect(events.published).toHaveLength(0);

      await movements.dispatch(item.id, { quantity: '1.000', employeeId: 'emp-1' }, actor);
      expect(events.published).toEqual([
        {
          itemId: item.id,
          name: 'Franela',
          stockOnHand: '5.000',
          minStock: '5.000',
          unit: 'unidad',
          actor: actor.event,
        },
      ]);

      await movements.adjust(item.id, { quantity: '-2.000', reason: 'Conteo' }, actor);
      expect(events.published).toHaveLength(1);

      await movements.registerEntry(item.id, { quantity: '10.000' }, actor);
      await movements.dispatch(item.id, { quantity: '8.000', employeeId: 'emp-1' }, actor);
      expect(events.published).toHaveLength(2);
    });

    it('un oyente roto no tumba el movimiento', async () => {
      const item = await product('5.000');
      const broken = new InventoryMovementUseCases(
        repo,
        new InMemoryEmployeeRepository([employee('emp-1', 'Juan')]),
        {
          publishLowStock: () => {
            throw new Error('oyente roto');
          },
        },
      );

      await expect(
        broken.registerEntry(item.id, { quantity: '1.000' }, actor),
      ).resolves.toMatchObject({ item: { stockOnHand: '1.000', isLowStock: true } });
    });

    it('lowStock en el listado', async () => {
      const low = await product('5.000');
      await movements.registerEntry(low.id, { quantity: '5.000' }, actor);
      const ok = await catalog.createItem({ kind: 'SUPPLY', name: 'Guantes', minStock: '1.000' });
      await movements.registerEntry(ok.id, { quantity: '3.000' }, actor);
      await catalog.createItem({ kind: 'SUPPLY', name: 'Sin mínimo' });

      const result = await catalog.listItems({ ...page, lowStock: true });

      expect(result.items.map((item) => item.id)).toEqual([low.id]);
    });
  });

  describe('kardex y reporte', () => {
    it('el kardex del artículo va más nuevo primero', async () => {
      const item = await supply();
      await movements.registerEntry(item.id, { quantity: '10.000' }, actor);
      await movements.dispatch(item.id, { quantity: '4.000', employeeId: 'emp-1' }, actor);

      const result = await movements.listItemMovements(item.id, page);

      expect(result.total).toBe(2);
      expect(result.items.map((m) => m.type)).toEqual(['DISPATCH', 'ENTRY']);
    });

    it('404 en el kardex de un artículo que no existe', async () => {
      expect((await failure(movements.listItemMovements('nope', page))).status).toBe(404);
    });

    it('el reporte filtra por tipo, artículo, empleado y fechas civiles', async () => {
      const a = await supply();
      const b = await product();

      repo.setClock('2026-09-25T20:00:00.000Z'); // 25 sept, 2 p. m. en El Salvador
      await movements.registerEntry(a.id, { quantity: '10.000' }, actor);
      await movements.registerEntry(b.id, { quantity: '10.000' }, actor);
      repo.setClock('2026-09-27T03:00:00.000Z'); // 26 sept, 9 p. m. en El Salvador
      await movements.dispatch(a.id, { quantity: '2.000', employeeId: 'emp-1' }, actor);

      expect((await movements.listMovements({ ...page, type: 'ENTRY' })).total).toBe(2);
      expect((await movements.listMovements({ ...page, itemId: b.id })).total).toBe(1);
      expect((await movements.listMovements({ ...page, employeeId: 'emp-1' })).total).toBe(1);
      expect(
        (
          await movements.listMovements({ ...page, from: '2026-09-26', to: '2026-09-26' })
        ).items.map((m) => m.type),
      ).toEqual(['DISPATCH']);
      expect((await movements.listMovements({ ...page, to: '2026-09-25' })).total).toBe(2);
    });

    it('422 si la fecha inicial es posterior a la final', async () => {
      expect(
        (await failure(movements.listMovements({ ...page, from: '2026-09-27', to: '2026-09-26' })))
          .status,
      ).toBe(422);
    });
  });
});
