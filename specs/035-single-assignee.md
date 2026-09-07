# 035 — Un solo asignado en «A cargo de»

**Estado:** En desarrollo
**Módulo:** `carwash` (web + api + `@elite/shared`)
**Depende de:** 003, 009, 027, 034

## Contexto

El bloque «A cargo de» era el equipo de varios empleados de la spec 009: comisión partida.
En pista el opener quedaba locked y se podían sumar chips. Sobran. Un lavado queda a cargo
de una persona o de nadie.

## Historias

- Como empleado de pista, quiero que el lavado que anoto quede a mi cargo sin elegir equipo.
- Como usuario de oficina con `carwash.manage`, quiero elegir un empleado o dejarlo sin asignar.
- Como usuario de oficina, quiero corregir el asignado de un ticket `OPEN`/`WASHING`/`READY`.

## Criterios de aceptación

- **Dado** un empleado logueado en pista, **cuando** abre un ticket, **entonces** `washers` es
  `[quien abrió]` y no hay campo «A cargo de» en `/floor/new`.
- **Dado** un `POST /floor/tickets` con `washerIds` extras, **cuando** el schema ya no los
  declara, **entonces** se ignoran (Zod los descarta) y queda solo el opener.
- **Dado** un ticket de pista asignado a Carlos, **cuando** José lo toma (`start`), **entonces**
  el asignado sigue siendo Carlos.
- **Dado** un ticket de oficina sin asignado, **cuando** Carlos lo toma en pista, **entonces**
  `washers` pasa a `[Carlos]`.
- **Dado** un alta de oficina sin `employeeId`, **cuando** se crea, **entonces** `washers = []`
  y `washer = null`.
- **Dado** un alta de oficina con `employeeId`, **cuando** se crea, **entonces** `washers`
  tiene ese único id.
- **Dado** un `PUT` con más de un id, **cuando** pista u oficina lo mandan, **entonces** 422
  `VALIDATION_ERROR`.
- **Dado** un ticket `OPEN`/`WASHING`/`READY`, **cuando** oficina manda `employeeIds: []`,
  **entonces** queda sin asignar. En pista el vacío sigue siendo 422.
- **Dado** `/floor/:id`, **cuando** el ticket está editable, **entonces** se ve el nombre
  (o «Sin asignar»), sin chips ni editor.
- **Dado** `/carwash/new` y el detalle de oficina editable, **cuando** se elige asignado,
  **entonces** es un Combobox con «Sin asignar» y empleados activos.

## Reglas de negocio

- **RN-1:** Un ticket admite 0 o 1 asignado en escrituras nuevas. `WorkOrderAssignment` en
  disco sigue 0..n; no hay migración. Tickets viejos con n>1 se cobran partiendo como 009;
  un `PUT` posterior los deja en 0 o 1.
- **RN-2:** Pista, alta: el registrador es el único asignado. No hay UI. No viaja `washerIds`.
- **RN-3:** Pista, detalle: solo lectura. Corregir es de oficina (`carwash.manage`).
- **RN-4:** `start` asigna al empleado **solo si** `washers.length === 0`. Nunca suma un segundo.
- **RN-5:** Oficina: `employeeId?` en el alta. Ausente = sin asignar. Combobox, no chips.
- **RN-6:** `Ticket.washer` (quien abrió, 003 RN-8) no se reescribe al cambiar `washers`.
- **RN-7:** Comisión: fórmula 009 intacta. n=1 se lleva el 100 %. n=0 va a `unassigned`.

## Permisos

Ninguno nuevo. Oficina corrige con `carwash.manage`. Pista no cobra.

## Datos

Sin migración. `WorkOrderAssignment` no cambia de forma.

## API

| Método | Ruta | Request | Response | Errores |
| ------ | ---- | ------- | -------- | ------- |
| POST | `/floor/tickets` | 003, **sin** `washerIds` | ticket, `washers=[sesión]` | 003 |
| POST | `/carwash/tickets` | 003 + `employeeId?` (sin `washerIds`) | ticket | `INVALID_WASHER` |
| PUT | `/floor/tickets/:id/washers` | `{ employeeIds }` max 1, length 1 | ticket | 422 si 0 o >1; `WASHERS_LOCKED`; `INVALID_WASHER` |
| PUT | `/carwash/tickets/:id/washers` | `{ employeeIds }` max 1, 0 o 1 | ticket | 422 si >1; `WASHERS_LOCKED`; `INVALID_WASHER` |
| POST | `/floor/tickets/:id/start` | — | WASHING; asigna solo si estaba vacío | 409 si no OPEN |

Mensaje de >1: «Un lavado queda a cargo de una sola persona.»

## UI

- `/floor/new`: sin Card «A cargo de».
- `/floor/:id` y fila: nombre o «Sin asignar».
- Oficina alta y detalle: `Combobox` (034), label «A cargo de», primera opción «Sin asignar».
- Ayuda en alta: «Si no elegís a nadie, el lavado queda sin asignar.»
- `WashersField` (multi-chip) se borra.

## Fuera de alcance

- Fórmula de comisión, caja, cobro, anulación, catálogo, intake.
- Migrar tickets con varios empleados.
- Prototipo HTML nuevo.

## Tareas

- [x] `createFloorTicketSchema` sin `washerIds`.
- [x] `createOfficeTicketSchema` con `employeeId?`, sin `washerIds`.
- [x] `putWashersSchema`: `employeeIds.max(1)`.
- [x] `TicketUseCases.create`: pista = `[opener]`; oficina = `[employeeId]` o `[]`.
- [x] `start` asigna solo si el conjunto está vacío. *(036: en pista ya no
      aplica; sin asignar no se toma.)*
- [x] `setWashers` rechaza length > 1.
- [x] `/floor/new` sin picker.
- [x] `/floor/:id` solo lectura.
- [x] Oficina: Combobox + `employeeId`.
- [x] Borrar `washers-field.tsx`.
- [x] `washersLabel` / `washerNames`: vacío → «Sin asignar».
- [x] Tests de usecase + `verify-035.sh`. Recortar `verify-009.sh`.

## Always

- Código en inglés; UI en español.
- Autorización por permiso, no por rol.
- Combobox de 034: nada de `<select>`.
- Densidad `bahia` en pista (el campo no está). `mostrador` en oficina.
- `Ticket.washer` intacto al reasignar.

## Ask first

Nada: el review del plan cerró pista solo lectura, `start` si vacío, y no migrar.

## Never

- Nunca chips multi-select ni «sumá a quien más lavó».
- Nunca extras en el POST de pista.
- Nunca `start` agrega un segundo empleado.
- Nunca Playwright / Chromium sin permiso.
- Nunca prototipo HTML nuevo.

## Verify

```bash
pnpm --filter @elite/api test && pnpm --filter @elite/web test && pnpm lint && pnpm build && bash scripts/verify-035.sh
```
