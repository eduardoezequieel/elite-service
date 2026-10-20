import type { FleetAlert, VehicleAvailability } from '@elite/shared';

import { availabilityCounts, sortByAvailability, workshopCount } from './fleet-list';

const car = (id: string, availability: VehicleAvailability | null) => ({ id, availability });
const alert = (kind: FleetAlert['kind']): FleetAlert => ({ kind, text: kind, level: 'WARN' });

describe('fleet list (121)', () => {
  it('ordena lo urgente primero y respeta el orden dentro de cada estado', () => {
    const sorted = sortByAvailability([
      car('a', 'FREE'),
      car('b', 'OVERDUE'),
      car('c', 'WORKSHOP'),
      car('d', 'FREE'),
      car('e', 'RENTED'),
      car('f', null),
      car('g', 'RESERVED'),
    ]);

    expect(sorted.map((vehicle) => vehicle.id)).toEqual(['b', 'e', 'g', 'a', 'd', 'c', 'f']);
  });

  it('cuenta solo los estados con carros, en orden', () => {
    expect(
      availabilityCounts([
        car('a', 'FREE'),
        car('b', 'WORKSHOP'),
        car('c', 'FREE'),
        car('d', null),
      ]),
    ).toEqual([
      { availability: 'FREE', count: 2 },
      { availability: 'WORKSHOP', count: 1 },
    ]);
  });

  it('cuenta los carros con al menos un aviso de servicio', () => {
    expect(
      workshopCount([
        { alerts: [alert('SERVICE'), alert('SERVICE')] },
        { alerts: [alert('DOCUMENT')] },
        { alerts: [alert('DOCUMENT'), alert('SERVICE')] },
        { alerts: [] },
      ]),
    ).toBe(2);
  });
});
