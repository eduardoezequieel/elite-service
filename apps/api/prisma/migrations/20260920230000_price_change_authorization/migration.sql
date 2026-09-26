-- Spec 060: cambiar un precio pide autorizacion.
--
-- Desde que el lavado queda READY el precio se cierra: cambiarlo exige la firma
-- de alguien con `carwash.discount` (045). La firma se guarda en la linea y el
-- cambio deja ademas una fila en el historial del lavado, para que la linea de
-- tiempo de la 046 lo muestre sin consultar otra tabla.
--
-- Las lineas que ya existen quedan con las cuatro columnas en null: precio de
-- catalogo, o descuento hecho con el lavado abierto, que no pide autorizacion.

-- CreateEnum
CREATE TYPE "WorkOrderEventKind" AS ENUM ('STATUS', 'PRICE_CHANGED');

-- AlterTable
ALTER TABLE "work_order_items" ADD COLUMN "priceAuthorizedByUserId" UUID;
ALTER TABLE "work_order_items" ADD COLUMN "priceAuthorizedAt" TIMESTAMP(3);
ALTER TABLE "work_order_items" ADD COLUMN "priceReason" TEXT;
ALTER TABLE "work_order_items" ADD COLUMN "previousUnitPrice" DECIMAL(12,2);

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_priceAuthorizedByUserId_fkey" FOREIGN KEY ("priceAuthorizedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
-- `kind` con default STATUS: las filas de la 046 que ya existen son todas
-- cambios de estado, que es lo unico que arma tramos en la linea de tiempo.
ALTER TABLE "work_order_status_events" ADD COLUMN "kind" "WorkOrderEventKind" NOT NULL DEFAULT 'STATUS';
ALTER TABLE "work_order_status_events" ADD COLUMN "itemId" UUID;
ALTER TABLE "work_order_status_events" ADD COLUMN "serviceName" TEXT;
ALTER TABLE "work_order_status_events" ADD COLUMN "previousUnitPrice" DECIMAL(12,2);
ALTER TABLE "work_order_status_events" ADD COLUMN "newUnitPrice" DECIMAL(12,2);
ALTER TABLE "work_order_status_events" ADD COLUMN "reason" TEXT;
