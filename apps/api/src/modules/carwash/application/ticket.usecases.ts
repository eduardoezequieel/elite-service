import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateFloorTicketInput,
  CreateOfficeTicketInput,
  ChargeTicketInput,
  Ticket,
  UpdateTicketInput,
} from '@elite/shared';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import type { CustomerRepository } from '../../customers/application/ports/customer.repository';
import type { ServiceCatalogRepository } from '../../services/application/ports/service-catalog.repository';
import type { VehicleRepository } from '../../vehicles/application/ports/vehicle.repository';
import { toCents } from '../domain/money';
import { missingFieldsOf, nextStatus, rejectCharge } from '../domain/work-order';
import type { WorkOrderAction } from '../domain/work-order';
import { buildTicketItems } from './build-ticket-items';
import type {
  TicketFilter,
  TicketRepository,
  NewTicketData,
  TicketChanges,
} from './ports/ticket.repository';

/** Quien abre el ticket. La pista pone empleado; la oficina, usuario. */
export type Opener =
  { kind: 'employee'; employeeId: string } | { kind: 'user'; userId: string; employeeId?: string };

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
  ) {}

  list(filter: TicketFilter): Promise<Ticket[]> {
    return this.tickets.list(filter);
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);

    if (ticket === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese lavado no existe.',
      });
    }

    return ticket;
  }

  /**
   * Abre un ticket. Cliente y vehiculo pueden venir por id o crearse al vuelo:
   * en la pista, con el carro esperando, mandar al lavador a otra pantalla a
   * dar de alta al cliente no es viable (RN-7).
   */
  async create(
    input: CreateFloorTicketInput | CreateOfficeTicketInput,
    opener: Opener,
  ): Promise<Ticket> {
    const employeeId = opener.kind === 'employee' ? opener.employeeId : opener.employeeId;

    // RN-8: si la oficina eligio lavador, tiene que existir y estar activo.
    if (employeeId !== undefined && !(await this.tickets.employeeIsActive(employeeId))) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.INVALID_WASHER,
        message: 'Ese lavador no existe o está desactivado.',
        details: { employeeId },
      });
    }

    const customerId = await this.resolveCustomerId(input);
    const vehicle = await this.resolveVehicle(input, customerId);

    const draft = {
      customerId,
      vehicleId: vehicle?.id ?? null,
      bodyTypeId: vehicle?.bodyTypeId ?? null,
      serviceIds: input.items.map((item) => item.serviceId),
    };
    const missing = missingFieldsOf(draft);

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.TICKET_INCOMPLETE,
        message: 'Faltan datos para abrir el lavado.',
        details: { missing },
      });
    }

    const services = await this.catalog.listServices(true);
    const items = buildTicketItems(input.items, services, draft.bodyTypeId as string);

    const data: NewTicketData = {
      customerId: draft.customerId as string,
      vehicleId: draft.vehicleId as string,
      bodyTypeId: draft.bodyTypeId as string,
      notes: input.notes,
      openedByEmployeeId: employeeId ?? null,
      openedByUserId: opener.kind === 'user' ? opener.userId : null,
      items,
    };

    return this.tickets.create(data);
  }

  /** Edicion de un ticket abierto (RN-9). */
  async update(id: string, input: UpdateTicketInput): Promise<Ticket> {
    const ticket = await this.requireStatus(id, 'OPEN', API_ERROR_CODES.TICKET_NOT_OPEN);
    const changes: TicketChanges = {};
    const bodyTypeId = input.bodyTypeId ?? ticket.bodyType.id;

    if (input.bodyTypeId !== undefined) changes.bodyTypeId = input.bodyTypeId;
    if (input.notes !== undefined) changes.notes = input.notes;

    if (input.items !== undefined) {
      const services = await this.catalog.listServices(true);

      changes.items = buildTicketItems(input.items, services, bodyTypeId);
    }

    return this.tickets.update(id, changes);
  }

  /** `ready`, `reopen` y `void`: las transiciones que no cobran (RN-9). */
  async transition(id: string, action: Exclude<WorkOrderAction, 'charge'>): Promise<Ticket> {
    const ticket = await this.findById(id);
    const next = nextStatus(ticket.status, action);

    if (next === null) {
      throw new ConflictException({
        code: REJECTION_CODES[action],
        message: REJECTION_MESSAGES[action],
      });
    }

    return this.tickets.setStatus(id, next);
  }

  /** Cobro. Solo desde `READY`, monto exacto, un solo pago (RN-10). */
  async charge(id: string, input: ChargeTicketInput, userId: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    const total = toCents(ticket.total);
    const amount = toCents(input.amount);
    const rejection = rejectCharge(ticket.status, total, amount);

    if (rejection === 'NOT_READY') {
      throw new ConflictException({
        code: API_ERROR_CODES.TICKET_NOT_READY,
        message: 'Solo se cobra un lavado que está listo.',
      });
    }

    if (rejection === 'EMPTY_TOTAL') {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
        message: 'Un lavado en cero no se cobra: se anula como cortesía.',
      });
    }

    if (rejection === 'AMOUNT_MISMATCH') {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
        message: 'El monto tiene que ser igual al total del lavado.',
        details: { total: ticket.total, amount: input.amount },
      });
    }

    return this.tickets.charge(id, { method: input.method, amount, userId });
  }

  private async requireStatus(id: string, status: Ticket['status'], code: string): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (ticket.status !== status) {
      throw new ConflictException({ code, message: 'Ese lavado ya no se puede editar.' });
    }

    return ticket;
  }

  /** Cliente por id, o creado al vuelo desde el cuerpo (RN-7). */
  private async resolveCustomerId(
    input: CreateFloorTicketInput | CreateOfficeTicketInput,
  ): Promise<string | null> {
    if (input.customerId !== undefined) {
      return (await this.customers.findById(input.customerId))?.id ?? null;
    }

    if (input.customer !== undefined) {
      return (await this.customers.create(input.customer)).id;
    }

    return null;
  }

  /**
   * Vehiculo por id, por placa existente, o creado al vuelo.
   *
   * Si la placa ya existe se **reutiliza** el vehiculo y se actualiza el dueno
   * actual si el cliente es otro (RN-12): el carro que vuelve es el mismo carro.
   */
  private async resolveVehicle(
    input: CreateFloorTicketInput | CreateOfficeTicketInput,
    customerId: string | null,
  ): Promise<{ id: string; bodyTypeId: string } | null> {
    if (input.vehicleId !== undefined) {
      const found = await this.vehicles.findById(input.vehicleId);

      return found === null ? null : { id: found.id, bodyTypeId: found.bodyType.id };
    }

    if (input.vehicle === undefined || customerId === null) return null;

    const existing = await this.vehicles.findByPlate(input.vehicle.plate);

    if (existing !== null) {
      const updated = await this.vehicles.update(existing.id, {
        bodyTypeId: input.vehicle.bodyTypeId,
        make: input.vehicle.make,
        color: input.vehicle.color,
        customerId,
      });

      return { id: updated.id, bodyTypeId: updated.bodyType.id };
    }

    const created = await this.vehicles.create({ ...input.vehicle, customerId });

    return { id: created.id, bodyTypeId: created.bodyType.id };
  }
}

const REJECTION_CODES: Record<Exclude<WorkOrderAction, 'charge'>, string> = {
  ready: API_ERROR_CODES.TICKET_NOT_OPEN,
  reopen: API_ERROR_CODES.TICKET_NOT_READY,
  void: API_ERROR_CODES.TICKET_NOT_VOIDABLE,
};

const REJECTION_MESSAGES: Record<Exclude<WorkOrderAction, 'charge'>, string> = {
  ready: 'Solo se marca listo un lavado abierto.',
  reopen: 'Solo se reabre un lavado que está listo.',
  void: 'Solo se anula un lavado abierto o listo.',
};
