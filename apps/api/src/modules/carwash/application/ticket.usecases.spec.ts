import { API_ERROR_CODES } from '@elite/shared';
import type {
  CarwashEventActor,
  FloorEmployeeOption,
  Page,
  Ticket,
  TicketListPage,
  TicketWasher,
  VehicleWithOwner,
  WorkOrderStatus,
} from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { toDecimalString } from '../domain/money';
import type { NewCustomerData } from '../../customers/application/ports/customer.repository';
import type {
  NewVehicleData,
  VehicleChanges,
  VehicleRepository,
} from '../../vehicles/application/ports/vehicle.repository';
import type {
  CommissionEntryRecord,
  CommissionWashRecord,
  UnassignedCommissionRecord,
} from '../domain/commission';
import type { StatusEventRecord } from '../domain/ticket-timeline';
import { ChargeUseCases } from './charge.usecases';
import { FakePriceAuthorizer } from './testing/fake-price-authorizer';
import { InMemoryChargeRepository } from './testing/in-memory-charge.repository';
import { InMemoryLowStockEvents, InMemoryStock } from './testing/in-memory-ticket.repository';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import { InMemoryComboCatalog } from './testing/in-memory-combo-catalog';
import { TicketUseCases } from './ticket.usecases';
import type { CashSessionRecord, CashSessionRepository } from './ports/cash-session.repository';
import {
  TicketStatusChangedError,
  type CommissionRange,
  type NewTicketData,
  type PriceAuthorizationData,
  type StatusActor,
  type StatusMove,
  type TicketChanges,
  type TicketFilter,
  type TicketItemData,
  type TicketRepository,
  type TicketWrite,
} from './ports/ticket.repository';

/** Las credenciales de la 045. El guard ya las verifico: el caso de uso no las mira. */
const AUTHORIZATION = { email: 'jefe@taller.sv', password: 'x' };

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
        kind: 'SERVICE',
        serviceId: 's1',
        inventoryItemId: null,
        code: 'SRV-0003',
        name: 'Lavado',
        serviceCode: 'SRV-0003',
        serviceName: 'Lavado',
        catalogPrice: '14.00',
        unitPrice: '14.00',
        quantity: '1.000',
        total: '14.00',
        sortOrder: 0,
        priceAuthorizedBy: null,
        priceAuthorizedAt: null,
        priceReason: null,
        previousUnitPrice: null,
        comboId: null,
        comboName: null,
      },
    ],
    total: '14.00',
    washer: carlos,
    washers: [carlos],
    commissionTotal: null,
    notes: null,
    payments: [],
    charge: null,
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

  lastCreated: NewTicketData | null = null;
  lastPriceAuthorization: PriceAuthorizationData | null = null;
  lastListFilter: TicketFilter | null = null;
  /** El historial que el repositorio real escribiria (046). */
  statusEvents: StatusEventRecord[] = [];
  /** Otros lavados de la base, para la regla de uno en curso (071). */
  others: Ticket[] = [];
  /**
   * Otra pantalla que mueve el lavado entre la lectura del caso de uso y la
   * escritura (090): el repositorio real lo ve al bloquear la fila.
   */
  raceTo: WorkOrderStatus | null = null;

  /** Lo que el repositorio real mira con la fila bloqueada. */
  private lockedStatus(): WorkOrderStatus {
    if (this.raceTo !== null) this.row = { ...this.row, status: this.raceTo };

    return this.row.status;
  }

  record(
    _id: string,
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

  /** La cuenta de cobro (059) lee y reescribe el mismo lavado que este fake. */
  get(id: string): Ticket | undefined {
    return this.row.id === id ? this.row : undefined;
  }

  set(ticket: Ticket): void {
    this.row = ticket;
  }

  async list(filter: TicketFilter): Promise<Ticket[]> {
    this.lastListFilter = filter;
    return [this.row];
  }

  async listPage(): Promise<TicketListPage> {
    throw new Error('not used: TicketUseCases.listPage se prueba con InMemoryTicketRepository');
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.row.id === id ? this.row : null;
  }

  async listLines(): Promise<TicketItemData[]> {
    return [];
  }

  async create(data: NewTicketData, actor: StatusActor): Promise<TicketWrite> {
    this.lastCreated = data;
    this.record('t1', null, 'OPEN', actor);
    const customerId =
      data.customer === null ? null : 'id' in data.customer ? data.customer.id : 'c-new';
    return {
      lowStock: [],
      ticket: ticket({
        customer:
          customerId === null ? null : { id: customerId, fullName: 'Customer', phone: null },
        vehicle: {
          id: 'id' in data.vehicle ? data.vehicle.id : 'veh-new',
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
      }),
    };
  }

  async update(_id: string, changes: TicketChanges): Promise<TicketWrite> {
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

    return { ticket: this.row, lowStock: [] };
  }

  async findUnchargedOfVehicle(vehicleId: string): Promise<Ticket | null> {
    return (
      this.others.find(
        (row) =>
          row.vehicle.id === vehicleId &&
          (row.status === 'OPEN' || row.status === 'WASHING' || row.status === 'READY'),
      ) ?? null
    );
  }

  async setStatus(id: string, move: StatusMove, actor: StatusActor): Promise<Ticket> {
    const current = this.lockedStatus();
    const status = move.to;

    if (!move.from.includes(current)) throw new TicketStatusChangedError(id, current);

    this.record('t1', this.row.status, status, actor);
    this.row = { ...this.row, status, readyAt: this.readyAt };
    return this.row;
  }

  async listStatusEvents(_id: string): Promise<StatusEventRecord[]> {
    return this.statusEvents;
  }

  async authorizePrice(id: string, data: PriceAuthorizationData): Promise<Ticket> {
    const current = this.lockedStatus();

    if (current === 'PAID' || current === 'VOID') throw new TicketStatusChangedError(id, current);

    this.lastPriceAuthorization = data;
    this.row = {
      ...this.row,
      items: this.row.items.map((item) =>
        item.id === data.itemId
          ? {
              ...item,
              unitPrice: toDecimalString(data.unitPrice),
              previousUnitPrice: toDecimalString(data.previousUnitPrice),
              priceReason: data.reason,
              priceAuthorizedAt: '2026-09-20T16:00:00.000Z',
              priceAuthorizedBy: { id: data.authorizedByUserId, fullName: data.authorizedByName },
            }
          : item,
      ),
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

  async listWashingOf(employeeId: string): Promise<Ticket[]> {
    return [this.row, ...this.others].filter(
      (row) => row.status === 'WASHING' && row.washers.some((washer) => washer.id === employeeId),
    );
  }

  async replaceWashers(id: string, employeeIds: string[]): Promise<Ticket> {
    const current = this.lockedStatus();

    if (current === 'PAID' || current === 'VOID') throw new TicketStatusChangedError(id, current);

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
    return { entries: this.commissionEntries, unassigned: [] };
  }

  /** Lo que el reporte de comisiones lee (009); vacío salvo que el test siembre. */
  commissionEntries: CommissionEntryRecord[] = [];
  commissionWashes: CommissionWashRecord[] = [];

  /** El rango con el que se pidió el detalle (061). */
  lastWashesRange: CommissionRange | null = null;

  async findCommissionEmployee(
    id: string,
  ): Promise<{ id: string; fullName: string; isActive: boolean } | null> {
    const found = [carlos, jose].find((employee) => employee.id === id);

    return found === undefined
      ? null
      : { id: found.id, fullName: found.fullName, isActive: this.activeIds.includes(found.id) };
  }

  async listEmployeeCommissionWashes(
    _employeeId: string,
    range: CommissionRange,
  ): Promise<CommissionWashRecord[]> {
    this.lastWashesRange = range;

    return this.commissionWashes;
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

  async listPage(): Promise<Page<CashSessionRecord>> {
    throw new Error('not used');
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

  /** Activa o no, como la base: la placa es unica (079). */
  async findByPlate(plate: string): Promise<VehicleWithOwner | null> {
    return this.vehicles.find((v) => v.plate === plate) ?? null;
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
    category: { id: 'cat-1', name: 'Lavados', sortOrder: 1, isActive: true, isExtra: false },
    prices: [],
  };

  const events = new InMemoryTicketEvents();
  const charges = new InMemoryChargeRepository(tickets);
  const chargeUseCases = new ChargeUseCases(
    charges,
    tickets,
    cashSessions,
    events,
    new InMemoryStock(),
    new FakePriceAuthorizer(),
    new InMemoryLowStockEvents(),
    charges.bankAccounts,
  );

  return {
    tickets,
    charges,
    fakeVehicles,
    fakeCustomers,
    events,
    usecases: new TicketUseCases(
      tickets,
      { listServices: async () => [mockService] } as never,
      fakeCustomers as never,
      fakeVehicles as never,
      chargeUseCases,
      events,
      { findByIds: async () => [], listOptions: async () => [] },
      { publishLowStock: () => undefined },
      new InMemoryComboCatalog(),
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
    const { usecases, charges } = build();

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(charges.lastCreated?.tickets[0].commissionTotal).toBe(100);
    expect(charges.lastCreated?.tickets[0].entries).toEqual([
      { employeeId: carlos.id, amount: 100 },
    ]);
  });

  it('el endpoint viejo pasa cuenta y referencia de la transferencia (069 RN-8)', async () => {
    const { usecases, charges } = build();

    charges.bankAccounts.add({
      id: 'acc-1',
      bank: 'AGRICOLA',
      bankName: 'Banco Agrícola',
      type: 'CHECKING',
      number: '0012345678',
      active: true,
    });

    await usecases.charge(
      't1',
      { method: 'TRANSFER', amount: '14.00', bankAccountId: 'acc-1', reference: '998877' },
      'user-1',
    );

    expect(charges.lastCreated?.tickets[0].payments).toEqual([
      {
        method: 'TRANSFER',
        amount: 1400,
        details: { bankAccountId: 'acc-1', reference: '998877', description: null },
      },
    ]);
  });

  it('el endpoint viejo con una cuenta inactiva no cobra (069 RN-8)', async () => {
    const { usecases, charges } = build();

    charges.bankAccounts.add({
      id: 'acc-off',
      bank: 'BAC',
      bankName: 'BAC Credomatic',
      type: 'SAVINGS',
      number: '99887766',
      active: false,
    });

    const failure = await captureApiError(
      usecases.charge(
        't1',
        { method: 'TRANSFER', amount: '14.00', bankAccountId: 'acc-off', reference: '1' },
        'user-1',
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE);
    expect(charges.lastCreated).toBeNull();
  });

  it('parte $1.00 entre dos empleados', async () => {
    const { usecases, charges } = build(ticket({ washers: [carlos, jose] }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(charges.lastCreated?.tickets[0].entries.map((entry) => entry.amount)).toEqual([50, 50]);
  });

  it('oficina sin empleado calcula el total y no crea entradas', async () => {
    const { usecases, charges } = build(ticket({ washer: null, washers: [] }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(charges.lastCreated?.tickets[0].commissionTotal).toBe(100);
    expect(charges.lastCreated?.tickets[0].entries).toEqual([]);
    expect(charges.lastCreated?.cashSessionId).toBe('cash-1');
  });

  it('sin caja abierta no cobra ni congela comisión', async () => {
    const { usecases, charges } = build(ticket(), undefined, false);
    const failure = await captureApiError(
      usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1'),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.CASH_NOT_OPEN);
    expect(charges.lastCreated).toBeNull();
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

describe('TicketUseCases — un lavado en curso por empleado (071)', () => {
  const washingP002 = ticket({
    id: 't2',
    number: 'CW-0002',
    status: 'WASHING',
    washers: [carlos],
    vehicle: { ...ticket().vehicle, id: 'v2', plate: 'P002' },
  });

  function withOther(row: Ticket, other: Ticket = washingP002) {
    const built = build(row);

    built.tickets.others = [other];

    return built;
  }

  it('pista: no toma otro si ya está lavando uno', async () => {
    const { usecases, tickets } = withOther(ticket({ status: 'OPEN', washers: [carlos] }));

    const failure = await captureApiError(usecases.start('t1', carlos.id));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.EMPLOYEE_ALREADY_WASHING);
    expect(failure.body.message).toBe('Ya estás lavando P002. Marcalo listo antes de tomar otro.');
    expect(failure.body.details).toEqual({
      ticketId: 't2',
      number: 'CW-0002',
      plate: 'P002',
      employeeId: carlos.id,
    });
    expect(tickets.row.status).toBe('OPEN');
  });

  it('pista: toma si lo que tiene de otros es cola o listo', async () => {
    const { usecases } = withOther(ticket({ status: 'OPEN', washers: [carlos] }), {
      ...washingP002,
      status: 'READY',
    });

    const updated = await usecases.start('t1', carlos.id);

    expect(updated.status).toBe('WASHING');
  });

  it('pista: el lavado de otro empleado no lo frena', async () => {
    const { usecases } = withOther(ticket({ status: 'OPEN', washers: [carlos] }), {
      ...washingP002,
      washers: [jose],
    });

    const updated = await usecases.start('t1', carlos.id);

    expect(updated.status).toBe('WASHING');
  });

  it.each(['OPEN', 'READY'] as const)(
    'oficina: %s -> WASHING se rechaza si el asignado ya lava otro',
    async (from) => {
      const { usecases, tickets } = withOther(ticket({ status: from, washers: [carlos] }));

      const failure = await captureApiError(usecases.setOperationalStatus('t1', 'WASHING'));

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.EMPLOYEE_ALREADY_WASHING);
      expect(failure.body.message).toBe(
        'Carlos VIS ya está lavando P002. Marcalo listo o pasalo a cola primero.',
      );
      expect(tickets.row.status).toBe(from);
    },
  );

  it('oficina: sin asignado pasa a WASHING igual', async () => {
    const { usecases } = withOther(ticket({ status: 'OPEN', washer: null, washers: [] }));

    const updated = await usecases.setOperationalStatus('t1', 'WASHING');

    expect(updated.status).toBe('WASHING');
  });

  it('oficina: mover a cola o listo no se frena', async () => {
    const { usecases } = withOther(ticket({ status: 'WASHING', washers: [carlos] }));

    expect((await usecases.setOperationalStatus('t1', 'READY')).status).toBe('READY');
  });

  it('cambio de asignado: no pasa uno en WASHING a quien ya lava otro', async () => {
    const { usecases } = withOther(ticket({ status: 'WASHING', washers: [jose] }));

    const failure = await captureApiError(
      usecases.setWashers('t1', [carlos.id], { requireNonEmpty: false }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.EMPLOYEE_ALREADY_WASHING);
  });

  it('cambio de asignado: en cola sí se le puede sumar', async () => {
    const { usecases } = withOther(ticket({ status: 'OPEN', washers: [jose] }));

    const updated = await usecases.setWashers('t1', [carlos.id], { requireNonEmpty: false });

    expect(updated.washers.map((washer) => washer.id)).toEqual([carlos.id]);
  });

  it('cambio de asignado: el mismo lavado no cuenta contra sí mismo', async () => {
    const { usecases } = build(ticket({ status: 'WASHING', washers: [carlos] }));

    const updated = await usecases.setWashers('t1', [carlos.id], { requireNonEmpty: false });

    expect(updated.washers.map((washer) => washer.id)).toEqual([carlos.id]);
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
        combos: [],
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
        combos: [],
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
        combos: [],
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
        combos: [],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(created).toBeDefined();
    // La ficha viaja al alta y nace en su transaccion (079): el caso de uso no la escribe.
    expect(fakeVehicles.createdData).toHaveLength(0);
    expect(tickets.lastCreated?.vehicle).toEqual({
      create: { plate: 'PNEW-001', bodyTypeId: 'b1', make: 'Toyota', color: 'Blanco' },
    });
    expect(tickets.lastCreated?.customer).toEqual({ id: 'c1' });
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
        combos: [],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(created).toBeDefined();
    expect(tickets.lastCreated?.vehicle).toEqual({ id: existingVehicle.id, claimOwner: false });
    expect(tickets.lastCreated?.bodyTypeId).toBe('b1');
    expect(tickets.lastCreated?.customer).toEqual({ id: 'c-old' });
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
          combos: [],
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
          combos: [],
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
          combos: [],
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
        combos: [],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(tickets.lastCreated?.customer).toBeNull();
    expect(fakeCustomers.createdData).toHaveLength(0);
    expect(fakeVehicles.createdData).toHaveLength(0);
    expect(tickets.lastCreated?.vehicle).toEqual({
      create: { plate: 'P040-001', bodyTypeId: 'b1' },
    });
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
        combos: [],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(tickets.lastCreated?.customer).toEqual({ id: 'c-old' });
    expect(tickets.lastCreated?.vehicle).toEqual({ id: existing.id, claimOwner: false });
    expect(fakeVehicles.updatedData).toHaveLength(0);
  });

  it('placa conocida sin responsable lo toma en el alta, no antes (079)', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const existing = await fakeVehicles.create({ plate: 'P079-001', bodyTypeId: 'b1' });
    const fakeCustomers = new FakeCustomerRepository();
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles, fakeCustomers);

    await usecases.create(
      {
        vehicleId: existing.id,
        customer: { fullName: 'Ana' },
        items: [{ serviceId: 'srv-1' }],
        combos: [],
      },
      { kind: 'employee', employeeId: carlos.id },
    );

    expect(tickets.lastCreated?.customer).toEqual({ create: { fullName: 'Ana' } });
    expect(tickets.lastCreated?.vehicle).toEqual({ id: existing.id, claimOwner: true });
    expect(fakeCustomers.createdData).toHaveLength(0);
    expect(fakeVehicles.updatedData).toHaveLength(0);
  });

  it('TICKET_INCOMPLETE sale antes de escribir nada (079)', async () => {
    const fakeVehicles = new FakeVehicleRepository();
    const fakeCustomers = new FakeCustomerRepository();
    const { usecases, tickets } = build(ticket(), undefined, true, fakeVehicles, fakeCustomers);

    const failure = await captureApiError(
      usecases.create(
        {
          customer: { fullName: 'Ana' },
          vehicle: { plate: 'P079-002' },
          items: [{ serviceId: 'srv-1' }],
          combos: [],
        },
        { kind: 'employee', employeeId: carlos.id },
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_INCOMPLETE);
    expect(failure.body.details).toEqual({ missing: ['vehicleId', 'bodyTypeId'] });
    expect(fakeCustomers.createdData).toHaveLength(0);
    expect(fakeVehicles.createdData).toHaveLength(0);
    expect(tickets.lastCreated).toBeNull();
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
    const { usecases, tickets, charges } = build(ticket({ status: 'READY', customer: null }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'user-1');

    expect(charges.lastCreated?.tickets[0].payments[0].method).toBe('CASH');
    expect(tickets.row.status).toBe('PAID');
    expect(tickets.row.customer).toBeNull();
  });
});

describe('TicketUseCases.employeeCommissions (061)', () => {
  it('un empleado que no existe es 404', async () => {
    const { usecases } = build();

    const error = await captureApiError(
      usecases.employeeCommissions('00000000-0000-4000-8000-000000000000', {
        page: 1,
        pageSize: 25,
      }),
    );

    expect(error.status).toBe(404);
    expect(error.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('pide el rango tal cual y devuelve el detalle aunque esté vacío', async () => {
    const { usecases, tickets } = build();

    const detail = await usecases.employeeCommissions(carlos.id, {
      from: '2026-09-01',
      to: '2026-09-26',
      page: 1,
      pageSize: 25,
    });

    expect(tickets.lastWashesRange).toEqual({ from: '2026-09-01', to: '2026-09-26' });
    expect(detail).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-26',
      employee: { id: carlos.id, fullName: carlos.fullName, isActive: true },
      ticketCount: 0,
      commission: '0.00',
      washes: { items: [], page: 1, pageSize: 25, total: 0 },
    });
  });
});

describe('TicketUseCases comisiones paginadas (102)', () => {
  function entry(employeeId: string, fullName: string, workOrderId: string, amount: number) {
    return {
      employeeId,
      fullName,
      isActive: true,
      amount,
      workOrderId,
      ticketTotal: 2000,
      washerCount: 1,
      washerIndex: 0,
    };
  }

  it('la página corta las filas; el total a pagar es de todos', async () => {
    const { usecases, tickets } = build();
    tickets.commissionEntries = [
      entry('e1', 'Ana', 'w1', 300),
      entry('e2', 'Beto', 'w2', 200),
      entry('e3', 'Carla', 'w3', 100),
    ];

    const report = await usecases.listCommissions({ page: 2, pageSize: 2 });

    expect(report.employees).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(report.employees.items.map((row) => row.employeeId)).toEqual(['e3']);
    expect(report.totalPayable).toBe('6.00');
  });

  it('el detalle pagina los lavados y suma todos', async () => {
    const { usecases, tickets } = build();
    tickets.commissionWashes = ['w1', 'w2', 'w3'].map((id, index) => ({
      ...entry(carlos.id, carlos.fullName, id, 200),
      ticketNumber: `CW-000${index + 1}`,
      chargedAt: new Date(Date.UTC(2026, 8, 20 + index)),
      plate: 'P1',
    }));

    const detail = await usecases.employeeCommissions(carlos.id, { page: 1, pageSize: 2 });

    expect(detail.washes).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(detail.washes.items.map((line) => line.workOrderId)).toEqual(['w3', 'w2']);
    expect(detail).toMatchObject({ ticketCount: 3, commission: '6.00' });
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
        combos: [],
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
    const { usecases, events } = build(ticket({ status: 'READY' }));

    await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'u-ana', ana);
    await usecases.reverse('t1', 'Cobro duplicado.', ana);

    expect(events.types).toEqual(['ticket.charged', 'ticket.reversed']);
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
    const { usecases, events, charges } = build();

    jest.spyOn(events, 'publish').mockImplementation(() => {
      throw new Error('el bus explotó');
    });

    await expect(
      usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'u-ana'),
    ).resolves.toMatchObject({ status: 'PAID' });
    expect(charges.lastCreated).not.toBeNull();
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
        combos: [],
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
    await usecases.reverse('t1', 'se equivocó de ticket', ana);

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

    await expect(usecases.timeline('t1')).resolves.toEqual({
      segments: [],
      priceChanges: [],
      recorded: false,
    });
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

describe('TicketUseCases.authorizePrice (060)', () => {
  const jefe = { id: 'u-jefe', fullName: 'Jefe' };

  it('guarda el precio nuevo con su firma y el precio anterior', async () => {
    const { usecases, tickets } = build(ticket({ status: 'READY' }));

    const updated = await usecases.authorizePrice(
      't1',
      'i1',
      { unitPrice: '10.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
      jefe,
    );

    expect(updated.items[0]).toMatchObject({
      unitPrice: '10.00',
      previousUnitPrice: '14.00',
      priceReason: 'Cliente frecuente',
      priceAuthorizedBy: { id: 'u-jefe', fullName: 'Jefe' },
    });
    expect(tickets.lastPriceAuthorization?.authorizedByName).toBe('Jefe');
  });

  it('un servicio se puede subir por encima del catálogo con la firma (087)', async () => {
    const { usecases, tickets } = build(ticket({ status: 'READY' }));

    const updated = await usecases.authorizePrice(
      't1',
      'i1',
      { unitPrice: '20.00', reason: 'Carro muy sucio', authorization: AUTHORIZATION },
      jefe,
    );

    expect(updated.items[0]).toMatchObject({ unitPrice: '20.00', previousUnitPrice: '14.00' });
    expect(tickets.lastPriceAuthorization?.unitPrice).toBe(2000);
  });

  it('un producto no se sube por encima de su precio (087)', async () => {
    const base = ticket({ status: 'READY' });
    const [line] = base.items;

    if (line === undefined) throw new Error('fixture sin línea');

    const product = {
      ...line,
      kind: 'PRODUCT' as const,
      serviceId: null,
      inventoryItemId: 'inv-1',
      catalogPrice: '3.00',
      unitPrice: '3.00',
      total: '3.00',
    };
    const { usecases, tickets } = build({ ...base, items: [product] });

    const failure = await captureApiError(
      usecases.authorizePrice(
        't1',
        'i1',
        { unitPrice: '4.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
        jefe,
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.PRICE_ABOVE_CATALOG);
    expect(tickets.lastPriceAuthorization).toBeNull();
  });

  it('un lavado ya cobrado no cambia de precio: primero se deshace el cobro', async () => {
    const { usecases } = build(ticket({ status: 'PAID' }));

    const failure = await captureApiError(
      usecases.authorizePrice(
        't1',
        'i1',
        { unitPrice: '10.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
        jefe,
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_ALREADY_CHARGED);
  });

  it('una línea que no es del lavado es 404', async () => {
    const { usecases } = build(ticket({ status: 'READY' }));

    const failure = await captureApiError(
      usecases.authorizePrice(
        't1',
        'i9',
        { unitPrice: '10.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
        jefe,
      ),
    );

    expect(failure.status).toBe(404);
  });

  it('avisa que el lavado cambió, para el tablero (042)', async () => {
    const { usecases, events } = build(ticket({ status: 'READY' }));

    await usecases.authorizePrice(
      't1',
      'i1',
      { unitPrice: '10.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
      jefe,
      { kind: 'user', id: 'u-ana', name: 'Ana' },
    );

    expect(events.types).toEqual(['ticket.updated']);
  });
});

describe('TicketUseCases.update — el precio se cierra al quedar listo (060 RN-1)', () => {
  it('con el lavado abierto, recepción rebaja sin autorización', async () => {
    const { usecases } = build(ticket({ status: 'OPEN' }));

    await expect(
      usecases.update('t1', { items: [{ serviceId: 'srv-1', unitPrice: '10.00' }] }),
    ).resolves.toBeDefined();
  });

  it('desde listo, una edición con precio rebajado pide autorización', async () => {
    const { usecases } = build(ticket({ status: 'READY' }));

    const failure = await captureApiError(
      usecases.update('t1', { items: [{ serviceId: 'srv-1', unitPrice: '10.00' }] }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.PRICE_CHANGE_NOT_AUTHORIZED);
  });

  it('desde listo, una edición sin precios sigue siendo «ya no se puede editar»', async () => {
    const { usecases } = build(ticket({ status: 'READY' }));

    const failure = await captureApiError(
      usecases.update('t1', { items: [{ serviceId: 'srv-1' }] }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_OPEN);
  });
});

describe('Frenos del ciclo del lavado (090)', () => {
  const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };
  const jefe = { id: 'u-jefe', fullName: 'Jefe' };

  /** Un carro conocido y un lavado suyo, en `status`, que ya está en la base. */
  async function withKnownCar(status: WorkOrderStatus) {
    const fakeVehicles = new FakeVehicleRepository();
    const car = await fakeVehicles.create({ plate: 'P123-132', bodyTypeId: 'b1' });
    const built = build(ticket(), undefined, true, fakeVehicles);

    built.tickets.others = [
      ticket({ id: 't2', number: 'CW-0002', status, vehicle: { ...car, lastWash: null } }),
    ];

    return { ...built, car };
  }

  describe('un carro, un lavado sin cobrar', () => {
    it.each(['OPEN', 'WASHING', 'READY'] as const)(
      'con uno en %s, el alta por vehicleId responde 409 y no crea nada',
      async (status) => {
        const { usecases, tickets, car } = await withKnownCar(status);

        const failure = await captureApiError(
          usecases.create(
            { vehicleId: car.id, items: [{ serviceId: 'srv-1' }], combos: [] },
            { kind: 'employee', employeeId: carlos.id },
          ),
        );

        expect(failure.status).toBe(409);
        expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_HAS_ACTIVE_TICKET);
        expect(failure.body.message).toBe('P123-132 ya tiene un lavado sin cobrar (#2).');
        expect(failure.body.details).toEqual({
          ticketId: 't2',
          number: 'CW-0002',
          plate: 'P123-132',
          status,
        });
        expect(tickets.lastCreated).toBeNull();
      },
    );

    it('con la placa tecleada responde lo mismo, no la ficha para confirmar', async () => {
      const { usecases, tickets } = await withKnownCar('OPEN');

      const failure = await captureApiError(
        usecases.create(
          {
            vehicle: { plate: 'P123-132', bodyTypeId: 'b1' },
            items: [{ serviceId: 'srv-1' }],
            combos: [],
          },
          { kind: 'user', userId: 'u-ana' },
        ),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_HAS_ACTIVE_TICKET);
      expect(tickets.lastCreated).toBeNull();
    });

    it.each(['PAID', 'VOID'] as const)(
      'con el anterior en %s, se abre como siempre',
      async (status) => {
        const { usecases, tickets, car } = await withKnownCar(status);

        await usecases.create(
          { vehicleId: car.id, items: [{ serviceId: 'srv-1' }], combos: [] },
          { kind: 'employee', employeeId: carlos.id },
        );

        expect(tickets.lastCreated?.vehicle).toEqual({ id: car.id, claimOwner: false });
      },
    );

    it('no se deshace un cobro si el carro volvió y tiene otro sin cobrar', async () => {
      const { usecases, tickets } = build(ticket({ status: 'READY' }));

      await usecases.charge('t1', { method: 'CASH', amount: '14.00' }, 'u-ana', ana);
      tickets.others = [ticket({ id: 't2', number: 'CW-0002', status: 'OPEN' })];

      const failure = await captureApiError(usecases.reverse('t1', 'Cobro duplicado.', ana));

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_HAS_ACTIVE_TICKET);
      expect(failure.body.message).toBe(
        'P001 ya tiene un lavado sin cobrar (#2). Cobralo o anulalo antes de deshacer este cobro.',
      );
      expect(tickets.row.status).toBe('PAID');
    });
  });

  describe('el estado se revisa al guardar', () => {
    it('anular un lavado que otra caja acaba de cobrar: 409 y queda cobrado', async () => {
      const { usecases, tickets } = build(ticket({ status: 'READY' }));

      tickets.raceTo = 'PAID';

      const failure = await captureApiError(usecases.voidWithReason('t1', 'Error.', ana));

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_VOIDABLE);
      expect(tickets.row.status).toBe('PAID');
      expect(tickets.statusEvents).toHaveLength(0);
    });

    it('marcar listo un lavado que ya anularon: el mismo 409 de siempre', async () => {
      const { usecases, tickets } = build(ticket({ status: 'WASHING' }));

      tickets.raceTo = 'VOID';

      const failure = await captureApiError(usecases.transition('t1', 'ready', ana));

      expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_OPEN);
      expect(failure.body.message).toBe(
        'Solo se marca listo un lavado abierto o que se está lavando.',
      );
      expect(tickets.row.status).toBe('VOID');
    });

    it('oficina pasa a cola un lavado que se cobra al mismo tiempo: queda cobrado', async () => {
      const { usecases, tickets } = build(ticket({ status: 'READY' }));

      tickets.raceTo = 'PAID';

      const failure = await captureApiError(usecases.setOperationalStatus('t1', 'OPEN', ana));

      expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_STATUS_LOCKED);
      expect(tickets.row.status).toBe('PAID');
    });

    it('oficina y pista lo llevan al mismo estado: el segundo recibe «ya está»', async () => {
      const { usecases, tickets } = build(ticket({ status: 'OPEN', washers: [] }));

      tickets.raceTo = 'READY';

      const failure = await captureApiError(usecases.setOperationalStatus('t1', 'READY', ana));

      expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_ALREADY_IN_STATUS);
    });

    it('cambiar el precio de uno que acaban de cobrar: 409 y el precio no cambia', async () => {
      const { usecases, tickets } = build(ticket({ status: 'READY' }));

      tickets.raceTo = 'PAID';

      const failure = await captureApiError(
        usecases.authorizePrice(
          't1',
          'i1',
          { unitPrice: '10.00', reason: 'Cliente frecuente', authorization: AUTHORIZATION },
          jefe,
        ),
      );

      expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_ALREADY_CHARGED);
      expect(tickets.lastPriceAuthorization).toBeNull();
    });

    it('cambiar al asignado de uno que acaban de cobrar: 409 WASHERS_LOCKED', async () => {
      const { usecases, tickets } = build(ticket({ status: 'READY' }));

      tickets.raceTo = 'PAID';

      const failure = await captureApiError(
        usecases.setWashers('t1', [jose.id], { requireNonEmpty: true }),
      );

      expect(failure.body.code).toBe(API_ERROR_CODES.WASHERS_LOCKED);
      expect(tickets.row.washers).toEqual([carlos]);
    });
  });
});
