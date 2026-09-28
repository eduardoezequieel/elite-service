import {
  API_ERROR_CODES,
  PERMISSIONS,
  consumptionRangeQuerySchema,
  createInventoryAdjustmentSchema,
  createInventoryCategorySchema,
  createInventoryConsumptionSchema,
  createInventoryDeliverySchema,
  createInventoryDispatchSchema,
  createInventoryEntriesSchema,
  createInventoryEntrySchema,
  createInventoryItemSchema,
  inventoryCategoriesQuerySchema,
  inventoryItemMovementsQuerySchema,
  inventoryItemsQuerySchema,
  inventoryMovementsQuerySchema,
  reverseInventoryConsumptionSchema,
  updateInventoryCategorySchema,
  updateInventoryItemSchema,
} from '@elite/shared';
import type {
  ConsumptionRangeQuery,
  CreateInventoryAdjustmentInput,
  CreateInventoryCategoryInput,
  CreateInventoryConsumptionInput,
  CreateInventoryDeliveryInput,
  CreateInventoryDispatchInput,
  CreateInventoryEntriesInput,
  CreateInventoryEntryInput,
  CreateInventoryItemInput,
  EmployeeConsumptionDetail,
  EmployeeConsumptionReport,
  InventoryBatchResult,
  InventoryCategoriesQuery,
  InventoryCategory,
  InventoryEmployeeOption,
  InventoryItem,
  InventoryItemMovementsQuery,
  InventoryItemsQuery,
  InventoryMovement,
  InventoryMovementResult,
  InventoryMovementsQuery,
  Page,
  ReverseInventoryConsumptionInput,
  UpdateInventoryCategoryInput,
  UpdateInventoryItemInput,
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
  Query,
} from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { InventoryBatchUseCases } from '../application/inventory-batch.usecases';
import { InventoryCatalogUseCases } from '../application/inventory-catalog.usecases';
import { InventoryConsumptionUseCases } from '../application/inventory-consumption.usecases';
import {
  InventoryMovementUseCases,
  type InventoryActor,
} from '../application/inventory-movement.usecases';

const { read, manage, move, adjust } = PERMISSIONS.inventory.actions;

/** Quien registra, sacado de la sesión que resolvió el guard (RN-10). */
function actorOf(user: AuthenticatedUser): InventoryActor {
  return { userId: user.id, event: { kind: 'user', id: user.id, name: user.fullName } };
}

/**
 * `/api/inventory` (065). Solo sesión de oficina; cada ruta con su clave
 * `inventory.*`, nunca por nombre de rol. Corregir existencia (`adjust`) va
 * separado de registrar entradas y despachos (`move`): es más delicado (RN-12).
 */
@Controller('inventory')
export class InventoryController {
  private static readonly categoryId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa categoría no existe.',
      }),
  });

  private static readonly itemId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese artículo no existe.',
      }),
  });

  private static readonly movementId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese consumo no existe.',
      }),
  });

  private static readonly employeeId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        message: 'Ese empleado no existe.',
      }),
  });

  constructor(
    private readonly catalog: InventoryCatalogUseCases,
    private readonly movements: InventoryMovementUseCases,
    private readonly consumptions: InventoryConsumptionUseCases,
    private readonly batch: InventoryBatchUseCases,
  ) {}

  // --- categorías ---

  @Get('categories')
  @RequirePermissions(read.key)
  listCategories(
    @Query(new ZodValidationPipe(inventoryCategoriesQuerySchema)) query: InventoryCategoriesQuery,
  ): Promise<InventoryCategory[]> {
    return this.catalog.listCategories(query);
  }

  @Post('categories')
  @RequirePermissions(manage.key)
  createCategory(
    @Body(new ZodValidationPipe(createInventoryCategorySchema)) input: CreateInventoryCategoryInput,
  ): Promise<InventoryCategory> {
    return this.catalog.createCategory(input);
  }

  @Patch('categories/:id')
  @RequirePermissions(manage.key)
  updateCategory(
    @Param('id', InventoryController.categoryId) id: string,
    @Body(new ZodValidationPipe(updateInventoryCategorySchema)) input: UpdateInventoryCategoryInput,
  ): Promise<InventoryCategory> {
    return this.catalog.updateCategory(id, input);
  }

  // --- artículos ---

  @Get('items')
  @RequirePermissions(read.key)
  listItems(
    @Query(new ZodValidationPipe(inventoryItemsQuerySchema)) query: InventoryItemsQuery,
  ): Promise<Page<InventoryItem>> {
    return this.catalog.listItems(query);
  }

  @Post('items')
  @RequirePermissions(manage.key)
  createItem(
    @Body(new ZodValidationPipe(createInventoryItemSchema)) input: CreateInventoryItemInput,
  ): Promise<InventoryItem> {
    return this.catalog.createItem(input);
  }

  @Get('items/:id')
  @RequirePermissions(read.key)
  findItem(@Param('id', InventoryController.itemId) id: string): Promise<InventoryItem> {
    return this.catalog.findItem(id);
  }

  /** `kind` no se acepta (RN-1): el schema lo descarta. */
  @Patch('items/:id')
  @RequirePermissions(manage.key)
  updateItem(
    @Param('id', InventoryController.itemId) id: string,
    @Body(new ZodValidationPipe(updateInventoryItemSchema)) input: UpdateInventoryItemInput,
  ): Promise<InventoryItem> {
    return this.catalog.updateItem(id, input);
  }

  // --- movimientos ---

  @Get('items/:id/movements')
  @RequirePermissions(read.key)
  itemMovements(
    @Param('id', InventoryController.itemId) id: string,
    @Query(new ZodValidationPipe(inventoryItemMovementsQuerySchema))
    query: InventoryItemMovementsQuery,
  ): Promise<Page<InventoryMovement>> {
    return this.movements.listItemMovements(id, query);
  }

  @Post('items/:id/entries')
  @RequirePermissions(move.key)
  registerEntry(
    @Param('id', InventoryController.itemId) id: string,
    @Body(new ZodValidationPipe(createInventoryEntrySchema)) input: CreateInventoryEntryInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryMovementResult> {
    return this.movements.registerEntry(id, input, actorOf(user));
  }

  @Post('items/:id/dispatches')
  @RequirePermissions(move.key)
  dispatch(
    @Param('id', InventoryController.itemId) id: string,
    @Body(new ZodValidationPipe(createInventoryDispatchSchema)) input: CreateInventoryDispatchInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryMovementResult> {
    return this.movements.dispatch(id, input, actorOf(user));
  }

  @Post('items/:id/adjustments')
  @RequirePermissions(adjust.key)
  adjust(
    @Param('id', InventoryController.itemId) id: string,
    @Body(new ZodValidationPipe(createInventoryAdjustmentSchema))
    input: CreateInventoryAdjustmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryMovementResult> {
    return this.movements.adjust(id, input, actorOf(user));
  }

  // --- varios artículos a la vez (091): todo o nada ---

  /** Lo que llegó, con una sola referencia (la factura). */
  @Post('entries')
  @RequirePermissions(move.key)
  recordEntries(
    @Body(new ZodValidationPipe(createInventoryEntriesSchema)) input: CreateInventoryEntriesInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryBatchResult> {
    return this.batch.recordEntries(input, actorOf(user));
  }

  /** Lo que se lleva un trabajador: producto → consumo, insumo → despacho (091 RN-1). */
  @Post('deliveries')
  @RequirePermissions(move.key)
  deliver(
    @Body(new ZodValidationPipe(createInventoryDeliverySchema)) input: CreateInventoryDeliveryInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryBatchResult> {
    return this.batch.deliver(input, actorOf(user));
  }

  /** Empleados activos para el diálogo «Despachar», sin pedir `employees.read` (RN-10). */
  @Get('employees')
  @RequirePermissions(move.key)
  listEmployees(): Promise<InventoryEmployeeOption[]> {
    return this.movements.listDispatchEmployees();
  }

  @Get('movements')
  @RequirePermissions(read.key)
  listMovements(
    @Query(new ZodValidationPipe(inventoryMovementsQuerySchema)) query: InventoryMovementsQuery,
  ): Promise<Page<InventoryMovement>> {
    return this.movements.listMovements(query);
  }

  // --- consumo de empleados (070): solo oficina, sin cobro ---

  @Post('items/:id/consumptions')
  @RequirePermissions(move.key)
  recordConsumption(
    @Param('id', InventoryController.itemId) id: string,
    @Body(new ZodValidationPipe(createInventoryConsumptionSchema))
    input: CreateInventoryConsumptionInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryMovementResult> {
    return this.consumptions.record(id, input, actorOf(user));
  }

  @Post('consumptions/:movementId/reverse')
  @RequirePermissions(move.key)
  reverseConsumption(
    @Param('movementId', InventoryController.movementId) movementId: string,
    @Body(new ZodValidationPipe(reverseInventoryConsumptionSchema))
    input: ReverseInventoryConsumptionInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryMovementResult> {
    return this.consumptions.reverse(movementId, input, actorOf(user));
  }

  @Get('consumptions')
  @RequirePermissions(read.key)
  consumptionReport(
    @Query(new ZodValidationPipe(consumptionRangeQuerySchema)) query: ConsumptionRangeQuery,
  ): Promise<EmployeeConsumptionReport> {
    return this.consumptions.report(query);
  }

  @Get('consumptions/:employeeId')
  @RequirePermissions(read.key)
  employeeConsumption(
    @Param('employeeId', InventoryController.employeeId) employeeId: string,
    @Query(new ZodValidationPipe(consumptionRangeQuerySchema)) query: ConsumptionRangeQuery,
  ): Promise<EmployeeConsumptionDetail> {
    return this.consumptions.detail(employeeId, query);
  }
}
