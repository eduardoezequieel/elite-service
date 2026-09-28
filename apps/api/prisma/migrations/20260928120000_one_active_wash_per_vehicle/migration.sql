-- At most one uncharged wash per vehicle (spec 090 RN-1). PAID and VOID rows
-- stay out of the index, so a car keeps its whole history.
CREATE UNIQUE INDEX "work_orders_one_active_per_vehicle" ON "work_orders"("vehicleId") WHERE "status" IN ('OPEN', 'WASHING', 'READY');
