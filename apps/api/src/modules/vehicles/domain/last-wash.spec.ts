import type { LastWashSource } from './last-wash';
import { lastWashBefore, lastWashOf } from './last-wash';

const at = new Date('2026-09-03T12:00:00.000Z');
const paidAt = new Date('2026-09-03T13:30:00.000Z');

/** Un ticket cobrado de dos lineas, que es el caso normal de la ficha (057). */
function source(changes: Partial<LastWashSource> = {}): LastWashSource {
  return {
    id: 't1',
    number: 'CW-0048',
    createdAt: at,
    notes: null,
    items: [
      { serviceName: 'Lavado + aspirado', unitPrice: '8.00' },
      { serviceName: 'Pulido de silvines', unitPrice: '15.00' },
    ],
    washers: [{ fullName: 'Carlos Mejía' }],
    payment: { method: 'CASH', paidAt },
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
        { serviceName: 'Lavado + aspirado', unitPrice: '8.00' },
        { serviceName: 'Pulido de silvines', unitPrice: '15.00' },
      ],
      total: '23.00',
      payment: { method: 'CASH', paidAt: '2026-09-03T13:30:00.000Z' },
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

  it('un lavado listo pero sin cobrar no tiene pago', () => {
    expect(lastWashOf(source({ payment: null }))?.payment).toBeNull();
  });

  it('sin lavador, `washers` vacio: lo hizo oficina', () => {
    expect(lastWashOf(source({ washers: [] }))?.washers).toEqual([]);
  });

  it('dos lavadores viajan con su nombre, en orden', () => {
    const washers = [{ fullName: 'Carlos Mejía' }, { fullName: 'José Ramos' }];

    expect(lastWashOf(source({ washers }))?.washers).toEqual(['Carlos Mejía', 'José Ramos']);
  });

  it('el total se suma en centavos: tres lineas de 8.10 dan 24.30, no 24.2999...', () => {
    const items = [
      { serviceName: 'A', unitPrice: '8.10' },
      { serviceName: 'B', unitPrice: '8.10' },
      { serviceName: 'C', unitPrice: '8.10' },
    ];

    expect(lastWashOf(source({ items }))?.total).toBe('24.30');
  });

  it('el precio se normaliza a dos decimales aunque la base lo entregue corto', () => {
    const items = [{ serviceName: 'Lavado', unitPrice: '8' }];
    const wash = lastWashOf(source({ items }));

    expect(wash?.items).toEqual([{ serviceName: 'Lavado', unitPrice: '8.00' }]);
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
    items: [{ serviceName: 'Lavado', unitPrice: '8.00' }],
    payment: null,
  });
  const paid = source({
    id: 't1',
    number: 'CW-0048',
    createdAt: before,
    notes: 'Pidió cera. No silicona.',
    items: [{ serviceName: 'Lavado + aspirado', unitPrice: '8.00' }],
  });

  it('un ticket recién abierto trae el lavado anterior, no el suyo', () => {
    expect(lastWashBefore([open, paid], open.id)).toEqual({
      id: 't1',
      number: 'CW-0048',
      createdAt: '2026-08-12T15:00:00.000Z',
      washers: ['Carlos Mejía'],
      items: [{ serviceName: 'Lavado + aspirado', unitPrice: '8.00' }],
      total: '8.00',
      payment: { method: 'CASH', paidAt: '2026-09-03T13:30:00.000Z' },
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
