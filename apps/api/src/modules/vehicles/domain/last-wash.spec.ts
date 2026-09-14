import { lastWashOf } from './last-wash';

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
