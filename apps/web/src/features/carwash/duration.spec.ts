import { durationLabel, liveDurationLabel, secondsSince } from './duration';

describe('durationLabel (046)', () => {
  it.each([
    [0, '0 s'],
    [45, '45 s'],
    [59, '59 s'],
    [60, '1 min'],
    [90, '1 min'],
    [3599, '59 min'],
    [3600, '1 h 00 min'],
    [3840, '1 h 04 min'],
    [7200, '2 h 00 min'],
  ])('%i s → %s', (seconds, label) => {
    expect(durationLabel(seconds)).toBe(label);
  });

  it('un valor negativo no produce un tiempo hacia atrás', () => {
    expect(durationLabel(-10)).toBe('0 s');
  });
});

describe('liveDurationLabel (046)', () => {
  it('bajo el minuto es igual al cerrado', () => {
    expect(liveDurationLabel(45)).toBe('45 s');
  });

  it('entre el minuto y la hora muestra los segundos que corren', () => {
    expect(liveDurationLabel(750)).toBe('12 min 30 s');
    expect(liveDurationLabel(60)).toBe('1 min 00 s');
  });

  it('pasada la hora vuelve a los minutos: el segundero ahí no dice nada', () => {
    expect(liveDurationLabel(3840)).toBe('1 h 04 min');
  });
});

describe('secondsSince (046)', () => {
  it('cuenta desde el ISO hasta la marca de reloj', () => {
    const at = '2026-09-20T16:38:00.000Z';

    expect(secondsSince(at, Date.parse('2026-09-20T16:49:30.000Z'))).toBe(690);
  });

  it('un reloj atrasado da cero, no un negativo', () => {
    const at = '2026-09-20T16:38:00.000Z';

    expect(secondsSince(at, Date.parse('2026-09-20T16:37:00.000Z'))).toBe(0);
  });
});
