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

describe('RentalReportsUseCases (100)', () => {
  it('dashboard: estados del tablero y saldos con el ingreso de agreementTotals', async () => {
    const { store, useCases } = setup();
    store.vehicleRows.push(
      reportVehicle({ id: 'free' }),
      reportVehicle({ id: 'out' }),
      reportVehicle({ id: 'shop', status: 'IN_SHOP' }),
    );
    store.agreementRows.push(
      reportAgreement({
        id: 'a-out',
        vehicleId: 'out',
        status: 'IN_PROGRESS',
        plannedPickupAt: '2026-10-19T16:00:00.000Z',
        actualPickupAt: '2026-10-19T16:00:00.000Z',
        plannedReturnAt: '2026-10-22T16:00:00.000Z',
        actualReturnAt: null,
      }),
      // Total 100, pagó 60: debe 40.
      reportAgreement({
        id: 'a-owed',
        vehicleId: 'free',
        totals: {
          ...reportAgreement({ id: 'x', vehicleId: 'free' }).totals,
          payments: [{ amount: '60.00' }],
        },
      }),
    );

    const dashboard = await useCases.dashboard();

    expect(dashboard.fleet.map((tile) => [tile.vehicle.id, tile.state])).toEqual([
      ['free', 'FREE'],
      ['out', 'OUT'],
      ['shop', 'IN_SHOP'],
    ]);
    expect(dashboard.pending.balances).toEqual([
      expect.objectContaining({ agreementId: 'a-owed', balance: '40.00' }),
    ]);
    // Las dos rentas (100 cada una) caen enteras en octubre.
    expect(dashboard.month.income).toBe('200.00');
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
