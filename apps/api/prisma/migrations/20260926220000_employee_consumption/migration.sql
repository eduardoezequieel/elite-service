-- spec 070: consumo de empleados.

-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'CONSUMPTION';
ALTER TYPE "InventoryMovementType" ADD VALUE 'CONSUMPTION_RETURN';

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "unitPrice" DECIMAL(12,2),
ADD COLUMN "reversesMovementId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_reversesMovementId_key" ON "inventory_movements"("reversesMovementId");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversesMovementId_fkey" FOREIGN KEY ("reversesMovementId") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
