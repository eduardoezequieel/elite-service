import { API_ERROR_CODES } from '@elite/shared';
import type {
  FloorEmployeeOption,
  Ticket,
  TicketWasher,
  VehicleWithOwner,
  WorkOrderStatus,
} from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type {
  NewVehicleData,
  VehicleChanges,
  VehicleRepository,
} from '../../vehicles/application/ports/vehicle.repository';
import type { CommissionEntryRecord, UnassignedCommissionRecord } from '../domain/commission';
import { TicketUseCases } from './ticket.usecases';
import type { CashSessionRecord, CashSessionRepository } from './ports/cash-session.repository';
import type {
  ChargeData,
  CommissionRange,
  NewTicketData,
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
    customer: { id: 'c1', fullName: 'Ana', phone: null, isActive: true },
    vehicle: {
      id: 'v1',
      plate: 'P001',
      bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: null,
      color: null,
      isActive: true,
      currentOwner: null,
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

  async list(filter: TicketFilter): Promise<Ticket[]> {
    this.lastListFilter = filter;
    return [this.row];
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.row.id === id ? this.row : null;
  }

  async create(data: NewTicketData): Promise<Ticket> {
    this.lastCreated = data;
    return ticket({
      customer: { id: data.customerId, fullName: 'Customer', phone: null, isActive: true },
      vehicle: {
        id: data.vehicleId,
        plate: 'P001',
        bodyType: { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
        make: null,
        color: null,
        isActive: true,
        currentOwner: null,
      },
      bodyType: { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
      washers: data.washerIds.map((id) => (id === jose.id ? jose : carlos)),
    });
  }

  async update(_id: string, _changes: TicketChanges): Promise<Ticket> {
    return this.row;
  }

  async setStatus(_id: string, status: WorkOrderStatus): Promise<Ticket> {
    this.row = { ...this.row, status };
    return this.row;
  }

  async charge(_id: string, data: ChargeData): Promise<Ticket> {
    this.lastCharge = data;
    this.row = {
      ...this.row,
      status: 'PAID',
      commissionTotal: '1.00',
      payment: { method: data.method, amount: '14.00', paidAt: '2026-09-03T12:00:00.000Z' },
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

class FakeVehicleRepository implements Partial<VehicleRepository> {
  public vehicles: VehicleWithOwner[] = [];
  public createdData: NewVehicleData[] = [];
  public updatedData: { id: string; changes: VehicleChanges }[] = [];

  async findById(id: string): Promise<VehicleWithOwner | null> {
    return this.vehicles.find((v) => v.id === id) ?? null;
  }

  async findByPlate(plate: string): Promise<VehicleWithOwner | null> {
    return this.vehicles.find((v) => v.plate === plate) ?? null;
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
      currentOwner: { id: data.customerId, fullName: 'Owner', phone: null, isActive: true },
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
    return found;
  }
}

function build(
  row: Ticket = ticket(),
  activeIds?: string[],
  cashOpen = true,
  fakeVehicles = new FakeVehicleRepository(),
) {
  const tickets = new FakeTicketRepository(row, activeIds);
  const cashSessions = new FakeCashSessions(cashOpen ? ({ id: 'cash-1' } as CashSessionRecord) : null);

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

  return {
    tickets,
    fakeVehicles,
    usecases: new TicketUseCases(
      tickets,
      { listServices: async () => [mockService] } as never,
      {
        findById: async (id: string) => ({ id, fullName: 'Cliente', phone: null, isActive: true }),
        create: async (c: { fullName: string }) => ({ id: 'c-new', fullName: c.fullName, phone: null, isActive: true }),
      } as never,
      fakeVehicles as never,
      cashSessions,
    ),
  };
}

describe('TicketUseCases.setWashers', () => {
  it('reemplaza el conjunto en READY y no toca a quien abrió', async () => {
    const { usecases, tickets } = build();

    const updated = await usecases.setWashers('t1', [carlos.id, jose.id], {
      requireNonEmpty: true,
    });

    expect(updated.washer?.id).toBe(carlos.id);
    expect(updated.washers.map((washer) => washer.id)).toEqual([carlos.id, jose.id]);
    expect(tickets.row.washer?.id).toBe(carlos.id);
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

  it('rechaza un lavador inactivo', async () => {
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

  it('parte $1.00 entre dos lavadores', async () => {
    const { usecases, tickets } = build(ticket({ washers: [carlos, jose] }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(tickets.lastCharge?.entries.map((entry) => entry.amount)).toEqual([50, 50]);
  });

  it('oficina sin lavador calcula el total y no crea entradas', async () => {
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
});

describe('TicketUseCases.list (014)', () => {
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
