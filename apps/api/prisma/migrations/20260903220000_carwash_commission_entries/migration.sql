-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN "commissionTotal" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "work_orders_chargedAt_idx" ON "work_orders"("chargedAt");

-- CreateTable
CREATE TABLE "commission_entries" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_entries_employeeId_idx" ON "commission_entries"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_entries_workOrderId_employeeId_key" ON "commission_entries"("workOrderId", "employeeId");

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
