-- AlterEnum
ALTER TYPE "WorkOrderStatus" ADD VALUE 'WASHING';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN "washingStartedAt" TIMESTAMP(3);
