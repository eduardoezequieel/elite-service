import {
  consumptionDetailHref,
  consumptionMonthFrom,
  consumptionMonthTitle,
  consumptionReportHref,
  consumptionValueLine,
  currentConsumptionMonth,
  formatCents,
  isAfterCurrentMonth,
  isConsumptionMonth,
  priceCents,
  shiftConsumptionMonth,
} from './consumption';

// 1 oct 2026 a las 03:00 UTC es todavía 30 sept a las 21:00 en El Salvador.
const LATE_SEPT_IN_SV = new Date('2026-10-01T03:00:00.000Z');

describe('mes del consumo (070 RN-5)', () => {
  it('arranca en el mes actual de El Salvador, no en el UTC', () => {
    expect(currentConsumptionMonth(LATE_SEPT_IN_SV)).toBe('2026-09');
  });

  it('toma el mes de la URL solo si es YYYY-MM válido', () => {
    expect(consumptionMonthFrom('2026-08', LATE_SEPT_IN_SV)).toBe('2026-08');
    expect(consumptionMonthFrom('2026-13', LATE_SEPT_IN_SV)).toBe('2026-09');
    expect(consumptionMonthFrom('2026-8', LATE_SEPT_IN_SV)).toBe('2026-09');
    expect(consumptionMonthFrom(['2026-08'], LATE_SEPT_IN_SV)).toBe('2026-09');
    expect(consumptionMonthFrom(undefined, LATE_SEPT_IN_SV)).toBe('2026-09');
    expect(isConsumptionMonth('2026-00')).toBe(false);
  });

  it('pasa de mes cruzando el año', () => {
    expect(shiftConsumptionMonth('2026-09', -1)).toBe('2026-08');
    expect(shiftConsumptionMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftConsumptionMonth('2026-01', -1)).toBe('2025-12');
  });

  it('no deja mirar un mes que todavía no llegó', () => {
    expect(isAfterCurrentMonth('2026-10', LATE_SEPT_IN_SV)).toBe(true);
    expect(isAfterCurrentMonth('2026-09', LATE_SEPT_IN_SV)).toBe(false);
  });

  it('titula el mes en español', () => {
    expect(consumptionMonthTitle('2026-09')).toBe('Septiembre 2026');
  });

  it('las dos rutas llevan el mes', () => {
    expect(consumptionReportHref('2026-09')).toBe('/inventory/consumption?month=2026-09');
    expect(consumptionDetailHref('e-1', '2026-09')).toBe(
      '/inventory/consumption/e-1?month=2026-09',
    );
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

  it('lee y escribe centavos', () => {
    expect(priceCents('1.25')).toBe(125);
    expect(priceCents('3')).toBe(300);
    expect(priceCents('1.5')).toBe(150);
    expect(priceCents('x')).toBeNull();
    expect(formatCents(250)).toBe('$2.50');
    expect(formatCents(5)).toBe('$0.05');
  });
});
