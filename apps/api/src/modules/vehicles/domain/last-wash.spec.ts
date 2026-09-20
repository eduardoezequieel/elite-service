import { lastWashBefore, lastWashOf } from './last-wash';

const at = new Date('2026-09-03T12:00:00.000Z');

describe('lastWashOf (041)', () => {
  it('sin ticket devuelve null', () => {
    expect(lastWashOf(undefined)).toBeNull();
  });

  it('copia fecha, primer servicio y nota recortada', () => {
    expect(
      lastWashOf({
        createdAt: at,
        notes: '  Pidió cera.  ',
        items: [{ serviceName: 'Lavado + aspirado' }, { serviceName: 'Motor' }],
      }),
    ).toEqual({
      createdAt: '2026-09-03T12:00:00.000Z',
      serviceName: 'Lavado + aspirado',
      notes: 'Pidió cera.',
    });
  });

  it('nota vacía o de espacios queda null; sin ítems, serviceName null', () => {
    expect(lastWashOf({ createdAt: at, notes: '   ', items: [] })).toEqual({
      createdAt: '2026-09-03T12:00:00.000Z',
      serviceName: null,
      notes: null,
    });
  });
});

describe('lastWashBefore (052)', () => {
  const before = new Date('2026-08-12T15:00:00.000Z');

  // Como lo entrega el repositorio: los del carro, sin anulados, del más
  // reciente al más viejo.
  const open = { id: 't2', createdAt: at, notes: null, items: [{ serviceName: 'Lavado' }] };
  const paid = {
    id: 't1',
    createdAt: before,
    notes: 'Pidió cera. No silicona.',
    items: [{ serviceName: 'Lavado + aspirado' }],
  };

  it('un ticket recién abierto trae la nota del lavado anterior, no la suya', () => {
    expect(lastWashBefore([open, paid], open.id)).toEqual({
      createdAt: '2026-08-12T15:00:00.000Z',
      serviceName: 'Lavado + aspirado',
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
