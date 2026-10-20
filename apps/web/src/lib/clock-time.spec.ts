import { clockLabel, fromClockParts, isClockTime, toClockParts } from './clock-time';

describe('la hora de un formulario (spec 119)', () => {
  it('pasa de 24 h a 12 h con las 12 bien puestas', () => {
    expect(toClockParts('00:15')).toEqual({ hour: 12, minute: 15, pm: false });
    expect(toClockParts('09:00')).toEqual({ hour: 9, minute: 0, pm: false });
    expect(toClockParts('12:30')).toEqual({ hour: 12, minute: 30, pm: true });
    expect(toClockParts('23:45')).toEqual({ hour: 11, minute: 45, pm: true });
  });

  it('vuelve a 24 h', () => {
    expect(fromClockParts({ hour: 12, minute: 0, pm: false })).toBe('00:00');
    expect(fromClockParts({ hour: 12, minute: 15, pm: true })).toBe('12:15');
    expect(fromClockParts({ hour: 7, minute: 30, pm: true })).toBe('19:30');
    expect(fromClockParts({ hour: 11, minute: 0, pm: false })).toBe('11:00');
  });

  it('rotula en 12 h y respeta los minutos sueltos', () => {
    expect(clockLabel('11:00')).toBe('11:00 AM');
    expect(clockLabel('00:00')).toBe('12:00 AM');
    expect(clockLabel('12:30')).toBe('12:30 PM');
    expect(clockLabel('10:07')).toBe('10:07 AM');
  });

  it('acepta solo horas reales', () => {
    expect(isClockTime('09:00')).toBe(true);
    expect(isClockTime('24:00')).toBe(false);
    expect(isClockTime('9:00')).toBe(false);
    expect(isClockTime('')).toBe(false);
  });
});
