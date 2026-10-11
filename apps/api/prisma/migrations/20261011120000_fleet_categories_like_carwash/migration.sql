-- spec 113: la flota usa los tipos del lavado, sin la moto.
UPDATE "fleet_vehicles" SET "category" = 'SEDAN' WHERE "category" IN ('HATCHBACK', 'OTHER');
UPDATE "fleet_vehicles" SET "category" = 'SUV' WHERE "category" = 'VAN';

-- AlterEnum
CREATE TYPE "FleetVehicleCategory_new" AS ENUM ('SEDAN', 'SUV', 'PICKUP');
ALTER TABLE "fleet_vehicles" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "fleet_vehicles" ALTER COLUMN "category" TYPE "FleetVehicleCategory_new" USING ("category"::text::"FleetVehicleCategory_new");
ALTER TYPE "FleetVehicleCategory" RENAME TO "FleetVehicleCategory_old";
ALTER TYPE "FleetVehicleCategory_new" RENAME TO "FleetVehicleCategory";
DROP TYPE "FleetVehicleCategory_old";
ALTER TABLE "fleet_vehicles" ALTER COLUMN "category" SET DEFAULT 'SEDAN';
