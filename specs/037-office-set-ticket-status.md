# 037 — Cambiar estado de un lavado desde oficina

**Estado:** Terminada
**Módulo:** `carwash` (web + api + `@elite/shared`)
**Depende de:** 003, 015, 020, 032, 036

## Task

En `/carwash/[id]`, con `carwash.manage` y el lavado en `OPEN`/`WASHING`/`READY`,
se elige cualquiera de esos tres estados y se confirma con un aviso según el
salto. «Marcar listo» y «Reabrir» salen de oficina. Cobrar, anular y deshacer
cobro no se tocan. La pista no cambia.

## Done

- [x] Dominio: `canSetOperationalStatus(from, to)` — los tres operativos entre sí,
      distinto de sí mismos. `PAID` y `VOID` no entran.
- [x] `POST /carwash/tickets/:id/status` `{ status: OPEN | WASHING | READY }`.
      `carwash.manage`. Reusa `setStatus` (020: `washingStartedAt` al entrar a
      `WASHING`, `null` al volver a `OPEN`).
- [x] 409 `TICKET_STATUS_LOCKED` si está `PAID`/`VOID`. 409
      `TICKET_ALREADY_IN_STATUS` si el destino es el actual. 422 si el body no
      es uno de los tres.
- [x] No inventa asignado al pasar a `WASHING`.
- [x] Detalle oficina: botón «Cambiar estado». Dialog con En espera / Lavando /
      Listo; el actual no se elige. Aviso por salto. Confirmar.
- [x] Salen «Marcar listo» y «Reabrir» del detalle. Sale «Marcar listo» de la
      fila. Cobrar en la fila se queda.
- [x] Pista: Tomar / Marcar listo / Reabrir intactos. Endpoints
      `/carwash/.../ready` y `/reopen` siguen (la UI de oficina ya no los usa).
- [x] Label de `carwash.manage` incluye cambiar estado.
- [x] Tests de dominio + usecase. `scripts/verify-037.sh`.

## Always

- Código en inglés; UI en español. Labels de estado: las de `TicketStatusStamp`
  (En espera / Lavando / Listo).
- Autorización por `carwash.manage`, nunca por nombre de rol.
- Un botón que el estado no admite no se muestra.
- Avisos:

  | De → a | Aviso |
  | --- | --- |
  | En espera → Lavando | Se marca como lavando. El tiempo de lavado empieza ahora. |
  | En espera → Listo | Queda listo para cobrar. Se salta el lavado. |
  | Lavando → En espera | Vuelve a la cola. Se pierde el tiempo de lavado. |
  | Lavando → Listo | Queda listo para cobrar. |
  | Listo → En espera | Vuelve a la cola. Deja de poder cobrarse. |
  | Listo → Lavando | Vuelve a lavando. Deja de poder cobrarse. El tiempo de lavado se reinicia. |

- Confirmación siempre, también en el salto frecuente a Listo.
- Densidad `mostrador` y `bahia` en el dialog (oficina en tablet).

## Ask first

Nada: el review cerró operativo-only, destino libre, un control con aviso,
fila sin atajo y pista intacta.

## Never

- Nunca `PAID` ni `VOID` por este camino (siguen cobro, reverso y anulación).
- Nunca inventar un lavador.
- Nunca cambiar la pista.
- Nunca el stamp del header como control.
- Nunca Playwright / Chromium / `pnpm dev` para mirar.
- Nunca prototipo HTML nuevo.

## Verify

```bash
pnpm --filter @elite/api test && pnpm --filter @elite/web test && pnpm lint && pnpm build && bash scripts/verify-037.sh
```
