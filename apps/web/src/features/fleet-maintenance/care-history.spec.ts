import type { FleetExpenseRow, MaintenanceLog } from '@elite/shared';

import { expenseTitle, historyHasMore, mergeHistory, monthRange } from './care-history';

function log(id: string, performedAt: string, cost: string | null = null): MaintenanceLog {
  return {
    id,
    vehicleId: 'v1',
    taskId: 't1',
    taskName: 'Cambio de aceite',
    performedAt,
    odometerKm: 87000,
    cost,
    shop: null,
    notes: null,
    expenseId: cost === null ? null : `e-${id}`,
    createdAt: `${performedAt}T10:00:00Z`,
  };
}

function expense(overrides: Partial<FleetExpenseRow>): FleetExpenseRow {
  return {
    id: 'e1',
    source: 'MANUAL',
    vehicle: { id: 'v1', plate: 'P123', make: 'Honda', model: 'Fit', year: 2007 },
    type: 'FUEL',
    amount: '20.00',
    incurredAt: '2026-10-10',
    odometerKm: null,
    description: null,
    maintenanceLogId: null,
    reference: null,
    editable: true,
    ...overrides,
  };
}

describe('care-history (122)', () => {
  it('junta servicios y gastos del más nuevo al más viejo sin repetir el servicio', () => {
    const rows = mergeHistory(
      [log('l1', '2026-10-05', '35.00'), log('l2', '2026-10-12')],
      [
        expense({
          id: 'e-l1',
          type: 'MAINTENANCE',
          amount: '35.00',
          incurredAt: '2026-10-05',
          maintenanceLogId: 'l1',
          editable: false,
        }),
        expense({ id: 'e2', incurredAt: '2026-10-08' }),
        expense({
          id: 'w1',
          source: 'CARWASH',
          type: 'WASH',
          incurredAt: '2026-10-15',
          editable: false,
        }),
      ],
    );

    expect(rows.map((row) => row.key)).toEqual([
      'CARWASH:w1',
      'service:l2',
      'MANUAL:e2',
      'service:l1',
    ]);
    expect(rows[0]).toMatchObject({ kind: 'expense', automatic: true, title: 'Lavado' });
    expect(rows[3]).toMatchObject({ kind: 'service', amount: '35.00', logId: 'l1' });
  });

  it('el gasto de un servicio que no se cargó sale como ese servicio', () => {
    const rows = mergeHistory(
      [],
      [
        expense({
          id: 'e9',
          type: 'MAINTENANCE',
          description: 'Frenos',
          maintenanceLogId: 'l9',
          editable: false,
        }),
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({ kind: 'service', key: 'service:l9', logId: 'l9', title: 'Frenos' }),
    ]);
  });

  it('con el rango del mes deja afuera los servicios de otro mes', () => {
    const range = monthRange('2026-10-19');

    expect(range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02-03')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(
      mergeHistory([log('l1', '2026-09-30'), log('l2', '2026-10-01')], [], range),
    ).toHaveLength(1);
  });

  it('«Cargar más» solo si queda algo que pueda caer en el filtro', () => {
    const range = monthRange('2026-10-19');
    const logs = [log('l1', '2026-10-02')];

    expect(historyHasMore({ logs, logsHasMore: false, expensesHasMore: true, range })).toBe(true);
    expect(historyHasMore({ logs, logsHasMore: true, expensesHasMore: false, range })).toBe(true);
    expect(
      historyHasMore({
        logs: [log('l0', '2026-09-28')],
        logsHasMore: true,
        expensesHasMore: false,
        range,
      }),
    ).toBe(false);
    expect(
      historyHasMore({
        logs: [log('l0', '2026-09-28')],
        logsHasMore: true,
        expensesHasMore: false,
        range: null,
      }),
    ).toBe(true);
    expect(historyHasMore({ logs, logsHasMore: false, expensesHasMore: false, range })).toBe(false);
  });

  it('nombra el gasto por lo escrito o por su tipo', () => {
    expect(expenseTitle({ description: '  ', type: 'INSURANCE' })).toBe('Seguro');
    expect(expenseTitle({ description: 'Tarjeta de circulación', type: 'OTHER' })).toBe(
      'Tarjeta de circulación',
    );
  });
});
