-- AlterTable
ALTER TABLE "rental_agreements" ADD COLUMN     "damageCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "damageLines" JSONB,
ADD COLUMN     "fuelCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;
