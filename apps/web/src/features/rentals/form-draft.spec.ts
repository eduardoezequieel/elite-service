import {
  civilOrNull,
  civilToField,
  isTypedDateValid,
  moneyOrNull,
  numberToField,
  textOrNull,
  wholeOrNull,
} from './form-draft';

describe('form-draft (095)', () => {
  it('vacío es null', () => {
    expect(textOrNull('  ')).toBeNull();
    expect(moneyOrNull('')).toBeNull();
    expect(wholeOrNull('')).toBeNull();
    expect(civilOrNull('')).toBeNull();
  });

  it('montos con coma', () => {
    expect(moneyOrNull('35,5')).toBe('35.5');
  });

  it('enteros y lo que no lo es', () => {
    expect(wholeOrNull('2022')).toBe(2022);
    expect(wholeOrNull('20a')).toBe('20a');
  });

  it('fechas dd/mm/aaaa ida y vuelta', () => {
    expect(civilOrNull('05/03/2026')).toBe('2026-03-05');
    expect(civilToField('2026-03-05')).toBe('05/03/2026');
    expect(civilToField(null)).toBe('');
    expect(isTypedDateValid('31/02/2026')).toBe(false);
    expect(isTypedDateValid('')).toBe(true);
  });

  it('números al campo', () => {
    expect(numberToField(null)).toBe('');
    expect(numberToField(0)).toBe('0');
  });
});
