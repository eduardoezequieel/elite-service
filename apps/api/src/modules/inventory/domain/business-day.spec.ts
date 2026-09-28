import { businessDayBounds, businessMonthBounds, businessMonthOf } from './business-day';

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

describe('businessMonthBounds', () => {
  it('el mes va del 1 a medianoche al 1 del siguiente, hora de El Salvador', () => {
    const { start, end } = businessMonthBounds('2026-09');

    expect(start.toISOString()).toBe('2026-09-01T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T06:00:00.000Z');
  });

  it('diciembre termina en enero del año siguiente', () => {
    expect(businessMonthBounds('2026-12').end.toISOString()).toBe('2027-01-01T06:00:00.000Z');
  });
});

describe('businessMonthOf', () => {
  it('las 11 de la noche del 30 sept en El Salvador todavía es septiembre', () => {
    expect(businessMonthOf(new Date('2026-10-01T05:00:00.000Z'))).toBe('2026-09');
  });

  it('medianoche del 1 oct ya es octubre', () => {
    expect(businessMonthOf(new Date('2026-10-01T06:00:00.000Z'))).toBe('2026-10');
  });
});
