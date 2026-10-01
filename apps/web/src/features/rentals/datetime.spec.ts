import {
  addDaysToField,
  civilStartInstant,
  fieldToInstant,
  instantToCivil,
  instantToField,
  nowField,
} from './datetime';

describe('fecha y hora de una renta (096)', () => {
  it('lee el campo en la hora del taller (UTC−6)', () => {
    expect(fieldToInstant('2026-10-12T10:00')).toBe('2026-10-12T16:00:00.000Z');
    expect(instantToField('2026-10-12T16:00:00.000Z')).toBe('2026-10-12T10:00');
  });

  it('vacío o roto no es un instante', () => {
    expect(fieldToInstant('')).toBeNull();
    expect(fieldToInstant('12/10/2026 10:00')).toBeNull();
    expect(instantToField(null)).toBe('');
  });

  it('el día civil de un instante cerca de medianoche es el del taller', () => {
    expect(instantToCivil('2026-10-13T03:00:00.000Z')).toBe('2026-10-12');
    expect(civilStartInstant('2026-10-12')).toBe('2026-10-12T06:00:00.000Z');
  });

  it('suma días al campo y redondea ahora al cuarto de hora', () => {
    expect(addDaysToField('2026-10-31T09:00', 1)).toBe('2026-11-01T09:00');
    expect(nowField(new Date('2026-10-12T16:07:00.000Z'))).toBe('2026-10-12T10:15');
  });
});
