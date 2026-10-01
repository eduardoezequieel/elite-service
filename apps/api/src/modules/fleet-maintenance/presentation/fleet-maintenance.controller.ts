import {
  API_ERROR_CODES,
  PERMISSIONS,
  createMaintenanceLogSchema,
  createPlanTaskSchema,
  maintenanceLogsQuerySchema,
  maintenanceStatusQuerySchema,
  updatePlanTaskSchema,
} from '@elite/shared';
import type {
  CreateMaintenanceLogInput,
  CreatePlanTaskInput,
  MaintenanceLog,
  MaintenanceLogsQuery,
  MaintenancePlanTask,
  MaintenanceStatusQuery,
  UpdatePlanTaskInput,
  VehicleMaintenanceStatus,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { MaintenanceLogUseCases } from '../application/maintenance-log.usecases';
import { MaintenancePlanUseCases } from '../application/maintenance-plan.usecases';
import { MaintenanceStatusUseCases } from '../application/maintenance-status.usecases';

const { read, manage } = PERMISSIONS.fleet.actions;

/** `/api/fleet/maintenance` (099): plan, estado, servicios, texto al taller y `.ics`. */
@Controller('fleet/maintenance')
export class FleetMaintenanceController {
  private static readonly taskId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa tarea del plan no existe.',
      }),
  });

  constructor(
    private readonly plan: MaintenancePlanUseCases,
    private readonly logs: MaintenanceLogUseCases,
    private readonly status: MaintenanceStatusUseCases,
  ) {}

  @Get('plan')
  @RequirePermissions(read.key)
  listPlan(): Promise<MaintenancePlanTask[]> {
    return this.plan.list();
  }

  @Post('plan')
  @RequirePermissions(manage.key)
  createTask(
    @Body(new ZodValidationPipe(createPlanTaskSchema)) input: CreatePlanTaskInput,
  ): Promise<MaintenancePlanTask> {
    return this.plan.create(input);
  }

  @Patch('plan/:id')
  @RequirePermissions(manage.key)
  updateTask(
    @Param('id', FleetMaintenanceController.taskId) id: string,
    @Body(new ZodValidationPipe(updatePlanTaskSchema)) input: UpdatePlanTaskInput,
  ): Promise<MaintenancePlanTask> {
    return this.plan.update(id, input);
  }

  @Get('status')
  @RequirePermissions(read.key)
  findStatus(
    @Query(new ZodValidationPipe(maintenanceStatusQuerySchema)) query: MaintenanceStatusQuery,
  ): Promise<VehicleMaintenanceStatus[]> {
    return this.status.status(query);
  }

  @Get('logs')
  @RequirePermissions(read.key)
  listLogs(
    @Query(new ZodValidationPipe(maintenanceLogsQuerySchema)) query: MaintenanceLogsQuery,
  ): Promise<MaintenanceLog[]> {
    return this.logs.list(query);
  }

  /** Varias tareas en un servicio: un log por tarea y un gasto por log con costo. */
  @Post('logs')
  @RequirePermissions(manage.key)
  recordService(
    @Body(new ZodValidationPipe(createMaintenanceLogSchema)) input: CreateMaintenanceLogInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MaintenanceLog[]> {
    return this.logs.record(input, user.id);
  }

  @Get('whatsapp-text')
  @RequirePermissions(read.key)
  whatsappText(): Promise<{ text: string }> {
    return this.status.whatsappText();
  }

  @Get('reminders.ics')
  @RequirePermissions(read.key)
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mantenimiento-flota.ics"')
  @Header('Cache-Control', 'private, no-store')
  reminders(): Promise<string> {
    return this.status.remindersCalendar();
  }
}
