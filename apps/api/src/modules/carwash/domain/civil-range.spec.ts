import { civilRange } from './civil-range';

describe('civilRange', () => {
  it('interpreta YYYY-MM-DD como medianoche en America/El_Salvador', () => {
    const range = civilRange('2026-09-03', '2026-09-03');

    expect(range.gte).toEqual(new Date('2026-09-03T00:00:00.000-06:00'));
    expect(range.gte.toISOString()).toBe('2026-09-03T06:00:00.000Z');
    expect(range.lt).toEqual(new Date('2026-09-04T00:00:00.000-06:00'));
    expect(range.lt.toISOString()).toBe('2026-09-04T06:00:00.000Z');
  });
});
