# 099 — Mantenimiento de la flota y gastos por carro

**Estado:** Aprobada (por chat, 1 oct 2026, misma nota que la 095)
**Módulo:** fleet-maintenance (api) · features/fleet-maintenance (web) · `@elite/shared`
rentals/maintenance.ts | **Depende de:** 095 (corre en paralelo con 096 y 098)

## Contexto

Casi todos los carros están financiados y se mantienen en el taller de la familia (Elite Service).
La rentadora necesita saber qué le toca a cada carro (aceite cada 5.000 km o 90 días, revisión
general cada 30 días, etc.), avisar antes de que se pase, mandarle la lista al taller por WhatsApp,
y anotar cada gasto por carro (aceite, llantas, reparaciones, multas no cargadas, combustible,
seguro, GPS, lavado). Los lavados que el carro se hace en el carwash de este mismo sistema deben
aparecer como gasto **solos**, sin que nadie los anote: se leen de `work_orders` pagadas cuya placa
coincide. Esta spec no toca `schema.prisma`: usa `maintenance_plan_tasks`, `maintenance_logs` y
`fleet_expenses` de la 095.

## Historias

- Como dueño con `fleet.manage`, quiero ajustar el plan (km y días por tarea) y registrar cada
  servicio con fecha, km y costo, para que el sistema me diga qué viene.
- Como recepción con `fleet.read`, quiero ver qué carros tienen mantenimiento vencido o próximo y
  qué documentos vencen, para no entregar un carro que debía ir al taller.
- Como dueño, quiero anotar gastos por carro y ver los del lavado automáticamente, para que la
  rentabilidad (100) sea real.

## Criterios de aceptación

- **Dado** el seed de la 095, **cuando** pido `GET /fleet/maintenance/plan`, **entonces** vienen
  las 8 tareas; `PATCH` cambia km/días; `POST` agrega una (nombre duplicado → 409
  `DUPLICATE_MAINTENANCE_TASK`); desactivar quita la tarea de los cálculos sin borrar historial.
- **Dado** un carro con odómetro 12.300 y un servicio de aceite a 7.000 km hace 40 días,
  **cuando** pido `GET /fleet/maintenance/status`, **entonces** aceite viene `DUE` (5.300 km >
  5.000); la revisión general sin registro viene `NO_DATA`; con un servicio a 12.000 km hace 10
  días, aceite viene `OK` con `kmLeft = 4.700` y `daysLeft = 80`; si `kmLeft <= kmAlert` (500) o
  `daysLeft <= daysAlert` (7) viene `SOON`.
- **Dado** un registro de servicio con `cost`, **cuando** lo guardo, **entonces** crea un
  `FleetExpense` tipo `MAINTENANCE` ligado (`maintenanceLogId`) con el mismo monto y fecha; sin
  costo, no crea gasto. Si el `odometerKm` del servicio supera el del carro, actualiza el carro.
- **Dado** un carro con `insuranceExpiresAt` en 5 días, **entonces** `status` lo lista en
  `documents` como `SOON`; vencido, `DUE`.
- **Dado** un lavado del carwash `PAID` de la placa `P53DBC` que es carro de la flota, **cuando**
  pido `GET /fleet/expenses?vehicleId=`, **entonces** aparece una fila `source: 'CARWASH'`, tipo
  `WASH`, con el total del lavado y la fecha de pago, sin fila en `fleet_expenses`, y sin opción de
  editarla ni borrarla.
- **Dado** `GET /fleet/maintenance/reminders.ics`, **entonces** devuelve un calendario con un
  evento por tarea `DUE`/`SOON` y por documento por vencer, `Content-Type: text/calendar`.
- **Dado** `GET /fleet/maintenance/whatsapp-text`, **entonces** devuelve `{ text }` con la lista de
  pendientes por carro, lista para `wa.me`.

## Reglas de negocio

- **RN-1:** Estado por carro × tarea activa (puro, en shared): último servicio = log más reciente
  de esa tarea; sin log → `NO_DATA`. `kmLeft = intervalKm − (odometerKm − lastKm)` si la tarea tiene
  km; `daysLeft = intervalDays − díasDesde(lastDate)` si tiene días. `DUE` si alguno `<= 0`; `SOON`
  si alguno `<= kmAlert / daysAlert`; si no, `OK`. `score` = el menor de los dos normalizados, para
  ordenar.
- **RN-2:** Km por día del carro: promedio de `(returnOdometerKm − pickupOdometerKm) / días` de
  las rentas finalizadas de los últimos 120 días (lectura directa a `rental_agreements`); sin datos,
  0. Sirve para «le tocaría durante esta renta» (`kmLeft <= kmPorDía × días`), expuesto en
  `GET /fleet/maintenance/status?vehicleId&days`.
- **RN-3:** Gastos manuales: `FleetExpenseType`, monto > 0, fecha civil, km opcional, descripción.
  Se editan y se borran (con `fleet.manage`), salvo los ligados a un servicio (se editan desde el
  servicio).
- **RN-4:** Gastos automáticos (solo lectura): (a) lavados del carwash: `work_orders` con `status =
  PAID` y `vehicle.plate = fleet_vehicles.plate` (ambas normalizadas), monto = suma de `charges`
  pagados de esa orden, fecha = fecha de pago; (b) multas **no** cargadas al cliente
  (`rental_fines.chargedToCustomer = false`) como tipo `FINE`. Las dos entran en
  `GET /fleet/expenses` con `source: 'CARWASH' | 'FINE'`, y los manuales con `source: 'MANUAL'`.
- **RN-5:** Un puerto de aplicación **exportado** por el módulo: `FleetExpensesReader.sumByVehicle
  (vehicleId, from, to)` y `.listByVehicle(...)`, que incluye los tres orígenes. La 100 lo importa
  (`FleetMaintenanceModule` lo exporta) para la rentabilidad.
- **RN-6:** Documentos: `insuranceExpiresAt` y `registrationExpiresAt`; `DUE` si ya pasó, `SOON`
  si faltan `<= daysAlert` días.

## Permisos

`fleet.read` para leer todo; `fleet.manage` para plan, servicios y gastos. Sin claves nuevas.

## Contrato compartido (`rentals/maintenance.ts`)

`MAINTENANCE_STATUS = ['OK','SOON','DUE','NO_DATA']` con labels, `FLEET_EXPENSE_TYPE_LABELS`,
schemas `createPlanTaskSchema`, `updatePlanTaskSchema`, `createMaintenanceLogSchema` (vehicleId,
taskIds[] o taskId, performedAt, odometerKm?, cost?, shop?, notes?), `createFleetExpenseSchema`,
`updateFleetExpenseSchema`, `fleetExpensesQuerySchema` (vehicleId?, type?, from?, to?),
`maintenanceStatusQuerySchema`; tipos `MaintenancePlanTask`, `MaintenanceLog`, `FleetExpenseRow`
(con `source`), `VehicleMaintenanceStatus { vehicle, tasks: [{ task, status, kmLeft, daysLeft,
lastAt, lastKm, score }], documents: [...], kmPerDay }`. Helper puro `taskStatus(...)` con tests.

## API

| Método | Ruta                                   | Permiso        | Notas                                   |
| ------ | -------------------------------------- | -------------- | --------------------------------------- |
| GET    | `/fleet/maintenance/plan`              | `fleet.read`   |                                         |
| POST   | `/fleet/maintenance/plan`              | `fleet.manage` | 409 duplicado                           |
| PATCH  | `/fleet/maintenance/plan/:id`          | `fleet.manage` | incluye `isActive`                      |
| GET    | `/fleet/maintenance/status`            | `fleet.read`   | `?vehicleId&days` → por carro            |
| GET    | `/fleet/maintenance/logs`              | `fleet.read`   | `?vehicleId&taskId`                      |
| POST   | `/fleet/maintenance/logs`              | `fleet.manage` | varias tareas en un servicio → un log por tarea, un gasto por log con costo |
| GET    | `/fleet/maintenance/whatsapp-text`     | `fleet.read`   | `{ text }`                               |
| GET    | `/fleet/maintenance/reminders.ics`     | `fleet.read`   | `text/calendar`                          |
| GET    | `/fleet/expenses`                      | `fleet.read`   | tres orígenes (RN-4)                     |
| POST   | `/fleet/expenses`                      | `fleet.manage` |                                         |
| PATCH  | `/fleet/expenses/:id`                  | `fleet.manage` | solo `MANUAL` sin log                    |
| DELETE | `/fleet/expenses/:id`                  | `fleet.manage` | solo `MANUAL` sin log                    |

Módulo `fleet-maintenance` (cascarón de la 095). Lee `fleet_vehicles`, `rental_agreements`,
`rental_fines`, `work_orders` + `vehicles` + `charges` **directo con Prisma** en su
`infrastructure/`; no importa `carwash` ni `rentals`.

## UI (`features/fleet-maintenance`)

- **Mantenimiento** `/rentals/maintenance` (`fleet.read`): arriba `StatCard`s (vencidos, próximos,
  sin dato, documentos por vencer); lista de pendientes agrupada por carro con `Stamp` por estado
  y botón «Registrar servicio»; «Plan» (diálogo con la tabla de tareas editable, agregar, activar
  o desactivar); «Lista para el taller» (abre `wa.me` con el texto, y botón copiar);
  «Recordatorios (.ics)» (descarga). Sección «Sin datos» con los carros a los que falta cargar el
  último servicio.
- **Registrar servicio** (`MaintenanceLogDialog`): carro, tareas (varias casillas), fecha, km,
  costo, taller (default «Elite Service»), notas.
- **Gastos** `/rentals/expenses` (`fleet.read`): filtros por carro, tipo y rango; `DataTable` con
  fecha, carro, tipo, descripción, origen (chip: manual · lavado · multa), monto; total del
  filtro; «Nuevo gasto» (diálogo). Las filas automáticas sin acciones.
- **Pestañas de la ficha del carro** (marco de la 095): `/rentals/fleet/[id]/maintenance` (estado
  por tarea con `kmLeft`/`daysLeft`, historial de servicios, «Registrar servicio») y
  `/rentals/fleet/[id]/expenses` (gastos del carro con total).
- Densidad `bahia`: tarjetas, objetivos táctiles.

## Fuera de alcance

- Órdenes de taller, cotizaciones, repuestos (viven en otro sistema).
- Rentabilidad (100). Notificaciones push.

## Tareas

- [ ] `rentals/maintenance.ts` en shared con `taskStatus` y tests (DUE por km, por días, SOON,
      NO_DATA, score).
- [ ] Dominio y casos de uso con repos en memoria: plan, status (con km/día), log con gasto ligado
      y odómetro, gastos de tres orígenes, texto WhatsApp, ICS; tests.
- [ ] Infra Prisma (incluida la lectura de lavados por placa) + controller + `FleetExpensesReader`
      exportado.
- [ ] Pantallas Mantenimiento, Gastos, pestañas de la ficha.
- [ ] `apps/api/AGENTS.md` y `apps/web/AGENTS.md`: una línea cada uno.
- [ ] `scripts/verify-099.sh`: plan por defecto, 409 duplicado, status DUE/SOON/NO_DATA, log con
      gasto ligado, lavado pagado del carwash como gasto `CARWASH` (crea un lavado con la misma
      placa usando los endpoints del carwash y lo cobra), `.ics` con `text/calendar`.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-099.sh
```
