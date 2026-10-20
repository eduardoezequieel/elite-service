import type { FleetAlert, TodayOutRow, TodayRow } from '@elite/shared';

import {
  dueAlertPending,
  homeMoves,
  occupiedVehicles,
  occupancyRatio,
  overduePending,
  slotTouchesCivilDay,
  slotsOf,
  weekDayLabel,
  weekOccupancy,
} from './today-home';

/** Hora del taller → instante ISO. */
function at(civil: string, time: string): string {
  return new Date(`${civil}T${time}:00-06:00`).toISOString();
}

function departure(id: string, when: string): TodayRow {
  return {
    agreementId: id,
    contractNumber: null,
    vehicleId: id,
    plate: `P-${id}`,
    vehicleName: `Carro ${id}`,
    customerName: `Cliente ${id}`,
    customerPhone: '',
    at: when,
    kind: 'DEPARTURE',
  };
}

function out(
  id: string,
  when: string,
  returnStatus: TodayOutRow['returnStatus'],
  phone = '',
): TodayOutRow {
  return {
    agreementId: id,
    contractNumber: null,
    vehicleId: id,
    plate: `P-${id}`,
    vehicleName: `Carro ${id}`,
    customerName: `Cliente ${id}`,
    customerPhone: phone,
    at: when,
    returnStatus,
  };
}

const alert = (level: FleetAlert['level'], text: string): FleetAlert => ({
  kind: 'SERVICE',
  level,
  text,
});

describe('week occupancy (125)', () => {
  const today = '2026-10-19';

  it('nombra los siete días desde el lunes 19', () => {
    expect(weekDayLabel('2026-10-19')).toBe('Lun 19');
    expect(weekDayLabel('2026-10-25')).toBe('Dom 25');
    expect(weekOccupancy([], today).map((day) => day.label)).toEqual([
      'Lun 19',
      'Mar 20',
      'Mié 21',
      'Jue 22',
      'Vie 23',
      'Sáb 24',
      'Dom 25',
    ]);
  });

  it('cuenta un carro por día que toca el tramo, sin repetir el mismo carro', () => {
    const slots = [
      { vehicleId: 'a', start: at('2026-10-19', '10:00'), end: at('2026-10-21', '10:00') },
      { vehicleId: 'a', start: at('2026-10-19', '18:00'), end: at('2026-10-19', '20:00') },
      { vehicleId: 'b', start: at('2026-10-19', '23:30'), end: at('2026-10-20', '00:30') },
    ];

    expect(occupiedVehicles(slots, '2026-10-19')).toBe(2);
    expect(occupiedVehicles(slots, '2026-10-20')).toBe(2);
    expect(occupiedVehicles(slots, '2026-10-21')).toBe(1);
    expect(occupiedVehicles(slots, '2026-10-22')).toBe(0);
  });

  it('un regreso a la medianoche no ocupa el día que empieza', () => {
    const slot = { start: at('2026-10-19', '08:00'), end: at('2026-10-20', '00:00') };

    expect(slotTouchesCivilDay(slot, '2026-10-19')).toBe(true);
    expect(slotTouchesCivilDay(slot, '2026-10-20')).toBe(false);
  });

  it('aplana el calendario y arma la semana', () => {
    const slots = slotsOf([
      {
        vehicle: { id: 'a' },
        agreements: [{ start: at('2026-10-25', '09:00'), end: at('2026-10-25', '18:00') }],
      },
    ]);
    const week = weekOccupancy(slots, today);

    expect(week).toHaveLength(7);
    expect(week[6]).toEqual({ date: '2026-10-25', label: 'Dom 25', occupied: 1 });
    expect(week[0]?.occupied).toBe(0);
  });

  it('la barra no pasa de llena y queda en cero sin carros', () => {
    expect(occupancyRatio(1, 4)).toBe(0.25);
    expect(occupancyRatio(5, 2)).toBe(1);
    expect(occupancyRatio(3, 0)).toBe(0);
    expect(occupancyRatio(0, 4)).toBe(0);
  });
});

describe('home lists (125)', () => {
  it('junta salidas y regresos de hoy, por hora, y deja afuera el resto', () => {
    const moves = homeMoves({
      departures: [
        departure('sale-tarde', at('2026-10-19', '15:00')),
        departure('sale-mismo', at('2026-10-19', '09:00')),
      ],
      out: [
        out('vuelve', at('2026-10-19', '18:00'), 'TODAY'),
        out('mismo', at('2026-10-19', '09:00'), 'TODAY'),
        out('luego', at('2026-10-21', '09:00'), 'UPCOMING'),
        out('tarde', at('2026-10-18', '09:00'), 'OVERDUE', '7777'),
      ],
    });

    expect(moves.map((move) => `${move.kind}:${move.agreementId}`)).toEqual([
      'deliver:sale-mismo',
      'receive:mismo',
      'deliver:sale-tarde',
      'receive:vuelve',
    ]);
  });

  it('deja en pendientes solo los atrasos, del más antiguo al más nuevo', () => {
    const rows = overduePending([
      out('hoy', at('2026-10-19', '18:00'), 'TODAY', '1111'),
      out('ayer', at('2026-10-18', '11:00'), 'OVERDUE', '2222'),
      out('antes', at('2026-10-17', '11:00'), 'OVERDUE', ''),
      out('luego', at('2026-10-21', '11:00'), 'UPCOMING'),
    ]);

    expect(rows.map((row) => row.agreementId)).toEqual(['antes', 'ayer']);
    expect(rows[0]?.customerPhone).toBe('');
    expect(rows[1]?.customerPhone).toBe('2222');
  });

  it('arma una fila por carro con avisos vencidos y conserva el orden', () => {
    const rows = dueAlertPending([
      {
        id: 'libre',
        plate: 'P1',
        make: 'Kia',
        model: 'Rio',
        year: 2022,
        alerts: [alert('WARN', 'Servicio en 300 km')],
      },
      {
        id: 'taller',
        plate: null,
        make: 'Mazda',
        model: 'BT-50',
        year: 2024,
        alerts: [alert('DUE', 'Cambio de frenos vencido'), alert('DUE', 'Seguro vencido')],
      },
      {
        id: 'papel',
        plate: 'P2',
        make: 'Nissan',
        model: 'Sentra',
        year: null,
        alerts: [alert('WARN', 'Seguro vence en 4 días'), alert('DUE', 'Tarjeta vencida')],
      },
    ]);

    expect(rows).toEqual([
      {
        vehicleId: 'taller',
        plate: '',
        vehicleName: 'Mazda BT-50 2024',
        texts: ['Cambio de frenos vencido', 'Seguro vencido'],
      },
      {
        vehicleId: 'papel',
        plate: 'P2',
        vehicleName: 'Nissan Sentra',
        texts: ['Tarjeta vencida'],
      },
    ]);
  });
});
