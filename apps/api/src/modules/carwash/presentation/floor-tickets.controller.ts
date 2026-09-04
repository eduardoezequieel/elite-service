import {
  API_ERROR_CODES,
  createCustomerSchema,
  createFloorTicketSchema,
  customerMatchQuerySchema,
  putWashersSchema,
  updateTicketSchema,
} from '@elite/shared';
import type {
  CreateCustomerInput,
  CreateFloorTicketInput,
  Customer,
  CustomerMatch,
  CustomerMatchQuery,
  FloorEmployeeOption,
  PutWashersInput,
  ServiceDetail,
  Ticket,
  UpdateTicketInput,
  VehicleBodyType,
  VehicleWithOwner,
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

import { CurrentEmployee, FloorSession } from '../../../common/auth/auth.decorators';
import type { AuthenticatedEmployee } from '../../../common/auth/authenticated-user';
import { flagFromQuery } from '../../../common/validation/query-flag';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import {
  CreateCustomerUseCase,
  FindCustomerMatchUseCase,
  ListCustomersUseCase,
} from '../../customers/application/customer.usecases';
import { ListServicesUseCase } from '../../services/application/catalog.usecases';
import {
  ListBodyTypesUseCase,
  ListVehiclesUseCase,
} from '../../vehicles/application/vehicle.usecases';
import { TicketUseCases } from '../application/ticket.usecases';

/**
 * La vista **pista**: lo que el lavador hace con la tablet en la mano.
 *
 * Lo que no esta aca es tan importante como lo que si: no hay cobrar, no hay
 * anular y no hay catalogo editable. El empleado no cobra (RN-10) y no
 * administra (RN-0). Agregar una de esas rutas a este controller seria
 * saltarse la regla sin que ningun permiso lo note, porque la pista no tiene
 * permisos que consultar.
 *
 * Cualquier empleado activo puede marcar listo un ticket que anoto otro: la
 * fila es del taller, no de quien la escribio (RN-9).
 */
@Controller('floor')
@FloorSession()
export class FloorTicketsController {
  private static readonly ticketId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese lavado no existe.' }),
  });

  constructor(
    private readonly tickets: TicketUseCases,
    private readonly listServices: ListServicesUseCase,
    private readonly listCustomers: ListCustomersUseCase,
    private readonly findCustomerMatch: FindCustomerMatchUseCase,
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly listVehicles: ListVehiclesUseCase,
    private readonly listBodyTypes: ListBodyTypesUseCase,
  ) {}

  /** La fila del dia: lo que falta hacer. Sin cobrados ni anulados. */
  @Get('tickets')
  findAll(@Query('date') date?: string, @Query('q') q?: string): Promise<Ticket[]> {
    return this.tickets.list({ statuses: ['OPEN', 'READY'], date, q });
  }

  /** Activos, solo id y nombre: en la pista no viaja el usuario ni el PIN. */
  @Get('employees')
  employees(): Promise<FloorEmployeeOption[]> {
    return this.tickets.listFloorEmployees();
  }

  @Post('tickets')
  create(
    @Body(new ZodValidationPipe(createFloorTicketSchema)) input: CreateFloorTicketInput,
    @CurrentEmployee() employee: AuthenticatedEmployee,
  ): Promise<Ticket> {
    // Quien abre entra siempre al conjunto. Los extras van en `washerIds` (009).
    return this.tickets.create(input, { kind: 'employee', employeeId: employee.id });
  }

  @Get('tickets/:id')
  findOne(@Param('id', FloorTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.findById(id);
  }

  @Patch('tickets/:id')
  update(
    @Param('id', FloorTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) input: UpdateTicketInput,
  ): Promise<Ticket> {
    return this.tickets.update(id, input);
  }

  @Post('tickets/:id/ready')
  @HttpCode(200)
  ready(@Param('id', FloorTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.transition(id, 'ready');
  }

  @Post('tickets/:id/reopen')
  @HttpCode(200)
  reopen(@Param('id', FloorTicketsController.ticketId) id: string): Promise<Ticket> {
    return this.tickets.transition(id, 'reopen');
  }

  @Put('tickets/:id/washers')
  setWashers(
    @Param('id', FloorTicketsController.ticketId) id: string,
    @Body(new ZodValidationPipe(putWashersSchema)) input: PutWashersInput,
  ): Promise<Ticket> {
    return this.tickets.setWashers(id, input.employeeIds, { requireNonEmpty: true });
  }

  /** Solo activos: en la pista no se ofrece lo que el negocio dio de baja. */
  @Get('services')
  services(): Promise<ServiceDetail[]> {
    return this.listServices.execute(true);
  }

  /**
   * Las sugerencias de la ficha. Solo activos por omision: en la pista no se
   * ofrece a quien el negocio dio de baja (004 RN-4).
   */
  @Get('customers')
  customers(
    @Query('q') query?: string,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<Customer[]> {
    return this.listCustomers.execute({ query, activeOnly: flagFromQuery(activeOnly, true) });
  }

  /**
   * ¿Ya existe alguien asi? (004 RN-1). La pista busca y da de alta; lo que no
   * puede es editar, desactivar ni listar clientes en una pantalla propia
   * (RN-5), y por eso aca hay `match` pero no `PATCH` ni `:id`.
   */
  @Get('customers/match')
  customerMatch(
    @Query(new ZodValidationPipe(customerMatchQuerySchema)) query: CustomerMatchQuery,
  ): Promise<CustomerMatch | null> {
    return this.findCustomerMatch.execute(query);
  }

  @Post('customers')
  addCustomer(
    @Body(new ZodValidationPipe(createCustomerSchema)) input: CreateCustomerInput,
  ): Promise<Customer> {
    return this.createCustomer.execute(input);
  }

  @Get('vehicles')
  vehicles(@Query('q') query?: string): Promise<VehicleWithOwner[]> {
    return this.listVehicles.execute({ query });
  }

  @Get('vehicle-body-types')
  bodyTypes(): Promise<VehicleBodyType[]> {
    return this.listBodyTypes.execute();
  }
}
