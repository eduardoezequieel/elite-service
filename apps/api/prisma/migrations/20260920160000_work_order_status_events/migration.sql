-- Spec 046: la linea de tiempo de un lavado. Tabla de solo agregar: cada fila
-- es una entrada a un estado, con el actor congelado por nombre (RN-4). Los
-- lavados anteriores a esta migracion no se reconstruyen (RN-8): quedan sin
-- filas y el API los devuelve como `recorded: false`.
CREATE TYPE "StatusActorKind" AS ENUM ('USER', 'EMPLOYEE');

CREATE TABLE "work_order_status_events" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "actorKind" "StatusActorKind",
    "actorUserId" UUID,
    "actorEmployeeId" UUID,
    "actorName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_order_status_events_workOrderId_occurredAt_idx"
    ON "work_order_status_events"("workOrderId", "occurredAt");

ALTER TABLE "work_order_status_events"
    ADD CONSTRAINT "work_order_status_events_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_order_status_events"
    ADD CONSTRAINT "work_order_status_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_status_events"
    ADD CONSTRAINT "work_order_status_events_actorEmployeeId_fkey"
    FOREIGN KEY ("actorEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
