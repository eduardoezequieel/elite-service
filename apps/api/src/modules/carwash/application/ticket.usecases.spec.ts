import { API_ERROR_CODES } from '@elite/shared';
import type {
  CarwashEventActor,
  FloorEmployeeOption,
  Ticket,
  TicketWasher,
  VehicleWithOwner,
  WorkOrderStatus,
} from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { NewCustomerData } from '../../customers/application/ports/customer.repository';
import type {
  NewVehicleData,
  VehicleChanges,
  VehicleRepository,
} from '../../vehicles/application/ports/vehicle.repository';
import type { CommissionEntryRecord, UnassignedCommissionRecord } from '../domain/commission';
import type { StatusEventRecord } from '../domain/ticket-timeline';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import { TicketUseCases } from './ticket.usecases';
import type { CashSessionRecord, CashSessionRepository } from './ports/cash-session.repository';
import type {
  ChargeData,
  CommissionRange,
  NewTicketData,
  StatusActor,
  TicketChanges,
  TicketFilter,
  TicketRepository,
} from './ports/ticket.repository';

const carlos: TicketWasher = { id: 'emp-carlos', username: 'carlos', fullName: 'Carlos VIS' };
const jose: TicketWasher = { id: 'emp-jose', username: 'jose', fullName: 'José VIS' };

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    number: 'CW-0001',
    status: 'READY',
    customer: { id: 'c1', fullName: 'Ana', phone: null },
    vehicle: {
      id: 'v1',
      plate: 'P001',
      bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: null,
      color: null,
      isActive: true,
      currentOwner: null,
      lastWash: null,
    },
    bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
    items: [
      {
        id: 'i1',
        serviceId: 's1',
        serviceCode: 'SRV-0003',
        serviceName: 'Lavado',
        catalogPrice: '14.00',
        unitPrice: '14.00',
        sortOrder: 0,
      },
    ],
    total: '14.00',
    washer: carlos,
    washers: [carlos],
    commissionTotal: null,
    notes: null,
    payment: null,
    washingStartedAt: null,
    readyAt: null,
    createdAt: '2026-09-03T12:00:00.000Z',
    updatedAt: '2026-09-03T12:00:00.000Z',
    ...overrides,
  };
}

class FakeTicketRepository implements TicketRepository {
  constructor(
    public row: Ticket,
    public activeIds: string[] = [carlos.id, jose.id],
  ) {}

  lastCharge: ChargeData | null = null;
  lastCreated: NewTicketData | null = null;
  lastListFilter: TicketFilter | null = null;
  /** El historial que el repositorio real escribiria (046). */
  statusEvents: StatusEventRecord[] = [];

  private record(
    fromStatus: WorkOrderStatus | null,
    toStatus: WorkOrderStatus,
    actor: StatusActor,
  ) {
    this.statusEvents.push({
      id: `ev-${this.statusEvents.length + 1}`,
      fromStatus,
      toStatus,
      actorKind: actor?.kind ?? null,
      actorName: actor?.name ?? null,
      occurredAt: new Date(Date.UTC(2026, 8, 20, 16, this.statusEvents.length)),
    });
  }

  /**
   * Lo que el repositorio real saca del historial al mapear (049): la ultima
   * entrada a READY. La tabla es de solo agregar, asi que volver a OPEN o a
   * WASHING no borra la marca; `null` es «nunca llego a READY».
   */
  private get readyAt(): string | null {
    const entries = this.statusEvents.filter((event) => event.toStatus === 'READY');
    const last = entries[entries.length - 1];

    return last === undefined ? null : last.occurredAt.toISOString();
  }

  async list(filter: TicketFilter): Promise<Ticket[]> {
    this.lastListFilter = filter;
    return [this.row];
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.row.id === id ? this.row : null;
  }

  async create(data: NewTicketData, actor: StatusActor): Promise<Ticket> {
    this.lastCreated = data;
    this.record(null, 'OPEN', actor);
    return ticket({
      customer:
        data.customerId === null
          ? null
          : { id: data.customerId, fullName: 'Customer', phone: null },
      vehicle: {
        id: data.vehicleId,
        plate: 'P001',
        bodyType: { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
        make: null,
        color: null,
        isActive: true,
        currentOwner: null,
        lastWash: null,
      },
      bodyType: { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
      washers: data.washerIds.map((id) => (id === jose.id ? jose : carlos)),
    });
  }

  async update(_id: string, changes: TicketChanges): Promise<Ticket> {
    if (changes.customerId !== undefined) {
      this.row = {
        ...this.row,
        customer:
          changes.customerId === null
            ? null
            : { id: changes.customerId, fullName: 'Cliente', phone: null },
      };
    }

    if (changes.notes !== undefined) {
      this.row = { ...this.row, notes: changes.notes };
    }

    return this.row;
  }

  async setStatus(_id: string, status: WorkOrderStatus, actor: StatusActor): Promise<Ticket> {
    this.record(this.row.status, status, actor);
    this.row = { ...this.row, status, readyAt: this.readyAt };
    return this.row;
  }

  async listStatusEvents(_id: string): Promise<StatusEventRecord[]> {
    return this.statusEvents;
  }

  async charge(_id: string, data: ChargeData, actor: StatusActor): Promise<Ticket> {
    this.lastCharge = data;
    this.record(this.row.status, 'PAID', actor);
    this.row = {
      ...this.row,
      status: 'PAID',
      commissionTotal: '1.00',
      payment: {
        method: data.method,
        amount: '14.00',
        paidAt: '2026-09-03T12:00:00.000Z',
        recordedBy: { id: actor?.id ?? 'u-1', fullName: actor?.name ?? 'Administrador' },
      },
      readyAt: this.readyAt,
    };
    return this.row;
  }

  async appendNote(_id: string, line: string): Promise<Ticket> {
    this.row = {
      ...this.row,
      notes: this.row.notes === null ? line : `${this.row.notes}\n${line}`,
    };
    return this.row;
  }

  async reverse(
    _id: string,
    data: { reason: string; cashSessionId: string },
    actor: StatusActor,
  ): Promise<Ticket> {
    this.record(this.row.status, 'READY', actor);
    this.row = {
      ...this.row,
      status: 'READY',
      payment: null,
      commissionTotal: null,
      notes: `Reverso: ${data.reason}`,
      readyAt: this.readyAt,
    };
    return this.row;
  }

  async replaceWashers(_id: string, employeeIds: string[]): Promise<Ticket> {
    this.row = {
      ...this.row,
      washers: employeeIds.map((id) => (id === jose.id ? jose : carlos)),
    };
    return this.row;
  }

  async findActiveEmployeeIds(ids: string[]): Promise<string[]> {
    return ids.filter((id) => this.activeIds.includes(id));
  }

  async listActiveEmployees(): Promise<FloorEmployeeOption[]> {
    return [
      { id: carlos.id, fullName: carlos.fullName },
      { id: jose.id, fullName: jose.fullName },
    ];
  }

  async listCommissionSnapshot(_range: CommissionRange): Promise<{
    entries: CommissionEntryRecord[];
    unassigned: UnassignedCommissionRecord[];
  }> {
    return { entries: [], unassigned: [] };
  }
}

class FakeCashSessions implements CashSessionRepository {
  constructor(public current: CashSessionRecord | null = { id: 'cash-1' } as CashSessionRecord) {}

  async findOpen(): Promise<CashSessionRecord | null> {
    return this.current;
  }

  async findById(): Promise<CashSessionRecord | null> {
    return this.current;
  }

  async list(_limit: number): Promise<CashSessionRecord[]> {
    return this.current === null ? [] : [this.current];
  }

  async open(): Promise<CashSessionRecord> {
    throw new Error('not used');
  }

  async close(): Promise<CashSessionRecord | null> {
    throw new Error('not used');
  }
}

class FakeCustomerRepository {
  public createdData: NewCustomerData[] = [];

  async findById(id: string) {
    return { id, fullName: 'Cliente', phone: null };
  }

  async create(data: NewCustomerData) {
    this.createdData.push(data);

    return {
      id: 'c-new',
      fullName: data.fullName,
      phone: data.phone ?? null,
      isActive: true,
    };
  }
}

class FakeVehicleRepository implements Partial<VehicleRepository> {
  public vehicles: VehicleWithOwner[] = [];
  public createdData: NewVehicleData[] = [];
  public updatedData: { id: string; changes: VehicleChanges }[] = [];

  async findById(id: string): Promise<VehicleWithOwner | null> {
    return this.vehicles.find((v) => v.id === id) ?? null;
  }

  async findByPlate(plate: string): Promise<VehicleWithOwner | null> {
    return this.vehicles.find((v) => v.plate === plate && v.isActive) ?? null;
  }

  async existsByPlate(plate: string, exceptId?: string): Promise<boolean> {
    return this.vehicles.some((v) => v.plate === plate && v.id !== exceptId);
  }

  async create(data: NewVehicleData): Promise<VehicleWithOwner> {
    this.createdData.push(data);
    const created: VehicleWithOwner = {
      id: `veh-${this.vehicles.length + 1}`,
      plate: data.plate,
      bodyType: { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: data.make ?? null,
      color: data.color ?? null,
      isActive: true,
      currentOwner:
        data.customerId === undefined
          ? null
          : { id: data.customerId, fullName: 'Owner', phone: null },
      lastWash: null,
    };
    this.vehicles.push(created);
    return created;
  }

  async update(id: string, changes: VehicleChanges): Promise<VehicleWithOwner> {
    this.updatedData.push({ id, changes });
    const found = this.vehicles.find((v) => v.id === id);
    if (!found) throw new Error('not found');
    if (changes.bodyTypeId) found.bodyType.id = changes.bodyTypeId;
    if (changes.make !== undefined) found.make = changes.make ?? null;
    if (changes.color !== undefined) found.color = changes.color ?? null;
    if (changes.customerId !== undefined) {
      found.currentOwner = {
        id: changes.customerId,
        fullName: 'Owner',
        phone: null,
        isActive: true,
      };
    }
    return found;
  }
}

function build(
  row: Ticket = ticket(),
  activeIds?: string[],
  cashOpen = true,
  fakeVehicles = new FakeVehicleRepository(),
  fakeCustomers = new FakeCustomerRepository(),
) {
  const tickets = new FakeTicketRepository(row, activeIds);
  const cashSessions = new FakeCashSessions(
    cashOpen ? ({ id: 'cash-1' } as CashSessionRecord) : null,
  );

  const mockService = {
    id: 'srv-1',
    code: 'SRV-0001',
    name: 'Lavado Express',
    defaultPrice: '14.00',
    taxRate: '0.13',
    isActive: true,
    category: { id: 'cat-1', name: 'Lavados', sortOrder: 1, isActive: true },
    prices: [],
  };

  const events = new InMemoryTicketEvents();

  return {
    tickets,
    fakeVehicles,
    fakeCustomers,
    events,
    usecases: new TicketUseCases(
      tickets,
      { listServices: async () => [mockService] } as never,
      fakeCustomers as never,
      fakeVehicles as never,
      cashSessions,
      events,
    ),
  };
}

describe('TicketUseCases.setWashers', () => {
  it('reemplaza al asignado en READY y no toca a quien abrió', async () => {
    const { usecases, tickets } = build();

    const updated = await usecases.setWashers('t1', [jose.id], {
      requireNonEmpty: true,
    });

    expect(updated.washer?.id).toBe(carlos.id);
    expect(updated.washers.map((washer) => washer.id)).toEqual([jose.id]);
    expect(tickets.row.washer?.id).toBe(carlos.id);
  });

  it('rechaza más de un asignado', async () => {
    const { usecases } = build();
    const failure = await captureApiError(
      usecases.setWashers('t1', [carlos.id, jose.id], { requireNonEmpty: true }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });

  it('en pista rechaza dejar el conjunto vacío', async () => {
    const { usecases } = build();
    const failure = await captureApiError(usecases.setWashers('t1', [], { requireNonEmpty: true }));

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });

  it('en PAID responde WASHERS_LOCKED', async () => {
    const { usecases } = build(ticket({ status: 'PAID' }));
    const failure = await captureApiError(
      usecases.setWashers('t1', [jose.id], { requireNonEmpty: true }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.WASHERS_LOCKED);
  });

  it('rechaza un empleado inactivo', async () => {
    const { usecases } = build(ticket(), [carlos.id]);
    const failure = await captureApiError(
      usecases.setWashers('t1', [jose.id], { requireNonEmpty: true }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.INVALID_WASHER);
  });
});

describe('TicketUseCases.charge (009)', () => {
  it('congela $14 → $1.00 en la misma llamada de cobro', async () => {
    const { usecases, tickets } = build();

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(tickets.lastCharge?.commissionTotal).toBe(100);
    expect(tickets.lastCharge?.entries).toEqual([{ employeeId: carlos.id, amount: 100 }]);
  });

  it('parte $1.00 entre dos empleados', async () => {
    const { usecases, tickets } = build(ticket({ washers: [carlos, jose] }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(tickets.lastCharge?.entries.map((entry) => entry.amount)).toEqual([50, 50]);
  });

  it('oficina sin empleado calcula el total y no crea entradas', async () => {
    const { usecases, tickets } = build(ticket({ washer: null, washers: [] }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(tickets.lastCharge?.commissionTotal).toBe(100);
    expect(tickets.lastCharge?.entries).toEqual([]);
    expect(tickets.lastCharge?.cashSessionId).toBe('cash-1');
  });

  it('sin caja abierta no cobra ni congela comisión', async () => {
    const { usecases, tickets } = build(ticket(), undefined, false);
    const failure = await captureApiError(
      usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1'),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.CASH_NOT_OPEN);
    expect(tickets.lastCharge).toBeNull();
  });
});

describe('TicketUseCases.start (036)', () => {
  it('el asignado puede empezar su lavado', async () => {
    const { usecases } = build(ticket({ status: 'OPEN', washers: [carlos] }));

    const updated = await usecases.start('t1', carlos.id);

    expect(updated.status).toBe('WASHING');
    expect(updated.washers.map((washer) => washer.id)).toEqual([carlos.id]);
  });

  it('un empleado no empieza el lavado de otro', async () => {
    const { usecases } = build(ticket({ status: 'OPEN', washers: [carlos] }));

    const failure = await captureApiError(usecases.start('t1', jose.id));

    expect(failure.status).toBe(404);
    expect(failure.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
    expect(failure.body.message).toBe('Ese lavado no existe.');
  });

  it('un lavado sin asignar no se toma en pista', async () => {
    const { usecases } = build(ticket({ status: 'OPEN', washer: null, washers: [] }));

    const failure = await captureApiError(usecases.start('t1', carlos.id));

    expect(failure.status).toBe(404);
    expect(failure.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });
});

describe('TicketUseCases.setOperationalStatus (037)', () => {
  it.each([
    ['OPEN', 'WASHING'],
    ['OPEN', 'READY'],
    ['WASHING', 'OPEN'],
    ['WASHING', 'READY'],
    ['READY', 'OPEN'],
    ['READY', 'WASHING'],
  ] as const)('%s -> %s', async (from, to) => {
    const { usecases, tickets } = build(ticket({ status: from, washers: [carlos] }));

    const updated = await usecases.setOperationalStatus('t1', to);

    expect(updated.status).toBe(to);
    expect(tickets.row.washers.map((washer) => washer.id)).toEqual([carlos.id]);
  });

  it('no inventa asignado al pasar a WASHING', async () => {
    const { usecases } = build(ticket({ status: 'OPEN', washer: null, washers: [] }));

    const updated = await usecases.setOperationalStatus('t1', 'WASHING');

    expect(updated.status).toBe('WASHING');
    expect(updated.washers).toEqual([]);
  });

  it('rechaza el mismo estado', async () => {
    const { usecases } = build(ticket({ status: 'WASHING' }));
    const failure = await captureApiError(usecases.setOperationalStatus('t1', 'WASHING'));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_ALREADY_IN_STATUS);
  });

  it('rechaza PAID y VOID', async () => {
    const paid = await captureApiError(
      build(ticket({ status: 'PAID' })).usecases.setOperationalStatus('t1', 'OPEN'),
    );
    const voided = await captureApiError(
      build(ticket({ status: 'VOID' })).usecases.setOperationalStatus('t1', 'READY'),
    );

    expect(paid.status).toBe(409);
    expect(paid.body.code).toBe(API_ERROR_CODES.TICKET_STATUS_LOCKED);
    expect(voided.status).toBe(409);
    expect(voided.body.code).toBe(API_ERROR_CODES.TICKET_STATUS_LOCKED);
  });
});

describe('TicketUseCases.requireOwnedByEmployee (036)', () => {
  it('devuelve el ticket si es del empleado', async () => {
    const { usecases } = build(ticket({ washers: [carlos] }));

    await expect(usecases.requireOwnedByEmployee('t1', carlos.id)).resolves.toMatchObject({
      id: 't1',
    });
  });

  it('404 si es de otro o no tiene asignado', async () => {
    const owned = build(ticket({ washers: [carlos] }));
    const bare = build(ticket({ washer: null, washers: [] }));

    const other = await captureApiError(owned.usecases.requireOwnedByEmployee('t1', jose.id));
    const empty = await captureApiError(bare.usecases.requireOwnedByEmployee('t1', carlos.id));

    expect(other.status).toBe(404);
    expect(other.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
    expect(empty.status).toBe(404);
  });
});

describe('TicketUseCases.create (035 assignee)', () => {
  it('en pista el opener es el único asignado', async () => {
    const { usecases, tickets } = build();

    await usecases.create(
      {
        customerId: 'c1',
        vehicle: { plate: 'P035-001', bodyTypeId: 'b1' },
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(tickets.lastCreated?.washerIds).toEqual([carlos.id]);
    expect(tickets.lastCreated?.openedByEmployeeId).toBe(carlos.id);
  });

  it('en oficina sin employeeId queda sin asignar', async () => {
    const { usecases, tickets } = build();

    await usecases.create(
      {
        customerId: 'c1',
        vehicle: { plate: 'P035-002', bodyTypeId: 'b1' },
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'user', userId: 'user-1' },
    );

    expect(tickets.lastCreated?.washerIds).toEqual([]);
    expect(tickets.lastCreated?.openedByEmployeeId).toBeNull();
  });

  it('en oficina con employeeId queda esa sola persona', async () => {
    const { usecases, tickets } = build();

    await usecases.create(
      {
        customerId: 'c1',
        vehicle: { plate: 'P035-003', bodyTypeId: 'b1' },
        items: [{ serviceId: 'srv-1' }],
        employeeId: jose.id,
      },
      { kind: 'user', userId: 'user-1', employeeId: jose.id },
    );

    expect(tickets.lastCreated?.washerIds).toEqual([jose.id]);
    expect(tickets.lastCreated?.openedByEmployeeId).toBe(jose.id);
  });
});

describe('TicketUseCases.create (012 vehicle lookup on intake)', () => {
  it('camino 1: placa nueva crea el vehículo y abre el ticket', async () => {
    const { usecases, tickets, fakeVehicles } = build();

    const created = await usecases.create(
      {
        customerId: 'c1',
        vehicle: {
          plate: 'PNEW-001',
          bodyTypeId: 'b1',
          make: 'Toyota',
          color: 'Blanco',
        },
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(created).toBeDefined();
    expect(fakeVehicles.createdData).toHaveLength(1);
    expect(fakeVehicles.createdData[0]).toEqual({
      plate: 'PNEW-001',
      bodyTypeId: 'b1',
      customerId: 'c1',
      make: 'Toyota',
      color: 'Blanco',
    });
    expect(tickets.lastCreated?.vehicleId).toBe(fakeVehicles.vehicles[0].id);
    expect(tickets.lastCreated?.bodyTypeId).toBe('b1');
    expect(fakeVehicles.updatedData).toHaveLength(0);
  });

  it('camino 2: placa conocida con vehicleId usa ese vehículo y NO muta ficha ni dueño', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const existingVehicle = await fakeVehicles.create({
      plate: 'PKNOWN-001',
      bodyTypeId: 'b1',
      customerId: 'c-old',
      make: 'Honda',
      color: 'Gris',
    });
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles);
    fakeVehicles.createdData = [];

    const created = await usecases.create(
      {
        customerId: 'c-new',
        vehicleId: existingVehicle.id,
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(created).toBeDefined();
    expect(tickets.lastCreated?.vehicleId).toBe(existingVehicle.id);
    expect(tickets.lastCreated?.bodyTypeId).toBe('b1');
    expect(tickets.lastCreated?.customerId).toBe('c-old');
    expect(fakeVehicles.createdData).toHaveLength(0);
    expect(fakeVehicles.updatedData).toHaveLength(0);

    const untouched = await fakeVehicles.findById(existingVehicle.id);
    expect(untouched?.make).toBe('Honda');
    expect(untouched?.color).toBe('Gris');
    expect(untouched?.bodyType.id).toBe('b1');
    expect(untouched?.currentOwner?.id).toBe('c-old');
  });

  it('camino 3: placa conocida sin vehicleId responde 409 VEHICLE_PLATE_EXISTS y NO muta ficha ni dueño', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const existingVehicle = await fakeVehicles.create({
      plate: 'PKNOWN-001',
      bodyTypeId: 'b1',
      customerId: 'c-old',
      make: 'Honda',
      color: 'Gris',
    });
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles);
    fakeVehicles.createdData = [];

    const failure = await captureApiError(
      usecases.create(
        {
          customerId: 'c-new',
          vehicle: {
            plate: 'PKNOWN-001',
            bodyTypeId: 'b2',
            make: 'Mazda',
            color: 'Rojo',
          },
          items: [{ serviceId: 'srv-1' }],
        },
        { kind: 'employee', employeeId: carlos.id },
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_PLATE_EXISTS);
    expect(failure.body.message).toBe('Ya existe un vehículo con esa placa.');
    expect((failure.body.details as { vehicle: VehicleWithOwner }).vehicle.id).toBe(
      existingVehicle.id,
    );
    expect(fakeVehicles.createdData).toHaveLength(0);
    expect(fakeVehicles.updatedData).toHaveLength(0);

    const untouched = await fakeVehicles.findById(existingVehicle.id);
    expect(untouched?.make).toBe('Honda');
    expect(untouched?.color).toBe('Gris');
    expect(untouched?.bodyType.id).toBe('b1');
    expect(untouched?.currentOwner?.id).toBe('c-old');
    expect(tickets.lastCreated).toBeNull();
  });

  it('placa desactivada sin vehicleId responde 409 y no crea otro vehículo', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const inactive = await fakeVehicles.create({
      plate: 'POLD-001',
      bodyTypeId: 'b1',
      customerId: 'c-old',
    });
    inactive.isActive = false;
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles);
    fakeVehicles.createdData = [];

    const failure = await captureApiError(
      usecases.create(
        {
          customerId: 'c-new',
          vehicle: { plate: 'POLD-001', bodyTypeId: 'b1' },
          items: [{ serviceId: 'srv-1' }],
        },
        { kind: 'employee', employeeId: carlos.id },
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_PLATE_EXISTS);
    expect(failure.body.details).toBeUndefined();
    expect(fakeVehicles.createdData).toHaveLength(0);
    expect(tickets.lastCreated).toBeNull();
  });

  it('placa conocida sin vehicleId no crea el cliente del cuerpo', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    await fakeVehicles.create({
      plate: 'PKNOWN-001',
      bodyTypeId: 'b1',
      customerId: 'c-old',
    });
    const fakeCustomers = new FakeCustomerRepository();
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles, fakeCustomers);
    fakeVehicles.createdData = [];

    const failure = await captureApiError(
      usecases.create(
        {
          customer: { fullName: 'Ana' },
          vehicle: { plate: 'PKNOWN-001', bodyTypeId: 'b1' },
          items: [{ serviceId: 'srv-1' }],
        },
        { kind: 'employee', employeeId: carlos.id },
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_PLATE_EXISTS);
    expect(fakeCustomers.createdData).toHaveLength(0);
    expect(tickets.lastCreated).toBeNull();
  });
});

describe('TicketUseCases.create (040 vehicle-first)', () => {
  it('abre un lavado solo con placa, sin crear cliente', async () => {
    const fakeCustomers = new FakeCustomerRepository();
    const { usecases, tickets, fakeVehicles } = build(
      ticket(),
      undefined,
      true,
      new FakeVehicleRepository(),
      fakeCustomers,
    );

    await usecases.create(
      {
        vehicle: { plate: 'P040-001', bodyTypeId: 'b1' },
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(tickets.lastCreated?.customerId).toBeNull();
    expect(fakeCustomers.createdData).toHaveLength(0);
    expect(fakeVehicles.createdData[0]?.customerId).toBeUndefined();
    expect(fakeVehicles.vehicles[0]?.currentOwner).toBeNull();
  });

  it('placa conocida con responsable usa ese dueño y no lo pisa', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const existing = await fakeVehicles.create({
      plate: 'P040-002',
      bodyTypeId: 'b1',
      customerId: 'c-old',
    });
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles);
    fakeVehicles.createdData = [];

    await usecases.create(
      {
        vehicleId: existing.id,
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(tickets.lastCreated?.customerId).toBe('c-old');
    expect(fakeVehicles.updatedData).toHaveLength(0);
  });
});

describe('TicketUseCases.setResponsible (040)', () => {
  it('pega un responsable nuevo al carro y al ticket', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const vehicle = await fakeVehicles.create({ plate: 'P040-003', bodyTypeId: 'b1' });
    const fakeCustomers = new FakeCustomerRepository();
    const { usecases, tickets } = build(
      ticket({
        status: 'READY',
        customer: null,
        vehicle: { ...vehicle, currentOwner: null },
      }),
      undefined,
      true,
      fakeVehicles,
      fakeCustomers,
    );

    const updated = await usecases.setResponsible('t1', {
      customer: { fullName: 'Carlos Mejía', phone: '7845-0912' },
    });

    expect(fakeCustomers.createdData).toHaveLength(1);
    expect(fakeVehicles.updatedData[0]?.changes.customerId).toBe('c-new');
    expect(updated.customer?.id).toBe('c-new');
    expect(tickets.row.customer?.id).toBe('c-new');
  });

  it('no pisa el responsable de un carro conocido', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const vehicle = await fakeVehicles.create({
      plate: 'P040-004',
      bodyTypeId: 'b1',
      customerId: 'c-old',
    });
    const { usecases } = build(
      ticket({
        status: 'READY',
        customer: { id: 'c-old', fullName: 'Ana', phone: null },
        vehicle,
      }),
      undefined,
      true,
      fakeVehicles,
    );

    const failure = await captureApiError(
      usecases.setResponsible('t1', { customer: { fullName: 'Otro' } }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_HAS_OWNER);
  });

  it('cobra sin responsable un ticket READY', async () => {
    const { usecases, tickets } = build(ticket({ status: 'READY', customer: null }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(tickets.lastCharge?.method).toBe('CASH');
    expect(tickets.row.status).toBe('PAID');
    expect(tickets.row.customer).toBeNull();
  });
});

describe('TicketUseCases.list (014)', () => {
  it('pasa assignedEmployeeId al repositorio (036)', async () => {
    const { usecases, tickets } = build();

    await usecases.list({
      statuses: ['OPEN', 'WASHING', 'READY'],
      assignedEmployeeId: carlos.id,
    });

    expect(tickets.lastListFilter).toEqual({
      statuses: ['OPEN', 'WASHING', 'READY'],
      assignedEmployeeId: carlos.id,
      q: undefined,
    });
  });

  it('pasa el filtro y recorta espacios en q', async () => {
    const { usecases, tickets } = build();

    await usecases.list({ date: '2026-09-04', q: '  PVIS-001  ' });

    expect(tickets.lastListFilter).toEqual({
      date: '2026-09-04',
      q: 'PVIS-001',
    });
  });

  it('omite q si viene vacío o solo con espacios', async () => {
    const { usecases, tickets } = build();

    await usecases.list({ date: '2026-09-04', q: '   ' });

    expect(tickets.lastListFilter).toEqual({
      date: '2026-09-04',
      q: undefined,
    });
  });
});

describe('TicketUseCases.update notes (041)', () => {
  it('guarda la nota en WASHING y READY', async () => {
    const washing = build(ticket({ status: 'WASHING' }));
    const washed = await washing.usecases.update('t1', { notes: 'Pidió cera.' });

    expect(washed.notes).toBe('Pidió cera.');

    const ready = build(ticket({ status: 'READY' }));
    const annotated = await ready.usecases.update('t1', { notes: 'No silicona.' });

    expect(annotated.notes).toBe('No silicona.');
  });

  it('una nota vacía queda null', async () => {
    const { usecases } = build(ticket({ status: 'OPEN', notes: 'Vieja' }));
    const updated = await usecases.update('t1', { notes: '   ' });

    expect(updated.notes).toBeNull();
  });

  it('no anota un PAID ni un VOID', async () => {
    const paid = await captureApiError(
      build(ticket({ status: 'PAID' })).usecases.update('t1', { notes: 'Tarde' }),
    );
    expect(paid.status).toBe(409);
    expect(paid.body.code).toBe(API_ERROR_CODES.TICKET_NOT_OPEN);

    const voided = await captureApiError(
      build(ticket({ status: 'VOID' })).usecases.update('t1', { notes: 'Tarde' }),
    );
    expect(voided.status).toBe(409);
    expect(voided.body.code).toBe(API_ERROR_CODES.TICKET_NOT_OPEN);
  });

  it('cambiar servicios en WASHING sigue bloqueado', async () => {
    const failure = await captureApiError(
      build(ticket({ status: 'WASHING' })).usecases.update('t1', {
        items: [{ serviceId: 'srv-1' }],
      }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_OPEN);
  });
});

// ============================================================================
// spec 042 — Lo que el lavado cuenta mientras pasa
//
// El stream no se testea aca (eso es transporte): lo que se afirma es que cada
// mutacion publica un evento y solo uno, con quien la hizo y de que estado
// venia. Si un caso de uso deja de avisar, la fila de la otra pantalla se queda
// quieta y nadie se entera hasta que alguien recarga.
// ============================================================================

describe('TicketUseCases — eventos (042)', () => {
  const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };

  it('avisa del alta, con el ticket ya creado', async () => {
    const { usecases, events } = build();

    await usecases.create(
      {
        customerId: 'c1',
        vehicle: { plate: 'P042-001', bodyTypeId: 'b1' },
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'user', userId: 'u-ana' },
      ana,
    );

    expect(events.types).toEqual(['ticket.created']);
    expect(events.last?.actor).toEqual(ana);
    expect(events.last?.ticket.number).toBe('CW-0001');
    expect(events.last?.previousStatus).toBeNull();
  });

  it('en un cambio de estado dice de donde venia', async () => {
    const { usecases, events } = build(ticket({ status: 'OPEN' }));

    await usecases.setOperationalStatus('t1', 'WASHING', ana);

    expect(events.types).toEqual(['ticket.status.changed']);
    expect(events.last?.previousStatus).toBe('OPEN');
    expect(events.last?.ticket.status).toBe('WASHING');
  });

  it('las transiciones de pista también avisan', async () => {
    const { usecases, events } = build(ticket({ status: 'OPEN' }));

    await usecases.start('t1', carlos.id, { kind: 'employee', id: carlos.id, name: 'Carlos' });

    expect(events.types).toEqual(['ticket.status.changed']);
    expect(events.last?.ticket.status).toBe('WASHING');
    expect(events.last?.actor?.kind).toBe('employee');
  });

  it('el cobro avisa una sola vez, aunque de paso pegue el responsable', async () => {
    const fakeVehicles = new FakeVehicleRepository();

    fakeVehicles.vehicles.push({
      id: 'v1',
      plate: 'P001',
      bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: null,
      color: null,
      isActive: true,
      currentOwner: null,
      lastWash: null,
    });

    const { usecases, events } = build(ticket({ customer: null }), undefined, true, fakeVehicles);

    await usecases.charge(
      't1',
      { method: 'CASH', amount: '14.00', customerId: 'c9' },
      'u-ana',
      ana,
    );

    // `assignResponsible` no publica: quien mira la fila ve «cobrado», no
    // «cambió el responsable» y además «cobrado».
    expect(events.types).toEqual(['ticket.charged']);
    expect(events.last?.previousStatus).toBe('READY');
    expect(events.last?.ticket.status).toBe('PAID');
  });

  it('la anulación sale con el motivo ya escrito', async () => {
    const { usecases, events } = build(ticket({ status: 'OPEN' }));

    await usecases.voidWithReason('t1', 'Carro equivocado.', ana);

    expect(events.types).toEqual(['ticket.voided']);
    expect(events.last?.previousStatus).toBe('OPEN');
    expect(events.last?.ticket.notes).toBe('Anulado: Carro equivocado.');
  });

  it('deshacer el cobro avisa que volvió de PAID', async () => {
    const { usecases, events } = build(ticket({ status: 'PAID' }));

    await usecases.reverse('t1', { reason: 'Cobro duplicado.' }, ana);

    expect(events.types).toEqual(['ticket.reversed']);
    expect(events.last?.previousStatus).toBe('PAID');
    expect(events.last?.ticket.status).toBe('READY');
  });

  it('reasignar tiene evento propio: es lo que le cambia la fila al de pista', async () => {
    const { usecases, events } = build();

    await usecases.setWashers('t1', [jose.id], { requireNonEmpty: true }, ana);

    expect(events.types).toEqual(['ticket.assigned']);
    expect(events.last?.ticket.washers).toEqual([jose]);
  });

  it('la nota también avisa: la ve quien está cobrando', async () => {
    const { usecases, events } = build();

    await usecases.update('t1', { notes: 'No mojar el interior.' }, ana);

    expect(events.types).toEqual(['ticket.updated']);
    expect(events.last?.ticket.notes).toBe('No mojar el interior.');
  });

  it('sin actor el evento igual sale: el aviso nunca bloquea la mutación', async () => {
    const { usecases, events } = build(ticket({ status: 'OPEN' }));

    await usecases.setOperationalStatus('t1', 'READY');

    expect(events.last?.actor).toBeNull();
  });

  it('un oyente roto no tumba el cobro', async () => {
    const { usecases, events, tickets } = build();

    jest.spyOn(events, 'publish').mockImplementation(() => {
      throw new Error('el bus explotó');
    });

    await expect(
      usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'u-ana'),
    ).resolves.toMatchObject({ status: 'PAID' });
    expect(tickets.lastCharge).not.toBeNull();
  });

  it('una mutación rechazada no avisa de nada', async () => {
    const { usecases, events } = build(ticket({ status: 'OPEN' }));

    await captureApiError(usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'u-ana'));

    expect(events.published).toHaveLength(0);
  });
});

describe('TicketUseCases — línea de tiempo (046)', () => {
  const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };

  it('el alta deja la fila de apertura con su actor (RN-2)', async () => {
    const { usecases, tickets } = build();

    await usecases.create(
      {
        customerId: 'c1',
        vehicle: { plate: 'P046-001', bodyTypeId: 'b1' },
        items: [{ serviceId: 'srv-1' }],
      },
      { kind: 'user', userId: 'u-ana' },
      ana,
    );

    expect(tickets.statusEvents).toHaveLength(1);
    expect(tickets.statusEvents[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'OPEN',
      actorKind: 'user',
      actorName: 'Ana',
    });
  });

  it('un cambio desde oficina anota de dónde venía', async () => {
    const { usecases, tickets } = build(ticket({ status: 'OPEN' }));

    await usecases.setOperationalStatus('t1', 'WASHING', ana);

    expect(tickets.statusEvents[0]).toMatchObject({
      fromStatus: 'OPEN',
      toStatus: 'WASHING',
      actorKind: 'user',
      actorName: 'Ana',
    });
  });

  it('una transición de pista queda a nombre del empleado (RN-3)', async () => {
    const { usecases, tickets } = build(ticket({ status: 'OPEN' }));

    await usecases.start('t1', carlos.id, { kind: 'employee', id: carlos.id, name: 'Carlos VIS' });

    expect(tickets.statusEvents[0]).toMatchObject({
      fromStatus: 'OPEN',
      toStatus: 'WASHING',
      actorKind: 'employee',
      actorName: 'Carlos VIS',
    });
  });

  it('el cobro y el reverso también dejan fila', async () => {
    const { usecases, tickets } = build(ticket({ status: 'READY' }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'u-ana', ana);
    await usecases.reverse('t1', { reason: 'se equivocó de ticket' }, ana);

    expect(tickets.statusEvents.map((event) => event.toStatus)).toEqual(['PAID', 'READY']);
  });

  it('una anulación deja fila con quien la hizo', async () => {
    const { usecases, tickets } = build(ticket({ status: 'READY' }));

    await usecases.voidWithReason('t1', 'el cliente se fue', ana);

    expect(tickets.statusEvents[0]).toMatchObject({
      fromStatus: 'READY',
      toStatus: 'VOID',
      actorName: 'Ana',
    });
  });

  it('editar la nota no mueve el estado, así que no deja fila (RN-2)', async () => {
    const { usecases, tickets } = build(ticket({ status: 'OPEN' }));

    await usecases.update('t1', { notes: 'dejar el tapete afuera' }, ana);

    expect(tickets.statusEvents).toHaveLength(0);
  });

  it('arma los tramos del historial guardado (RN-5)', async () => {
    const { usecases } = build(ticket({ status: 'OPEN' }));

    await usecases.setOperationalStatus('t1', 'WASHING', ana);
    await usecases.setOperationalStatus('t1', 'READY', ana);

    const timeline = await usecases.timeline('t1');

    expect(timeline.recorded).toBe(true);
    expect(timeline.segments.map((segment) => segment.status)).toEqual(['WASHING', 'READY']);
    expect(timeline.segments[0]?.durationSeconds).toBe(60);
    expect(timeline.segments[1]?.durationSeconds).toBeNull();
  });

  it('un lavado anterior a la spec no tiene historia (RN-8)', async () => {
    const { usecases } = build(ticket({ status: 'PAID' }));

    await expect(usecases.timeline('t1')).resolves.toEqual({ segments: [], recorded: false });
  });

  it('un lavado que no existe es 404, no una línea vacía', async () => {
    const { usecases } = build();

    const error = await captureApiError(usecases.timeline('desconocido'));

    expect(error.status).toBe(404);
  });
});

describe('TicketUseCases — readyAt (049)', () => {
  const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };

  it('al marcar READY el ticket sale con la hora puesta', async () => {
    const { usecases } = build(ticket({ status: 'WASHING' }));

    const updated = await usecases.setOperationalStatus('t1', 'READY', ana);

    expect(updated.readyAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(updated.readyAt ?? ''))).toBe(false);
  });

  it('un lavado que sigue abierto no tiene hora de listo', async () => {
    const { usecases } = build(ticket({ status: 'WASHING' }));

    const updated = await usecases.setOperationalStatus('t1', 'OPEN', ana);

    expect(updated.readyAt).toBeNull();
  });

  it('oficina saltando de OPEN a READY tambien deja la hora', async () => {
    const { usecases } = build(ticket({ status: 'OPEN' }));

    const updated = await usecases.setOperationalStatus('t1', 'READY', ana);

    expect(updated.readyAt).not.toBeNull();
  });

  it('volver a la pista no borra el ultimo READY: el historial no se edita', async () => {
    const { usecases } = build(ticket({ status: 'OPEN' }));

    const ready = await usecases.setOperationalStatus('t1', 'READY', ana);
    const again = await usecases.setOperationalStatus('t1', 'WASHING', ana);

    expect(again.readyAt).toBe(ready.readyAt);
  });
});
