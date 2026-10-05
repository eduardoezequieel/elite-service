import {
  API_ERROR_CODES,
  PERMISSIONS,
  authorizePriceSchema,
  chargeTicketSchema,
  commissionsQuerySchema,
  createOfficeTicketSchema,
  putWashersSchema,
  reverseTicketSchema,
  setTicketResponsibleSchema,
  setTicketStatusSchema,
  ticketsQuerySchema,
  updateTicketNotesSchema,
  updateTicketSchema,
  voidTicketSchema,
} from '@elite/shared';
import type {
  AuthorizePriceInput,
  ChargeTicketInput,
  ComboOption,
  CommissionEmployeeDetail,
  CommissionReport,
  CommissionsQuery,
  CreateOfficeTicketInput,
  InventoryItemOption,
  PutWashersInput,
  ReverseTicketInput,
  SetTicketResponsibleInput,
  SetTicketStatusInput,
  Ticket,
  TicketListPage,
  TicketTimeline,
  TicketsQuery,
  VoidTicketInput,
  UpdateTicketInput,
  UpdateTicketNotesInput,
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
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { TicketUseCases } from '../application/ticket.usecases';
import { userActor } from './carwash-actor';

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

  private static readonly employeeId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      }),
  });

  private static readonly itemId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa línea no existe en el lavado.',
      }),
  });

  constructor(private readonly tickets: TicketUseCases) {}

  /**
   * La fila del dia, o —con `customerId`— el historial de un cliente, sin
   * recorte por dia y en cualquier estado (004). De a una pagina, con el
   * resumen del dia y las opciones de filtro (102). Un estado que no existe se
   * ignora (`ticketsQuerySchema`).
   */
  @Get('tickets')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  findAll(
    @Query(new ZodValidationPipe(ticketsQuerySchema)) query: TicketsQuery,
  ): Promise<TicketListPage> {
    return this.tickets.listPage(query);
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

  /**
   * Productos activos para el selector del lavado y de la venta suelta (065).
   * Pide `carwash.read`, no `inventory.read`: quien arma un lavado tiene que
   * poder agregar un producto sin ver el inventario. Sin costos (RN-17).
   */
  @Get('inventory-items')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  inventoryItems(@Query('search') search?: string): Promise<InventoryItemOption[]> {
    return this.tickets.listInventoryItems(search);
  }

  /** Los combos que valen hoy, para la tarjeta del alta (104). Con `carwash.read`. */
  @Get('combos')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  combos(): Promise<ComboOption[]> {
    return this.tickets.listCombos();
  }

  @Get('commissions')
  @RequirePermissions(PERMISSIONS.carwash.actions.commissions.key)
  commissions(
    @Query(new ZodValidationPipe(commissionsQuerySchema)) query: CommissionsQuery,
  ): Promise<CommissionReport> {
    return this.tickets.listCommissions(query);
  }

  @Get('commissions/:employeeId')
  @RequirePermissions(PERMISSIONS.carwash.actions.commissions.key)
  employeeCommissions(
    @Param('employeeId', CarwashTicketsController.employeeId) employeeId: string,
    @Query(new ZodValidationPipe(commissionsQuerySchema)) query: CommissionsQuery,
  ): Promise<CommissionEmployeeDetail> {
    return this.tickets.employeeCommissions(employeeId, query);
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
    return this.tickets.reverse(id, input.reason, userActor(user), authorizer);
  }

  /**
   * Cambiar el precio de una linea de un lavado ya listo (060).
   *
   * Dos claves distintas y a proposito: `carwash.charge` es lo que hace falta
   * para **llegar** —el cajero ve la linea—, y `carwash.discount` es lo que
   * hace falta para **aplicar**, y lo pone quien escribe sus credenciales en la
   * pantalla del cajero, sin abrir sesion (RN-2, RN-3, RN-6).
   */
  @Patch('tickets/:id/items/:itemId/price')
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  @RequireAuthorization(PERMISSIONS.carwash.actions.discount.key)
  authorizePrice(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Param('itemId', CarwashTicketsController.itemId) itemId: string,
    @Body(new ZodValidationPipe(authorizePriceSchema)) input: AuthorizePriceInput,
    @CurrentUser() user: AuthenticatedUser,
    @Authorizer() authorizer: ActionAuthorizer,
  ): Promise<Ticket> {
    return this.tickets.authorizePrice(id, itemId, input, authorizer, userActor(user));
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
