import {
  dailyPriceLabel,
  dayOccupancy,
  defaultFreeRange,
  pushReturn,
  weekDays,
  weekRange,
  weekendRange,
} from './available-range';

describe('Libre (107)', () => {
  it('arranca mañana 09:00 y el atajo de una semana suma siete días', () => {
    expect(defaultFreeRange('2026-10-05')).toEqual({
      from: '2026-10-06T09:00',
      to: '2026-10-07T09:00',
    });
    expect(weekRange('2026-10-05')).toEqual({
      from: '2026-10-06T09:00',
      to: '2026-10-13T09:00',
    });
  });

  it('el fin de semana es sábado 09:00 a lunes 09:00', () => {
    const weekend = { from: '2026-10-10T09:00', to: '2026-10-12T09:00' };

    expect(weekendRange('2026-10-05')).toEqual(weekend);
    expect(weekendRange('2026-10-09')).toEqual(weekend);
    expect(weekendRange('2026-10-10')).toEqual(weekend);
    expect(weekendRange('2026-10-11')).toEqual(weekend);
  });

  it('elige un día de Sale y corre Regresa si quedó antes', () => {
    expect(pushReturn('2026-10-08T09:00', '2026-10-10T09:00')).toBe('2026-10-10T09:00');
    expect(pushReturn('2026-10-10T09:00', '2026-10-10T09:00')).toBe('2026-10-11T09:00');
    expect(pushReturn('2026-10-12T09:00', '2026-10-10T09:00')).toBe('2026-10-13T09:00');
  });

  it('la semana son siete días y la celda junta los nombres', () => {
    expect(weekDays('2026-10-06T09:00')).toEqual([
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
    expect(
      dayOccupancy(
        [
          {
            id: 'ana',
            start: '2026-10-06T15:00:00.000Z',
            end: '2026-10-08T15:00:00.000Z',
            customerName: 'Ana López',
          },
          {
            id: 'luis',
            start: '2026-10-07T15:00:00.000Z',
            end: '2026-10-07T21:00:00.000Z',
            customerName: 'Luis Gómez',
          },
        ],
        '2026-10-07',
      ),
    ).toEqual({ agreementId: 'ana', label: 'Ana · Luis' });
    expect(dayOccupancy([], '2026-10-07')).toBeNull();
  });

  it('escribe el precio sin centavos cuando el monto es entero', () => {
    expect(dailyPriceLabel('35.00', 2, '70.00')).toBe('$35 por día × 2 días = $70');
    expect(dailyPriceLabel('35.50', 1, '35.50')).toBe('$35.50 por día × 1 día = $35.50');
  });
});
