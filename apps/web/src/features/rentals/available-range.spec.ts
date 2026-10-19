import {
  dayShort,
  defaultFreeRange,
  fromCivilRange,
  rangeLabel,
  toCivilRange,
} from './available-range';

describe('Libre (107)', () => {
  it('arranca mañana 09:00', () => {
    expect(defaultFreeRange('2026-10-05')).toEqual({
      from: '2026-10-06T09:00',
      to: '2026-10-07T09:00',
    });
  });

  it('nombra el día corto, de un campo o de un día civil', () => {
    expect(dayShort('2026-10-03')).toBe('sáb 3 oct');
    expect(dayShort('2026-10-05T09:00')).toBe('lun 5 oct');
  });

  it('el disparador dice los dos días y cuántos cobra', () => {
    expect(rangeLabel({ from: '2026-10-16T09:00', to: '2026-10-17T09:00' })).toBe(
      'vie 16 oct → sáb 17 oct · 1 día',
    );
    expect(rangeLabel({ from: '2026-10-16T09:00', to: '2026-10-18T10:00' })).toMatch(/· 3 días$/);
  });

  it('pasa del calendario a las 09:00 y un solo día vuelve al siguiente', () => {
    expect(fromCivilRange({ from: '2026-10-16', to: '2026-10-18' })).toEqual({
      from: '2026-10-16T09:00',
      to: '2026-10-18T09:00',
    });
    expect(fromCivilRange({ from: '2026-10-16', to: '2026-10-16' })).toEqual({
      from: '2026-10-16T09:00',
      to: '2026-10-17T09:00',
    });
    expect(toCivilRange({ from: '2026-10-16T09:00', to: '2026-10-17T09:00' })).toEqual({
      from: '2026-10-16',
      to: '2026-10-17',
    });
  });
});
