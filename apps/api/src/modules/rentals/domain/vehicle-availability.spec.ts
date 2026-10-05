import { vehicleAvailability } from './vehicle-availability';
import type { DayAgreement } from './vehicle-availability';

/** 20 de octubre de 2026, 12:00 en El Salvador. */
const NOW = new Date('2026-10-20T18:00:00.000Z');

function agreement(overrides: Partial<DayAgreement> & Pick<DayAgreement, 'id' | 'status'>): DayAgreement {
  return {
    plannedPickupAt: '2026-10-20T21:00:00.000Z',
    plannedReturnAt: '2026-10-22T21:00:00.000Z',
    ...overrides,
  };
}

describe('vehicleAvailability (107 RN-2)', () => {
  it('un retirado no tiene estado de día', () => {
    expect(vehicleAvailability({ status: 'RETIRED' }, [], NOW)).toBeNull();
  });

  it('el taller gana sobre cualquier renta', () => {
    expect(
      vehicleAvailability(
        { status: 'IN_SHOP' },
        [agreement({ id: 'out', status: 'IN_PROGRESS' })],
        NOW,
      ),
    ).toEqual({ availability: 'WORKSHOP', agreementId: null });
  });

  it('en curso con el regreso ya pasado es atrasado, aunque el día sea hoy', () => {
    expect(
      vehicleAvailability(
        { status: 'ACTIVE' },
        [
          agreement({
            id: 'late-today',
            status: 'IN_PROGRESS',
            plannedReturnAt: '2026-10-20T15:00:00.000Z',
          }),
        ],
        NOW,
      ),
    ).toEqual({ availability: 'OVERDUE', agreementId: 'late-today' });
  });

  it('en curso a tiempo es en renta', () => {
    expect(
      vehicleAvailability(
        { status: 'ACTIVE' },
        [agreement({ id: 'out', status: 'IN_PROGRESS', plannedReturnAt: '2026-10-21T16:00:00.000Z' })],
        NOW,
      ),
    ).toEqual({ availability: 'RENTED', agreementId: 'out' });
  });

  it('una reserva que sale hoy es reservado; una de mañana deja el carro libre', () => {
    expect(
      vehicleAvailability(
        { status: 'ACTIVE' },
        [agreement({ id: 'today', status: 'RESERVED' })],
        NOW,
      ),
    ).toEqual({ availability: 'RESERVED', agreementId: 'today' });

    expect(
      vehicleAvailability(
        { status: 'ACTIVE' },
        [
          agreement({
            id: 'tomorrow',
            status: 'RESERVED',
            plannedPickupAt: '2026-10-21T15:00:00.000Z',
          }),
        ],
        NOW,
      ),
    ).toEqual({ availability: 'FREE', agreementId: null });
  });

  it('una reserva que no se retiró no está libre', () => {
    expect(
      vehicleAvailability(
        { status: 'ACTIVE' },
        [
          agreement({
            id: 'missed',
            status: 'RESERVED',
            plannedPickupAt: '2026-10-19T16:00:00.000Z',
          }),
        ],
        NOW,
      ),
    ).toEqual({ availability: 'OVERDUE', agreementId: 'missed' });
  });
});
