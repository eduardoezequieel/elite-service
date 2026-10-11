import type { FleetVehicleActivity } from '@elite/shared';

import { fleetActivityLine } from './fleet-activity';

// Martes 6 de octubre de 2026, 12:00 en El Salvador (UTC−6).
const NOW = new Date('2026-10-06T18:00:00.000Z');

function line(activity: FleetVehicleActivity | null, availability: 'FREE' | 'RENTED' = 'RENTED') {
  return fleetActivityLine({ availability, activity }, NOW);
}

const returning = (at: string, customerName: string | null = 'Ana Flores') =>
  ({ kind: 'RETURN', at, customerName }) as const;
const leaving = (at: string) => ({ kind: 'PICKUP', at, customerName: null }) as const;

describe('fleetActivityLine (115, RN-4)', () => {
  it('una devolución futura dice cuándo vuelve y con quién', () => {
    expect(line(returning('2026-10-06T23:00:00.000Z'))).toEqual({
      lead: 'Vuelve',
      when: 'hoy 5:00 p.m.',
      customer: 'Ana Flores',
    });
    expect(line(returning('2026-10-07T14:00:00.000Z'))?.when).toBe('mañana 8:00 a.m.');
    expect(line(returning('2026-10-08T18:00:00.000Z'))?.when).toBe('el jueves');
    expect(line(returning('2026-10-24T18:00:00.000Z'))?.when).toBe('el 24 oct');
  });

  it('una devolución vencida dice hace cuánto', () => {
    expect(line(returning('2026-10-04T18:00:00.000Z'))).toMatchObject({
      lead: 'Debió volver',
      when: 'hace 2 días',
    });
    expect(line(returning('2026-10-05T18:00:00.000Z'))?.when).toBe('ayer');
    expect(line(returning('2026-10-06T15:00:00.000Z'))?.when).toBe('hoy a las 9:00 a.m.');
  });

  it('una salida dice Sale o Debió salir; sin permiso no hay cliente', () => {
    expect(line(leaving('2026-10-07T14:00:00.000Z'))).toEqual({
      lead: 'Sale',
      when: 'mañana 8:00 a.m.',
      customer: null,
    });
    expect(line(leaving('2026-10-05T14:00:00.000Z'))?.lead).toBe('Debió salir');
  });

  it('sin actividad: libre o en taller, y nada para los demás', () => {
    expect(line(null, 'FREE')).toEqual({ lead: 'Listo para rentar', when: null, customer: null });
    expect(fleetActivityLine({ availability: 'WORKSHOP', activity: null }, NOW)?.lead).toBe(
      'En taller',
    );
    expect(fleetActivityLine({ availability: null, activity: null }, NOW)).toBeNull();
  });
});
