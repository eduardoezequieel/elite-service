import { businessDayBounds } from './business-day';

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
