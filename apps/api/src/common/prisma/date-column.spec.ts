import { civilColumn, civilToDate, dateToCivil } from './date-column';

describe('date-column (095)', () => {
  it('ida y vuelta sin correrse un día', () => {
    expect(dateToCivil(civilToDate('2026-03-05'))).toBe('2026-03-05');
  });

  it('null y undefined se respetan', () => {
    expect(dateToCivil(null)).toBeNull();
    expect(civilColumn(undefined)).toBeUndefined();
    expect(civilColumn(null)).toBeNull();
    expect(civilColumn('2026-01-31')?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});
