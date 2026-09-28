-- Spec 074: el rol del sistema se marca con una columna, no por su nombre.
--
-- El seed solo le agrega permisos al rol con `isSystem` y el API no deja
-- borrarlo ni quitarle `roles.manage`. Se marca el que el seed ya habia creado:
-- el llamado `Administrator` o `Administrador`; si estan los dos, el mas viejo.
-- Si no hay ninguno, no se marca nada y el seed crea uno marcado.

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Data
UPDATE "roles" SET "isSystem" = true
WHERE "id" = (
    SELECT "id" FROM "roles"
    WHERE "name" IN ('Administrator', 'Administrador')
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1
);
