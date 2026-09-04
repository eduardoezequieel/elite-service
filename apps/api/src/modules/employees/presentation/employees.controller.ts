import {
  API_ERROR_CODES,
  PERMISSIONS,
  createEmployeeSchema,
  updateEmployeeSchema,
} from '@elite/shared';
import type { CreateEmployeeInput, PublicEmployee, UpdateEmployeeInput } from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { CreateEmployeeUseCase } from '../application/create-employee.usecase';
import { ListEmployeesUseCase } from '../application/list-employees.usecase';
import { UpdateEmployeeUseCase } from '../application/update-employee.usecase';

/**
 * Empleados, desde la **oficina**: los crea y edita quien tenga el permiso, no
 * ellos mismos. Sesion `user` (spec 001) mas clave `module.action`.
 *
 * Sin `DELETE`: se desactivan (RN-13). Tienen tickets colgando y borrarlos
 * perderia de quien fue el trabajo.
 */
@Controller('employees')
export class EmployeesController {
  private static readonly employeeId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      }),
  });

  constructor(
    private readonly listEmployees: ListEmployeesUseCase,
    private readonly createEmployee: CreateEmployeeUseCase,
    private readonly updateEmployee: UpdateEmployeeUseCase,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.employees.actions.read.key)
  findAll(): Promise<PublicEmployee[]> {
    return this.listEmployees.execute();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.employees.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createEmployeeSchema)) input: CreateEmployeeInput,
  ): Promise<PublicEmployee> {
    return this.createEmployee.execute(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.employees.actions.manage.key)
  update(
    @Param('id', EmployeesController.employeeId) id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema)) input: UpdateEmployeeInput,
  ): Promise<PublicEmployee> {
    return this.updateEmployee.execute(id, input);
  }
}
