-- Spec 065: inventario (productos e insumos) y venta suelta.
--
-- Un solo inventario con dos tipos de articulo. El producto se vende como una
-- linea mas del lavado, o suelto en una venta que nace cobrada; el insumo se
-- despacha a un empleado. Todo cambio de existencia es una fila del kardex
-- (`inventory_movements`), de solo agregar.
--
-- Las lineas de lavado que ya existen quedan `kind = SERVICE`, `quantity = 1`.
-- `payments.workOrderId` pasa a nullable: desde aca un pago cuelga de un lavado
-- o de una venta suelta, exactamente de uno (CHECK). Nada se rellena hacia
-- atras.

-- CreateEnum
CREATE TYPE "InventoryItemKind" AS ENUM ('PRODUCT', 'SUPPLY');
CREATE TYPE "InventoryMovementType" AS ENUM ('ENTRY', 'SALE', 'SALE_RETURN', 'DISPATCH', 'ADJUSTMENT');
CREATE TYPE "WorkOrderItemKind" AS ENUM ('SERVICE', 'PRODUCT');
CREATE TYPE "CounterSaleStatus" AS ENUM ('PAID', 'VOID');

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "kind" "InventoryItemKind" NOT NULL,
    "categoryId" UUID,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0.1300,
    "averageCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockOnHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lowStockNotified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
    -- Nunca negativo (RN-3). El API lo valida con bloqueo de fila; esto es la
    -- ultima red si alguien escribe por otro camino.
    CONSTRAINT "inventory_items_stockOnHand_nonnegative" CHECK ("stockOnHand" >= 0)
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "balanceAfter" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "reference" TEXT,
    "reason" TEXT,
    "workOrderId" UUID,
    "counterSaleId" UUID,
    "employeeId" UUID,
    "createdByUserId" UUID,
    "createdByEmployeeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_balanceAfter_nonnegative" CHECK ("balanceAfter" >= 0)
);

-- CreateTable
CREATE TABLE "counter_sales" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "CounterSaleStatus" NOT NULL DEFAULT 'PAID',
    "customerName" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "chargeId" UUID,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedByUserId" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "counter_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_sale_items" (
    "id" UUID NOT NULL,
    "counterSaleId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "catalogPrice" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "taxRate" DECIMAL(6,4) NOT NULL,
    "priceAuthorizedByUserId" UUID,
    "priceReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counter_sale_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
-- Las lineas que ya existen son todas servicios con cantidad 1.
ALTER TABLE "work_order_items" ADD COLUMN "kind" "WorkOrderItemKind" NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "work_order_items" ADD COLUMN "inventoryItemId" UUID;
ALTER TABLE "work_order_items" ADD COLUMN "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1;

-- AlterTable
-- Un pago cuelga de un lavado o de una venta suelta, nunca de los dos ni de
-- ninguno (RN-20). Todos los pagos que ya existen tienen lavado.
ALTER TABLE "payments" ALTER COLUMN "workOrderId" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "counterSaleId" UUID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_one_owner" CHECK (num_nonnulls("workOrderId", "counterSaleId") = 1);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_code_key" ON "inventory_items"("code");
CREATE UNIQUE INDEX "inventory_items_barcode_key" ON "inventory_items"("barcode");
CREATE INDEX "inventory_items_kind_isActive_idx" ON "inventory_items"("kind", "isActive");
CREATE INDEX "inventory_items_name_idx" ON "inventory_items"("name");
CREATE INDEX "inventory_items_categoryId_idx" ON "inventory_items"("categoryId");

-- CreateIndex
CREATE INDEX "inventory_movements_itemId_createdAt_idx" ON "inventory_movements"("itemId", "createdAt");
CREATE INDEX "inventory_movements_type_createdAt_idx" ON "inventory_movements"("type", "createdAt");
CREATE INDEX "inventory_movements_workOrderId_idx" ON "inventory_movements"("workOrderId");
CREATE INDEX "inventory_movements_counterSaleId_idx" ON "inventory_movements"("counterSaleId");
CREATE INDEX "inventory_movements_employeeId_idx" ON "inventory_movements"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "counter_sales_number_key" ON "counter_sales"("number");
CREATE UNIQUE INDEX "counter_sales_chargeId_key" ON "counter_sales"("chargeId");
CREATE INDEX "counter_sales_createdAt_idx" ON "counter_sales"("createdAt");
CREATE INDEX "counter_sales_createdByUserId_idx" ON "counter_sales"("createdByUserId");

-- CreateIndex
CREATE INDEX "counter_sale_items_counterSaleId_idx" ON "counter_sale_items"("counterSaleId");
CREATE INDEX "counter_sale_items_inventoryItemId_idx" ON "counter_sale_items"("inventoryItemId");

-- CreateIndex
CREATE INDEX "work_order_items_inventoryItemId_idx" ON "work_order_items"("inventoryItemId");

-- CreateIndex
CREATE INDEX "payments_counterSaleId_idx" ON "payments"("counterSaleId");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_counterSaleId_fkey" FOREIGN KEY ("counterSaleId") REFERENCES "counter_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL: anular la venta borra su cobro (059) y la venta queda sin cuenta.
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sale_items" ADD CONSTRAINT "counter_sale_items_counterSaleId_fkey" FOREIGN KEY ("counterSaleId") REFERENCES "counter_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "counter_sale_items" ADD CONSTRAINT "counter_sale_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counter_sale_items" ADD CONSTRAINT "counter_sale_items_priceAuthorizedByUserId_fkey" FOREIGN KEY ("priceAuthorizedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_counterSaleId_fkey" FOREIGN KEY ("counterSaleId") REFERENCES "counter_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
