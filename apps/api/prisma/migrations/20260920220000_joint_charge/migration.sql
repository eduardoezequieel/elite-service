-- Spec 059: cuenta de cobro, pago partido y vuelto.
--
-- El cobro deja de colgar del lavado y pasa a ser una entidad propia que junta
-- 1..N lavados y 1..N pagos. Por eso `payments.workOrderId` deja de ser unico:
-- una cuenta escribe una fila por metodo y por lavado, con la parte que le toco
-- a ese lavado (RN-5).
--
-- Los pagos que ya existen quedan con `chargeId` nulo y se leen como hasta hoy.
-- No se rellenan cuentas hacia atras: inventar una cuenta por cada cobro viejo
-- seria escribir historia que nadie cobro asi.

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "cashTendered" DECIMAL(12,2),
    "changeGiven" DECIMAL(12,2),
    "chargedByUserId" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "chargedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charges_number_key" ON "charges"("number");
CREATE INDEX "charges_cashSessionId_idx" ON "charges"("cashSessionId");
CREATE INDEX "charges_chargedByUserId_idx" ON "charges"("chargedByUserId");
CREATE INDEX "charges_chargedAt_idx" ON "charges"("chargedAt");

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_chargedByUserId_fkey" FOREIGN KEY ("chargedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charges" ADD CONSTRAINT "charges_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "chargeId" UUID;

-- DropIndex
-- Un lavado puede tener varias filas de pago desde esta spec (RN-5).
DROP INDEX "payments_workOrderId_key";

-- CreateIndex
CREATE INDEX "payments_workOrderId_idx" ON "payments"("workOrderId");
CREATE INDEX "payments_chargeId_idx" ON "payments"("chargeId");

-- AddForeignKey
-- En cascada a proposito: deshacer una cuenta es borrar su fila, y sus pagos se
-- van con ella, igual que el reverso de la 045 borraba el pago suelto.
ALTER TABLE "payments" ADD CONSTRAINT "payments_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
