import { API_ERROR_CODES } from '@elite/shared';

import { ApplicationError } from '../../../common/errors/application-error';
import { applicationErrorStatus } from '../../../common/filters/application-error-status';
import type { Employee } from '../../employees/domain/employee';
import { InMemoryEmployeeRepository } from '../../employees/application/testing/in-memory-employee.repository';
import { InventoryCatalogUseCases } from './inventory-catalog.usecases';
import { InventoryConsumptionUseCases } from './inventory-consumption.usecases';
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

/** Rangos civiles inclusive (091 RN-4). */
const SEPT = { from: '2026-09-01', to: '2026-09-30' };
const OCT = { from: '2026-10-01', to: '2026-10-31' };

const actor: InventoryActor = {
  userId: 'user-1',
  event: { kind: 'user', id: 'user-1', name: 'Oficina' },
};

describe('InventoryConsumptionUseCases (070)', () => {
  let repo: InMemoryInventoryRepository;
  let events: InMemoryLowStockEvents;
  let catalog: InventoryCatalogUseCases;
  let movements: InventoryMovementUseCases;
  let consumptions: InventoryConsumptionUseCases;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository({
      'user-1': 'Oficina',
      juan: 'Juan Pérez',
      ana: 'Ana López',
      baja: 'De baja',
    });
    events = new InMemoryLowStockEvents();
    catalog = new InventoryCatalogUseCases(repo);
    const employees = new InMemoryEmployeeRepository([
      employee('juan', 'Juan Pérez'),
      employee('ana', 'Ana López'),
      employee('baja', 'De baja', false),
    ]);
    movements = new InventoryMovementUseCases(repo, employees, events);
    consumptions = new InventoryConsumptionUseCases(
      repo,
      employees,
      events,
      () => new Date('2026-09-26T18:00:00.000Z'),
    );
  });

  async function drink(price = '1.25', stock = '10', minStock?: string) {
    const item = await catalog.createItem({
      kind: 'PRODUCT',
      name: `Bebida ${price}`,
      price,
      minStock,
    });
    await movements.registerEntry(item.id, { quantity: stock }, actor);

    return item;
  }

  describe('anotar (RN-1 a RN-4)', () => {
    it('saca la existencia y deja CONSUMPTION con empleado, quien anotó y el precio', async () => {
      const item = await drink();
      const result = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan', note: ' Almuerzo ' },
        actor,
      );

      expect(result.item.stockOnHand).toBe('8.000');
      expect(result.movement).toMatchObject({
        type: 'CONSUMPTION',
        quantity: '-2.000',
        balanceAfter: '8.000',
        unitPrice: '1.25',
        reversesMovementId: null,
        reason: 'Almuerzo',
        employee: { id: 'juan', fullName: 'Juan Pérez' },
        createdBy: { kind: 'user', id: 'user-1' },
      });
    });

    it('409 INSUFFICIENT_STOCK con lo que hay, y nada cambia', async () => {
      const item = await drink('1.25', '1');

      expect(
        await failure(consumptions.record(item.id, { quantity: '2', employeeId: 'juan' }, actor)),
      ).toEqual({
        status: 409,
        code: API_ERROR_CODES.INSUFFICIENT_STOCK,
        details: { itemId: item.id, available: '1.000' },
      });
      expect((await catalog.findItem(item.id)).stockOnHand).toBe('1.000');
      expect(repo.movements.filter((row) => row.type === 'CONSUMPTION')).toHaveLength(0);
    });

    it('409 ITEM_NOT_SELLABLE en un insumo', async () => {
      const supply = await catalog.createItem({ kind: 'SUPPLY', name: 'Franela' });
      await movements.registerEntry(supply.id, { quantity: '5' }, actor);

      expect(
        await failure(consumptions.record(supply.id, { quantity: '1', employeeId: 'juan' }, actor)),
      ).toMatchObject({ status: 409, code: API_ERROR_CODES.ITEM_NOT_SELLABLE });
    });

    it('409 ITEM_INACTIVE en un producto desactivado', async () => {
      const item = await drink();
      await catalog.updateItem(item.id, { isActive: false });

      expect(
        await failure(consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor)),
      ).toMatchObject({ status: 409, code: API_ERROR_CODES.ITEM_INACTIVE });
    });

    it('404 EMPLOYEE_NOT_FOUND si el empleado no existe o está desactivado', async () => {
      const item = await drink();

      for (const employeeId of ['baja', 'nadie']) {
        expect(
          await failure(consumptions.record(item.id, { quantity: '1', employeeId }, actor)),
        ).toMatchObject({ status: 404, code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND });
      }
      expect((await catalog.findItem(item.id)).stockOnHand).toBe('10.000');
    });

    it('avisa del mínimo al cruzarlo (RN-13)', async () => {
      const item = await drink('1.25', '3', '2');
      await consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor);

      expect(events.published).toHaveLength(1);
      expect(events.published[0]).toMatchObject({ itemId: item.id, stockOnHand: '2.000' });
    });

    it('el precio queda congelado aunque después suba (RN-4)', async () => {
      const item = await drink();
      await consumptions.record(item.id, { quantity: '2', employeeId: 'juan' }, actor);
      await catalog.updateItem(item.id, { price: '1.50' });

      const detail = await consumptions.detail('juan', SEPT);

      expect(detail.entries[0]).toMatchObject({ unitPrice: '1.25', total: '2.50' });
      expect(detail.total).toBe('2.50');
    });
  });

  describe('anular (RN-6)', () => {
    it('devuelve la existencia con CONSUMPTION_RETURN que apunta al original', async () => {
      const item = await drink();
      const { movement } = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan' },
        actor,
      );

      const result = await consumptions.reverse(movement.id, { reason: 'Mal anotado' }, actor);

      expect(result.item.stockOnHand).toBe('10.000');
      expect(result.movement).toMatchObject({
        type: 'CONSUMPTION_RETURN',
        quantity: '2.000',
        unitPrice: '1.25',
        reversesMovementId: movement.id,
        reason: 'Mal anotado',
        employee: { id: 'juan' },
        createdBy: { kind: 'user', id: 'user-1' },
      });
    });

    it('una sola vez: la segunda es 409 CONSUMPTION_ALREADY_REVERSED', async () => {
      const item = await drink();
      const { movement } = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan' },
        actor,
      );
      await consumptions.reverse(movement.id, { reason: 'Mal anotado' }, actor);

      expect(
        await failure(consumptions.reverse(movement.id, { reason: 'Otra vez' }, actor)),
      ).toMatchObject({ status: 409, code: API_ERROR_CODES.CONSUMPTION_ALREADY_REVERSED });
      expect((await catalog.findItem(item.id)).stockOnHand).toBe('10.000');
    });

    it('el índice único también frena la carrera: 409 aunque el chequeo previo no lo viera', async () => {
      const item = await drink();
      const { movement } = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan' },
        actor,
      );
      const stale = await repo.findConsumption(movement.id);
      await consumptions.reverse(movement.id, { reason: 'Primera' }, actor);
      jest.spyOn(repo, 'findConsumption').mockResolvedValueOnce(stale);

      expect(
        await failure(consumptions.reverse(movement.id, { reason: 'Segunda' }, actor)),
      ).toMatchObject({ status: 409, code: API_ERROR_CODES.CONSUMPTION_ALREADY_REVERSED });
    });

    it('404 si el movimiento no existe o no es un consumo', async () => {
      const item = await drink();
      const { movement } = await movements.adjust(
        item.id,
        { quantity: '-1', reason: 'Conteo' },
        actor,
      );

      for (const id of ['nope', movement.id]) {
        expect(await failure(consumptions.reverse(id, { reason: 'x' }, actor))).toMatchObject({
          status: 404,
          code: API_ERROR_CODES.NOT_FOUND,
        });
      }
    });

    it('se puede anular con el artículo desactivado', async () => {
      const item = await drink();
      const { movement } = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan' },
        actor,
      );
      await catalog.updateItem(item.id, { isActive: false });

      await expect(
        consumptions.reverse(movement.id, { reason: 'Mal anotado' }, actor),
      ).resolves.toMatchObject({ item: { stockOnHand: '10.000' } });
    });
  });

  describe('reporte por rango (091 RN-4)', () => {
    it('el ejemplo de la spec: Juan 3 / $3.25, Ana 1 / $1.25, total $4.50', async () => {
      const cheap = await drink('0.75');
      const regular = await drink('1.25');
      await consumptions.record(regular.id, { quantity: '1', employeeId: 'ana' }, actor);
      await consumptions.record(regular.id, { quantity: '2', employeeId: 'juan' }, actor);
      await consumptions.record(cheap.id, { quantity: '1', employeeId: 'juan' }, actor);

      await expect(consumptions.report(SEPT)).resolves.toEqual({
        ...SEPT,
        total: '4.50',
        rows: [
          {
            employee: { id: 'juan', fullName: 'Juan Pérez', isActive: true },
            units: '3.000',
            total: '3.25',
          },
          {
            employee: { id: 'ana', fullName: 'Ana López', isActive: true },
            units: '1.000',
            total: '1.25',
          },
        ],
      });
    });

    it('sin rango usa del primero del mes en curso a hoy, en El Salvador', async () => {
      const item = await drink();
      await consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor);

      await expect(consumptions.report({})).resolves.toMatchObject({
        from: '2026-09-01',
        to: '2026-09-26',
        total: '1.25',
      });
    });

    it('las dos puntas son inclusive y el rango puede cruzar meses', async () => {
      const item = await drink();
      repo.setClock('2026-10-01T05:58:00.000Z'); // 30 sept 23:58 en El Salvador
      await consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor);
      repo.setClock('2026-10-02T05:59:00.000Z'); // 1 oct 23:59
      await consumptions.record(item.id, { quantity: '2', employeeId: 'juan' }, actor);
      repo.setClock('2026-10-02T06:00:00.000Z'); // 2 oct 00:00: ya afuera
      await consumptions.record(item.id, { quantity: '4', employeeId: 'juan' }, actor);

      const report = await consumptions.report({ from: '2026-09-30', to: '2026-10-01' });

      expect(report.rows.map((row) => row.units)).toEqual(['3.000']);
    });

    it('422 si la fecha inicial es posterior a la final', async () => {
      expect(
        await failure(consumptions.report({ from: '2026-09-27', to: '2026-09-26' })),
      ).toMatchObject({ status: 422, code: API_ERROR_CODES.VALIDATION_ERROR });
      expect(
        (await failure(consumptions.detail('juan', { from: '2026-09-27', to: '2026-09-26' })))
          .status,
      ).toBe(422);
    });

    it('borde de mes: el 30 sept a las 23:59 es septiembre, el 1 oct es octubre', async () => {
      const item = await drink();
      repo.setClock('2026-10-01T05:58:00.000Z'); // 30 sept 23:58 en El Salvador
      await consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor);
      repo.setClock('2026-10-01T06:00:00.000Z'); // 1 oct 00:00
      await consumptions.record(item.id, { quantity: '2', employeeId: 'juan' }, actor);

      const september = await consumptions.report(SEPT);
      const october = await consumptions.report(OCT);

      expect(september.rows.map((row) => row.units)).toEqual(['1.000']);
      expect(october.rows.map((row) => row.units)).toEqual(['2.000']);
    });

    it('un anulado no cuenta en el rango de su consumo, aunque se haya anulado en otro', async () => {
      const item = await drink();
      const { movement } = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan' },
        actor,
      );
      await consumptions.record(item.id, { quantity: '1', employeeId: 'ana' }, actor);
      repo.setClock('2026-10-15T15:00:00.000Z');
      await consumptions.reverse(movement.id, { reason: 'Mal anotado' }, actor);

      const september = await consumptions.report(SEPT);
      const october = await consumptions.report(OCT);

      expect(september.rows.map((row) => row.employee.id)).toEqual(['ana']);
      expect(september.total).toBe('1.25');
      expect(october).toEqual({ ...OCT, total: '0.00', rows: [] });
    });

    it('un empleado desactivado sigue saliendo, marcado', async () => {
      const item = await drink();
      await consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor);
      repo.inactiveEmployees.add('juan');

      const report = await consumptions.report(SEPT);

      expect(report.rows[0].employee).toEqual({
        id: 'juan',
        fullName: 'Juan Pérez',
        isActive: false,
      });
    });
  });

  describe('detalle por empleado', () => {
    it('trae los anulados marcados, más reciente arriba, y las cifras sin ellos', async () => {
      const item = await drink();
      const first = await consumptions.record(
        item.id,
        { quantity: '2', employeeId: 'juan', note: 'Almuerzo' },
        actor,
      );
      await consumptions.record(item.id, { quantity: '1', employeeId: 'juan' }, actor);
      await consumptions.record(item.id, { quantity: '1', employeeId: 'ana' }, actor);
      await consumptions.reverse(first.movement.id, { reason: 'Era de Ana' }, actor);

      const detail = await consumptions.detail('juan', SEPT);

      expect(detail).toMatchObject({
        ...SEPT,
        employee: { id: 'juan', fullName: 'Juan Pérez', isActive: true },
        units: '1.000',
        total: '1.25',
      });
      expect(detail.entries).toHaveLength(2);
      expect(detail.entries[0]).toMatchObject({ quantity: '1.000', reversal: null });
      expect(detail.entries[1]).toMatchObject({
        movementId: first.movement.id,
        item: { id: item.id, name: 'Bebida 1.25' },
        quantity: '2.000',
        unitPrice: '1.25',
        total: '2.50',
        note: 'Almuerzo',
        createdBy: { kind: 'user', id: 'user-1', fullName: 'Oficina' },
        reversal: { reason: 'Era de Ana', createdBy: { kind: 'user', id: 'user-1' } },
      });
    });

    it('un empleado desactivado tiene detalle; sin consumos viene vacío', async () => {
      await expect(consumptions.detail('baja', SEPT)).resolves.toEqual({
        ...SEPT,
        employee: { id: 'baja', fullName: 'De baja', isActive: false },
        units: '0.000',
        total: '0.00',
        entries: [],
      });
    });

    it('404 EMPLOYEE_NOT_FOUND si el empleado no existe', async () => {
      expect(await failure(consumptions.detail('nadie', SEPT))).toMatchObject({
        status: 404,
        code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
      });
    });
  });
});
