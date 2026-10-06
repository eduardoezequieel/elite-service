-- AlterTable
ALTER TABLE "rental_payments" ADD COLUMN "cashSessionId" UUID;

-- CreateTable
CREATE TABLE "rental_cash_sessions" (
    "id" UUID NOT NULL,
    "status" "CashSessionStatus" NOT NULL,
    "openedByUserId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DECIMAL(12,2) NOT NULL,
    "closedByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "countedCash" DECIMAL(12,2),
    "cashTotal" DECIMAL(12,2),
    "cardTotal" DECIMAL(12,2),
    "transferTotal" DECIMAL(12,2),
    "otherTotal" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2),
    "differenceCash" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_cash_sessions_status_idx" ON "rental_cash_sessions"("status");

-- CreateIndex
CREATE INDEX "rental_cash_sessions_openedAt_idx" ON "rental_cash_sessions"("openedAt");

-- CreateIndex
CREATE INDEX "rental_payments_cashSessionId_idx" ON "rental_payments"("cashSessionId");

-- A lo sumo un turno OPEN (109 RN-1). Postgres deja pasar muchas filas CLOSED.
CREATE UNIQUE INDEX "rental_cash_sessions_one_open" ON "rental_cash_sessions"("status") WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "rental_cash_sessions" ADD CONSTRAINT "rental_cash_sessions_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_cash_sessions" ADD CONSTRAINT "rental_cash_sessions_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "rental_cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
