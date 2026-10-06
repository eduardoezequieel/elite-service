import { FUEL_QUARTERS, fuelQuarterLabel } from './fuel-scale';

describe('tramos de combustible (108)', () => {
  it('mapea Vacío, ¼, ½, ¾ y Lleno a octavos pares', () => {
    expect(FUEL_QUARTERS.map((level) => [level.label, level.eighths])).toEqual([
      ['Vacío', 0],
      ['¼', 2],
      ['½', 4],
      ['¾', 6],
      ['Lleno', 8],
    ]);
    expect(fuelQuarterLabel(4)).toBe('½');
    expect(fuelQuarterLabel(1)).toBeNull();
  });
});
