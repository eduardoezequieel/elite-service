-- Spec 072: la categoria de inventario tiene tipo (PRODUCT o SUPPLY).
--
-- Reparto de las que ya existen:
--   * solo insumos (y al menos uno)  -> SUPPLY
--   * solo productos o vacia         -> PRODUCT
--   * con los dos tipos              -> queda PRODUCT y se crea una gemela
--     SUPPLY con el mismo nombre, orden y estado, a la que pasan sus insumos.
-- Ningun articulo queda sin categoria. El nombre pasa a ser unico por tipo.

-- AlterTable
ALTER TABLE "inventory_categories" ADD COLUMN "kind" "InventoryItemKind";

-- Solo insumos -> SUPPLY
UPDATE "inventory_categories" c
SET "kind" = 'SUPPLY'
WHERE EXISTS (
    SELECT 1 FROM "inventory_items" i
    WHERE i."categoryId" = c."id" AND i."kind" = 'SUPPLY'
)
AND NOT EXISTS (
    SELECT 1 FROM "inventory_items" i
    WHERE i."categoryId" = c."id" AND i."kind" = 'PRODUCT'
);

-- El resto (solo productos, vacias o mixtas) -> PRODUCT
UPDATE "inventory_categories" SET "kind" = 'PRODUCT' WHERE "kind" IS NULL;

-- Mixtas: gemela SUPPLY y sus insumos pasan a ella.
CREATE TEMP TABLE "_category_twins" AS
SELECT c."id" AS "sourceId", gen_random_uuid() AS "twinId", c."name", c."sortOrder", c."isActive"
FROM "inventory_categories" c
WHERE c."kind" = 'PRODUCT'
AND EXISTS (
    SELECT 1 FROM "inventory_items" i
    WHERE i."categoryId" = c."id" AND i."kind" = 'SUPPLY'
);

INSERT INTO "inventory_categories" ("id", "kind", "name", "sortOrder", "isActive")
SELECT t."twinId", 'SUPPLY', t."name", t."sortOrder", t."isActive"
FROM "_category_twins" t;

UPDATE "inventory_items" i
SET "categoryId" = t."twinId"
FROM "_category_twins" t
WHERE i."categoryId" = t."sourceId" AND i."kind" = 'SUPPLY';

DROP TABLE "_category_twins";

ALTER TABLE "inventory_categories" ALTER COLUMN "kind" SET NOT NULL;

-- DropIndex
DROP INDEX "inventory_categories_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_kind_name_key" ON "inventory_categories"("kind", "name");
