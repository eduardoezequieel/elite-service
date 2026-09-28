# 071 — Un solo lavado en curso por empleado

**Estado:** Terminada (aprobada por chat, 26 sept 2026: «no quiero que tengan varios en lavado, validemos eso
… tanto del lado de oficina como del lado del portal de empleados»)
**Módulo:** `carwash` (api + `@elite/shared`) | **Depende de:** 020, 035, 036, 037

## Task

Un empleado puede tener varios lavados a su cargo en cola (`OPEN`), pero **uno solo en `WASHING`**.
Hoy nada lo impide: pista toma uno tras otro y oficina los pasa a _Lavando_ sin mirar.

Entran a `WASHING` con un empleado por tres caminos, y los tres se validan:

1. Pista, **Tomar** (`start`, 036): `OPEN → WASHING`.
2. Oficina, cambio de estado (037): `OPEN | READY → WASHING`.
3. Oficina o pista, cambio de asignado (035) sobre un lavado que ya está en `WASHING`.

## Done

- [x] `API_ERROR_CODES.EMPLOYEE_ALREADY_WASHING` en `@elite/shared`; responde 409.
- [x] Puerto `TicketRepository.listWashingOf(employeeId)`: los `WASHING` a cargo de ese empleado,
      sin recortar por día (uno de ayer sin cerrar también cuenta).
- [x] `start` rechaza si el empleado ya tiene otro en `WASHING`: «Ya estás lavando P001. Marcalo
      listo antes de tomar otro.»
- [x] `setOperationalStatus(→ WASHING)` rechaza si algún asignado ya tiene otro en `WASHING`:
      «Carlos ya está lavando P001. Marcalo listo o pasalo a cola primero.»
- [x] `setWashers` sobre un `WASHING` rechaza al nuevo asignado si ya lava otro. El mismo lavado no
      cuenta contra sí mismo.
- [x] Un lavado sin asignado pasa a `WASHING` como antes (037: no se inventa lavador).
- [x] `details: { ticketId, number, plate, employeeId }` para que el front pueda enlazar al otro.
- [x] Tests en `ticket.usecases.spec.ts` para los tres caminos y los casos que pasan.

## Always

- La regla vive en `TicketUseCases`, una sola vez, para las dos vistas.
- El web ya muestra `error.message` en la confirmación de pista y en el diálogo de estado de
  oficina: no hace falta tocar pantallas.

## Ask first

- Bloquear también la cola (`OPEN`) o `READY`.
- Una restricción en base (índice/lock) contra la carrera de dos «Tomar» simultáneos del mismo
  empleado en dos tablets. Hoy la validación es de aplicación; el caso es un mismo empleado en dos
  dispositivos a la vez.

## Never

- Rechazar un lavado sin asignado por esta regla.
- Mover solo el estado del otro lavado para «hacer lugar».

## Verify

```sh
pnpm build && pnpm lint && pnpm test
```
