import { formatItemCode, nextItemCode, parseItemCode } from './item-code';

describe('código de artículo (RN-15)', () => {
  it('formatea con cuatro dígitos', () => {
    expect(formatItemCode(7)).toBe('INV-0007');
    expect(formatItemCode(12345)).toBe('INV-12345');
  });

  it('lee el correlativo', () => {
    expect(parseItemCode('INV-0014')).toBe(14);
    expect(parseItemCode('CW-0014')).toBeNull();
  });

  it('empieza en 1', () => {
    expect(nextItemCode([])).toBe('INV-0001');
  });

  it('sigue al mayor, no al último de la lista', () => {
    expect(nextItemCode(['INV-0003', 'INV-0010', 'INV-0002'])).toBe('INV-0011');
  });

  it('pasa de 9999 sin romperse e ignora códigos ajenos', () => {
    expect(nextItemCode(['INV-9999', 'X-1'])).toBe('INV-10000');
  });
});
