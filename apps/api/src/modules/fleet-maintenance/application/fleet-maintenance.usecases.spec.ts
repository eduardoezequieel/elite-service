import {
  API_ERROR_CODES,
  createMaintenanceLogSchema,
  createPlanTaskSchema,
  fleetExpensesQuerySchema,
  maintenanceLogsQuerySchema,
  maintenanceStatusQuerySchema,
} from '@elite/shared';
import type { FleetExpenseRow } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { FleetExpenseUseCases } from './fleet-expense.usecases';
import { MaintenanceLogUseCases } from './maintenance-log.usecases';
import { MaintenancePlanUseCases } from './maintenance-plan.usecases';
import { MaintenanceStatusUseCases } from './maintenance-status.usecases';
import {
  InMemoryAutomaticExpenseSource,
  InMemoryFleetExpenseRepository,
  InMemoryFleetSnapshotSource,
  InMemoryMaintenanceLogRepository,
  InMemoryMaintenancePlanRepository,
  InMemoryMaintenanceSettings,
  nextId,
} from './testing/in-memory-fleet-maintenance';

const TODAY = '2026-10-01';
const NOW = new Date('2026-10-01T18:00:00.000Z');
const USER = '00000000-0000-4000-8000-0000000000aa';

type QueryInput = Record<string, string | number>;
const statusQuery = (input: QueryInput = {}) => maintenanceStatusQuerySchema.parse(input);
const logsQuery = (input: QueryInput = {}) => maintenanceLogsQuerySchema.parse(input);
const expenseQuery = (input: QueryInput = {}) => fleetExpensesQuerySchema.parse(input);

function daysAgo(days: number): string {
  const date = new Date(`${TODAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);

  return date.toISOString().slice(0, 10);
}

function setup() {
  const plan = new InMemoryMaintenancePlanRepository();
  const fleet = new InMemoryFleetSnapshotSource();
  const expenses = new InMemoryFleetExpenseRepository(fleet);
  const automatic = new InMemoryAutomaticExpenseSource();
  const logs = new InMemoryMaintenanceLogRepository(fleet, expenses);
  const settings = new InMemoryMaintenanceSettings();
  const today = () => TODAY;

  return {
    plan,
    fleet,
    expenses,
    automatic,
    logs,
    settings,
    planUseCases: new MaintenancePlanUseCases(plan),
    logUseCases: new MaintenanceLogUseCases(logs, plan, fleet, today),
    status: new MaintenanceStatusUseCases(fleet, plan, logs, settings, today, () => NOW),
    expenseUseCases: new FleetExpenseUseCases(expenses, automatic, fleet),
  };
}

function service(input: Record<string, unknown>) {
  return createMaintenanceLogSchema.parse(input);
}

describe('MaintenancePlanUseCases (099)', () => {
  it('lista las 8 tareas del seed', async () => {
    const { planUseCases } = setup();

    expect(await planUseCases.list()).toHaveLength(8);
  });

  it('agrega una tarea con clave armada del nombre y al final del orden', async () => {
    const { planUseCases } = setup();

    const created = await planUseCases.create(
      createPlanTaskSchema.parse({ name: 'Lavado de motor', intervalDays: 60 }),
    );

    expect(created).toMatchObject({
      key: 'lavado_de_motor',
      intervalKm: null,
      intervalDays: 60,
      sortOrder: 9,
      isActive: true,
    });
  });

  it('409 DUPLICATE_MAINTENANCE_TASK con un nombre que ya está, sin importar tildes', async () => {
    const { planUseCases } = setup();

    const error = await captureApiError(
      planUseCases.create(
        createPlanTaskSchema.parse({ name: 'revision de FRENOS', intervalKm: 1 }),
      ),
    );

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.DUPLICATE_MAINTENANCE_TASK);
  });

  it('cambia km y días, y no deja una tarea sin ninguno de los dos', async () => {
    const { plan, planUseCases } = setup();
    const oil = plan.byKey('oil');

    await expect(planUseCases.update(oil.id, { intervalKm: 6000 })).resolves.toMatchObject({
      intervalKm: 6000,
      intervalDays: 90,
    });

    const error = await captureApiError(
      planUseCases.update(oil.id, { intervalKm: null, intervalDays: null }),
    );
    expect(error.status).toBe(422);
  });

  it('renombrar a un nombre ajeno choca', async () => {
    const { plan, planUseCases } = setup();

    const error = await captureApiError(
      planUseCases.update(plan.byKey('oil').id, { name: 'Filtro de aire' }),
    );

    expect(error.body.code).toBe(API_ERROR_CODES.DUPLICATE_MAINTENANCE_TASK);
  });
});

describe('MaintenanceStatusUseCases (099 RN-1, RN-2, RN-6)', () => {
  it('aceite DUE por km y revisión general NO_DATA', async () => {
    const { fleet, plan, logs, status } = setup();
    const car = fleet.add({ odometerKm: 12300 });
    logs.rows.push({
      id: nextId(),
      vehicleId: car.id,
      taskId: plan.byKey('oil').id,
      taskName: 'Cambio de aceite y filtro',
      performedAt: daysAgo(40),
      odometerKm: 7000,
      cost: null,
      shop: null,
      notes: null,
      expenseId: null,
      createdAt: NOW.toISOString(),
    });

    const [result] = (await status.status(statusQuery())).items;
    const oil = result?.tasks.find((task) => task.task.key === 'oil');
    const general = result?.tasks.find((task) => task.task.key === 'general');

    expect(oil).toMatchObject({
      status: 'DUE',
      kmLeft: -300,
      daysLeft: 50,
      lastKm: 7000,
      line: 'Le toca a los 12.000 km',
    });
    expect(general).toMatchObject({ status: 'NO_DATA', kmLeft: null, daysLeft: null });
    expect(result?.tasks[0]?.task.key).toBe('oil');
  });

  it('con un aceite a los 12.000 km hace 10 días queda OK con 4.700 km y 80 días', async () => {
    const { fleet, plan, logUseCases, status } = setup();
    const car = fleet.add({ odometerKm: 12300 });
    await logUseCases.record(
      service({
        vehicleId: car.id,
        taskId: plan.byKey('oil').id,
        performedAt: daysAgo(10),
        odometerKm: 12000,
      }),
      USER,
    );

    const [result] = (await status.status(statusQuery({ vehicleId: car.id }))).items;

    expect(result?.tasks.find((task) => task.task.key === 'oil')).toMatchObject({
      status: 'OK',
      kmLeft: 4700,
      daysLeft: 80,
    });
  });

  it('SOON dentro del aviso de km o de días', async () => {
    const { fleet, plan, logUseCases, status, settings } = setup();
    settings.value = { ...settings.value, kmAlert: 500, daysAlert: 7 };
    const car = fleet.add({ odometerKm: 16600 });
    await logUseCases.record(
      service({
        vehicleId: car.id,
        taskIds: [plan.byKey('oil').id, plan.byKey('general').id],
        performedAt: daysAgo(25),
        odometerKm: 12000,
      }),
      USER,
    );

    const [result] = (await status.status(statusQuery({ vehicleId: car.id }))).items;

    expect(result?.tasks.find((task) => task.task.key === 'oil')).toMatchObject({
      status: 'SOON',
      kmLeft: 400,
    });
    expect(result?.tasks.find((task) => task.task.key === 'general')).toMatchObject({
      status: 'SOON',
      daysLeft: 5,
    });
  });

  it('una tarea desactivada no entra a la cuenta', async () => {
    const { fleet, plan, planUseCases, status } = setup();
    const car = fleet.add();
    await planUseCases.update(plan.byKey('coolant').id, { isActive: false });

    const [result] = (await status.status(statusQuery({ vehicleId: car.id }))).items;

    expect(result?.tasks).toHaveLength(7);
    expect(result?.tasks.some((task) => task.task.key === 'coolant')).toBe(false);
  });

  it('documentos: seguro en 5 días SOON, tarjeta vencida DUE', async () => {
    const { fleet, status } = setup();
    const car = fleet.add({
      insuranceExpiresAt: '2026-10-06',
      registrationExpiresAt: '2026-09-15',
    });

    const [result] = (await status.status(statusQuery({ vehicleId: car.id }))).items;

    expect(result?.documents).toEqual([
      { kind: 'INSURANCE', expiresAt: '2026-10-06', daysLeft: 5, status: 'SOON' },
      { kind: 'REGISTRATION', expiresAt: '2026-09-15', daysLeft: -16, status: 'DUE' },
    ]);
  });

  it('km por día de las rentas finalizadas y «le tocaría durante esta renta»', async () => {
    const { fleet, plan, logUseCases, status } = setup();
    const car = fleet.add({ odometerKm: 12000 });
    fleet.trips.push(
      {
        vehicleId: car.id,
        pickupAt: new Date('2026-09-01T10:00:00Z'),
        returnAt: new Date('2026-09-05T10:00:00Z'),
        pickupKm: 10000,
        returnKm: 10800,
      },
      {
        vehicleId: car.id,
        pickupAt: new Date('2026-09-10T10:00:00Z'),
        returnAt: new Date('2026-09-12T10:00:00Z'),
        pickupKm: 10800,
        returnKm: 11400,
      },
    );
    await logUseCases.record(
      service({
        vehicleId: car.id,
        taskId: plan.byKey('oil').id,
        performedAt: daysAgo(1),
        odometerKm: 8000,
      }),
      USER,
    );

    const [result] = (await status.status(statusQuery({ vehicleId: car.id, days: 5 }))).items;
    const oil = result?.tasks.find((task) => task.task.key === 'oil');

    // (800 / 4 + 600 / 2) / 2 = 250 km por día; quedan 1.000 km y 5 días son 1.250.
    expect(result?.kmPerDay).toBe(250);
    expect(oil).toMatchObject({ kmLeft: 1000, dueWithinDays: true });
    expect(result?.tasks.find((task) => task.task.key === 'general')?.dueWithinDays).toBe(false);
  });

  it('sin rentas, 0 km por día; sin ?days, dueWithinDays null', async () => {
    const { fleet, status } = setup();
    const car = fleet.add();

    const [result] = (await status.status(statusQuery({ vehicleId: car.id }))).items;

    expect(result?.kmPerDay).toBe(0);
    expect(result?.tasks[0]?.dueWithinDays).toBeNull();
  });

  it('la vista pagina los carros y las cifras siguen siendo de toda la flota (101)', async () => {
    const { fleet, status } = setup();
    fleet.add();
    fleet.add({ plate: 'P11AAA' });

    const noData = await status.status(statusQuery({ view: 'no_data', pageSize: 1 }));
    const pending = await status.status(statusQuery({ view: 'pending' }));

    expect(noData).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(noData.items).toHaveLength(1);
    expect(noData.summary.noData).toBe(2);
    expect(pending).toMatchObject({ total: 0, items: [] });
    expect(pending.summary.noData).toBe(2);
  });

  it('sin vehicleId deja fuera a los retirados; con vehicleId de otro, 404', async () => {
    const { fleet, status } = setup();
    fleet.add();
    fleet.add({ status: 'RETIRED', plate: 'P11AAA' });

    expect((await status.status(statusQuery())).items).toHaveLength(1);

    const error = await captureApiError(status.status(statusQuery({ vehicleId: nextId() })));
    expect(error.status).toBe(404);
  });

  it('texto de WhatsApp con los pendientes por carro', async () => {
    const { fleet, plan, logUseCases, status } = setup();
    const car = fleet.add({ odometerKm: 12300 });
    await logUseCases.record(
      service({
        vehicleId: car.id,
        taskId: plan.byKey('oil').id,
        performedAt: daysAgo(40),
        odometerKm: 7000,
      }),
      USER,
    );

    const { text } = await status.whatsappText();

    expect(text).toContain('*Mantenimiento pendiente · Riveras Rent a Car*');
    expect(text).toContain('Fecha: 01/10/2026');
    expect(text).toContain('*Toyota Yaris 2022 · P53DBC* · 12300 km');
    expect(text).toContain(
      '- Cambio de aceite y filtro: vencido (se pasó por 300 km, faltan 50 días)',
    );
    expect(text).not.toContain('Revisión general');
  });

  it('sin pendientes, el texto lo dice', async () => {
    const { status } = setup();

    expect((await status.whatsappText()).text).toContain('Sin mantenimientos pendientes.');
  });

  it('el .ics trae un evento por tarea pendiente y por documento por vencer', async () => {
    const { fleet, plan, logUseCases, status } = setup();
    const car = fleet.add({ odometerKm: 12300, insuranceExpiresAt: '2026-10-06' });
    await logUseCases.record(
      service({
        vehicleId: car.id,
        taskId: plan.byKey('oil').id,
        performedAt: daysAgo(40),
        odometerKm: 7000,
      }),
      USER,
    );

    const ics = await status.remindersCalendar();

    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261001');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261006');
    expect(ics).toContain('DTSTAMP:20261001T180000Z');
    expect(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
  });
});

describe('MaintenanceLogUseCases (099)', () => {
  it('un servicio con costo crea el gasto MAINTENANCE ligado con el mismo monto y fecha', async () => {
    const { fleet, plan, logUseCases, expenses } = setup();
    const car = fleet.add({ odometerKm: 12000 });

    const [log] = await logUseCases.record(
      service({
        vehicleId: car.id,
        taskId: plan.byKey('oil').id,
        performedAt: daysAgo(2),
        odometerKm: 12500,
        cost: '45.50',
      }),
      USER,
    );

    expect(log).toMatchObject({ cost: '45.50', taskName: 'Cambio de aceite y filtro' });
    expect(expenses.rows).toEqual([
      expect.objectContaining({
        id: log?.expenseId,
        type: 'MAINTENANCE',
        amount: '45.50',
        incurredAt: daysAgo(2),
        maintenanceLogId: log?.id,
        editable: false,
      }),
    ]);
  });

  it('sin costo no crea gasto', async () => {
    const { fleet, plan, logUseCases, expenses } = setup();
    const car = fleet.add();

    const [log] = await logUseCases.record(
      service({ vehicleId: car.id, taskId: plan.byKey('general').id, performedAt: TODAY }),
      USER,
    );

    expect(log?.expenseId).toBeNull();
    expect(expenses.rows).toHaveLength(0);
  });

  it('varias tareas: un log por tarea y el costo repartido sin perder centavos', async () => {
    const { fleet, plan, logUseCases, expenses } = setup();
    const car = fleet.add();

    const logs = await logUseCases.record(
      service({
        vehicleId: car.id,
        taskIds: [plan.byKey('oil').id, plan.byKey('air_filter').id, plan.byKey('brakes').id],
        performedAt: TODAY,
        cost: '100.00',
      }),
      USER,
    );

    expect(logs.map((log) => log.cost)).toEqual(['33.34', '33.33', '33.33']);
    expect(expenses.rows).toHaveLength(3);
  });

  it('sube el odómetro del carro si el del servicio es mayor, nunca lo baja', async () => {
    const { fleet, plan, logUseCases } = setup();
    const car = fleet.add({ odometerKm: 12000 });
    const oil = plan.byKey('oil').id;

    await logUseCases.record(
      service({ vehicleId: car.id, taskId: oil, performedAt: TODAY, odometerKm: 12800 }),
      USER,
    );
    expect(fleet.vehicles[0]?.odometerKm).toBe(12800);

    await logUseCases.record(
      service({ vehicleId: car.id, taskId: oil, performedAt: TODAY, odometerKm: 9000 }),
      USER,
    );
    expect(fleet.vehicles[0]?.odometerKm).toBe(12800);
  });

  it('422 con un carro que no existe, una tarea desactivada o una fecha futura', async () => {
    const { fleet, plan, planUseCases, logUseCases } = setup();
    const car = fleet.add();
    const coolant = plan.byKey('coolant').id;
    await planUseCases.update(coolant, { isActive: false });

    const missing = await captureApiError(
      logUseCases.record(
        service({ vehicleId: nextId(), taskId: coolant, performedAt: TODAY }),
        USER,
      ),
    );
    const inactive = await captureApiError(
      logUseCases.record(service({ vehicleId: car.id, taskId: coolant, performedAt: TODAY }), USER),
    );
    const future = await captureApiError(
      logUseCases.record(
        service({ vehicleId: car.id, taskId: plan.byKey('oil').id, performedAt: '2026-10-02' }),
        USER,
      ),
    );

    expect([missing.status, inactive.status, future.status]).toEqual([422, 422, 422]);
  });

  it('el historial filtra por carro y por tarea', async () => {
    const { fleet, plan, logUseCases } = setup();
    const car = fleet.add();
    const other = fleet.add({ plate: 'P11AAA' });
    const oil = plan.byKey('oil').id;
    await logUseCases.record(service({ vehicleId: car.id, taskId: oil, performedAt: TODAY }), USER);
    await logUseCases.record(
      service({ vehicleId: other.id, taskId: plan.byKey('general').id, performedAt: TODAY }),
      USER,
    );

    expect((await logUseCases.list(logsQuery({ vehicleId: car.id }))).items).toHaveLength(1);
    expect((await logUseCases.list(logsQuery({ taskId: oil }))).items).toHaveLength(1);
    expect((await logUseCases.list(logsQuery({}))).items).toHaveLength(2);
  });

  it('el historial pagina: lo más reciente arriba y el total del filtro (101)', async () => {
    const { fleet, plan, logUseCases } = setup();
    const car = fleet.add();
    const oil = plan.byKey('oil').id;
    await logUseCases.record(
      service({ vehicleId: car.id, taskId: oil, performedAt: daysAgo(3) }),
      USER,
    );
    await logUseCases.record(service({ vehicleId: car.id, taskId: oil, performedAt: TODAY }), USER);

    const second = await logUseCases.list(logsQuery({ vehicleId: car.id, page: 2, pageSize: 1 }));

    expect(second).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(second.items.map((log) => log.performedAt)).toEqual([daysAgo(3)]);
  });
});

describe('FleetExpenseUseCases (099 RN-3, RN-4, RN-5)', () => {
  function automaticRow(
    vehicle: FleetExpenseRow['vehicle'],
    row: Pick<FleetExpenseRow, 'source' | 'type' | 'amount' | 'incurredAt'>,
  ): FleetExpenseRow {
    return {
      id: nextId(),
      vehicle,
      odometerKm: null,
      description: row.source === 'CARWASH' ? 'Lavado CW-0014' : 'Multa de tránsito',
      maintenanceLogId: null,
      reference: row.source === 'CARWASH' ? 'CW-0014' : null,
      editable: false,
      ...row,
    };
  }

  function seeded() {
    const context = setup();
    const car = context.fleet.add();
    const ref = { id: car.id, plate: car.plate, make: car.make, model: car.model, year: car.year };
    context.automatic.washes.push(
      automaticRow(ref, {
        source: 'CARWASH',
        type: 'WASH',
        amount: '12.00',
        incurredAt: '2026-09-20',
      }),
    );
    context.automatic.fines.push(
      automaticRow(ref, {
        source: 'FINE',
        type: 'FINE',
        amount: '57.14',
        incurredAt: '2026-09-25',
      }),
    );

    return { ...context, car };
  }

  it('junta los tres orígenes, lo más reciente arriba, con el total', async () => {
    const { car, expenseUseCases } = seeded();
    await expenseUseCases.create(
      { vehicleId: car.id, type: 'FUEL', amount: '30.00', incurredAt: '2026-09-28' },
      USER,
    );

    const list = await expenseUseCases.list(expenseQuery({ vehicleId: car.id }));

    expect(list.items.map((row) => row.source)).toEqual(['MANUAL', 'FINE', 'CARWASH']);
    expect(list).toMatchObject({ total: 3, totalAmount: '99.14' });
  });

  it('pagina y el total en dinero sigue siendo de todas las filas (101)', async () => {
    const { car, expenseUseCases } = seeded();
    await expenseUseCases.create(
      { vehicleId: car.id, type: 'FUEL', amount: '30.00', incurredAt: '2026-09-28' },
      USER,
    );

    const second = await expenseUseCases.list(
      expenseQuery({ vehicleId: car.id, page: 2, pageSize: 2 }),
    );

    expect(second).toMatchObject({ page: 2, pageSize: 2, total: 3, totalAmount: '99.14' });
    expect(second.items.map((row) => row.source)).toEqual(['CARWASH']);
  });

  it('el filtro por tipo trae los automáticos de ese tipo y nada más', async () => {
    const { car, expenseUseCases } = seeded();
    await expenseUseCases.create(
      { vehicleId: car.id, type: 'WASH', amount: '5.00', incurredAt: '2026-09-28' },
      USER,
    );

    const washes = await expenseUseCases.list(expenseQuery({ type: 'WASH' }));
    const fuel = await expenseUseCases.list(expenseQuery({ type: 'FUEL' }));

    expect(washes.items.map((row) => row.source)).toEqual(['MANUAL', 'CARWASH']);
    expect(fuel.items).toHaveLength(0);
  });

  it('el rango de fechas es inclusive en los dos extremos', async () => {
    const { expenseUseCases } = seeded();

    const list = await expenseUseCases.list(expenseQuery({ from: '2026-09-20', to: '2026-09-20' }));

    expect(list.items.map((row) => row.source)).toEqual(['CARWASH']);
  });

  it('el puerto exportado lista y suma por carro con los tres orígenes', async () => {
    const { car, expenseUseCases } = seeded();

    expect(await expenseUseCases.sumByVehicle(car.id, '2026-09-01', '2026-09-30')).toBe('69.14');
    expect(await expenseUseCases.listByVehicle(car.id, '2026-09-21')).toHaveLength(1);
  });

  it('edita y borra un gasto manual', async () => {
    const { car, expenseUseCases, expenses } = seeded();
    const created = await expenseUseCases.create(
      { vehicleId: car.id, type: 'TIRES', amount: '200.00', incurredAt: '2026-09-28' },
      USER,
    );

    await expect(expenseUseCases.update(created.id, { amount: '180.00' })).resolves.toMatchObject({
      amount: '180.00',
    });
    await expenseUseCases.remove(created.id);

    expect(expenses.rows).toHaveLength(0);
  });

  it('un gasto ligado a un servicio no se edita ni se borra (409)', async () => {
    const { car, plan, logUseCases, expenseUseCases } = seeded();
    const [log] = await logUseCases.record(
      service({ vehicleId: car.id, taskId: plan.byKey('oil').id, performedAt: TODAY, cost: '40' }),
      USER,
    );
    const expenseId = log?.expenseId ?? '';

    const edit = await captureApiError(expenseUseCases.update(expenseId, { amount: '1.00' }));
    const remove = await captureApiError(expenseUseCases.remove(expenseId));

    expect([edit.status, remove.status]).toEqual([409, 409]);
  });

  it('un lavado o una multa no existen como gasto editable (404)', async () => {
    const { automatic, expenseUseCases } = seeded();

    const error = await captureApiError(expenseUseCases.remove(automatic.washes[0]?.id ?? ''));

    expect(error.status).toBe(404);
  });

  it('422 si el carro del gasto no existe', async () => {
    const { expenseUseCases } = seeded();

    const error = await captureApiError(
      expenseUseCases.create(
        { vehicleId: nextId(), type: 'FUEL', amount: '10.00', incurredAt: TODAY },
        USER,
      ),
    );

    expect(error.status).toBe(422);
  });

  it('sin tipo, el texto elige la categoría; si no coincide, queda Otro (110)', async () => {
    const { car, expenseUseCases } = seeded();

    await expect(
      expenseUseCases.create(
        {
          vehicleId: car.id,
          amount: '15.00',
          incurredAt: TODAY,
          description: 'Combustible del viaje',
        },
        USER,
      ),
    ).resolves.toMatchObject({ type: 'FUEL' });

    await expect(
      expenseUseCases.create(
        { vehicleId: car.id, amount: '8.00', incurredAt: TODAY, description: 'Un café' },
        USER,
      ),
    ).resolves.toMatchObject({ type: 'OTHER' });
  });
});

describe('MaintenanceLogUseCases (110)', () => {
  it('«Otro» con costo deja un gasto y borrarlo lo borra (RN-2)', async () => {
    const { fleet, logUseCases, expenseUseCases, expenses } = setup();
    const car = fleet.add();
    const [log] = await logUseCases.record(
      service({
        vehicleId: car.id,
        other: 'Frenos',
        performedAt: TODAY,
        cost: '10.00',
        notes: 'chilló',
      }),
      USER,
    );

    expect(log).toMatchObject({
      taskId: null,
      taskName: 'Frenos',
      notes: 'chilló',
      cost: '10.00',
    });
    expect(log?.expenseId).toEqual(expect.any(String));

    const listed = await expenseUseCases.list(expenseQuery({ vehicleId: car.id }));
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({ type: 'MAINTENANCE', amount: '10.00' });

    await logUseCases.remove(log?.id ?? '');

    expect(expenses.rows).toHaveLength(0);
    const missing = await captureApiError(logUseCases.remove(log?.id ?? ''));
    expect(missing.status).toBe(404);
  });
});
