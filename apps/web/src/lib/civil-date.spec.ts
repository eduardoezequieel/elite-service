import {
  addDays,
  addMonths,
  firstOfMonth,
  formatCivil,
  isCivil,
  maskDate,
  matchingPreset,
  monthCells,
  parseTyped,
  presetRange,
  rangeDayCount,
  rangeSummary,
  WEEKDAYS,
} from './civil-date';

describe('civil dates (spec 026)', () => {
  it('acepta solo días reales en YYYY-MM-DD', () => {
    expect(isCivil('2026-09-05')).toBe(true);
    expect(isCivil('2026-02-31')).toBe(false);
    expect(isCivil('05/09/2026')).toBe(false);
  });

  it('formatea y parsea dd/mm/yyyy', () => {
    expect(formatCivil('2026-09-05')).toBe('05/09/2026');
    expect(parseTyped('05/09/2026')).toBe('2026-09-05');
    expect(parseTyped('31/02/2026')).toBeNull();
    expect(parseTyped('5/9/2026')).toBeNull();
    expect(parseTyped('')).toBeNull();
  });

  it('enmascara dígitos con barras', () => {
    expect(maskDate('0')).toBe('0');
    expect(maskDate('05')).toBe('05');
    expect(maskDate('050')).toBe('05/0');
    expect(maskDate('0509')).toBe('05/09');
    expect(maskDate('05092026')).toBe('05/09/2026');
    expect(maskDate('05a09b2026extra')).toBe('05/09/2026');
  });

  it('suma días y meses sin correrse de zona', () => {
    expect(addDays('2026-09-05', -6)).toBe('2026-08-30');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(firstOfMonth('2026-09-05')).toBe('2026-09-01');
  });

  it('arma la rejilla empezando en lunes', () => {
    expect(WEEKDAYS[0]).toBe('lu');
    // 1 sep 2026 es martes: la primera celda es el lunes 31 ago.
    const cells = monthCells('2026-09-01');
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe('2026-08-31');
    expect(cells[1]).toBe('2026-09-01');
    expect(cells[5]).toBe('2026-09-05');
  });

  it('resuelve presets contra un hoy fijo', () => {
    const today = '2026-09-05';
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
    expect(presetRange('7d', today)).toEqual({ from: '2026-08-30', to: today });
    expect(presetRange('month', today)).toEqual({ from: '2026-09-01', to: today });
    expect(matchingPreset({ from: '2026-08-30', to: today }, today)).toBe('7d');
    expect(matchingPreset({ from: '2026-08-01', to: today }, today)).toBe('');
  });

  it('resume el rango como el disparador cerrado', () => {
    expect(rangeDayCount({ from: '2026-08-31', to: '2026-09-06' })).toBe(7);
    expect(rangeSummary({ from: '2026-09-06', to: '2026-09-06' })).toBe('6 sept 2026 · 1 día');
    expect(rangeSummary({ from: '2026-08-31', to: '2026-09-06' })).toBe('31 ago – 6 sept 2026 · 7 días');
    expect(rangeSummary({ from: '2025-12-28', to: '2026-01-03' })).toBe(
      '28 dic 2025 – 3 ene 2026 · 7 días',
    );
  });
});
