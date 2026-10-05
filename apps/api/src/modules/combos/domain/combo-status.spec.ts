import { comboStatus, isAvailableOn, weekdayOf } from './combo-status';

const window = {
  isActive: true,
  validFrom: '2026-10-01',
  validTo: '2026-10-31',
  weekdays: [1, 2, 3, 4, 5],
};

describe('comboStatus (104 RN-3)', () => {
  it('pausado gana a cualquier fecha', () => {
    expect(comboStatus({ ...window, isActive: false }, '2026-10-05')).toBe('PAUSED');
  });

  it('antes de validFrom es SCHEDULED', () => {
    expect(comboStatus(window, '2026-09-30')).toBe('SCHEDULED');
  });

  it('después de validTo es EXPIRED', () => {
    expect(comboStatus(window, '2026-11-01')).toBe('EXPIRED');
  });

  it('los dos bordes son LIVE', () => {
    expect(comboStatus(window, '2026-10-01')).toBe('LIVE');
    expect(comboStatus(window, '2026-10-31')).toBe('LIVE');
  });

  it('sin fin no vence', () => {
    expect(comboStatus({ ...window, validTo: null }, '2030-01-01')).toBe('LIVE');
  });
});

describe('weekdayOf', () => {
  it('lee el día de la semana de la fecha civil, 0 = domingo', () => {
    expect(weekdayOf('2026-10-04')).toBe(0);
    expect(weekdayOf('2026-10-05')).toBe(1);
    expect(weekdayOf('2026-10-10')).toBe(6);
    expect(weekdayOf('2024-02-29')).toBe(4);
  });
});

describe('isAvailableOn (104 RN-3)', () => {
  it('vale hoy si está LIVE y el día de la semana aplica', () => {
    expect(isAvailableOn(window, '2026-10-05')).toBe(true);
  });

  it('no vale un día de la semana que no aplica', () => {
    expect(isAvailableOn(window, '2026-10-04')).toBe(false);
  });

  it('no vale pausado, programado ni vencido', () => {
    expect(isAvailableOn({ ...window, isActive: false }, '2026-10-05')).toBe(false);
    expect(isAvailableOn(window, '2026-09-28')).toBe(false);
    expect(isAvailableOn(window, '2026-11-02')).toBe(false);
  });
});
