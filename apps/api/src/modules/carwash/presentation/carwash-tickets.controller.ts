import {
  API_ERROR_CODES,
  PERMISSIONS,
  chargeTicketSchema,
  commissionsQuerySchema,
  createOfficeTicketSchema,
  putWashersSchema,
  updateTicketSchema,
} from '@elite/shared';
import type {
  ChargeTicketInput,
  CommissionReport,
  CommissionsQuery,
  CreateOfficeTicketInput,
  PutWashersInput,
  Ticket,
  UpdateTicketInput,
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

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import { optionalUuidQuery } from '../../../common/validation/uuid-query.pipe';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { TicketUseCases } from '../application/ticket.usecases';

/** Estados validos en el filtro. Cualquier otra cosa se ignora. */
const STATUSES: WorkOrderStatus[] = ['OPEN', 'READY', 'PAID', 'VOID'];

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

  /** Alta de emergencia desde el mostrador, con lavador opcional (RN-7, RN-8). */
  @Post('tickets')
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createOfficeTicketSchema)) input: CreateOfficeTicketInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.create(input, {
      kind: 'user',
      userId: user.id,
      employeeId: input.employeeId,
    });
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

  @Patch('tickets/:id')
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  update(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) input: UpdateTicketInput,
  ): Promise<Ticket> {
    return this.tickets.update(id, input);
  }

  @Post('tickets/:id/ready')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  ready(@Param('id', CarwashTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.transition(id, 'ready');
  }

  @Post('tickets/:id/reopen')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  reopen(@Param('id', CarwashTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.transition(id, 'reopen');
  }

  @Post('tickets/:id/charge')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  charge(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(chargeTicketSchema)) input: ChargeTicketInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.charge(id, input, user.id);
  }

  @Post('tickets/:id/void')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.void.key)
  void(@Param('id', CarwashTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.transition(id, 'void');
  }

  @Put('tickets/:id/washers')
  @RequirePermissions(PERMISSIONS.carwash.actions.manage.key)
  setWashers(
    @Param('id', CarwashTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(putWashersSchema)) input: PutWashersInput,
  ): Promise<Ticket> {
    return this.tickets.setWashers(id, input.employeeIds, { requireNonEmpty: false });
  }
}
