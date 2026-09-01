import {
  formatNumber,
  nextNumber,
  parseSequence,
  SERVICE_PREFIX,
  TICKET_PREFIX,
  toReferenceLabel,
} from './numbering';

describe('numeracion (RN-15)', () => {
  it('formatea con cuatro digitos', () => {
    expect(formatNumber(TICKET_PREFIX, 1)).toBe('CW-0001');
    expect(formatNumber(TICKET_PREFIX, 14)).toBe('CW-0014');
    expect(formatNumber(SERVICE_PREFIX, 1)).toBe('SRV-0001');
  });

  it('lee el correlativo de vuelta', () => {
    expect(parseSequence(TICKET_PREFIX, 'CW-0014')).toBe(14);
    expect(parseSequence(SERVICE_PREFIX, 'SRV-0003')).toBe(3);
  });

  it.each(['', 'CW', '14', 'SRV-0001', 'CW-abc'])('no lee %s como ticket', (value) => {
    expect(parseSequence(TICKET_PREFIX, value)).toBeNull();
  });

  describe('nextNumber', () => {
    it('empieza en 1 cuando no hay ninguno', () => {
      expect(nextNumber(TICKET_PREFIX, null)).toBe('CW-0001');
    });

    it('sigue al ultimo', () => {
      expect(nextNumber(TICKET_PREFIX, 'CW-0013')).toBe('CW-0014');
    });

    /** Pasado el 9999 la serie crece en vez de romperse o repetir folio. */
    it('sigue creciendo despues de agotar los cuatro digitos', () => {
      expect(nextNumber(TICKET_PREFIX, 'CW-9999')).toBe('CW-10000');
      expect(nextNumber(TICKET_PREFIX, 'CW-10000')).toBe('CW-10001');
    });

    it('vuelve a empezar si el ultimo no tiene la forma esperada', () => {
      expect(nextNumber(TICKET_PREFIX, 'basura')).toBe('CW-0001');
    });
  });

  describe('toReferenceLabel', () => {
    /** En pantalla se dice "catorce", no "ce-uve-cero-cero-catorce" (RN-15). */
    it('muestra el numero sin prefijo ni ceros', () => {
      expect(toReferenceLabel('CW-0014')).toBe('#14');
      expect(toReferenceLabel('CW-0001')).toBe('#1');
      expect(toReferenceLabel('SRV-0003')).toBe('#3');
    });

    it('aguanta un valor sin la forma esperada sin romper la pantalla', () => {
      expect(toReferenceLabel('14')).toBe('#14');
    });
  });
});
