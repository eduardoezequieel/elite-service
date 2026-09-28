import { businessDateOf, businessDayBounds, defaultBusinessRange } from './business-day';

describe('businessDayBounds', () => {
  it('el día empieza a medianoche de El Salvador (UTC−6)', () => {
    const { start, end } = businessDayBounds('2026-09-26');

    expect(start.toISOString()).toBe('2026-09-26T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-27T06:00:00.000Z');
  });

  it('cruza el fin de mes', () => {
    expect(businessDayBounds('2026-09-30').end.toISOString()).toBe('2026-10-01T06:00:00.000Z');
  });
});

describe('businessDateOf', () => {
  it('las 11 de la noche del 30 sept en El Salvador todavía es 30 sept', () => {
    expect(businessDateOf(new Date('2026-10-01T05:00:00.000Z'))).toBe('2026-09-30');
  });

  it('medianoche del 1 oct ya es 1 oct', () => {
    expect(businessDateOf(new Date('2026-10-01T06:00:00.000Z'))).toBe('2026-10-01');
  });
});

describe('defaultBusinessRange (091 RN-4)', () => {
  const now = new Date('2026-09-28T18:00:00.000Z');

  it('sin rango, del primero del mes en curso a hoy', () => {
    expect(defaultBusinessRange(now, {})).toEqual({ from: '2026-09-01', to: '2026-09-28' });
  });

  it('lo que viene manda', () => {
    expect(defaultBusinessRange(now, { from: '2026-08-15', to: '2026-08-20' })).toEqual({
      from: '2026-08-15',
      to: '2026-08-20',
    });
  });

  it('con una sola punta, la otra sale del mes en curso', () => {
    expect(defaultBusinessRange(now, { from: '2026-09-10' })).toEqual({
      from: '2026-09-10',
      to: '2026-09-28',
    });
  });
});
