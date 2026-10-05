-- spec 104: combos del lavado. Aditiva: tablas nuevas y dos columnas nulas en work_order_items.
-- CreateEnum
CREATE TYPE "ComboPricingMode" AS ENUM ('FIXED', 'PERCENT');

-- AlterTable
ALTER TABLE "work_order_items" ADD COLUMN     "comboId" UUID,
ADD COLUMN     "comboName" TEXT;

-- CreateTable
CREATE TABLE "combos" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingMode" "ComboPricingMode" NOT NULL,
    "discountPercent" INTEGER,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "weekdays" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_items" (
    "id" UUID NOT NULL,
    "comboId" UUID NOT NULL,
    "kind" "WorkOrderItemKind" NOT NULL,
    "serviceId" UUID,
    "inventoryItemId" UUID,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_prices" (
    "comboId" UUID NOT NULL,
    "bodyTypeId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "combo_prices_pkey" PRIMARY KEY ("comboId","bodyTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "combos_code_key" ON "combos"("code");

-- CreateIndex
CREATE INDEX "combo_items_comboId_idx" ON "combo_items"("comboId");

-- CreateIndex
CREATE INDEX "combo_items_serviceId_idx" ON "combo_items"("serviceId");

-- CreateIndex
CREATE INDEX "combo_items_inventoryItemId_idx" ON "combo_items"("inventoryItemId");

-- CreateIndex
CREATE INDEX "combo_prices_bodyTypeId_idx" ON "combo_prices"("bodyTypeId");

-- CreateIndex
CREATE INDEX "work_order_items_comboId_idx" ON "work_order_items"("comboId");

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "combos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_prices" ADD CONSTRAINT "combo_prices_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_prices" ADD CONSTRAINT "combo_prices_bodyTypeId_fkey" FOREIGN KEY ("bodyTypeId") REFERENCES "vehicle_body_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

