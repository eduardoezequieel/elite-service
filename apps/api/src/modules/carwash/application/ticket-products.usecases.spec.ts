import { API_ERROR_CODES } from '@elite/shared';
import type {
  CarwashEventActor,
  CreateOfficeTicketInput,
  ServiceDetail,
  TicketItemInput,
  VehicleWithOwner,
} from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { ChargeUseCases } from './charge.usecases';
import { InMemoryCashSessionRepository } from './testing/in-memory-cash-session.repository';
import { FakePriceAuthorizer } from './testing/fake-price-authorizer';
import { InMemoryChargeRepository } from './testing/in-memory-charge.repository';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import {
  InMemoryLowStockEvents,
  InMemoryStock,
  InMemoryTicketRepository,
} from './testing/in-memory-ticket.repository';
import { TicketUseCases } from './ticket.usecases';

/** Las credenciales de la 045. El guard ya las verifico: el caso de uso no las mira. */
const AUTHORIZATION = { email: 'jefe@taller.sv', password: 'x' };

const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana Oficina' };
const carlos: CarwashEventActor = { kind: 'employee', id: 'emp-carlos', name: 'Carlos VIS' };

const wash: ServiceDetail = {
  id: 'srv-1',
  code: 'SRV-0001',
  name: 'Lavado completo',
  category: { id: 'cat-1', name: 'Lavados', sortOrder: 1, isActive: true, isExtra: false },
  defaultPrice: '20.00',
  taxRate: '0.1300',
  isActive: true,
  prices: [],
};

const vehicle: VehicleWithOwner = {
  id: 'v1',
  plate: 'P001',
  bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
  make: null,
  color: null,
  isActive: true,
  currentOwner: null,
  lastWash: null,
};

const service: TicketItemInput = { serviceId: 'srv-1' };

function wax(quantity: string, unitPrice?: string): TicketItemInput {
  return unitPrice === undefined
    ? { inventoryItemId: 'wax', quantity }
    : { inventoryItemId: 'wax', quantity, unitPrice };
}

async function build() {
  const stock = new InMemoryStock();

  stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 3000 });
  stock.add({ id: 'scent', name: 'Aromatizante', price: 150, onHand: 10_000 });
  stock.add({ id: 'rag', name: 'Franela', kind: 'SUPPLY', price: 0, onHand: 10_000 });
  stock.add({ id: 'old', name: 'Cera vieja', isActive: false, onHand: 5000 });

  const tickets = new InMemoryTicketRepository(stock);
  const cash = new InMemoryCashSessionRepository();

  cash.addUser(ana.id, ana.name);
  await cash.open({ openingFloat: 0, userId: ana.id });

  const events = new InMemoryTicketEvents();
  const lowStock = new InMemoryLowStockEvents();
  const charges = new InMemoryChargeRepository(tickets);
  const chargeUseCases = new ChargeUseCases(
    charges,
    tickets,
    cash,
    events,
    stock,
    new FakePriceAuthorizer(),
    lowStock,
  );
  const usecases = new TicketUseCases(
    tickets,
    { listServices: async () => [wash] } as never,
    {} as never,
    { findById: async (id: string) => (id === vehicle.id ? vehicle : null) } as never,
    chargeUseCases,
    events,
    stock,
    lowStock,
  );

  return { stock, tickets, charges, lowStock, usecases };
}

function openInput(items: TicketItemInput[]): CreateOfficeTicketInput {
  return { vehicleId: vehicle.id, items };
}

describe('TicketUseCases — productos en el lavado (065)', () => {
  describe('alta (RN-4, RN-6)', () => {
    it('guarda la línea con su snapshot y saca la cantidad del inventario', async () => {
      const { usecases, stock } = await build();

      const created = await usecases.create(
        openInput([service, wax('2')]),
        { kind: 'user', userId: ana.id },
        ana,
      );

      const product = created.items.find((item) => item.kind === 'PRODUCT');

      expect(product).toMatchObject({
        inventoryItemId: 'wax',
        serviceId: null,
        code: 'INV-0001',
        name: 'Cera en pasta',
        catalogPrice: '3.00',
        unitPrice: '3.00',
        quantity: '2.000',
        total: '6.00',
        sortOrder: 1,
      });
      expect(created.total).toBe('26.00');
      expect(stock.onHand('wax')).toBe(1000);
      expect(stock.movements).toEqual([
        {
          itemId: 'wax',
          type: 'SALE',
          quantity: -2000,
          balanceAfter: 1000,
          workOrderId: created.id,
          createdByUserId: ana.id,
          createdByEmployeeId: null,
        },
      ]);
    });

    it('sin existencia responde 409 INSUFFICIENT_STOCK y no abre el lavado', async () => {
      const { usecases, stock, tickets } = await build();

      stock.add({ id: 'wax', price: 300, onHand: 1000 });

      const failure = await captureApiError(
        usecases.create(openInput([service, wax('2')]), { kind: 'user', userId: ana.id }, ana),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.INSUFFICIENT_STOCK);
      expect(failure.body.details).toEqual({ itemId: 'wax', available: '1.000' });
      expect(tickets.rows.size).toBe(0);
      expect(stock.onHand('wax')).toBe(1000);
      expect(stock.movements).toHaveLength(0);
    });

    it('un insumo responde 409 ITEM_NOT_SELLABLE', async () => {
      const { usecases } = await build();

      const failure = await captureApiError(
        usecases.create(
          openInput([service, { inventoryItemId: 'rag', quantity: '1.000' }]),
          { kind: 'user', userId: ana.id },
          ana,
        ),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.ITEM_NOT_SELLABLE);
    });

    it('un producto desactivado responde 409 ITEM_INACTIVE', async () => {
      const { usecases } = await build();

      const failure = await captureApiError(
        usecases.create(
          openInput([service, { inventoryItemId: 'old', quantity: '1.000' }]),
          { kind: 'user', userId: ana.id },
          ana,
        ),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.ITEM_INACTIVE);
    });

    it('un producto que no existe responde 422, igual que un servicio', async () => {
      const { usecases } = await build();

      const failure = await captureApiError(
        usecases.create(
          openInput([service, { inventoryItemId: 'nope', quantity: '1.000' }]),
          { kind: 'user', userId: ana.id },
          ana,
        ),
      );

      expect(failure.status).toBe(422);
      expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    });

    it('la pista deja el movimiento a nombre del empleado (RN-17)', async () => {
      const { usecases, stock } = await build();

      await usecases.create(
        openInput([service, wax('1')]),
        { kind: 'employee', employeeId: carlos.id },
        carlos,
      );

      expect(stock.movements[0]).toMatchObject({
        createdByUserId: null,
        createdByEmployeeId: carlos.id,
      });
    });

    it('precio sobre el del producto responde 422 PRICE_ABOVE_CATALOG (RN-7)', async () => {
      const { usecases } = await build();

      const failure = await captureApiError(
        usecases.create(
          openInput([service, wax('1', '3.50')]),
          { kind: 'user', userId: ana.id },
          ana,
        ),
      );

      expect(failure.status).toBe(422);
      expect(failure.body.code).toBe(API_ERROR_CODES.PRICE_ABOVE_CATALOG);
    });

    it('con precio rebajado el total de la línea es precio × cantidad', async () => {
      const { usecases } = await build();

      const created = await usecases.create(
        openInput([service, wax('2', '2.50')]),
        { kind: 'user', userId: ana.id },
        ana,
      );

      expect(created.items[1]).toMatchObject({ unitPrice: '2.50', total: '5.00' });
      expect(created.total).toBe('25.00');
    });
  });

  describe('edición: diferencia por artículo (RN-4)', () => {
    async function opened() {
      const context = await build();
      const created = await context.usecases.create(
        openInput([service, wax('2')]),
        { kind: 'user', userId: ana.id },
        ana,
      );

      context.stock.movements.length = 0;

      return { ...context, id: created.id };
    }

    it('bajar de 2 a 1 devuelve 1 con SALE_RETURN; quitar la línea devuelve el resto', async () => {
      const { usecases, stock, id } = await opened();

      await usecases.update(id, { items: [service, wax('1')] }, ana);

      expect(stock.onHand('wax')).toBe(2000);
      expect(stock.movements.at(-1)).toMatchObject({
        type: 'SALE_RETURN',
        quantity: 1000,
        workOrderId: id,
        createdByUserId: ana.id,
      });

      const updated = await usecases.update(id, { items: [service] }, ana);

      expect(stock.onHand('wax')).toBe(3000);
      expect(stock.movements.at(-1)).toMatchObject({ type: 'SALE_RETURN', quantity: 1000 });
      expect(updated.items.map((item) => item.kind)).toEqual(['SERVICE']);
    });

    it('subir la cantidad vende solo la diferencia', async () => {
      const { usecases, stock, id } = await opened();

      await usecases.update(id, { items: [service, wax('3')] }, ana);

      expect(stock.onHand('wax')).toBe(0);
      expect(stock.movements).toEqual([expect.objectContaining({ type: 'SALE', quantity: -1000 })]);
    });

    it('la misma cantidad no mueve nada, y un producto nuevo se vende entero', async () => {
      const { usecases, stock, id } = await opened();

      await usecases.update(
        id,
        { items: [service, wax('2'), { inventoryItemId: 'scent', quantity: '1.500' }] },
        ana,
      );

      expect(stock.onHand('wax')).toBe(1000);
      expect(stock.onHand('scent')).toBe(8500);
      expect(stock.movements).toEqual([
        expect.objectContaining({ itemId: 'scent', type: 'SALE', quantity: -1500 }),
      ]);
    });

    it('si no alcanza, 409 y el lavado y el inventario quedan como estaban', async () => {
      const { usecases, stock, tickets, id } = await opened();

      const failure = await captureApiError(
        usecases.update(id, { items: [service, wax('5')] }, ana),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.INSUFFICIENT_STOCK);
      expect(failure.body.details).toEqual({ itemId: 'wax', available: '1.000' });
      expect(stock.onHand('wax')).toBe(1000);
      expect(tickets.get(id)?.items[1]?.quantity).toBe('2.000');
    });

    it('una línea que ya estaba sigue valiendo aunque el producto se desactive; subirla no', async () => {
      const { usecases, stock, id } = await opened();
      const item = stock.items.get('wax');

      if (item !== undefined) item.isActive = false;

      await usecases.update(id, { items: [service, wax('2')], notes: 'sin cambios' }, ana);

      const failure = await captureApiError(
        usecases.update(id, { items: [service, wax('3')] }, ana),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.ITEM_INACTIVE);

      await usecases.update(id, { items: [service] }, ana);

      expect(stock.onHand('wax')).toBe(3000);
    });

    it('el mismo producto dos veces responde 422 (RN-9)', async () => {
      const { usecases, id } = await opened();

      const failure = await captureApiError(
        usecases.update(id, { items: [service, wax('1'), wax('1')] }, ana),
      );

      expect(failure.status).toBe(422);
      expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    });

    it('desde READY un precio rebajado de producto pide la autorización de la 060', async () => {
      const { usecases, id } = await opened();

      await usecases.transition(id, 'ready', ana);

      const failure = await captureApiError(
        usecases.update(id, { items: [service, wax('2', '2.00')] }, ana),
      );

      expect(failure.status).toBe(422);
      expect(failure.body.code).toBe(API_ERROR_CODES.PRICE_CHANGE_NOT_AUTHORIZED);
    });

    it('el precio autorizado de una línea de producto se multiplica por su cantidad (060)', async () => {
      const { usecases, id } = await opened();

      await usecases.transition(id, 'ready', ana);

      const updated = await usecases.authorizePrice(
        id,
        'item-2',
        { unitPrice: '2.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
        { id: 'u-boss', fullName: 'Jefe' },
        ana,
      );

      expect(updated.items[1]).toMatchObject({ unitPrice: '2.00', total: '4.00' });
      expect(updated.total).toBe('24.00');
    });
  });

  describe('anular, cobrar y deshacer el cobro (RN-5, RN-4, RN-8)', () => {
    it('anular devuelve cada producto con SALE_RETURN que apunta al lavado', async () => {
      const { usecases, stock } = await build();
      const created = await usecases.create(
        openInput([service, wax('2'), { inventoryItemId: 'scent', quantity: '1' }]),
        { kind: 'user', userId: ana.id },
        ana,
      );

      stock.movements.length = 0;

      await usecases.voidWithReason(created.id, 'Se fue el cliente', ana, 'Jefe');

      expect(stock.onHand('wax')).toBe(3000);
      expect(stock.onHand('scent')).toBe(10_000);
      expect(stock.movements).toEqual([
        expect.objectContaining({ itemId: 'scent', type: 'SALE_RETURN', quantity: 1000 }),
        expect.objectContaining({ itemId: 'wax', type: 'SALE_RETURN', quantity: 2000 }),
      ]);
      expect(stock.movements.every((movement) => movement.workOrderId === created.id)).toBe(true);
    });

    it('cobrar y deshacer el cobro no tocan el inventario; la comisión solo ve servicios', async () => {
      const { usecases, stock, charges } = await build();
      const created = await usecases.create(
        openInput([service, wax('2')]),
        { kind: 'user', userId: ana.id },
        ana,
      );

      stock.movements.length = 0;
      await usecases.transition(created.id, 'ready', ana);

      const charged = await usecases.charge(
        created.id,
        { method: 'CASH', amount: '26.00' },
        ana.id,
        ana,
      );

      expect(charged.status).toBe('PAID');
      expect(charges.lastCreated?.total).toBe(2600);
      // $20 de servicio → tramo de $2; con los $6 del producto serian $3.
      expect(charges.lastCreated?.tickets[0]?.commissionTotal).toBe(200);

      const reversed = await usecases.reverse(created.id, 'Se cobró mal', ana, {
        id: 'u-jefe',
        fullName: 'Jefe',
      });

      expect(reversed.status).toBe('READY');
      expect(reversed.items.map((item) => item.kind)).toEqual(['SERVICE', 'PRODUCT']);
      expect(stock.movements).toHaveLength(0);
      expect(stock.onHand('wax')).toBe(1000);
    });
  });

  describe('aviso de mínimo (RN-13)', () => {
    it('avisa una vez al cruzar el mínimo, con quien lo cruzó, y no repite mientras siga abajo', async () => {
      const { usecases, stock, lowStock } = await build();

      stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 6000, minStock: 5000 });

      const created = await usecases.create(
        openInput([service, wax('1')]),
        { kind: 'user', userId: ana.id },
        ana,
      );

      expect(lowStock.published).toEqual([
        {
          itemId: 'wax',
          name: 'Cera en pasta',
          stockOnHand: '5.000',
          minStock: '5.000',
          unit: 'unidad',
          actor: ana,
        },
      ]);

      await usecases.update(created.id, { items: [service, wax('3')] }, ana);

      expect(lowStock.published).toHaveLength(1);
    });

    it('un alta que falla no avisa nada', async () => {
      const { usecases, stock, lowStock } = await build();

      stock.add({ id: 'wax', price: 300, onHand: 6000, minStock: 5000 });

      await captureApiError(
        usecases.create(
          openInput([service, wax('1'), { inventoryItemId: 'rag', quantity: '1' }]),
          { kind: 'user', userId: ana.id },
          ana,
        ),
      );

      expect(lowStock.published).toHaveLength(0);
    });
  });

  it('el selector trae solo productos activos, sin costos (RN-17)', async () => {
    const { usecases } = await build();

    const options = await usecases.listInventoryItems('  ');

    expect(options.map((option) => option.id)).toEqual(['wax', 'scent']);
    expect(options[0]).toEqual({
      id: 'wax',
      code: 'INV-0001',
      name: 'Cera en pasta',
      price: '3.00',
      unit: 'unidad',
      stockOnHand: '3.000',
    });
  });
});
