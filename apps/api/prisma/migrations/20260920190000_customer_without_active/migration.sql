-- Un cliente no es un actor del sistema: no se desactiva (spec 048).
-- Destructiva: quien estaba desactivado vuelve a verse y a sugerirse.
-- AlterTable
ALTER TABLE "customers" DROP COLUMN "isActive";
