import type { TabDetail, TabLine, TabPayment, TabsSummary } from '@elite/shared';

import type { CartLine } from '../sales/sale-cart';
import {
  addTabLinesInput,
  cashChangeCents,
  chargeAmountBlocker,
  chargeQuickAmounts,
  chargeVerb,
  closedLabel,
  dayHeading,
  firstName,
  holdersInOrder,
  newSaleHref,
  newSaleTargetFrom,
  owedAfterCents,
  payTabInput,
  quantityMark,
  remainingAfter,
  tabLinesBlocker,
  tabTimeline,
  tabsEmptyTitle,
  tabsFilterCount,
  tabsFilterFrom,
  tabsFilterQuery,
  tabsListFrom,
  tabsListHref,
  tabsListQuery,
  unitsLabel,
} from './tab-format';

const ACTOR = { id: 'u1', fullName: 'Karla Caja' };

function line(overrides: Partial<TabLine> = {}): TabLine {
  return {
    id: 'l1',
    inventoryItemId: 'i1',
    code: 'INV-0001',
    name: 'Soda',
    unitPrice: '1.25',
    quantity: '2.000',
    total: '2.50',
    createdAt: '2026-10-05T16:40:00.000Z',
    createdBy: ACTOR,
    voided: null,
    isVoidable: true,
    ...overrides,
  };
}

function payment(overrides: Partial<TabPayment> = {}): TabPayment {
  return {
    id: 'p1',
    method: 'CASH',
    amount: '3.00',
    paidAt: '2026-10-04T23:20:00.000Z',
    recordedBy: ACTOR,
    bankAccount: null,
    reference: null,
    description: null,
    ...overrides,
  };
}

function cartLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    itemId: 'i1',
    name: 'Soda',
    unit: 'unidad',
    catalogPrice: '1.25',
    unitPrice: '1.25',
    quantity: 2000,
    stock: 10_000,
    ...overrides,
  };
}

const SUMMARY: TabsSummary = {
  owed: '18.50',
  owedByEmployees: '8.50',
  owedByCustomers: '10.00',
  openCount: 4,
  employeeCount: 3,
  customerCount: 1,
  closedCount: 7,
};

describe('filtros de la lista', () => {
  it('cada chip pide lo suyo a GET /tabs', () => {
    expect(tabsFilterQuery('ALL')).toEqual({ status: 'OPEN' });
    expect(tabsFilterQuery('EMPLOYEE')).toEqual({ status: 'OPEN', holder: 'EMPLOYEE' });
    expect(tabsFilterQuery('CUSTOMER')).toEqual({ status: 'OPEN', holder: 'CUSTOMER' });
    expect(tabsFilterQuery('CLOSED')).toEqual({ status: 'CLOSED' });
  });

  it('cada chip cuenta con los totales de arriba', () => {
    expect(tabsFilterCount(SUMMARY, 'ALL')).toBe(4);
    expect(tabsFilterCount(SUMMARY, 'EMPLOYEE')).toBe(3);
    expect(tabsFilterCount(SUMMARY, 'CUSTOMER')).toBe(1);
    expect(tabsFilterCount(SUMMARY, 'CLOSED')).toBe(7);
  });

  it('un filtro desconocido en la URL es «Todas»', () => {
    expect(tabsFilterFrom('CLOSED')).toBe('CLOSED');
    expect(tabsFilterFrom('whatever')).toBe('ALL');
    expect(tabsFilterFrom(null)).toBe('ALL');
  });

  it('el vacío dice por qué está vacío', () => {
    expect(tabsEmptyTitle('ALL', '')).toBe('Nadie debe nada');
    expect(tabsEmptyTitle('EMPLOYEE', '  ')).toBe('Nadie debe nada');
    expect(tabsEmptyTitle('CLOSED', '')).toBe('Ninguna cerrada');
    expect(tabsEmptyTitle('CLOSED', 'juan')).toBe('Sin resultados');
  });
});

describe('la lista en la URL', () => {
  it('lee filtro, búsqueda, página y la cuenta a resaltar', () => {
    expect(tabsListFrom({})).toEqual({ filter: 'ALL', search: '', page: 1, highlight: null });
    expect(tabsListFrom({ filter: 'CLOSED', q: 'juan', page: '3', highlight: 't1' })).toEqual({
      filter: 'CLOSED',
      search: 'juan',
      page: 3,
      highlight: 't1',
    });
  });

  it('escribe solo lo que no es por defecto, nunca el resaltado', () => {
    expect(tabsListQuery({ filter: 'ALL', search: ' ', page: 1 })).toBe('');
    expect(tabsListQuery({ filter: 'EMPLOYEE', search: ' ana ', page: 2 })).toBe(
      'filter=EMPLOYEE&q=ana&page=2',
    );
  });
});

describe('filas', () => {
  it('una cerrada con abonos dice Pagada; sin abonos, Cerrada', () => {
    expect(closedLabel({ paid: '4.20' })).toBe('Pagada');
    expect(closedLabel({ paid: '0.00' })).toBe('Cerrada');
  });

  it('nombra con el primer nombre y cuenta productos en singular y plural', () => {
    expect(firstName('  Juan Pérez ')).toBe('Juan');
    expect(firstName('Transportes')).toBe('Transportes');
    expect(unitsLabel('1.000')).toBe('1 producto');
    expect(unitsLabel('5.000')).toBe('5 productos');
    expect(unitsLabel('1.500')).toBe('1.5 productos');
    expect(quantityMark('1.000')).toBeNull();
    expect(quantityMark('2.000')).toBe('×2');
  });
});

describe('línea de tiempo', () => {
  const today = '2026-10-05';

  it('nombra hoy, ayer y los demás días por su nombre', () => {
    expect(dayHeading('2026-10-05', today)).toBe('Hoy');
    expect(dayHeading('2026-10-04', today)).toBe('Ayer');
    expect(dayHeading('2026-09-29', today)).toBe('Martes 29 de septiembre');
  });

  it('agrupa por día del taller, lo más nuevo arriba, y suma solo lo anotado sin quitar', () => {
    const tab: Pick<TabDetail, 'lines' | 'payments'> = {
      lines: [
        line({ id: 'today', createdAt: '2026-10-05T16:40:00.000Z', total: '0.75' }),
        // 23:30 UTC del 4 son las 5:30 p.m. del 4 en el taller.
        line({ id: 'yesterday', createdAt: '2026-10-04T23:30:00.000Z', total: '2.50' }),
        line({
          id: 'voided',
          createdAt: '2026-10-04T15:00:00.000Z',
          total: '1.50',
          voided: { at: '2026-10-04T15:20:00.000Z', by: ACTOR, reason: 'Era de otro' },
          isVoidable: false,
        }),
        // 02:00 UTC del 5 todavía es el 4 en El Salvador.
        line({ id: 'late', createdAt: '2026-10-05T02:00:00.000Z', total: '1.00' }),
      ],
      payments: [payment({ id: 'pay', paidAt: '2026-10-04T23:20:00.000Z' })],
    };

    const days = tabTimeline(tab, today);

    expect(days.map((day) => day.label)).toEqual(['Hoy', 'Ayer']);
    expect(days[0]?.totalCents).toBe(75);
    expect(days[1]?.totalCents).toBe(350);
    expect(
      days[1]?.entries.map((entry) => (entry.kind === 'line' ? entry.line.id : entry.payment.id)),
    ).toEqual(['late', 'yesterday', 'pay', 'voided']);
  });

  it('una cuenta sin movimientos no tiene días', () => {
    expect(tabTimeline({ lines: [], payments: [] }, today)).toEqual([]);
  });
});

describe('cobrar', () => {
  it('el monto tiene que ser mayor que cero y no pasar del saldo', () => {
    expect(chargeAmountBlocker(0, 375)).toBe('Escribí el monto');
    expect(chargeAmountBlocker(400, 375)).toBe('Pasa de lo que debe');
    expect(chargeAmountBlocker(375, 375)).toBeNull();
    expect(chargeAmountBlocker(250, 375)).toBeNull();
  });

  it('los atajos: todo, y $5 o $10 solo si debe más', () => {
    expect(chargeQuickAmounts(375)).toEqual([{ label: 'Todo · $3.75', cents: 375 }]);
    expect(chargeQuickAmounts(500)).toEqual([{ label: 'Todo · $5.00', cents: 500 }]);
    expect(chargeQuickAmounts(1250).map((quick) => quick.label)).toEqual([
      'Todo · $12.50',
      '$5.00',
      '$10.00',
    ]);
  });

  it('el botón cierra si paga todo y abona si es parte; dice cuánto queda', () => {
    expect(chargeVerb(375, 375)).toBe('Cobrar $3.75 y cerrar');
    expect(chargeVerb(250, 375)).toBe('Abonar $2.50');
    expect(remainingAfter(375, 250)).toBe(125);
    expect(remainingAfter(375, 500)).toBe(0);
  });

  it('el vuelto solo si se tecleó y alcanza', () => {
    expect(cashChangeCents('', 250)).toBeNull();
    expect(cashChangeCents('2', 250)).toBeNull();
    expect(cashChangeCents('5', 250)).toBe(250);
    expect(cashChangeCents('2.50', 250)).toBe(0);
  });

  it('el cuerpo lleva solo los datos que pide el método (069)', () => {
    expect(payTabInput({ method: 'CASH', amountCents: 250, details: { reference: 'x' } })).toEqual({
      method: 'CASH',
      amount: '2.50',
    });
    expect(
      payTabInput({
        method: 'TRANSFER',
        amountCents: 1000,
        details: { bankAccountId: 'b1', reference: ' 123 ', description: 'no' },
      }),
    ).toEqual({ method: 'TRANSFER', amount: '10.00', bankAccountId: 'b1', reference: '123' });
    expect(
      payTabInput({ method: 'OTHER', amountCents: 100, details: { description: 'Cheque' } }),
    ).toEqual({ method: 'OTHER', amount: '1.00', description: 'Cheque' });
  });
});

describe('anotar', () => {
  it('recorre trabajadores y después clientes', () => {
    const juan = { kind: 'EMPLOYEE', id: 'e1', fullName: 'Juan', detail: null, openTab: null };
    const roberto = {
      kind: 'CUSTOMER',
      id: 'c1',
      fullName: 'Roberto',
      detail: 'P 512-873',
      openTab: null,
    };

    expect(holdersInOrder(undefined)).toEqual([]);
    expect(
      holdersInOrder({ employees: [juan], customers: [roberto] } as Parameters<
        typeof holdersInOrder
      >[0]).map((holder) => holder.id),
    ).toEqual(['e1', 'c1']);
  });

  it('queda debiendo su saldo abierto más lo de ahora', () => {
    expect(owedAfterCents(null, 325)).toBe(325);
    expect(owedAfterCents({ balance: '6.15' }, 325)).toBe(940);
  });

  it('el botón dice qué falta: productos, existencia y persona', () => {
    expect(tabLinesBlocker({ lines: [], hasHolder: true })).toBe('Agregá un producto');
    expect(
      tabLinesBlocker({ lines: [cartLine({ quantity: 3000, stock: 2000 })], hasHolder: true }),
    ).toBe('Hay 2 de Soda');
    expect(tabLinesBlocker({ lines: [cartLine()], hasHolder: false })).toBe('Elegí a quién');
    expect(tabLinesBlocker({ lines: [cartLine()], hasHolder: true })).toBeNull();
  });

  it('el cuerpo no lleva precio: es el del artículo al anotar', () => {
    expect(
      addTabLinesInput({ kind: 'EMPLOYEE', id: 'e1' }, [
        cartLine({ unitPrice: '0.50' }),
        cartLine({ itemId: 'i2', quantity: 1500 }),
      ]),
    ).toEqual({
      holder: { kind: 'EMPLOYEE', id: 'e1' },
      items: [
        { inventoryItemId: 'i1', quantity: '2.000' },
        { inventoryItemId: 'i2', quantity: '1.500' },
      ],
    });
  });
});

describe('navegación', () => {
  const params = (query: string) => new URLSearchParams(query);

  it('vuelve a la lista con la cuenta resaltada', () => {
    expect(tabsListHref()).toBe('/sales/tabs');
    expect(tabsListHref('t1')).toBe('/sales/tabs?highlight=t1');
  });

  it('lee a quién va Nueva venta, y descarta lo que no entiende', () => {
    expect(newSaleTargetFrom(params(''))).toEqual({ kind: 'sale' });
    expect(newSaleTargetFrom(params('tab=t1'))).toEqual({ kind: 'tab', tabId: 't1' });
    expect(newSaleTargetFrom(params('holderKind=CUSTOMER&holderId=c1'))).toEqual({
      kind: 'holder',
      holder: { kind: 'CUSTOMER', id: 'c1' },
    });
    expect(newSaleTargetFrom(params('holderKind=ADMIN&holderId=c1'))).toEqual({ kind: 'sale' });
    expect(newSaleTargetFrom(params('holderKind=EMPLOYEE'))).toEqual({ kind: 'sale' });
  });

  it('arma la URL de ida y vuelta', () => {
    expect(newSaleHref({ kind: 'tab', tabId: 't1' })).toBe('/sales/new?tab=t1');
    expect(newSaleHref({ kind: 'holder', holder: { kind: 'EMPLOYEE', id: 'e1' } })).toBe(
      '/sales/new?holderKind=EMPLOYEE&holderId=e1',
    );
    expect(
      newSaleTargetFrom(params(newSaleHref({ kind: 'tab', tabId: 't9' }).split('?')[1] ?? '')),
    ).toEqual({
      kind: 'tab',
      tabId: 't9',
    });
  });
});
