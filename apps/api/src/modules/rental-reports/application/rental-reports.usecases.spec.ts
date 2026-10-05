import { NotFoundError } from '../../../common/errors/application-error';
import { RentalReportsUseCases } from './rental-reports.usecases';
import {
  InMemoryRentalReports,
  reportAgreement,
  reportVehicle,
} from './testing/in-memory-rental-reports';

/** 20 de octubre de 2026, 12:00 en El Salvador. */
const NOW = new Date('2026-10-20T18:00:00Z');
const PAGE = { page: 1, pageSize: 50 };

function setup() {
  const store = new InMemoryRentalReports();
  const useCases = new RentalReportsUseCases(store, store, store, () => NOW);

  return { store, useCases };
}

describe('RentalReportsUseCases (100, 107)', () => {
  it('today: sale de hoy, atraso de ayer una sola vez, y lo cobrado hoy', async () => {
    const { store, useCases } = setup();
    store.vehicleRows.push(
      reportVehicle({ id: 'out', plate: 'P-OUT' }),
      reportVehicle({ id: 'late', plate: 'P-LATE' }),
      reportVehicle({ id: 'booked', plate: 'P-BOOK' }),
      reportVehicle({ id: 'missed', plate: 'P-MISS' }),
      reportVehicle({ id: 'shop', plate: 'P-SHOP', status: 'IN_SHOP' }),
      reportVehicle({ id: 'gone', plate: 'P-GONE', status: 'RETIRED' }),
    );
    store.todayRows.push(
      {
        id: 'departs',
        contractNumber: 12,
        vehicleId: 'booked',
        status: 'RESERVED',
        customerName: 'Ana Pérez',
        customerPhone: '7000-0000',
        plannedPickupAt: '2026-10-20T21:00:00.000Z',
        plannedReturnAt: '2026-10-22T21:00:00.000Z',
      },
      {
        id: 'returns-today',
        contractNumber: 8,
        vehicleId: 'out',
        status: 'IN_PROGRESS',
        customerName: 'Luis Gómez',
        customerPhone: '7111-1111',
        plannedPickupAt: '2026-10-18T16:00:00.000Z',
        plannedReturnAt: '2026-10-20T22:00:00.000Z',
      },
      {
        id: 'late-yesterday',
        contractNumber: 4,
        vehicleId: 'late',
        status: 'IN_PROGRESS',
        customerName: 'Marta Ruiz',
        customerPhone: '7222-2222',
        plannedPickupAt: '2026-10-10T16:00:00.000Z',
        plannedReturnAt: '2026-10-19T16:00:00.000Z',
      },
      {
        id: 'missed-yesterday',
        contractNumber: 5,
        vehicleId: 'missed',
        status: 'RESERVED',
        customerName: 'Pedro Díaz',
        customerPhone: '',
        plannedPickupAt: '2026-10-19T16:00:00.000Z',
        plannedReturnAt: '2026-10-21T16:00:00.000Z',
      },
      {
        id: 'retired-open',
        contractNumber: 1,
        vehicleId: 'gone',
        status: 'IN_PROGRESS',
        customerName: 'Nadie',
        customerPhone: '',
        plannedPickupAt: '2026-10-01T16:00:00.000Z',
        plannedReturnAt: '2026-10-02T16:00:00.000Z',
      },
    );
    store.paymentRows.push(
      { amount: '30.00', method: 'CASH', paidAt: '2026-10-20T18:30:00.000Z', voidedAt: null },
      { amount: '20.00', method: 'CARD', paidAt: '2026-10-20T19:00:00.000Z', voidedAt: '2026-10-20T20:00:00.000Z' },
      { amount: '10.00', method: 'CASH', paidAt: '2026-10-19T18:00:00.000Z', voidedAt: null },
    );

    const today = await useCases.today();

    expect(today.date).toBe('2026-10-20');
    expect(today.departures.map((row) => row.agreementId)).toEqual(['departs']);
    expect(today.returns.map((row) => row.agreementId)).toEqual(['returns-today']);
    expect(today.overdue.map((row) => row.agreementId)).toEqual([
      'late-yesterday',
      'missed-yesterday',
    ]);
    expect(today.overdue.map((row) => row.at)).toEqual([
      '2026-10-19T16:00:00.000Z',
      '2026-10-19T16:00:00.000Z',
    ]);
    expect(today.returns.some((row) => row.agreementId === 'late-yesterday')).toBe(false);
    expect(today.collected).toEqual({
      total: '30.00',
      byMethod: { CASH: '30.00', CARD: '0.00', TRANSFER: '0.00', OTHER: '0.00' },
    });
    expect(today.fleet.map((vehicle) => [vehicle.vehicleId, vehicle.availability])).toEqual([
      ['late', 'OVERDUE'],
      ['missed', 'OVERDUE'],
      ['booked', 'RESERVED'],
      ['out', 'RENTED'],
      ['shop', 'WORKSHOP'],
    ]);
    expect(today.fleet.find((vehicle) => vehicle.vehicleId === 'booked')?.agreementId).toBe(
      'departs',
    );
  });

  it('profitability: prorratea entre meses, resta gastos y aplica el IVA de ajustes', async () => {
    const { store, useCases } = setup();
    store.settings = { ...store.settings, vatRate: '13.00' };
    store.vehicleRows.push(reportVehicle({ id: 'v1' }));
    // Del 28 sep 10:00 al 3 oct 10:00 (SV): 58 h de 120 caen en octubre. Total 339 con IVA.
    store.agreementRows.push(
      reportAgreement({
        id: 'a1',
        vehicleId: 'v1',
        plannedPickupAt: '2026-09-28T16:00:00.000Z',
        actualPickupAt: '2026-09-28T16:00:00.000Z',
        plannedReturnAt: '2026-10-03T16:00:00.000Z',
        actualReturnAt: '2026-10-03T16:00:00.000Z',
        includesVat: true,
        totals: {
          ...reportAgreement({ id: 'x', vehicleId: 'v1' }).totals,
          dailyRate: '67.80',
          billableDays: 5,
        },
      }),
    );
    store.expenseRows.push({ vehicleId: 'v1', incurredAt: '2026-10-05', amount: '20.00' });

    const report = await useCases.profitability({
      from: '2026-10-01',
      to: '2026-10-31',
      ...PAGE,
    });

    expect(report.rows.items).toHaveLength(1);
    expect(report.rows.items[0]).toMatchObject({
      income: '145.00',
      expenses: '20.00',
      net: '125.00',
    });
    expect(report.totals.net).toBe('125.00');
    expect(report.rows.items[0]?.lifetime.recovered).toBeNull();
  });

  it('profitability pagina los carros y los totales siguen siendo de toda la flota (101)', async () => {
    const { store, useCases } = setup();
    store.vehicleRows.push(reportVehicle({ id: 'v1' }), reportVehicle({ id: 'v2' }));
    store.expenseRows.push({ vehicleId: 'v2', incurredAt: '2026-10-05', amount: '20.00' });

    const second = await useCases.profitability({
      from: '2026-10-01',
      to: '2026-10-31',
      page: 2,
      pageSize: 1,
    });

    expect(second.rows).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(second.rows.items.map((row) => row.vehicle.id)).toEqual(['v2']);
    expect(second.totals.expenses).toBe('20.00');
  });

  it('months: 12 filas del año pedido', async () => {
    const { store, useCases } = setup();
    store.vehicleRows.push(reportVehicle({ id: 'v1' }));
    store.agreementRows.push(reportAgreement({ id: 'a1', vehicleId: 'v1' }));

    const months = await useCases.months('v1', { year: 2026 });

    expect(months.rows).toHaveLength(12);
    expect(months.rows[9]).toMatchObject({ month: '2026-10', income: '100.00' });
    expect((await useCases.months('v1', {})).year).toBe(2026);
  });

  it('months: 404 si el carro no existe', async () => {
    const { useCases } = setup();

    await expect(useCases.months('nope', {})).rejects.toBeInstanceOf(NotFoundError);
  });
});
