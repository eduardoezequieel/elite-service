import { shortCivil, todayTitle } from './today-format';

describe('todayTitle (107)', () => {
  it('arma «Hoy, 5 de oct» sin punto en el mes', () => {
    expect(todayTitle('2026-10-05')).toBe('Hoy, 5 de oct');
    expect(shortCivil('2026-01-09')).toBe('9 de ene');
    expect(shortCivil('2026-12-31')).toBe('31 de dic');
  });
});
