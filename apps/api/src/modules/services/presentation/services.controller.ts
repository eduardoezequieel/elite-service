import {
  API_ERROR_CODES,
  PERMISSIONS,
  createServiceCategorySchema,
  createServiceSchema,
  updateServiceCategorySchema,
  updateServiceSchema,
} from '@elite/shared';
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  ServiceCategorySummary,
  ServiceDetail,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
} from '@elite/shared';
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
import {
  CreateCategoryUseCase,
  CreateServiceUseCase,
  ListCategoriesUseCase,
  ListServicesUseCase,
  UpdateCategoryUseCase,
  UpdateServiceUseCase,
} from '../application/catalog.usecases';

function notFound(what: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: what }),
  });
}

/**
 * Catalogo de carwash desde la oficina. El `?area=` del contrato es siempre
 * `CARWASH` en esta spec, asi que no se lee: el repositorio ya filtra por area
 * y una ruta que aceptara el parametro invitaria a listar el taller desde una
 * pantalla de lavado (RN-1).
 */
@Controller('service-categories')
export class ServiceCategoriesController {
  private static readonly categoryId = notFound('Esa categoría no existe.');

  constructor(
    private readonly listCategories: ListCategoriesUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.services.actions.read.key)
  findAll(): Promise<ServiceCategorySummary[]> {
    return this.listCategories.execute();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.services.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createServiceCategorySchema)) input: CreateServiceCategoryInput,
  ): Promise<ServiceCategorySummary> {
    return this.createCategory.execute(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.services.actions.manage.key)
  update(
    @Param('id', ServiceCategoriesController.categoryId) id: string,
    @Body(new ZodValidationPipe(updateServiceCategorySchema)) input: UpdateServiceCategoryInput,
  ): Promise<ServiceCategorySummary> {
    return this.updateCategory.execute(id, input);
  }
}

@Controller('services')
export class ServicesController {
  private static readonly serviceId = notFound('Ese servicio no existe.');

  constructor(
    private readonly listServices: ListServicesUseCase,
    private readonly createService: CreateServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.services.actions.read.key)
  findAll(): Promise<ServiceDetail[]> {
    return this.listServices.execute();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.services.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createServiceSchema)) input: CreateServiceInput,
  ): Promise<ServiceDetail> {
    return this.createService.execute(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.services.actions.manage.key)
  update(
    @Param('id', ServicesController.serviceId) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) input: UpdateServiceInput,
  ): Promise<ServiceDetail> {
    return this.updateService.execute(id, input);
  }
}
