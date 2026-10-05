import { API_ERROR_CODES, isServiceTicketItem } from '@elite/shared';
import type {
  ApiErrorCode,
  AuthorizePriceInput,
  ComboOption,
  CarwashEventActor,
  CarwashEventType,
  CommissionEmployeeDetail,
  CommissionReport,
  CommissionsQuery,
  CreateFloorTicketInput,
  CreateOfficeTicketInput,
  ChargeTicketInput,
  FloorEmployeeOption,
  InventoryItemOption,
  SetTicketResponsibleInput,
  SetTicketStatusInput,
  Ticket,
  TicketComboInput,
  TicketListPage,
  TicketsQuery,
  TicketItemInput,
  TicketTimeline,
  UpdateTicketInput,
} from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import type { ActionAuthorizer } from '../../../common/auth/authenticated-user';
import { slicePage } from '../../../common/pagination/page';
import type { CustomerRepository } from '../../customers/application/ports/customer.repository';
import {
  publishLowStock,
  type LowStockPublisher,
} from '../../inventory/application/ports/low-stock-events';
import type { ServiceCatalogRepository } from '../../services/application/ports/service-catalog.repository';
import type {
  NewVehicleData,
  VehicleRepository,
} from '../../vehicles/application/ports/vehicle.repository';
import {
  buildCommissionReport,
  buildEmployeeCommissionDetail,
  resolveCommissionRange,
} from '../domain/commission';
import { eventTypeFor } from '../domain/carwash-event';
import { toCents } from '../domain/money';
import { needsPriceAuthorization, rejectPrice, rejectServicePrice } from '../domain/pricing';
import { buildTimeline } from '../domain/ticket-timeline';
import {
  canEditWashers,
  canSetOperationalStatus,
  isOperationalStatus,
  isOwnedByEmployee,
  missingFieldsOf,
  nextStatus,
  operationalSourcesOf,
  sourcesOf,
} from '../domain/work-order';
import type { WorkOrderAction, WorkOrderStatus } from '../domain/work-order';
import { signed } from './authorized-note';
import {
  buildComboLines,
  buildTicketLines,
  orderTicketLines,
  productIdsOf,
} from './build-ticket-items';
import type { ChargeUseCases } from './charge.usecases';
import type { ComboCatalog, TicketComboRecord } from './ports/combo-catalog';
import type { InventoryCatalog } from './ports/inventory-catalog';
import type { TicketEventsPublisher } from './ports/ticket-events';
import {
  TicketStatusChangedError,
  type TicketFilter,
  type TicketRepository,
  type NewTicketData,
  type TicketChanges,
  type TicketIntakeCustomer,
  type TicketItemData,
  type TicketWrite,
} from './ports/ticket.repository';
import { publishTicketEvent } from './publish-ticket-event';
import { stockFailure } from './stock-failure';
import { vehicleBusy } from './vehicle-busy';

/** Quien abre el ticket. La pista pone empleado; la oficina, usuario. */
export type Opener =
  { kind: 'employee'; employeeId: string } | { kind: 'user'; userId: string; employeeId?: string };

/**
 * El vehiculo del alta antes de escribir (079): una ficha conocida (`id`) o
 * una a crear con el lavado (`create`), y el dueno que ya tiene.
 */
type IntakeVehicle =
  | { id: string; create: null; bodyTypeId: string; ownerId: string | null }
  | {
      id: null;
      create: Omit<NewVehicleData, 'customerId'>;
      bodyTypeId: string;
      ownerId: null;
    };

/** Una busqueda vacia o solo con espacios no filtra (014). */
function trimmedSearch(q: string | undefined): string | undefined {
  const trimmed = q?.trim();

  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * Casos de uso de tickets, compartidos por las dos vistas.
 *
 * Que la pista y la oficina usen el mismo codigo es deliberado: las diferencias
 * entre ellas son **quien** puede llamar y **con que datos**, no como se calcula
 * un precio ni que transiciones existen. Duplicarlo garantizaria que un dia
 * cobren distinto por lo mismo.
 */
export class TicketUseCases {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly catalog: ServiceCatalogRepository,
    private readonly customers: CustomerRepository,
    private readonly vehicles: VehicleRepository,
    private readonly charges: ChargeUseCases,
    private readonly events: TicketEventsPublisher,
    private readonly inventory: InventoryCatalog,
    private readonly lowStock: LowStockPublisher,
    private readonly combos: ComboCatalog,
  ) {}

  /**
   * Una escritura que puede mover inventario (065): traduce lo que el kardex
   * rechazo y, ya confirmada, avisa los minimos que cruzo (RN-13). El aviso va
   * despues del commit: uno de algo que se deshizo no se manda.
   */
  private async writeWithStock(
    write: () => Promise<TicketWrite>,
    actor: CarwashEventActor | null,
  ): Promise<Ticket> {
    let result: TicketWrite;

    try {
      result = await write();
    } catch (error) {
      throw stockFailure(error);
    }

    publishLowStock(this.lowStock, result.lowStock, actor);

    return result.ticket;
  }

  /**
   * Resuelve las lineas pedidas contra los dos catalogos: servicios con su
   * matriz de precios y productos del inventario (065). Un solo lugar decide
   * cuanto cuesta una linea, para las dos entradas.
   */
  private async resolveLines(
    requested: readonly TicketItemInput[],
    bodyTypeId: string,
  ): Promise<TicketItemData[]> {
    const productIds = productIdsOf(requested);
    const [services, products] = await Promise.all([
      this.catalog.listServices(true),
      productIds.length === 0 ? Promise.resolve([]) : this.inventory.findByIds(productIds),
    ]);

    return buildTicketLines(requested, services, products, bodyTypeId);
  }

  /** Los combos que valen hoy, para la tarjeta del alta (104, oficina y pista). */
  listCombos(): Promise<ComboOption[]> {
    return this.combos.listAvailable();
  }

  /**
   * Los combos que pide un alta o que se agregan en una edicion (104): sin
   * repetir (`DUPLICATE_COMBO`) y cada uno disponible hoy
   * (`COMBO_NOT_AVAILABLE`, criterio 3). En el orden pedido.
   */
  private async availableCombos(
    requested: readonly TicketComboInput[],
  ): Promise<TicketComboRecord[]> {
    const ids = requested.map((combo) => combo.comboId);

    rejectDuplicateCombos(ids);

    if (ids.length === 0) return [];

    const found = new Map((await this.combos.findByIds(ids)).map((combo) => [combo.id, combo]));

    return ids.map((id) => {
      const combo = found.get(id);

      if (combo === undefined || !combo.availableToday) throw comboNotAvailable(id, combo);

      return combo;
    });
  }

  /**
   * Las lineas que deja una edicion de un lavado `OPEN` (104 criterio 8), o
   * `null` si la edicion no toca lineas.
   *
   * - `items` trae **solo** las lineas sueltas y reemplaza solo esas; sin
   *   `items`, las sueltas guardadas quedan como estan.
   * - `combos`, si viene, es la lista completa de combos del lavado: uno que ya
   *   estaba conserva sus lineas guardadas (snapshot, aunque el combo se haya
   *   editado, pausado o vencido); uno nuevo tiene que valer hoy y se expande;
   *   los que no vienen se quitan. Sin `combos`, quedan los que habia.
   * - Si cambia el tipo de carro, todo combo que ya estaba se vuelve a
   *   expandir con su precio actual para el tipo nuevo, este disponible o no.
   *
   * Las lineas de combo no pasan por `repriceForBodyType`: se re-expanden
   * enteras o se conservan, nunca se recotizan linea por linea.
   */
  private async editedLines(
    ticket: Ticket,
    input: UpdateTicketInput,
    bodyTypeId: string,
  ): Promise<TicketItemData[] | null> {
    const bodyTypeChanged = bodyTypeId !== ticket.bodyType.id;
    const hasComboLines = ticket.items.some((item) => item.comboId !== null);

    if (
      input.items === undefined &&
      input.combos === undefined &&
      !(bodyTypeChanged && hasComboLines)
    ) {
      return null;
    }

    const stored = await this.tickets.listLines(ticket.id);
    const storedComboIds = [
      ...new Set(stored.flatMap((line) => (line.comboId === null ? [] : [line.comboId]))),
    ];
    const onTicket = new Set(storedComboIds);
    const wanted = input.combos?.map((combo) => combo.comboId) ?? storedComboIds;

    rejectDuplicateCombos(wanted);

    // Lo que hay que leer del catalogo: los nuevos y, si cambio el tipo, todos.
    const toExpand = wanted.filter((id) => bodyTypeChanged || !onTicket.has(id));
    const found =
      toExpand.length === 0
        ? new Map<string, TicketComboRecord>()
        : new Map((await this.combos.findByIds(toExpand)).map((combo) => [combo.id, combo]));

    const comboGroups = wanted.map((id) => {
      if (onTicket.has(id) && !bodyTypeChanged) {
        return stored.filter((line) => line.comboId === id);
      }

      const combo = found.get(id);

      // Uno que ya estaba se re-expande aunque este pausado o vencido; uno
      // nuevo tiene que valer hoy.
      if (combo === undefined || (!onTicket.has(id) && !combo.availableToday)) {
        throw comboNotAvailable(id, combo);
      }

      return buildComboLines(combo, bodyTypeId);
    });

    const standalone =
      input.items === undefined
        ? stored.filter((line) => line.comboId === null)
        : await this.resolveLines(input.items, bodyTypeId);

    return orderTicketLines(standalone, comboGroups);
  }

  /** Productos activos para el selector del lavado y de la venta suelta (065 RN-17). */
  listInventoryItems(search?: string): Promise<InventoryItemOption[]> {
    const trimmed = search?.trim();

    return this.inventory.listOptions(
      trimmed === undefined || trimmed === '' ? undefined : trimmed,
    );
  }

  private emit(
    type: CarwashEventType,
    ticket: Ticket,
    previousStatus: WorkOrderStatus | null,
    actor: CarwashEventActor | null,
  ): void {
    publishTicketEvent(this.events, { type, ticket, previousStatus, actor });
  }

  list(filter: TicketFilter): Promise<Ticket[]> {
    return this.tickets.list({ ...filter, q: trimmedSearch(filter.q) });
  }

  /** `GET /carwash/tickets` (102): una pagina, con resumen y opciones de filtro. */
  listPage(query: TicketsQuery): Promise<TicketListPage> {
    return this.tickets.listPage({
      statuses: query.status === undefined || query.status.length === 0 ? undefined : query.status,
      date: query.date,
      customerId: query.customerId,
      q: trimmedSearch(query.q),
      bodyTypeId: query.bodyTypeId,
      serviceId: query.serviceId,
      washerId: query.washerId,
      payment: query.payment,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);

    if (ticket === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese lavado no existe.',
      });
    }

    return ticket;
  }

  /**
   * Abre un ticket. Cliente y vehiculo pueden venir por id o crearse al vuelo:
   * en la pista, con el carro esperando, mandar al empleado a otra pantalla a
   * dar de alta al cliente no es viable (RN-7).
   */
  async create(
    input: CreateFloorTicketInput | CreateOfficeTicketInput,
    opener: Opener,
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const employeeId = opener.employeeId;
    const washerIds = employeeId === undefined ? [] : [employeeId];

    await this.requireActiveEmployees(washerIds);

    // Todo lo que sigue hasta `tickets.create` solo lee: cliente, vehiculo y
    // lavado se escriben juntos o ninguno (079). Un 409 de placa o un 422 de
    // datos faltantes no dejan nada.
    let vehicle: IntakeVehicle | null = null;

    if (input.vehicleId) {
      vehicle = await this.resolveVehicleById(input.vehicleId);
      if (vehicle !== null && vehicle.id !== null) await this.rejectUncharged(vehicle.id);
    } else {
      await this.rejectTakenPlate(input);
      vehicle = newVehicleOf(input);
    }

    // Los combos se validan antes de la completitud: sus servicios cuentan
    // para que el lavado este completo (104 criterio 6).
    const combos = await this.availableCombos(input.combos);
    const check = missingFieldsOf({
      vehicle,
      bodyTypeId: vehicle?.bodyTypeId ?? null,
      serviceIds: [
        ...input.items.filter(isServiceTicketItem).map((item) => item.serviceId),
        ...combos.flatMap((combo) =>
          combo.components.flatMap((component) =>
            component.serviceId === null ? [] : [component.serviceId],
          ),
        ),
      ],
    });

    if (!check.ok) {
      throw new ValidationError({
        code: API_ERROR_CODES.TICKET_INCOMPLETE,
        message: 'Faltan datos para abrir el lavado.',
        details: { missing: check.missing },
      });
    }

    const { draft } = check;
    // El dueno que el carro ya tiene manda y no se pisa (040): el cliente del
    // cuerpo ni se busca ni se crea.
    const customer: TicketIntakeCustomer =
      draft.vehicle.ownerId === null
        ? await this.intakeCustomer(input)
        : { id: draft.vehicle.ownerId };
    const items = orderTicketLines(
      await this.resolveLines(input.items, draft.bodyTypeId),
      combos.map((combo) => buildComboLines(combo, draft.bodyTypeId)),
    );

    const data: NewTicketData = {
      customer,
      vehicle:
        draft.vehicle.id === null
          ? { create: draft.vehicle.create }
          : {
              id: draft.vehicle.id,
              claimOwner: draft.vehicle.ownerId === null && customer !== null,
            },
      bodyTypeId: draft.bodyTypeId,
      notes: input.notes,
      openedByEmployeeId: employeeId ?? null,
      openedByUserId: opener.kind === 'user' ? opener.userId : null,
      items,
      washerIds,
    };

    const created = await this.writeWithStock(() => this.tickets.create(data, actor), actor);

    this.emit('ticket.created', created, null, actor);

    return created;
  }

  /**
   * Edicion de un ticket. Servicios y tipo solo en OPEN (RN-9). La nota se
   * puede guardar en OPEN, WASHING y READY: quien lava y quien cobra la dejan
   * para la próxima visita (041).
   */
  async update(
    id: string,
    input: UpdateTicketInput,
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const notesOnly =
      input.notes !== undefined &&
      input.items === undefined &&
      input.combos === undefined &&
      input.bodyTypeId === undefined;

    if (notesOnly && input.notes !== undefined) {
      const ticket = await this.findById(id);

      if (!isOperationalStatus(ticket.status)) {
        throw new ConflictError({
          code: API_ERROR_CODES.TICKET_NOT_OPEN,
          message: 'Ese lavado ya no se puede anotar.',
        });
      }

      const { ticket: noted } = await this.tickets.update(id, { notes: emptyNotes(input.notes) });

      this.emit('ticket.updated', noted, null, actor);

      return noted;
    }

    const ticket = await this.findById(id);
    const bodyTypeId = input.bodyTypeId ?? ticket.bodyType.id;

    if (ticket.status !== 'OPEN') {
      await this.rejectClosedPrice(ticket, input, bodyTypeId);

      throw new ConflictError({
        code: API_ERROR_CODES.TICKET_NOT_OPEN,
        message: 'Ese lavado ya no se puede editar.',
      });
    }

    const changes: TicketChanges = {};

    if (input.bodyTypeId !== undefined) changes.bodyTypeId = input.bodyTypeId;
    if (input.notes !== undefined) changes.notes = emptyNotes(input.notes);

    const items = await this.editedLines(ticket, input, bodyTypeId);

    if (items !== null) changes.items = items;

    const updated = await this.writeWithStock(() => this.tickets.update(id, changes, actor), actor);

    this.emit('ticket.updated', updated, null, actor);

    return updated;
  }

  /**
   * `start` en pista: OPEN → WASHING. Solo el asignado (036). Un ticket sin
   * asignar o de otro responde igual que si no existiera.
   */
  async start(
    id: string,
    employeeId: string,
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const ticket = await this.requireOwnedByEmployee(id, employeeId);

    if (ticket.status === 'OPEN') {
      await this.rejectAlreadyWashing(id, [employeeId], 'self');
    }

    return this.transition(id, 'start', actor);
  }

  /**
   * Pista: el lavado tiene que ser del empleado de la sesión. Si no, 404
   * con el mismo texto que un id inexistente: no se filtra que el de otro
   * existe (036).
   */
  async requireOwnedByEmployee(id: string, employeeId: string): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (!isOwnedByEmployee(ticket.washers, employeeId)) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese lavado no existe.',
      });
    }

    return ticket;
  }

  /** `ready`, `reopen`, `start` y `void`: las transiciones que no cobran (RN-9). */
  async voidWithReason(
    id: string,
    reason: string,
    actor: CarwashEventActor | null = null,
    authorizedBy: string | null = null,
  ): Promise<Ticket> {
    const { previousStatus } = await this.runTransition(id, 'void', actor);
    // El evento sale despues de la nota: el motivo es lo primero que se lee en
    // el aviso, y con el ticket de la transicion todavia no esta escrito.
    const voided = await this.tickets.appendNote(id, signed(`Anulado: ${reason}`, authorizedBy));

    this.emit('ticket.voided', voided, previousStatus, actor);

    return voided;
  }

  async transition(
    id: string,
    action: Exclude<WorkOrderAction, 'charge' | 'reverse'>,
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const { ticket, previousStatus } = await this.runTransition(id, action, actor);

    this.emit(eventTypeFor(action), ticket, previousStatus, actor);

    return ticket;
  }

  /**
   * Mueve el estado sin avisar. Existe para `voidWithReason`, que necesita
   * anotar el motivo antes de que salga el evento.
   */
  private async runTransition(
    id: string,
    action: Exclude<WorkOrderAction, 'charge' | 'reverse'>,
    actor: CarwashEventActor | null,
  ): Promise<{ ticket: Ticket; previousStatus: WorkOrderStatus }> {
    const ticket = await this.findById(id);
    const next = nextStatus(ticket.status, action);
    const rejected = () =>
      new ConflictError({
        code: REJECTION_CODES[action],
        message: REJECTION_MESSAGES[action],
      });

    if (next === null) throw rejected();

    // Anular repone los productos en la misma transaccion (065 RN-5); por eso
    // pasa por la misma traduccion de errores del kardex que el alta. Si otra
    // pantalla lo movio antes de bloquearlo, sale el mismo rechazo (090 RN-3).
    let moved: Ticket;

    try {
      moved = await this.tickets.setStatus(id, { from: sourcesOf(action), to: next }, actor);
    } catch (error) {
      if (error instanceof TicketStatusChangedError) throw rejected();
      throw stockFailure(error);
    }

    return { ticket: moved, previousStatus: ticket.status };
  }

  /**
   * Oficina: OPEN / WASHING / READY entre sí (037). No inventa asignado:
   * `setStatus` solo mueve el estado y `washingStartedAt`.
   */
  async setOperationalStatus(
    id: string,
    status: SetTicketStatusInput['status'],
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const ticket = await this.findById(id);

    rejectOperationalMove(ticket.status, status);

    if (status === 'WASHING') {
      await this.rejectAlreadyWashing(
        id,
        ticket.washers.map((washer) => washer.id),
        'office',
      );
    }

    let moved: Ticket;

    try {
      moved = await this.tickets.setStatus(
        id,
        { from: operationalSourcesOf(status), to: status },
        actor,
      );
    } catch (error) {
      // Un cobro o una anulacion que gano la carrera (090 RN-3): el mismo
      // rechazo que si se hubiera leido asi.
      if (error instanceof TicketStatusChangedError) rejectOperationalMove(error.current, status);
      throw error;
    }

    this.emit('ticket.status.changed', moved, ticket.status, actor);

    return moved;
  }

  /**
   * Pega un responsable al carro del ticket (040). Si el ticket no tenía
   * cliente, también lo anota. No pisa un dueño vigente (012).
   */
  async setResponsible(
    id: string,
    input: SetTicketResponsibleInput,
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const updated = await this.assignResponsible(id, input);

    this.emit('ticket.updated', updated, null, actor);

    return updated;
  }

  /**
   * El trabajo sin el aviso. `charge` lo usa para no disparar dos eventos por
   * un solo cobro: quien mira la fila ve «cobrado», no «cobrado» y ademas
   * «cambio el responsable».
   */
  private async assignResponsible(id: string, input: SetTicketResponsibleInput): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (ticket.status === 'PAID' || ticket.status === 'VOID') {
      throw new ConflictError({
        code: API_ERROR_CODES.TICKET_STATUS_LOCKED,
        message: 'Un lavado cobrado o anulado no cambia de responsable por acá.',
      });
    }

    const vehicle = await this.vehicles.findById(ticket.vehicle.id);

    if (vehicle === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese vehículo no existe.',
      });
    }

    if (vehicle.currentOwner !== null) {
      if (input.customerId === vehicle.currentOwner.id) {
        return ticket.customer === null
          ? (await this.tickets.update(id, { customerId: vehicle.currentOwner.id })).ticket
          : ticket;
      }

      throw new ConflictError({
        code: API_ERROR_CODES.VEHICLE_HAS_OWNER,
        message: 'Este carro ya tiene responsable.',
        details: { vehicle },
      });
    }

    const customerId = await this.resolveCustomerId(input);

    if (customerId === null) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Escribí un nombre o elegí un responsable.',
      });
    }

    await this.vehicles.update(vehicle.id, { customerId });

    return ticket.customer === null
      ? (await this.tickets.update(id, { customerId })).ticket
      : this.findById(id);
  }

  /**
   * Cobro de un lavado suelto: el contrato viejo, que sigue vivo (059).
   *
   * Delega en la cuenta de cobro con un lavado y un pago. No hay un segundo
   * camino que escriba pagos: si lo hubiera, un dia uno congelaria la comision
   * distinto que el otro.
   */
  async charge(
    id: string,
    input: ChargeTicketInput,
    userId: string,
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    if (input.customerId !== undefined || input.customer !== undefined) {
      await this.assignResponsible(id, {
        customerId: input.customerId,
        customer: input.customer,
      });
    }

    const charge = await this.charges.create(
      {
        workOrderIds: [id],
        payments: [
          {
            method: input.method,
            amount: input.amount,
            bankAccountId: input.bankAccountId,
            reference: input.reference,
            description: input.description,
          },
        ],
      },
      userId,
      actor,
    );

    return charge.tickets[0] ?? this.findById(id);
  }

  /**
   * Deshace el cobro de un lavado del turno abierto. Si ese cobro incluye mas
   * lavados, se rechaza: una cuenta mancomunada se deshace entera (059 RN-8).
   * Si incluye productos sueltos, la venta se anula con el (066).
   */
  async reverse(
    id: string,
    reason: string,
    actor: CarwashEventActor | null = null,
    authorizer: ActionAuthorizer | null = null,
  ): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (nextStatus(ticket.status, 'reverse') === null) {
      throw new ConflictError({
        code: API_ERROR_CODES.TICKET_NOT_REVERSIBLE,
        message: 'Solo se deshace un cobro.',
      });
    }

    const [reversed] = await this.charges.voidForTicket(ticket, reason, actor, authorizer);

    return reversed ?? this.findById(id);
  }

  /**
   * Cambia el precio de una linea de un lavado que ya cerro el precio (060).
   *
   * Llegar hasta aca solo pide `carwash.charge`; lo que aplica el cambio es la
   * firma que el `AuthorizationGuard` ya verifico contra `carwash.discount`
   * (RN-2, RN-3). El cajero teclea, el encargado autoriza, y la sesion del
   * cajero sigue siendo la suya (RN-6).
   */
  async authorizePrice(
    id: string,
    itemId: string,
    input: AuthorizePriceInput,
    authorizer: { id: string; fullName: string },
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (ticket.status === 'PAID' || ticket.status === 'VOID') throw closedPriceError(ticket.status);

    const item = ticket.items.find((candidate) => candidate.id === itemId);

    if (item === undefined) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa línea no existe en el lavado.',
      });
    }

    const unitPrice = toCents(input.unitPrice);
    // Un servicio sube o baja; un producto no pasa el precio del articulo (087).
    const rejection =
      item.kind === 'SERVICE'
        ? rejectServicePrice(unitPrice)
        : rejectPrice(unitPrice, toCents(item.catalogPrice));

    if (rejection === 'ABOVE_CATALOG') {
      throw new ValidationError({
        code: API_ERROR_CODES.PRICE_ABOVE_CATALOG,
        message: 'El precio no puede ser mayor al del producto. El descuento solo baja.',
        details: { itemId, catalogPrice: item.catalogPrice },
      });
    }

    if (rejection === 'NEGATIVE') {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'El precio no puede ser negativo.',
        details: { itemId },
      });
    }

    let updated: Ticket;

    try {
      updated = await this.tickets.authorizePrice(id, {
        itemId,
        unitPrice,
        previousUnitPrice: toCents(item.unitPrice),
        reason: input.reason,
        authorizedByUserId: authorizer.id,
        authorizedByName: authorizer.fullName,
      });
    } catch (error) {
      // Lo cobro o lo anulo otra pantalla mientras se autorizaba (090 RN-3).
      if (error instanceof TicketStatusChangedError) throw closedPriceError(error.current);
      throw error;
    }

    this.emit('ticket.updated', updated, null, actor);

    return updated;
  }

  /**
   * Reemplaza al asignado. En pista no puede quedar vacío; en oficina sí.
   * Nunca más de uno (035). No toca `openedByEmployeeId` (003 RN-8).
   */
  async setWashers(
    id: string,
    employeeIds: string[],
    options: { requireNonEmpty: boolean },
    actor: CarwashEventActor | null = null,
  ): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (!canEditWashers(ticket.status)) throw washersLocked();

    const washerIds = uniqueIds(employeeIds);

    if (washerIds.length > 1) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Un lavado queda a cargo de una sola persona.',
      });
    }

    if (options.requireNonEmpty && washerIds.length === 0) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Tiene que quedar al menos un empleado.',
      });
    }

    await this.requireActiveEmployees(washerIds);

    if (ticket.status === 'WASHING') {
      await this.rejectAlreadyWashing(id, washerIds, 'office');
    }

    let assigned: Ticket;

    try {
      assigned = await this.tickets.replaceWashers(id, washerIds);
    } catch (error) {
      // Lo cobraron mientras tanto: la comision ya se congelo (090 RN-3).
      if (error instanceof TicketStatusChangedError) throw washersLocked();
      throw error;
    }

    this.emit('ticket.assigned', assigned, null, actor);

    return assigned;
  }

  /**
   * Un empleado lava un carro a la vez (071). La cola no cuenta, solo
   * `WASHING`, y el lavado que se esta moviendo no cuenta contra si mismo.
   * Pista le habla al empleado de la sesion; oficina, por su nombre.
   */
  private async rejectAlreadyWashing(
    ticketId: string,
    employeeIds: readonly string[],
    audience: 'self' | 'office',
  ): Promise<void> {
    for (const employeeId of employeeIds) {
      const washing = await this.tickets.listWashingOf(employeeId);
      const busy = washing.find((row) => row.id !== ticketId);

      if (busy === undefined) continue;

      const plate = busy.vehicle.plate;
      const name = busy.washers.find((washer) => washer.id === employeeId)?.fullName;

      throw new ConflictError({
        code: API_ERROR_CODES.EMPLOYEE_ALREADY_WASHING,
        message:
          audience === 'self'
            ? `Ya estás lavando ${plate}. Marcalo listo antes de tomar otro.`
            : `${name ?? 'Ese empleado'} ya está lavando ${plate}. Marcalo listo o pasalo a cola primero.`,
        details: { ticketId: busy.id, number: busy.number, plate, employeeId },
      });
    }
  }

  /**
   * La linea de tiempo del lavado (046). Un ticket que existe pero es anterior
   * a la spec devuelve `recorded: false`, no un 404: el lavado esta ahi, lo que
   * falta es su historia.
   */
  async timeline(id: string): Promise<TicketTimeline> {
    await this.findById(id);

    return buildTimeline(await this.tickets.listStatusEvents(id));
  }

  listFloorEmployees(): Promise<FloorEmployeeOption[]> {
    return this.tickets.listActiveEmployees();
  }

  async listCommissions(query: CommissionsQuery): Promise<CommissionReport> {
    const range = resolveCommissionRange(query.from, query.to);
    const snapshot = await this.tickets.listCommissionSnapshot(range);

    const report = buildCommissionReport(range, snapshot.entries, snapshot.unassigned);

    // `totalPayable` ya se sumo sobre todos; la pagina solo corta la tabla (102).
    return { ...report, employees: slicePage(report.employees, query) };
  }

  /** Los lavados detrás de una fila del reporte, en el mismo rango (061). */
  async employeeCommissions(
    employeeId: string,
    query: CommissionsQuery,
  ): Promise<CommissionEmployeeDetail> {
    const employee = await this.tickets.findCommissionEmployee(employeeId);

    if (employee === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      });
    }

    const range = resolveCommissionRange(query.from, query.to);
    const washes = await this.tickets.listEmployeeCommissionWashes(employeeId, range);

    const detail = buildEmployeeCommissionDetail(range, employee, washes);

    return { ...detail, washes: slicePage(detail.washes, query) };
  }

  private async requireActiveEmployees(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const active = new Set(await this.tickets.findActiveEmployeeIds(ids));
    const missing = ids.filter((id) => !active.has(id));

    if (missing.length > 0) {
      throw new ValidationError({
        code: API_ERROR_CODES.INVALID_WASHER,
        message: 'Ese empleado no existe o está desactivado.',
        details: { employeeIds: missing },
      });
    }
  }

  /**
   * Desde `READY` el precio se cierra (060 RN-1): si la edicion trae un precio
   * distinto al de catalogo, el rechazo dice que falta —la firma— en vez de
   * «ya no se puede editar», que mandaria a buscar el problema donde no esta.
   *
   * Solo se resuelve el catalogo cuando la edicion manda precios: sin ellos no
   * hay nada que comparar y el rechazo es el de siempre.
   */
  private async rejectClosedPrice(
    ticket: Ticket,
    input: UpdateTicketInput,
    bodyTypeId: string,
  ): Promise<void> {
    if (input.items === undefined) return;
    if (!input.items.some((item) => item.unitPrice !== undefined)) return;

    const priced = await this.resolveLines(input.items, bodyTypeId);

    if (needsPriceAuthorization(ticket.status, priced)) {
      throw new ValidationError({
        code: API_ERROR_CODES.PRICE_CHANGE_NOT_AUTHORIZED,
        message: 'Desde que el lavado está listo, el precio se cambia con autorización.',
      });
    }
  }

  /** Cliente por id, o creado al vuelo desde el cuerpo (RN-7, 040). */
  private async resolveCustomerId(input: {
    customerId?: string;
    customer?: { fullName: string; phone?: string };
  }): Promise<string | null> {
    if (input.customerId !== undefined) {
      return (await this.customers.findById(input.customerId))?.id ?? null;
    }

    if (input.customer !== undefined) {
      return (await this.customers.create(input.customer)).id;
    }

    return null;
  }

  /**
   * El responsable del alta, sin escribir nada (079): uno por id que exista, o
   * los datos del que se crea en la misma transaccion que el lavado.
   */
  private async intakeCustomer(input: {
    customerId?: string;
    customer?: { fullName: string; phone?: string };
  }): Promise<TicketIntakeCustomer> {
    if (input.customerId !== undefined) {
      const found = await this.customers.findById(input.customerId);

      return found === null ? null : { id: found.id };
    }

    if (input.customer !== undefined) return { create: input.customer };

    return null;
  }

  /**
   * Vehiculo por id (spec 012). Un id desactivado se trata como ausente: no se
   * reusa. No toca ficha ni dueno.
   */
  private async resolveVehicleById(id: string): Promise<IntakeVehicle | null> {
    const found = await this.vehicles.findById(id);

    if (found === null || !found.isActive) return null;

    return {
      id: found.id,
      create: null,
      bodyTypeId: found.bodyType.id,
      ownerId: found.currentOwner?.id ?? null,
    };
  }

  /**
   * Un carro, un lavado sin cobrar (090 RN-1). La consulta da el mensaje con
   * la placa y el numero; la garantia es el unico parcial de la base.
   */
  private async rejectUncharged(vehicleId: string, hint?: string): Promise<void> {
    const open = await this.tickets.findUnchargedOfVehicle(vehicleId);

    if (open === null) return;

    throw vehicleBusy(
      { id: open.id, number: open.number, plate: open.vehicle.plate, status: open.status },
      hint,
    );
  }

  /**
   * Si la placa ya existe y no se mando `vehicleId`, 409. Activa, con el
   * vehiculo para confirmar la ficha; solo desactivada, sin ficha: no hay nada
   * que confirmar. Una sola consulta (079).
   */
  private async rejectTakenPlate(
    input: CreateFloorTicketInput | CreateOfficeTicketInput,
  ): Promise<void> {
    if (input.vehicle === undefined) return;

    const existing = await this.vehicles.findByPlate(input.vehicle.plate);

    if (existing === null) return;

    // Confirmar la ficha no serviria de nada si el carro sigue en el lavado
    // (090): el alta con su id chocaria igual.
    if (existing.isActive) await this.rejectUncharged(existing.id);

    throw new ConflictError({
      code: API_ERROR_CODES.VEHICLE_PLATE_EXISTS,
      message: 'Ya existe un vehículo con esa placa.',
      ...(existing.isActive ? { details: { vehicle: existing } } : {}),
    });
  }
}

/** Placa nueva con tipo de carro: la ficha que se crea con el lavado (012, 040). */
function newVehicleOf(
  input: CreateFloorTicketInput | CreateOfficeTicketInput,
): IntakeVehicle | null {
  if (input.vehicle === undefined || input.vehicle.bodyTypeId === undefined) return null;

  return {
    id: null,
    create: {
      plate: input.vehicle.plate,
      bodyTypeId: input.vehicle.bodyTypeId,
      make: input.vehicle.make,
      color: input.vehicle.color,
    },
    bodyTypeId: input.vehicle.bodyTypeId,
    ownerId: null,
  };
}

const REJECTION_CODES: Record<Exclude<WorkOrderAction, 'charge' | 'reverse'>, ApiErrorCode> = {
  start: API_ERROR_CODES.TICKET_NOT_OPEN,
  ready: API_ERROR_CODES.TICKET_NOT_OPEN,
  reopen: API_ERROR_CODES.TICKET_NOT_READY,
  void: API_ERROR_CODES.TICKET_NOT_VOIDABLE,
};

const REJECTION_MESSAGES: Record<Exclude<WorkOrderAction, 'charge' | 'reverse'>, string> = {
  start: 'Solo se puede empezar un lavado que está en espera.',
  ready: 'Solo se marca listo un lavado abierto o que se está lavando.',
  reopen: 'Solo se reabre un lavado que está listo.',
  void: 'Solo se anula un lavado abierto, en lavado o listo.',
};

/** Por que oficina no puede llevar un lavado de `from` a `to` (037), si no puede. */
function rejectOperationalMove(from: WorkOrderStatus, to: WorkOrderStatus): void {
  if (from === to) {
    throw new ConflictError({
      code: API_ERROR_CODES.TICKET_ALREADY_IN_STATUS,
      message: 'El lavado ya está en ese estado.',
    });
  }

  if (!canSetOperationalStatus(from, to)) {
    throw new ConflictError({
      code: API_ERROR_CODES.TICKET_STATUS_LOCKED,
      message: 'Un lavado cobrado o anulado no cambia de estado por acá.',
    });
  }
}

function washersLocked(): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.WASHERS_LOCKED,
    message: 'El empleado de un lavado cobrado o anulado no se cambia.',
  });
}

/** Lo que se dice de un precio que ya no se puede cambiar (060). */
function closedPriceError(status: WorkOrderStatus): ConflictError {
  return status === 'PAID'
    ? new ConflictError({
        code: API_ERROR_CODES.TICKET_ALREADY_CHARGED,
        message: 'Ese lavado ya está cobrado: deshacé el cobro para corregir el precio.',
      })
    : new ConflictError({
        code: API_ERROR_CODES.TICKET_STATUS_LOCKED,
        message: 'Un lavado anulado no cambia de precio.',
      });
}

/** El mismo combo dos veces en un lavado (104 RN-6). */
function rejectDuplicateCombos(ids: readonly string[]): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new ValidationError({
        code: API_ERROR_CODES.DUPLICATE_COMBO,
        message: 'Combo repetido',
        details: { comboId: id },
      });
    }
    seen.add(id);
  }
}

/** Pausado, fuera de fechas, otro dia de la semana o inexistente (104 criterio 3). */
function comboNotAvailable(id: string, combo: TicketComboRecord | undefined): ValidationError {
  return new ValidationError({
    code: API_ERROR_CODES.COMBO_NOT_AVAILABLE,
    message: combo === undefined ? 'Combo no disponible' : `«${combo.name}» no vale hoy`,
    details: { comboId: id },
  });
}

function emptyNotes(notes: string): string | null {
  return notes.trim() === '' ? null : notes;
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  return unique;
}
