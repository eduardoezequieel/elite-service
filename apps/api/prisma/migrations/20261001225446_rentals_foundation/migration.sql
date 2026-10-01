-- CreateEnum
CREATE TYPE "FleetVehicleCategory" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'PICKUP', 'VAN', 'OTHER');

-- CreateEnum
CREATE TYPE "FleetVehicleStatus" AS ENUM ('ACTIVE', 'IN_SHOP', 'RETIRED');

-- CreateEnum
CREATE TYPE "StoredFileKind" AS ENUM ('INSPECTION_PHOTO', 'LOGO');

-- CreateEnum
CREATE TYPE "RentalAgreementStatus" AS ENUM ('RESERVED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalCoverage" AS ENUM ('UNDEFINED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FleetExpenseType" AS ENUM ('MAINTENANCE', 'TIRES', 'REPAIR', 'FINE', 'FUEL', 'INSURANCE', 'GPS', 'WASH', 'OTHER');

-- CreateTable
CREATE TABLE "fleet_vehicles" (
    "id" UUID NOT NULL,
    "plate" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "color" TEXT,
    "category" "FleetVehicleCategory" NOT NULL DEFAULT 'SEDAN',
    "status" "FleetVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "dailyRate" DECIMAL(12,2) NOT NULL,
    "weeklyRate" DECIMAL(12,2),
    "monthlyRate" DECIMAL(12,2),
    "freeKmPerDay" INTEGER,
    "extraKmPrice" DECIMAL(12,2),
    "odometerKm" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(12,2),
    "purchasedAt" DATE,
    "financed" BOOLEAN NOT NULL DEFAULT false,
    "downPayment" DECIMAL(12,2),
    "installment" DECIMAL(12,2),
    "termMonths" INTEGER,
    "financingStartedAt" DATE,
    "insuranceMonthly" DECIMAL(12,2),
    "gpsMonthly" DECIMAL(12,2),
    "otherFixedMonthly" DECIMAL(12,2),
    "insuranceExpiresAt" DATE,
    "registrationExpiresAt" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_customers" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentId" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiresAt" DATE,
    "birthDate" DATE,
    "country" TEXT,
    "mobilePhone" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "workplace" TEXT,
    "permanentAddress" TEXT,
    "permanentPhone" TEXT,
    "representative" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_settings" (
    "key" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL,
    "taxId" TEXT,
    "nrc" TEXT,
    "address" TEXT,
    "phones" TEXT,
    "email" TEXT,
    "lessorName" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'San Salvador',
    "contractStartNumber" INTEGER NOT NULL DEFAULT 733,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "defaultCdwPerDay" DECIMAL(12,2),
    "defaultDeductible" DECIMAL(12,2),
    "bufferHours" INTEGER NOT NULL DEFAULT 1,
    "graceHours" INTEGER NOT NULL DEFAULT 1,
    "minDriverAge" INTEGER NOT NULL DEFAULT 21,
    "kmAlert" INTEGER NOT NULL DEFAULT 500,
    "daysAlert" INTEGER NOT NULL DEFAULT 7,
    "interestRate" DECIMAL(5,2),
    "lateInterestRate" DECIMAL(5,2),
    "contractIntro" TEXT NOT NULL,
    "clauses" JSONB NOT NULL,
    "accessories" JSONB NOT NULL,
    "logoFileId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "kind" "StoredFileKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storedName" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_agreements" (
    "id" UUID NOT NULL,
    "contractNumber" INTEGER,
    "status" "RentalAgreementStatus" NOT NULL DEFAULT 'RESERVED',
    "customerId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "plannedPickupAt" TIMESTAMP(3) NOT NULL,
    "plannedReturnAt" TIMESTAMP(3) NOT NULL,
    "actualPickupAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "pickupLocation" TEXT NOT NULL DEFAULT 'Oficina',
    "returnLocation" TEXT NOT NULL DEFAULT 'Oficina',
    "dailyRate" DECIMAL(12,2) NOT NULL,
    "billableDays" INTEGER NOT NULL,
    "cdwPerDay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductible" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coverage" "RentalCoverage" NOT NULL DEFAULT 'UNDEFINED',
    "includesVat" BOOLEAN NOT NULL DEFAULT true,
    "extraCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extraChargesNote" TEXT,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extraKmCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositMethod" "PaymentMethod",
    "depositReturnedAmount" DECIMAL(12,2),
    "depositReturnedAt" TIMESTAMP(3),
    "depositReturnNote" TEXT,
    "depositTransferredToId" UUID,
    "cardLast4" TEXT,
    "authorizationCode" TEXT,
    "authorizationAmount" DECIMAL(12,2),
    "authorizationDate" DATE,
    "additionalDriver" JSONB,
    "pickupInspection" JSONB,
    "returnInspection" JSONB,
    "pickupOdometerKm" INTEGER,
    "returnOdometerKm" INTEGER,
    "previousAgreementId" UUID,
    "swapReason" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "previousReturnAt" TIMESTAMP(3) NOT NULL,
    "newReturnAt" TIMESTAMP(3) NOT NULL,
    "addedDays" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_payments" (
    "id" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "receivedByUserId" UUID NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_fines" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "agreementId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "chargedToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plan_tasks" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalKm" INTEGER,
    "intervalDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "maintenance_plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "taskId" UUID,
    "performedAt" DATE NOT NULL,
    "odometerKm" INTEGER,
    "cost" DECIMAL(12,2),
    "shop" TEXT,
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_expenses" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "type" "FleetExpenseType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incurredAt" DATE NOT NULL,
    "odometerKm" INTEGER,
    "description" TEXT,
    "maintenanceLogId" UUID,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fleet_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fleet_vehicles_plate_key" ON "fleet_vehicles"("plate");

-- CreateIndex
CREATE INDEX "fleet_vehicles_status_idx" ON "fleet_vehicles"("status");

-- CreateIndex
CREATE INDEX "rental_customers_fullName_idx" ON "rental_customers"("fullName");

-- CreateIndex
CREATE INDEX "rental_customers_documentId_idx" ON "rental_customers"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_agreements_contractNumber_key" ON "rental_agreements"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rental_agreements_depositTransferredToId_key" ON "rental_agreements"("depositTransferredToId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_agreements_previousAgreementId_key" ON "rental_agreements"("previousAgreementId");

-- CreateIndex
CREATE INDEX "rental_agreements_status_idx" ON "rental_agreements"("status");

-- CreateIndex
CREATE INDEX "rental_agreements_vehicleId_status_idx" ON "rental_agreements"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "rental_agreements_customerId_idx" ON "rental_agreements"("customerId");

-- CreateIndex
CREATE INDEX "rental_agreements_plannedPickupAt_idx" ON "rental_agreements"("plannedPickupAt");

-- CreateIndex
CREATE INDEX "rental_agreements_plannedReturnAt_idx" ON "rental_agreements"("plannedReturnAt");

-- CreateIndex
CREATE INDEX "rental_extensions_agreementId_idx" ON "rental_extensions"("agreementId");

-- CreateIndex
CREATE INDEX "rental_payments_agreementId_idx" ON "rental_payments"("agreementId");

-- CreateIndex
CREATE INDEX "rental_payments_paidAt_idx" ON "rental_payments"("paidAt");

-- CreateIndex
CREATE INDEX "rental_fines_vehicleId_idx" ON "rental_fines"("vehicleId");

-- CreateIndex
CREATE INDEX "rental_fines_agreementId_idx" ON "rental_fines"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_plan_tasks_key_key" ON "maintenance_plan_tasks"("key");

-- CreateIndex
CREATE INDEX "maintenance_logs_vehicleId_performedAt_idx" ON "maintenance_logs"("vehicleId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_expenses_maintenanceLogId_key" ON "fleet_expenses"("maintenanceLogId");

-- CreateIndex
CREATE INDEX "fleet_expenses_vehicleId_incurredAt_idx" ON "fleet_expenses"("vehicleId", "incurredAt");

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "rental_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "fleet_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_previousAgreementId_fkey" FOREIGN KEY ("previousAgreementId") REFERENCES "rental_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "rental_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "rental_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_fines" ADD CONSTRAINT "rental_fines_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "fleet_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_fines" ADD CONSTRAINT "rental_fines_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "rental_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "fleet_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "maintenance_plan_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_expenses" ADD CONSTRAINT "fleet_expenses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "fleet_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_expenses" ADD CONSTRAINT "fleet_expenses_maintenanceLogId_fkey" FOREIGN KEY ("maintenanceLogId") REFERENCES "maintenance_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
