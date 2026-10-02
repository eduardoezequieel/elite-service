import type { LastWashItemSource, LastWashSource } from './last-wash';
import { lastWashBefore, lastWashOf } from './last-wash';

const at = new Date('2026-09-03T12:00:00.000Z');
const paidAt = new Date('2026-09-03T13:30:00.000Z');

/** Una linea de servicio: una unidad (065 RN-6). */
function service(serviceName: string, unitPrice: string): LastWashItemSource {
  return { kind: 'SERVICE', serviceName, unitPrice, quantity: '1.000' };
}

/** Un ticket cobrado de dos lineas, que es el caso normal de la ficha (057). */
function source(changes: Partial<LastWashSource> = {}): LastWashSource {
  return {
    id: 't1',
    number: 'CW-0048',
    createdAt: at,
    notes: null,
    items: [
      { kind: 'SERVICE', serviceName: 'Lavado + aspirado', unitPrice: '8.00', quantity: '1.000' },
      { kind: 'SERVICE', serviceName: 'Pulido de silvines', unitPrice: '15.00', quantity: '1.000' },
    ],
    washers: [{ fullName: 'Carlos Mejía' }],
    payments: [{ method: 'CASH', paidAt }],
    ...changes,
  };
}

describe('lastWashOf (041, 057)', () => {
  it('sin ticket devuelve null', () => {
    expect(lastWashOf(undefined)).toBeNull();
  });

  it('un cobrado de dos lineas viaja con su desglose, su total y su pago', () => {
    expect(lastWashOf(source({ notes: '  Pidió cera.  ' }))).toEqual({
      id: 't1',
      number: 'CW-0048',
      createdAt: '2026-09-03T12:00:00.000Z',
      washers: ['Carlos Mejía'],
      items: [
        {
          kind: 'SERVICE',
          serviceName: 'Lavado + aspirado',
          unitPrice: '8.00',
          quantity: '1.000',
          total: '8.00',
        },
        {
          kind: 'SERVICE',
          serviceName: 'Pulido de silvines',
          unitPrice: '15.00',
          quantity: '1.000',
          total: '15.00',
        },
      ],
      total: '23.00',
      payments: [{ method: 'CASH', paidAt: '2026-09-03T13:30:00.000Z' }],
      notes: 'Pidió cera.',
    });
  });

  it('las lineas salen en el orden en que llegan, no reordenadas por precio', () => {
    const wash = lastWashOf(source());

    expect(wash?.items.map((item) => item.serviceName)).toEqual([
      'Lavado + aspirado',
      'Pulido de silvines',
    ]);
  });

  it('una linea de producto suma precio × cantidad al total (065 RN-6)', () => {
    const wash = lastWashOf(
      source({
        items: [
          { kind: 'SERVICE', serviceName: 'Lavado', unitPrice: '10.00', quantity: '1.000' },
          { kind: 'PRODUCT', serviceName: 'Aromatizante', unitPrice: '3.00', quantity: '2.000' },
        ],
      }),
    );

    expect(wash?.items[1]).toEqual({
      kind: 'PRODUCT',
      serviceName: 'Aromatizante',
      unitPrice: '3.00',
      quantity: '2.000',
      total: '6.00',
    });
    expect(wash?.total).toBe('16.00');
  });

  it('un lavado listo pero sin cobrar no tiene pagos', () => {
    expect(lastWashOf(source({ payments: [] }))?.payments).toEqual([]);
  });

  it('un cobro partido viaja con sus dos métodos, en orden (059)', () => {
    const split = source({
      payments: [
        { method: 'CARD', paidAt },
        { method: 'CASH', paidAt },
      ],
    });

    expect(lastWashOf(split)?.payments).toEqual([
      { method: 'CARD', paidAt: '2026-09-03T13:30:00.000Z' },
      { method: 'CASH', paidAt: '2026-09-03T13:30:00.000Z' },
    ]);
  });

  it('sin lavador, `washers` vacio: lo hizo oficina', () => {
    expect(lastWashOf(source({ washers: [] }))?.washers).toEqual([]);
  });

  it('dos lavadores viajan con su nombre, en orden', () => {
    const washers = [{ fullName: 'Carlos Mejía' }, { fullName: 'José Ramos' }];

    expect(lastWashOf(source({ washers }))?.washers).toEqual(['Carlos Mejía', 'José Ramos']);
  });

  it('el total se suma en centavos: tres lineas de 8.10 dan 24.30, no 24.2999...', () => {
    const items = [service('A', '8.10'), service('B', '8.10'), service('C', '8.10')];

    expect(lastWashOf(source({ items }))?.total).toBe('24.30');
  });

  it('el precio se normaliza a dos decimales aunque la base lo entregue corto', () => {
    const items = [service('Lavado', '8')];
    const wash = lastWashOf(source({ items }));

    expect(wash?.items).toEqual([
      {
        kind: 'SERVICE',
        serviceName: 'Lavado',
        unitPrice: '8.00',
        quantity: '1.000',
        total: '8.00',
      },
    ]);
    expect(wash?.total).toBe('8.00');
  });

  it('nota vacia o de espacios queda null; sin lineas, total en cero', () => {
    expect(lastWashOf(source({ notes: '   ', items: [] }))).toMatchObject({
      items: [],
      total: '0.00',
      notes: null,
    });
  });
});

describe('lastWashBefore (052)', () => {
  const before = new Date('2026-08-12T15:00:00.000Z');

  // Como lo entrega el repositorio: los del carro, sin anulados, del más
  // reciente al más viejo.
  const open = source({
    id: 't2',
    number: 'CW-0049',
    createdAt: at,
    notes: null,
    items: [service('Lavado', '8.00')],
    payments: [],
  });
  const paid = source({
    id: 't1',
    number: 'CW-0048',
    createdAt: before,
    notes: 'Pidió cera. No silicona.',
    items: [service('Lavado + aspirado', '8.00')],
  });

  it('un ticket recién abierto trae el lavado anterior, no el suyo', () => {
    expect(lastWashBefore([open, paid], open.id)).toEqual({
      id: 't1',
      number: 'CW-0048',
      createdAt: '2026-08-12T15:00:00.000Z',
      washers: ['Carlos Mejía'],
      items: [
        {
          kind: 'SERVICE',
          serviceName: 'Lavado + aspirado',
          unitPrice: '8.00',
          quantity: '1.000',
          total: '8.00',
        },
      ],
      total: '8.00',
      payments: [{ method: 'CASH', paidAt: '2026-09-03T13:30:00.000Z' }],
      notes: 'Pidió cera. No silicona.',
    });
  });

  it('el primer lavado de un carro no tiene anterior', () => {
    expect(lastWashBefore([open], open.id)).toBeNull();
  });

  it('el anulado no llega hasta acá: se salta al anterior no anulado', () => {
    // El VOID que había entre los dos ya quedó fuera al consultar.
    expect(lastWashBefore([open, paid], open.id)?.notes).toBe('Pidió cera. No silicona.');
    // Y si el único anterior estaba anulado, no queda ninguno.
    expect(lastWashBefore([open], open.id)).toBeNull();
  });
});
