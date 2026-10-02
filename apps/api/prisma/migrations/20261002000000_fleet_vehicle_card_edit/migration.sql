-- spec 103: aseguradora, póliza y «la cuota incluye seguro y GPS». Aditiva.
ALTER TABLE "fleet_vehicles" ADD COLUMN     "insurer" TEXT,
ADD COLUMN     "policyNumber" TEXT,
ADD COLUMN     "installmentIncludesExtras" BOOLEAN NOT NULL DEFAULT false;
