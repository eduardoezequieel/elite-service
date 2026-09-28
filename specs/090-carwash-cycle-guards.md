# 090 — Frenos del ciclo del lavado

**Estado:** Terminada (aprobada por chat, 28 sept 2026: «Hazlos todos en una sola spec, cuando termines, lo
implementas por favor»)
**Módulo:** `carwash`, `vehicles`, `employees` (api + `@elite/shared`) | **Depende de:** 003, 037,
059, 065, 071, 079

## Contexto

Una revisión del ciclo real (anotar → lavar → listo → cobrar → anular/deshacer) encontró cinco
huecos. El primero lo vio el usuario en la pista: el mismo carro se anota dos veces mientras el
primer lavado sigue sin cobrar. Los otros son carreras entre dos pantallas y bajas que dejan
lavados colgando.

## Criterios de aceptación

**1. Un carro, un lavado sin cobrar.**

- **Dado** un carro con un lavado en `OPEN`, `WASHING` o `READY`, **cuando** pista u oficina abren
  otro con su `vehicleId`, **entonces** 409 `VEHICLE_HAS_ACTIVE_TICKET`: «P123-132 ya tiene un
  lavado sin cobrar (#2).», con `details: { ticketId, number, plate, status }`.
- **Dado** lo mismo, **cuando** se teclea la placa sin `vehicleId`, **entonces** el mismo 409 en
  vez del `VEHICLE_PLATE_EXISTS` de confirmar la ficha: confirmarla no serviría de nada.
- **Dado** que el lavado anterior ya está `PAID` o `VOID`, **cuando** se anota el carro, **entonces**
  se abre como hoy.
- **Dado** dos altas simultáneas del mismo carro, **cuando** llegan a la base, **entonces** una
  entra y la otra responde el mismo 409 (índice único parcial, no un 500).
- **Dado** un lavado `PAID` cuyo carro ya volvió y tiene otro sin cobrar, **cuando** se deshace ese
  cobro (lavado suelto o cuenta), **entonces** 409 `VEHICLE_HAS_ACTIVE_TICKET` y no se deshace
  nada.

**2. Cobrar y anular a la vez.**

- **Dado** un `READY`, **cuando** se cobra y se anula a la vez, **entonces** gana uno solo: o queda
  `PAID` con su pago, o `VOID` con los productos devueltos. Nunca las dos cosas.

**3. El estado se revisa al guardar.**

- **Dado** un lavado que otra pantalla movió entre la lectura y la escritura, **cuando** se aplica
  una transición (`start`, `ready`, `reopen`, `void`), un cambio de estado de oficina, un cambio de
  precio o un cambio de asignado, **entonces** se revisa el estado con el lavado bloqueado y, si ya
  no aplica, sale el mismo 409 que si se hubiera leído así desde el principio.
- **Dado** un `PAID`, **cuando** oficina lo pasa a cola al mismo tiempo que se cobra, **entonces**
  queda `PAID`.

**4. Desactivar a quien tiene lavados sin terminar.**

- **Dado** un empleado con lavados a su cargo en `OPEN` o `WASHING`, **cuando** se lo desactiva,
  **entonces** 409 `EMPLOYEE_HAS_ACTIVE_TICKETS`: «Carlos tiene 2 lavados sin terminar: P001,
  P002. Pasalos a otro o marcalos listos antes de desactivarlo.», con
  `details: { tickets: [{ ticketId, number, plate, status }] }`.
- Los `READY` no frenan: el trabajo está hecho y la comisión se congela igual al cobrar.
- Cambiar nombre, usuario o PIN sin desactivar no se frena.

**5. Desactivar un carro con lavado sin cobrar.**

- **Dado** un carro con un lavado en `OPEN`, `WASHING` o `READY`, **cuando** se lo desactiva por
  `PATCH /vehicles/:id`, **entonces** 409 `VEHICLE_HAS_ACTIVE_TICKET`: «Este carro tiene un lavado
  sin cobrar (#2). Cobralo o anulalo antes de desactivarlo.»

## Reglas de negocio

- **RN-1:** «Sin cobrar» es `OPEN`, `WASHING` o `READY`. Un carro tiene como máximo uno. Lo
  garantiza el índice `work_orders_one_active_per_vehicle` (único parcial sobre `vehicleId`); la
  consulta previa solo da un mensaje mejor.
- **RN-2:** Toda escritura que depende del estado lo revisa con la fila bloqueada (`FOR UPDATE`),
  en la misma transacción que escribe. El cobro bloquea sus lavados, en orden de id, después del
  turno de caja.
- **RN-3:** Un choque de estado responde el mismo código y el mismo texto que la regla que lo
  habría rechazado antes. La pantalla no necesita conocer la carrera.
- **RN-4:** Las bajas no mueven lavados solas. Ni se desasigna al empleado ni se anula el lavado
  del carro (071: no se toca otro lavado para «hacer lugar»).

## Datos

Migración `20260928120000_one_active_wash_per_vehicle`:

```sql
CREATE UNIQUE INDEX "work_orders_one_active_per_vehicle" ON "work_orders"("vehicleId")
  WHERE "status" IN ('OPEN', 'WASHING', 'READY');
```

Si la base ya tiene un carro con dos lavados sin cobrar, la migración falla: la consulta para
encontrarlos está en `docs/TROUBLESHOOTING.md`.

## API

Sin endpoints nuevos. Códigos nuevos en `API_ERROR_CODES`:

| Código                        | Status | Dónde                                                            |
| ----------------------------- | ------ | ---------------------------------------------------------------- |
| `VEHICLE_HAS_ACTIVE_TICKET`   | 409    | `POST /carwash/tickets`, `POST /floor/tickets`, reverso, `PATCH /vehicles/:id` |
| `EMPLOYEE_HAS_ACTIVE_TICKETS` | 409    | `PATCH /employees/:id` con `isActive: false`                     |

## UI

Sin cambios: el alta (oficina y pista), el diálogo de empleado y el reverso ya muestran
`error.message`.

## Fuera de alcance

- Volver a anotar una placa desactivada: ninguna pantalla desactiva carros hoy.
- Dos «Tomar» simultáneos del mismo empleado en dos tablets (071, Ask first).
- Mostrar en la búsqueda de placa que el carro ya está en el lavado.

## Always

- Las reglas viven en los casos de uso, una sola vez para pista y oficina.
- El índice es la garantía; el chequeo previo es para el mensaje.

## Ask first

- Bloquear también la baja de un empleado con lavados `READY`.
- Reactivar sola una placa desactivada al anotarla.

## Never

- Anular, desasignar o mover un lavado para destrabar una baja o un alta.
- Responder 500 por un choque del índice.

## Tareas

- [x] `@elite/shared`: `VEHICLE_HAS_ACTIVE_TICKET` y `EMPLOYEE_HAS_ACTIVE_TICKETS`.
- [x] Migración con el índice parcial; comentario en `WorkOrder` del `schema.prisma`.
- [x] `uniqueViolationOnIndex` en `common/prisma/unique-violation.ts`, con tests.
- [x] `VehicleRepository.findUnchargedWash(vehicleId)` (Prisma + memoria).
- [x] `TicketUseCases.create`: 409 si el carro tiene uno sin cobrar, por `vehicleId` o por placa.
- [x] `VehicleBusyError` del índice → 409 en el alta y en el reverso.
- [x] Reverso: el repositorio de cobros revisa, antes de volver a `READY`, que el carro no tenga
      otro sin cobrar.
- [x] Cobro: bloquea los lavados (`FOR UPDATE`, orden de id) antes de leerlos.
- [x] `setStatus(id, { from, to }, actor)`: revisa `from` con la fila bloqueada;
      `TicketStatusChangedError` → el 409 de siempre.
- [x] `authorizePrice` y `replaceWashers`: revisan el estado con la fila bloqueada.
- [x] `EmployeeRepository.listUnfinishedWashes(employeeId)`; `UpdateEmployeeUseCase` rechaza la
      baja.
- [x] `UpdateVehicleUseCase` rechaza la baja.
- [x] Tests de aplicación para 1, 3, 4 y 5 (el 2 y la carrera del 1 son de base: `verify-090.sh`).
- [x] `scripts/verify-090.sh` y entrada en `docs/TROUBLESHOOTING.md`. Sin correr: pide el stack levantado.

## Verificación

```sh
pnpm build && pnpm lint && pnpm test
bash scripts/verify-090.sh   # con el stack levantado
```
