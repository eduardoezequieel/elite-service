import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import {
  CreateCategoryUseCase,
  CreateServiceUseCase,
  ListCategoriesUseCase,
  ListServicesUseCase,
  UpdateCategoryUseCase,
  UpdateServiceUseCase,
} from './application/catalog.usecases';
import { SERVICE_CATALOG_REPOSITORY } from './application/ports/service-catalog.repository';
import type { ServiceCatalogRepository } from './application/ports/service-catalog.repository';
import { PrismaServiceCatalogRepository } from './infrastructure/prisma-service-catalog.repository';
import {
  ServiceCategoriesController,
  ServicesController,
} from './presentation/services.controller';

/** Catalogo de carwash. Exporta lo que la pista lee para armar un ticket. */
@Module({
  imports: [PrismaModule],
  controllers: [ServiceCategoriesController, ServicesController],
  providers: [
    { provide: SERVICE_CATALOG_REPOSITORY, useClass: PrismaServiceCatalogRepository },
    {
      provide: ListCategoriesUseCase,
      useFactory: (c: ServiceCatalogRepository) => new ListCategoriesUseCase(c),
      inject: [SERVICE_CATALOG_REPOSITORY],
    },
    {
      provide: CreateCategoryUseCase,
      useFactory: (c: ServiceCatalogRepository) => new CreateCategoryUseCase(c),
      inject: [SERVICE_CATALOG_REPOSITORY],
    },
    {
      provide: UpdateCategoryUseCase,
      useFactory: (c: ServiceCatalogRepository) => new UpdateCategoryUseCase(c),
      inject: [SERVICE_CATALOG_REPOSITORY],
    },
    {
      provide: ListServicesUseCase,
      useFactory: (c: ServiceCatalogRepository) => new ListServicesUseCase(c),
      inject: [SERVICE_CATALOG_REPOSITORY],
    },
    {
      provide: CreateServiceUseCase,
      useFactory: (c: ServiceCatalogRepository) => new CreateServiceUseCase(c),
      inject: [SERVICE_CATALOG_REPOSITORY],
    },
    {
      provide: UpdateServiceUseCase,
      useFactory: (c: ServiceCatalogRepository) => new UpdateServiceUseCase(c),
      inject: [SERVICE_CATALOG_REPOSITORY],
    },
  ],
  exports: [SERVICE_CATALOG_REPOSITORY, ListServicesUseCase],
})
export class ServicesModule {}
