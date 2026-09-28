import {
  consumptionDetailHref,
  consumptionRangeFrom,
  consumptionRangeQuery,
  consumptionReportHref,
  consumptionValueLine,
  priceCents,
} from './consumption';

describe('rango del consumo (091 RN-4)', () => {
  it('sin rango en la URL es el mes en curso hasta hoy', () => {
    expect(consumptionRangeFrom({}, '2026-09-28')).toEqual({
      from: '2026-09-01',
      to: '2026-09-28',
    });
  });

  it('toma el rango de la URL solo si las dos fechas valen y van en orden', () => {
    expect(consumptionRangeFrom({ start: '2026-08-10', end: '2026-09-02' }, '2026-09-28')).toEqual({
      from: '2026-08-10',
      to: '2026-09-02',
    });
    expect(consumptionRangeFrom({ start: '2026-09-20', end: '2026-09-01' }, '2026-09-28')).toEqual({
      from: '2026-09-01',
      to: '2026-09-28',
    });
    expect(
      consumptionRangeFrom({ start: '2026-13-01', end: '2026-09-01' }, '2026-09-28').from,
    ).toBe('2026-09-01');
  });

  it('las dos rutas llevan el rango, que va y vuelve', () => {
    const range = { from: '2026-09-01', to: '2026-09-28' };

    expect(consumptionReportHref(range)).toBe(
      '/inventory/consumption?start=2026-09-01&end=2026-09-28',
    );
    expect(consumptionDetailHref('e-1', range)).toBe(
      '/inventory/consumption/e-1?start=2026-09-01&end=2026-09-28',
    );
    expect(
      consumptionRangeFrom(Object.fromEntries(new URLSearchParams(consumptionRangeQuery(range)))),
    ).toEqual(range);
  });
});

describe('valor del consumo (070 RN-4)', () => {
  it('multiplica a precio de venta', () => {
    expect(consumptionValueLine('2', '1.25')).toBe('2 × $1.25 = $2.50');
    expect(consumptionValueLine('3', '0.75')).toBe('3 × $0.75 = $2.25');
  });

  it('una cantidad con decimales redondea a centavo', () => {
    expect(consumptionValueLine('2.5', '1.25')).toBe('2.5 × $1.25 = $3.13');
  });

  it('sin cantidad válida no dice nada', () => {
    expect(consumptionValueLine('', '1.25')).toBeNull();
    expect(consumptionValueLine('0', '1.25')).toBeNull();
    expect(consumptionValueLine('-1', '1.25')).toBeNull();
    expect(consumptionValueLine('dos', '1.25')).toBeNull();
  });

  it('lee centavos', () => {
    expect(priceCents('1.25')).toBe(125);
    expect(priceCents('3')).toBe(300);
    expect(priceCents('1.5')).toBe(150);
    expect(priceCents('x')).toBeNull();
  });
});
