import {
  API_ERROR_CODES,
  PERMISSIONS,
  chargeTicketSchema,
  commissionsQuerySchema,
  createOfficeTicketSchema,
  putWashersSchema,
  reverseTicketSchema,
  setTicketResponsibleSchema,
  setTicketStatusSchema,
  updateTicketNotesSchema,
  updateTicketSchema,
  voidTicketSchema,
} from '@elite/shared';
import type {
  ChargeTicketInput,
  CommissionReport,
  CommissionsQuery,
  CreateOfficeTicketInput,
  PutWashersInput,
  ReverseTicketInput,
  SetTicketResponsibleInput,
  SetTicketStatusInput,
  Ticket,
  TicketTimeline,
  VoidTicketInput,
  UpdateTicketInput,
  UpdateTicketNotesInput,
  WorkOrderStatus,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import {
  Authorizer,
  CurrentUser,
  RequireAuthorization,
  RequirePermissions,
} from '../../../common/auth/auth.decorators';
import type { ActionAuthorizer, AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { optionalUuidQuery } from '../../../common/validation/uuid-query.pipe';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { TicketUseCases } from '../application/ticket.usecases';
import { userActor } from './carwash-actor';

/** Estados validos en el filtro. Cualquier otra cosa se ignora. */
const STATUSES: WorkOrderStatus[] = ['OPEN', 'WASHING', 'READY', 'PAID', 'VOID'];

/**
 * La vista **oficina**. Sesion de usuario (spec 001) y autorizacion por clave
 * `module.action`, nunca por nombre de rol (RN-1, RN-16).
 *
 * Las cuatro claves de `carwash` estan separadas por una razon concreta: un rol
 * de cajero lleva `read` y `charge` y con eso ve la fila y cobra, pero no puede
 * editar precios ni anular. Si `charge` viviera dentro de `manage`, darle a
 * alguien el cobro le daria tambien el descuento.
 */
@Controller('carwash')
export class CarwashTicketsController {
  private static readonly ticketId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese lavado no existe.' }),
  });

  private static readonly customerId = optionalUuidQuery('customerId');

  constructor(private readonly tickets: TicketUseCases) {}

  /**
   * La fila del dia, o —con `customerId`— el historial de un cliente: sin
   * recorte por dia, en cualquier estado y solo los ultimos (004).
   */
  @Get('tickets')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  findAll(
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('q') q?: string,
    @Query('customerId', CarwashTicketsController.customerId) customerId?: string,
  ): Promise<Ticket[]> {
    const requested = status
      ?.split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is WorkOrderStatus => STATUSES.includes(value as WorkOrderStatus));

    return this.tickets.list({
      statuses: requested === undefined || requested.length === 0 ? undefined : requested,
      date,
      q,
      customerId,
    });
  }

  /** Alta de emergencia desde el mostrador, con asignado opcional (RN-7, 035). */
  @Post('tickets')
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createOfficeTicketSchema)) input: CreateOfficeTicketInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.create(
      input,
      { kind: 'user', userId: user.id, employeeId: input.employeeId },
      userActor(user),
    );
  }

  @Get('commissions')
  @RequirePermissions(PERMISSIONS.carwash.actions.commissions.key)
  commissions(
    @Query(new ZodValidationPipe(commissionsQuerySchema)) query: CommissionsQuery,
  ): Promise<CommissionReport> {
    return this.tickets.listCommissions(query);
  }

  @Get('tickets/:id')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  findOne(@Param('id', CarwashTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.findById(id);
  }

  /**
   * La linea de tiempo del lavado (046). Clave propia: quien cobra no necesita
   * saber cuanto tardo cada quien, y quien audita no necesita poder cobrar.
   */
  @Get('tickets/:id/timeline')
  @RequirePermissions(PERMISSIONS.carwash.actions.audit.key)
  timeline(@Param('id', CarwashTicketsController.ticketId) id: string): Promise<TicketTimeline> {
    return this.tickets.timeline(id);
  }

  @Patch('tickets/:id')
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  update(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) input: UpdateTicketInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.update(id, input, userActor(user));
  }

  /**
   * La nota del ticket abierto, en lavado o listo. El cajero no tiene
   * `carwash.manage` (no edita precios); cobra y puede dejar la nota (041).
   */
  @Patch('tickets/:id/notes')
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  updateNotes(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(updateTicketNotesSchema)) input: UpdateTicketNotesInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.update(id, { notes: input.notes }, userActor(user));
  }

  @Post('tickets/:id/ready')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  ready(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.transition(id, 'ready', userActor(user));
  }

  @Post('tickets/:id/reopen')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  reopen(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.transition(id, 'reopen', userActor(user));
  }

  @Post('tickets/:id/status')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  setStatus(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(setTicketStatusSchema)) input: SetTicketStatusInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.setOperationalStatus(id, input.status, userActor(user));
  }

  @Put('tickets/:id/responsible')
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  setResponsible(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(setTicketResponsibleSchema)) input: SetTicketResponsibleInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.setResponsible(id, input, userActor(user));
  }

  @Post('tickets/:id/charge')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  charge(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(chargeTicketSchema)) input: ChargeTicketInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.charge(id, input, user.id, userActor(user));
  }

  /**
   * Deshacer un cobro y anular no los autoriza la sesion sino la firma que
   * viene en el body (045): para llegar alcanza con ver el modulo, y el permiso
   * lo pone quien escribe sus credenciales en la pantalla. El actor del evento
   * sigue siendo el de la sesion (RN-4).
   */
  @Post('tickets/:id/reverse')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  @RequireAuthorization(PERMISSIONS.carwash.actions.reverse.key)
  reverse(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(reverseTicketSchema)) input: ReverseTicketInput,
    @CurrentUser() user: AuthenticatedUser,
    @Authorizer() authorizer: ActionAuthorizer,
  ): Promise<Ticket> {
    return this.tickets.reverse(id, input, userActor(user), authorizer.fullName);
  }

  @Post('tickets/:id/void')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  @RequireAuthorization(PERMISSIONS.carwash.actions.void.key)
  void(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(voidTicketSchema)) input: VoidTicketInput,
    @CurrentUser() user: AuthenticatedUser,
    @Authorizer() authorizer: ActionAuthorizer,
  ): Promise<Ticket> {
    return this.tickets.voidWithReason(id, input.reason, userActor(user), authorizer.fullName);
  }

  @Put('tickets/:id/washers')
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  setWashers(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(putWashersSchema)) input: PutWashersInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.setWashers(
      id,
      input.employeeIds,
      { requireNonEmpty: false },
      userActor(user),
    );
  }
}
