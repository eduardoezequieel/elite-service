-- Spec 067: una categoria cuenta como extra en Rendimiento.
--
-- Los servicios de una categoria con `isExtra` son lo que se vende ademas del
-- lavado (RN-4). Por defecto todas lo son; la del lavado principal del seed,
-- «Lavado premium», queda en false.

-- AlterTable
ALTER TABLE "service_categories" ADD COLUMN "isExtra" BOOLEAN NOT NULL DEFAULT true;

-- Data
UPDATE "service_categories" SET "isExtra" = false WHERE "area" = 'CARWASH' AND "name" = 'Lavado premium';
