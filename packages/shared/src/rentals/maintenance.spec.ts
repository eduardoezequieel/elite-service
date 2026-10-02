import {
  civilDaysBetween,
  createFleetExpenseSchema,
  createMaintenanceLogSchema,
  createPlanTaskSchema,
  documentStatus,
  inMaintenanceView,
  maintenanceSummary,
  taskStatus,
} from './maintenance';
import type { MaintenanceTaskStatus } from './maintenance';

const OIL = { intervalKm: 5000, intervalDays: 90 };
const GENERAL = { intervalKm: null, intervalDays: 30 };
const TIRES = { intervalKm: 10000, intervalDays: null };
const ALERTS = { kmAlert: 500, daysAlert: 7 };
const TODAY = '2026-10-01';

describe('civilDaysBetween', () => {
  it('cuenta días civiles, también hacia atrás y cruzando meses', () => {
    expect(civilDaysBetween('2026-09-21', TODAY)).toBe(10);
    expect(civilDaysBetween(TODAY, '2026-09-30')).toBe(-1);
    expect(civilDaysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });
});

describe('taskStatus (099 RN-1)', () => {
  it('DUE por km: 5.300 km desde el aceite de los 7.000 km, aunque falten días', () => {
    const result = taskStatus({
      task: OIL,
      last: { performedAt: '2026-08-22', odometerKm: 7000 },
      odometerKm: 12300,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result).toMatchObject({ status: 'DUE', kmLeft: -300, daysLeft: 50 });
  });

  it('OK con kmLeft 4.700 y daysLeft 80 tras un aceite a los 12.000 km hace 10 días', () => {
    const result = taskStatus({
      task: OIL,
      last: { performedAt: '2026-09-21', odometerKm: 12000 },
      odometerKm: 12300,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result).toMatchObject({ status: 'OK', kmLeft: 4700, daysLeft: 80 });
    expect(result.score).toBeCloseTo(80 / 90);
  });

  it('DUE por días: la revisión general de hace 30 días', () => {
    const result = taskStatus({
      task: GENERAL,
      last: { performedAt: '2026-09-01', odometerKm: null },
      odometerKm: 0,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result).toMatchObject({ status: 'DUE', kmLeft: null, daysLeft: 0, score: 0 });
  });

  it('SOON cuando faltan los días del aviso o menos', () => {
    const result = taskStatus({
      task: GENERAL,
      last: { performedAt: '2026-09-08', odometerKm: null },
      odometerKm: 0,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result).toMatchObject({ status: 'SOON', daysLeft: 7 });
  });

  it('SOON cuando faltan los km del aviso o menos', () => {
    const result = taskStatus({
      task: TIRES,
      last: { performedAt: '2026-01-01', odometerKm: 2000 },
      odometerKm: 11500,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result).toMatchObject({ status: 'SOON', kmLeft: 500, daysLeft: null, score: 0.05 });
  });

  it('NO_DATA sin servicio registrado', () => {
    expect(
      taskStatus({ task: GENERAL, last: null, odometerKm: 0, today: TODAY, alerts: ALERTS }),
    ).toEqual({ status: 'NO_DATA', kmLeft: null, daysLeft: null, score: null });
  });

  it('NO_DATA si la tarea mide solo km y el último servicio no anotó km', () => {
    const result = taskStatus({
      task: TIRES,
      last: { performedAt: '2026-09-01', odometerKm: null },
      odometerKm: 9000,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result.status).toBe('NO_DATA');
  });

  it('score es el menor de los dos normalizados', () => {
    const result = taskStatus({
      task: OIL,
      last: { performedAt: '2026-09-30', odometerKm: 10000 },
      odometerKm: 12500,
      today: TODAY,
      alerts: ALERTS,
    });

    expect(result.score).toBeCloseTo(0.5);
  });
});

describe('documentStatus (099 RN-6)', () => {
  it('SOON si faltan los días del aviso o menos, DUE si ya pasó, nada si falta', () => {
    expect(documentStatus('2026-10-06', TODAY, 7)).toEqual({ status: 'SOON', daysLeft: 5 });
    expect(documentStatus('2026-10-01', TODAY, 7)).toEqual({ status: 'SOON', daysLeft: 0 });
    expect(documentStatus('2026-09-30', TODAY, 7)).toEqual({ status: 'DUE', daysLeft: -1 });
    expect(documentStatus('2026-12-01', TODAY, 7)).toBeNull();
    expect(documentStatus(null, TODAY, 7)).toBeNull();
  });
});

describe('schemas de mantenimiento', () => {
  const VEHICLE = '00000000-0000-4000-8000-000000000001';
  const TASK = '00000000-0000-4000-8000-000000000002';

  it('una tarea necesita km o días', () => {
    expect(createPlanTaskSchema.safeParse({ name: 'Lavado de motor' }).success).toBe(false);
    expect(
      createPlanTaskSchema.safeParse({ name: 'Lavado de motor', intervalDays: 60 }).success,
    ).toBe(true);
  });

  it('el servicio acepta taskId suelto y sale como taskIds', () => {
    const parsed = createMaintenanceLogSchema.parse({
      vehicleId: VEHICLE,
      taskId: TASK,
      performedAt: TODAY,
      cost: 45,
    });

    expect(parsed).toMatchObject({ taskIds: [TASK], cost: '45.00' });
  });

  it('el servicio sin tareas no pasa', () => {
    const parsed = createMaintenanceLogSchema.safeParse({
      vehicleId: VEHICLE,
      taskIds: [],
      performedAt: TODAY,
    });

    expect(parsed.success).toBe(false);
  });

  it('un gasto en cero no pasa', () => {
    const base = { vehicleId: VEHICLE, type: 'FUEL', incurredAt: TODAY };

    expect(createFleetExpenseSchema.safeParse({ ...base, amount: '0' }).success).toBe(false);
    expect(createFleetExpenseSchema.parse({ ...base, amount: '20' }).amount).toBe('20.00');
  });
});

describe('vistas y cifras del estado (099, 101)', () => {
  const task = (status: MaintenanceTaskStatus['status']) => ({ status }) as MaintenanceTaskStatus;
  const statuses = [
    { tasks: [task('DUE'), task('SOON'), task('NO_DATA')], documents: [] },
    {
      tasks: [task('OK')],
      documents: [
        {
          kind: 'INSURANCE' as const,
          expiresAt: '2026-10-06',
          daysLeft: 5,
          status: 'SOON' as const,
        },
      ],
    },
    { tasks: [task('OK')], documents: [] },
  ];

  it('cuenta vencidas, próximas, carros sin dato y documentos', () => {
    expect(maintenanceSummary(statuses)).toEqual({ due: 1, soon: 1, noData: 1, documents: 1 });
  });

  it('pendientes, sin dato y sin vista', () => {
    expect(statuses.filter((status) => inMaintenanceView(status, 'pending'))).toHaveLength(2);
    expect(statuses.filter((status) => inMaintenanceView(status, 'no_data'))).toHaveLength(1);
    expect(statuses.filter((status) => inMaintenanceView(status, undefined))).toHaveLength(3);
  });
});
