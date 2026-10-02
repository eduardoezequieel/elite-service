import type { MaintenanceTaskStatus, VehicleMaintenanceStatus } from '@elite/shared';

import {
  createFleetExpenseFormSchema,
  emptyFleetExpenseForm,
  emptyMaintenanceLogForm,
  maintenanceLogFormSchema,
} from './forms';
import {
  documentLabel,
  intervalLabel,
  leftLabel,
  missingTasksOf,
  whatsappUrl,
} from './maintenance-view';

const VEHICLE = '00000000-0000-4000-8000-000000000001';
const TASK = '00000000-0000-4000-8000-000000000002';

function task(status: MaintenanceTaskStatus['status']): MaintenanceTaskStatus {
  return {
    task: { id: TASK, key: 'oil', name: 'Aceite', intervalKm: 5000, intervalDays: 90 },
    status,
    kmLeft: null,
    daysLeft: null,
    lastAt: null,
    lastKm: null,
    score: null,
    dueWithinDays: null,
  };
}

function vehicle(
  tasks: MaintenanceTaskStatus[],
  documents: VehicleMaintenanceStatus['documents'] = [],
): VehicleMaintenanceStatus {
  return {
    vehicle: {
      id: VEHICLE,
      plate: 'P53DBC',
      make: 'Toyota',
      model: 'Yaris',
      year: 2022,
      odometerKm: 12300,
      status: 'ACTIVE',
    },
    tasks,
    documents,
    kmPerDay: 0,
  };
}

describe('maintenance-view (099)', () => {
  it('de cada carro sin dato deja solo las tareas que faltan (101)', () => {
    const [row] = missingTasksOf([vehicle([task('DUE'), task('NO_DATA')])]);

    expect(row?.tasks.map((item) => item.status)).toEqual(['NO_DATA']);
  });

  it('rotula lo que falta, lo que se pasó y el intervalo', () => {
    expect(leftLabel({ kmLeft: 4700, daysLeft: 80 })).toBe('Faltan 4700 km · faltan 80 días');
    expect(leftLabel({ kmLeft: -300, daysLeft: null })).toBe('Se pasó por 300 km');
    expect(leftLabel({ kmLeft: null, daysLeft: null })).toBe('Sin último servicio');
    expect(intervalLabel({ intervalKm: 5000, intervalDays: 90 })).toBe('Cada 5000 km o 90 días');
    expect(intervalLabel({ intervalKm: null, intervalDays: 1 })).toBe('Cada 1 día');
    expect(documentLabel(-3)).toBe('Venció hace 3 días');
    expect(documentLabel(0)).toBe('Vence hoy');
  });

  it('arma el enlace de wa.me con el texto codificado', () => {
    expect(whatsappUrl('*Hola* taller\nAceite')).toBe(
      'https://wa.me/?text=*Hola*%20taller%0AAceite',
    );
  });
});

describe('formularios de mantenimiento y gastos (099)', () => {
  it('el servicio sale con fecha civil, km y costo del contrato', () => {
    const parsed = maintenanceLogFormSchema.safeParse({
      ...emptyMaintenanceLogForm(VEHICLE, [TASK], '2026-10-01'),
      odometerKm: '12500',
      cost: '45,5',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      vehicleId: VEHICLE,
      taskIds: [TASK],
      performedAt: '2026-10-01',
      odometerKm: 12500,
      cost: '45.50',
      shop: 'Elite Service',
    });
  });

  it('sin tareas o con la fecha mal escrita no pasa', () => {
    const noTasks = maintenanceLogFormSchema.safeParse(
      emptyMaintenanceLogForm(VEHICLE, [], '2026-10-01'),
    );
    const badDate = maintenanceLogFormSchema.safeParse({
      ...emptyMaintenanceLogForm(VEHICLE, [TASK], '2026-10-01'),
      performedAt: '31/02/2026',
    });

    expect(noTasks.success).toBe(false);
    expect(badDate.success).toBe(false);
  });

  it('el gasto pide carro y un monto mayor que cero', () => {
    const empty = createFleetExpenseFormSchema.safeParse(emptyFleetExpenseForm('', '2026-10-01'));
    const ok = createFleetExpenseFormSchema.safeParse({
      ...emptyFleetExpenseForm(VEHICLE, '2026-10-01'),
      type: 'FUEL',
      amount: '30',
    });

    expect(empty.success).toBe(false);
    expect(ok.success && ok.data).toMatchObject({ amount: '30.00', incurredAt: '2026-10-01' });
  });
});
