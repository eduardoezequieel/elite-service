import { API_ERROR_CODES } from '@elite/shared';
import type {
  CarwashEventActor,
  CreateOfficeTicketInput,
  ServiceDetail,
  Ticket,
  TicketItem,
  VehicleWithOwner,
} from '@elite/shared';

import type { ComboComponent } from '../../combos/domain/combo-pricing';
import { captureApiError } from '../../users/application/testing/capture-api-error';
import { ChargeUseCases } from './charge.usecases';
import type { TicketComboRecord } from './ports/combo-catalog';
import { FakePriceAuthorizer } from './testing/fake-price-authorizer';
import { InMemoryCashSessionRepository } from './testing/in-memory-cash-session.repository';
import { InMemoryChargeRepository } from './testing/in-memory-charge.repository';
import { InMemoryComboCatalog } from './testing/in-memory-combo-catalog';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import {
  InMemoryLowStockEvents,
  InMemoryStock,
  InMemoryTicketRepository,
} from './testing/in-memory-ticket.repository';
import { TicketUseCases } from './ticket.usecases';

const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana Oficina' };
const SEDAN = 'b1';
const SUV = 'b2';
const SUMMER = '00000000-0000-4000-8000-00000000c001';
const SHINE = '00000000-0000-4000-8000-00000000c002';
const PAUSED = '00000000-0000-4000-8000-00000000c003';
const UNKNOWN = '00000000-0000-4000-8000-00000000c0ff';

const washes = { id: 'cat-1', name: 'Lavados', sortOrder: 1, isActive: true, isExtra: false };
const extras = { id: 'cat-2', name: 'Extras', sortOrder: 2, isActive: true, isExtra: true };

function service(id: string, category: typeof washes, defaultPrice: string): ServiceDetail {
  return {
    id,
    code: `SRV-${id}`,
    name: `Servicio ${id}`,
    category,
    defaultPrice,
    taxRate: '0.1300',
    isActive: true,
    prices: [],
  };
}

const catalog = [
  service('srv-wash', washes, '20.00'),
  service('srv-basic', washes, '8.00'),
  service('srv-polish', extras, '15.00'),
];

const vehicle: VehicleWithOwner = {
  id: 'v1',
  plate: 'P104',
  bodyType: { id: SEDAN, key: 'sedan', name: 'Sedán', sortOrder: 1 },
  make: null,
  color: null,
  isActive: true,
  currentOwner: null,
  lastWash: null,
};

function serviceComponent(id: string, defaultPrice: number, suvPrice?: number): ComboComponent {
  return {
    kind: 'SERVICE',
    serviceId: id,
    inventoryItemId: null,
    code: `SRV-${id}`,
    name: `Servicio ${id}`,
    taxRate: '0.1300',
    quantity: 1,
    defaultPrice,
    prices: suvPrice === undefined ? [] : [{ bodyTypeId: SUV, price: suvPrice }],
    stockOnHand: null,
  };
}

function productComponent(id: string, price: number, quantity: number): ComboComponent {
  return {
    kind: 'PRODUCT',
    serviceId: null,
    inventoryItemId: id,
    code: `INV-${id}`,
    name: 'Cera en pasta',
    taxRate: '0.1300',
    quantity,
    defaultPrice: price,
    prices: [],
    stockOnHand: 10_000,
  };
}

/**
 * «Verano»: lavado ($20 sedán / $26 camioneta) + 2 ceras de $3. Por separado
 * $26 / $32; el combo cuesta $22 / $27.
 */
function summer(): TicketComboRecord {
  return {
    id: SUMMER,
    name: 'Verano',
    availableToday: true,
    pricingMode: 'FIXED',
    discountPercent: null,
    fixedPrices: [
      { bodyTypeId: SEDAN, price: 2200 },
      { bodyTypeId: SUV, price: 2700 },
    ],
    components: [serviceComponent('srv-wash', 2000, 2600), productComponent('wax', 300, 2)],
  };
}

/** «Brillo»: pulido + lavado básico al 10 %. */
function shine(): TicketComboRecord {
  return {
    id: SHINE,
    name: 'Brillo',
    availableToday: true,
    pricingMode: 'PERCENT',
    discountPercent: 10,
    fixedPrices: [],
    components: [serviceComponent('srv-polish', 1500), serviceComponent('srv-basic', 800)],
  };
}

function build() {
  const stock = new InMemoryStock();

  stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 10_000 });

  const tickets = new InMemoryTicketRepository(stock);
  const cash = new InMemoryCashSessionRepository();
  const events = new InMemoryTicketEvents();
  const lowStock = new InMemoryLowStockEvents();
  const charges = new InMemoryChargeRepository(tickets);
  const combos = new InMemoryComboCatalog([SEDAN, SUV]);

  combos.add(summer());
  combos.add(shine());
  combos.add({ ...shine(), id: PAUSED, name: 'Pausado', availableToday: false });

  const usecases = new TicketUseCases(
    tickets,
    { listServices: async () => catalog } as never,
    tickets.customers,
    { findById: async (id: string) => (id === vehicle.id ? vehicle : null) } as never,
    new ChargeUseCases(
      charges,
      tickets,
      cash,
      events,
      stock,
      new FakePriceAuthorizer(),
      lowStock,
      charges.bankAccounts,
    ),
    events,
    stock,
    lowStock,
    combos,
  );

  return { stock, tickets, combos, usecases };
}

function input(
  combos: string[],
  items: CreateOfficeTicketInput['items'] = [],
): CreateOfficeTicketInput {
  return { vehicleId: vehicle.id, items, combos: combos.map((comboId) => ({ comboId })) };
}

const opener = { kind: 'user' as const, userId: ana.id };

function comboLines(ticket: Ticket, comboId: string): TicketItem[] {
  return ticket.items.filter((item) => item.comboId === comboId);
}

function cents(value: string): number {
  return Math.round(Number(value) * 100);
}

function sumOf(lines: readonly TicketItem[]): number {
  return lines.reduce((sum, line) => sum + cents(line.total), 0);
}

describe('TicketUseCases — combos en el alta (104)', () => {
  it('expande el combo en una línea por componente y suma exacto su precio (criterios 4 y 6)', async () => {
    const { usecases, stock } = build();

    // Solo el combo: sus servicios cuentan para que el lavado esté completo.
    const created = await usecases.create(input([SUMMER]), opener, ana);

    expect(created.items).toEqual([
      expect.objectContaining({
        kind: 'SERVICE',
        serviceId: 'srv-wash',
        catalogPrice: '20.00',
        // 2200 × 2000 / 2600 = 1692.3 → 1692, más el residuo de 2 centavos.
        unitPrice: '16.94',
        quantity: '1.000',
        sortOrder: 0,
        comboId: SUMMER,
        comboName: 'Verano',
      }),
      expect.objectContaining({
        kind: 'PRODUCT',
        inventoryItemId: 'wax',
        catalogPrice: '3.00',
        // 2200 × 300 / 2600 = 253.8 → 253, nunca sobre el catálogo.
        unitPrice: '2.53',
        quantity: '2.000',
        sortOrder: 1,
        comboId: SUMMER,
        comboName: 'Verano',
      }),
    ]);
    expect(created.total).toBe('22.00');
    expect(stock.onHand('wax')).toBe(8000);
  });

  it('PERCENT cierra exacto en el precio redondeado', async () => {
    const { usecases } = build();

    const created = await usecases.create(input([SHINE]), opener, ana);

    // 23.00 × 0.9 = 20.70
    expect(sumOf(comboLines(created, SHINE))).toBe(2070);
    expect(created.total).toBe('20.70');
  });

  it('las sueltas van primero y cada combo junto después', async () => {
    const { usecases } = build();

    const created = await usecases.create(
      input([SHINE, SUMMER], [{ inventoryItemId: 'wax', quantity: '1' }]),
      opener,
      ana,
    );

    expect(created.items.map((item) => [item.comboId, item.sortOrder])).toEqual([
      [null, 0],
      [SHINE, 1],
      [SHINE, 2],
      [SUMMER, 3],
      [SUMMER, 4],
    ]);
  });

  it.each([
    ['pausado o fuera de fecha', PAUSED],
    ['que no existe', UNKNOWN],
  ])('un combo %s responde 422 COMBO_NOT_AVAILABLE (criterio 3)', async (_label, comboId) => {
    const { usecases, tickets, stock } = build();

    const failure = await captureApiError(usecases.create(input([SUMMER, comboId]), opener, ana));

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.COMBO_NOT_AVAILABLE);
    expect(failure.body.details).toEqual({ comboId });
    expect(tickets.rows.size).toBe(0);
    expect(stock.onHand('wax')).toBe(10_000);
  });

  it('el mismo combo dos veces responde 422 DUPLICATE_COMBO (RN-6)', async () => {
    const { usecases } = build();

    const failure = await captureApiError(usecases.create(input([SUMMER, SUMMER]), opener, ana));

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.DUPLICATE_COMBO);
  });

  it('la regla del servicio una vez y la del producto una vez miran solo las sueltas (criterio 7)', async () => {
    const { usecases, stock } = build();

    // «Brillo» trae el básico (Lavados) y el suelto es el lavado completo (Lavados);
    // «Verano» trae cera y la cera también va suelta.
    const created = await usecases.create(
      input(
        [SHINE, SUMMER],
        [{ serviceId: 'srv-basic' }, { inventoryItemId: 'wax', quantity: '1' }],
      ),
      opener,
      ana,
    );

    expect(created.items.filter((item) => item.serviceId === 'srv-basic')).toHaveLength(2);
    expect(created.items.filter((item) => item.inventoryItemId === 'wax')).toHaveLength(2);
    // La existencia sale por la suma de las dos líneas: 2 del combo + 1 suelta.
    expect(stock.onHand('wax')).toBe(7000);
  });

  it('las sueltas pueden repetir categoría pero no el mismo servicio (111)', async () => {
    const { usecases } = build();

    const created = await usecases.create(
      input([], [{ serviceId: 'srv-wash' }, { serviceId: 'srv-basic' }]),
      opener,
      ana,
    );

    expect(created.items.map((item) => item.serviceId)).toEqual(['srv-wash', 'srv-basic']);

    const failure = await captureApiError(
      build().usecases.create(
        input([SUMMER], [{ serviceId: 'srv-wash' }, { serviceId: 'srv-wash' }]),
        opener,
        ana,
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });

  it('un producto del combo sin existencia responde 409 INSUFFICIENT_STOCK (criterio 5)', async () => {
    const { usecases, stock, tickets } = build();

    stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 1000 });

    const failure = await captureApiError(usecases.create(input([SUMMER]), opener, ana));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.INSUFFICIENT_STOCK);
    expect(tickets.rows.size).toBe(0);
    expect(stock.onHand('wax')).toBe(1000);
  });

  it('sin servicios sueltos ni combos sigue incompleto', async () => {
    const { usecases } = build();

    const failure = await captureApiError(usecases.create(input([]), opener, ana));

    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_INCOMPLETE);
  });

  it('lista los combos de hoy para la tarjeta del alta', async () => {
    const { usecases } = build();

    const options = await usecases.listCombos();

    expect(options.map((option) => option.name)).toEqual(['Verano', 'Brillo']);
    expect(options[0]?.prices).toEqual([
      { bodyTypeId: SEDAN, listPrice: '26.00', price: '22.00' },
      { bodyTypeId: SUV, listPrice: '32.00', price: '27.00' },
    ]);
  });
});

describe('TicketUseCases — combos en la edición (104 criterio 8)', () => {
  async function opened() {
    const built = build();
    const created = await built.usecases.create(
      input([SUMMER], [{ serviceId: 'srv-polish' }]),
      opener,
      ana,
    );

    return { ...built, created };
  }

  it('sin combos ni cambio de tipo, las líneas del combo quedan aunque el combo cambió o se pausó', async () => {
    const { usecases, combos, created } = await opened();

    combos.change(SUMMER, {
      availableToday: false,
      fixedPrices: [
        { bodyTypeId: SEDAN, price: 1000 },
        { bodyTypeId: SUV, price: 1000 },
      ],
    });

    // `items` trae solo las sueltas y reemplaza solo esas.
    const updated = await usecases.update(created.id, { items: [{ serviceId: 'srv-basic' }] }, ana);

    expect(comboLines(updated, SUMMER)).toEqual(
      comboLines(created, SUMMER).map((line) =>
        expect.objectContaining({
          serviceId: line.serviceId,
          inventoryItemId: line.inventoryItemId,
          unitPrice: line.unitPrice,
          catalogPrice: line.catalogPrice,
          comboName: 'Verano',
        }),
      ),
    );
    expect(updated.items.filter((item) => item.comboId === null).map((i) => i.serviceId)).toEqual([
      'srv-basic',
    ]);
    expect(sumOf(comboLines(updated, SUMMER))).toBe(2200);
  });

  it('con combos que ya estaban y el mismo tipo, conserva el snapshot', async () => {
    const { usecases, combos, created, stock } = await opened();

    combos.change(SUMMER, { availableToday: false, name: 'Verano 2' });

    const updated = await usecases.update(
      created.id,
      { combos: [{ comboId: SUMMER }], bodyTypeId: SEDAN },
      ana,
    );

    expect(sumOf(comboLines(updated, SUMMER))).toBe(2200);
    expect(comboLines(updated, SUMMER).every((line) => line.comboName === 'Verano')).toBe(true);
    expect(updated.items.find((item) => item.comboId === null)?.serviceId).toBe('srv-polish');
    expect(stock.onHand('wax')).toBe(8000);
  });

  it('al cambiar el tipo de carro re-expande el combo con su precio actual, aunque esté pausado', async () => {
    const { usecases, combos, created, stock } = await opened();

    combos.change(SUMMER, { availableToday: false });

    const updated = await usecases.update(created.id, { bodyTypeId: SUV }, ana);

    expect(sumOf(comboLines(updated, SUMMER))).toBe(2700);
    expect(comboLines(updated, SUMMER)[0]).toMatchObject({ catalogPrice: '26.00' });
    // La suelta no se toca sin `items`.
    expect(updated.items.find((item) => item.comboId === null)?.unitPrice).toBe('15.00');
    expect(stock.onHand('wax')).toBe(8000);
  });

  it('agregar un combo que no estaba exige que valga hoy', async () => {
    const { usecases, created } = await opened();

    const failure = await captureApiError(
      usecases.update(created.id, { combos: [{ comboId: SUMMER }, { comboId: PAUSED }] }, ana),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.COMBO_NOT_AVAILABLE);
  });

  it('agrega uno de hoy y quita el que se deja afuera, devolviendo su existencia', async () => {
    const { usecases, created, stock } = await opened();

    const updated = await usecases.update(created.id, { combos: [{ comboId: SHINE }] }, ana);

    expect(comboLines(updated, SUMMER)).toEqual([]);
    expect(sumOf(comboLines(updated, SHINE))).toBe(2070);
    expect(updated.items.find((item) => item.comboId === null)?.serviceId).toBe('srv-polish');
    expect(stock.onHand('wax')).toBe(10_000);
  });

  it('el mismo combo dos veces en la edición es 422 DUPLICATE_COMBO', async () => {
    const { usecases, created } = await opened();

    const failure = await captureApiError(
      usecases.update(created.id, { combos: [{ comboId: SUMMER }, { comboId: SUMMER }] }, ana),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.DUPLICATE_COMBO);
  });

  it('solo la nota no toca las líneas', async () => {
    const { usecases, created } = await opened();

    const noted = await usecases.update(created.id, { notes: 'Cliente frecuente' }, ana);

    expect(noted.items).toEqual(created.items);
  });
});
