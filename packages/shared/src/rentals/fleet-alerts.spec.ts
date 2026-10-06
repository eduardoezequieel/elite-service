import { fleetAlerts, formatKm, pendingServiceLine } from './fleet-alerts';
import type { MaintenanceTaskStatus, VehicleDocumentStatus } from './maintenance';

const TODAY = '2026-10-06';

function task(
  status: MaintenanceTaskStatus['status'],
  extra: Partial<MaintenanceTaskStatus> = {},
): MaintenanceTaskStatus {
  return {
    task: {
      id: '00000000-0000-4000-8000-000000000001',
      key: 'oil',
      name: 'aceite',
      intervalKm: 5000,
      intervalDays: null,
    },
    status,
    kmLeft: -1200,
    daysLeft: null,
    lastAt: '2026-08-01',
    lastKm: 45000,
    score: -0.2,
    dueWithinDays: null,
    line: null,
    ...extra,
  };
}

describe('fleet alerts (110)', () => {
  it('formatea el km con punto de miles', () => {
    expect(formatKm(50000)).toBe('50.000');
    expect(formatKm(51200)).toBe('51.200');
  });

  it('el aviso de un servicio vencido y uno próximo dicen el km que tocaba', () => {
    const due = task('DUE', { kmLeft: -1200 });
    const soon = task('SOON', { kmLeft: 400, status: 'SOON' });

    expect(fleetAlerts({ tasks: [due], documents: [], odometerKm: 51200, today: TODAY })).toEqual([
      {
        kind: 'SERVICE',
        level: 'DUE',
        text: 'Se pasó: aceite iba a los 50.000 y va en 51.200',
      },
    ]);
    expect(
      fleetAlerts({ tasks: [soon], documents: [], odometerKm: 49600, today: TODAY })[0],
    ).toEqual({
      kind: 'SERVICE',
      level: 'WARN',
      text: 'Le toca aceite a los 50.000 km',
    });
  });

  it('un seguro que vence pronto es un aviso de documento', () => {
    const document: VehicleDocumentStatus = {
      kind: 'INSURANCE',
      expiresAt: '2026-10-18',
      daysLeft: 12,
      status: 'SOON',
    };

    expect(fleetAlerts({ tasks: [], documents: [document], odometerKm: 0, today: TODAY })).toEqual([
      { kind: 'DOCUMENT', level: 'WARN', text: 'Seguro vence en 12 días' },
    ]);
  });

  it('la línea de la ficha no repite el nombre de la tarea', () => {
    expect(pendingServiceLine(task('DUE', { kmLeft: -1200 }), 51200, TODAY)).toBe(
      'Le toca a los 50.000 km',
    );
    expect(
      pendingServiceLine(
        task('SOON', {
          kmLeft: null,
          daysLeft: 6,
          task: {
            id: '00000000-0000-4000-8000-000000000002',
            key: 'general',
            name: 'Revisión',
            intervalKm: null,
            intervalDays: 30,
          },
        }),
        1000,
        TODAY,
      ),
    ).toBe('Le toca el 12 oct');
    expect(pendingServiceLine(task('OK', { kmLeft: 4000 }), 1000, TODAY)).toBeNull();
  });
});
