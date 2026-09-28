-- Spec 069: cuentas bancarias del negocio y metodo de pago «Otro».
--
-- Aditiva: nada existente se rellena. Las transferencias anteriores quedan con
-- `bankAccountId` nulo y se leen como «Sin cuenta» (RN-7); los turnos cerrados
-- antes quedan con `otherTotal` nulo.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('SAVINGS', 'CHECKING');

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "bank" TEXT NOT NULL,
    "type" "BankAccountType" NOT NULL,
    "number" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_bank_number_key" ON "bank_accounts"("bank", "number");

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "bankAccountId" UUID,
ADD COLUMN "reference" TEXT,
ADD COLUMN "description" TEXT;

-- CreateIndex
CREATE INDEX "payments_bankAccountId_idx" ON "payments"("bankAccountId");

-- AddForeignKey
-- Restrict: una cuenta con pagos no se borra (RN-3); se desactiva.
ALTER TABLE "payments" ADD CONSTRAINT "payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "cash_sessions" ADD COLUMN "otherTotal" DECIMAL(12,2);
