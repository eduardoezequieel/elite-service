-- spec 105: cuentas abiertas. Aditiva: dos tablas nuevas y dos columnas nulas (payments.tabId,
-- inventory_movements.tabLineId). El consumo de la 070 deja de crearse, pero su enum y sus filas quedan.
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tabId" UUID;

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "tabLineId" UUID;

-- CreateTable
CREATE TABLE "tabs" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "employeeId" UUID,
    "customerId" UUID,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "openedByUserId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tab_lines" (
    "id" UUID NOT NULL,
    "tabId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" UUID,
    "voidReason" TEXT,

    CONSTRAINT "tab_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tabs_number_key" ON "tabs"("number");

-- CreateIndex
CREATE INDEX "tabs_closedAt_balance_idx" ON "tabs"("closedAt", "balance");

-- CreateIndex
CREATE INDEX "tabs_employeeId_idx" ON "tabs"("employeeId");

-- CreateIndex
CREATE INDEX "tabs_customerId_idx" ON "tabs"("customerId");

-- CreateIndex
CREATE INDEX "tab_lines_tabId_idx" ON "tab_lines"("tabId");

-- CreateIndex
CREATE INDEX "tab_lines_inventoryItemId_idx" ON "tab_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "payments_tabId_idx" ON "payments"("tabId");

-- CreateIndex
CREATE INDEX "inventory_movements_tabLineId_idx" ON "inventory_movements"("tabLineId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tabLineId_fkey" FOREIGN KEY ("tabLineId") REFERENCES "tab_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_lines" ADD CONSTRAINT "tab_lines_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_lines" ADD CONSTRAINT "tab_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_lines" ADD CONSTRAINT "tab_lines_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_lines" ADD CONSTRAINT "tab_lines_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Un titular, exactamente uno: un empleado o un cliente (105 RN-1).
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_one_holder" CHECK (num_nonnulls("employeeId", "customerId") = 1);

-- El saldo es lo anotado menos lo abonado y nunca baja de cero (105 RN-6, RN-7).
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_balance_consistent" CHECK ("paid" >= 0 AND "balance" >= 0 AND "balance" = "total" - "paid");

-- Una sola cuenta abierta por titular (105 RN-2): dos cajas anotando a la vez a
-- alguien sin cuenta no le abren dos.
CREATE UNIQUE INDEX "tabs_one_open_per_employee" ON "tabs"("employeeId") WHERE "closedAt" IS NULL AND "employeeId" IS NOT NULL;
CREATE UNIQUE INDEX "tabs_one_open_per_customer" ON "tabs"("customerId") WHERE "closedAt" IS NULL AND "customerId" IS NOT NULL;

-- Un pago es de un lavado, de una venta suelta o el abono a una cuenta: uno solo
-- (065 RN-20, ampliado por la 105).
ALTER TABLE "payments" DROP CONSTRAINT "payments_one_owner";
ALTER TABLE "payments" ADD CONSTRAINT "payments_one_owner" CHECK (num_nonnulls("workOrderId", "counterSaleId", "tabId") = 1);
