# 089 — Tablero de pista en kanban

**Estado:** Terminada
**Módulo:** carwash (solo web) | **Depende de:** 049, 088

## Task

`/carwash/board` deja de ser una columna por lavador y pasa a un kanban de **tres columnas por
estado**: **En cola** (`OPEN`) · **Lavando** (`WASHING`) · **Listos para cobrar** (`READY`). Cada
tarjeta dice placa, vehículo, lavador y su tiempo. De un vistazo se sabe qué espera, qué está en la
bahía y qué ya salió. Los cobrados (`PAID`) no se dibujan y el dinero sale de la pantalla: quien
quiera ver lo cobrado lo verá en otro lado. Abajo queda una franja chica por lavador con terminados
hoy, promedio y si está libre o lavando. Sigue siendo solo lectura. Sin cambios de API ni contrato. Sin prototipo: el usuario pidió ir directo al código.

## Done

- [x] `features/carwash/board.ts`: `buildBoard(tickets, now)` devuelve
      `{ queued, washing, ready, washers, totals }`. `queued` = todos los `OPEN` (con o sin lavador;
      sin lavador la tarjeta dice «Sin asignar»), del más viejo al más nuevo. `washing` = los
      `WASHING` con `elapsedSeconds`, el que más lleva primero. `ready` = los `READY`, el más viejo
      primero. `washers` = quien tocó un lavado hoy, por nombre, con `doneToday` (`READY`+`PAID`),
      `averageSeconds` (misma regla de la 049) y `busy` (tiene un `WASHING`). `totals` =
      `{ open, washing, ready }`: **sin `paidCents`**. `VOID` no cuenta en ningún lado.
- [x] `board.spec.ts` al día: un `OPEN` sin lavador entra a `queued`; orden de cada columna;
      `PAID` no aparece en ninguna columna pero sí en `doneToday`; `busy` sale del `WASHING`;
      `VOID` no aparece; el promedio sigue excluyendo `OPEN → READY` directo.
- [x] `board-screen.tsx`: tres columnas con cabecera (chip de estado + nombre + cantidad en cifra
      grande); desaparece la fila de `StatCard` —las cantidades viven en las cabeceras— y desaparece
      «Cobrado hoy» (nada de `carwash.cash` en esta pantalla). Tarjeta «Lavando» con cronómetro grande
      que avanza cada segundo; «En cola» con «espera X»; «Listos» con «listo hace X». Aviso en
      `--warn-text` igual que hoy (45 min lavando, 30 min esperando).
- [x] Vacíos: columna sin tarjetas → «Nadie en espera» / «Nadie lavando» / «Nada por cobrar»; sin
      ningún lavado vivo ni terminado hoy → el `EmptyState` actual.
- [x] Bajo 900px las tres columnas van en scroll horizontal con `scroll-snap`, una por pantalla; la
      franja de lavadores se apila. En `bahia` las tarjetas miden al menos `--touch-min`. Sin `hover`.
- [x] `DESIGN.md`: sección «Tablero de pista» reescrita para el kanban, sin la parte de dinero.
- [x] Spec 049: nota de que la 089 reemplaza su diseño de columnas y quita «Cobrado hoy».

## Always

- Tokens de `globals.css` y la escala `--board-scale` de la 049; nada literal fuera de ella.
- El color de cada columna acompaña, la palabra del chip es la que dice el estado.
- La novedad sigue llegando por el hilo de la 042; el cronómetro no dispara fetch.

## Ask first

- Arrastrar tarjetas entre columnas o cualquier botón que mueva un lavado.
- Volver a mostrar dinero o los `PAID`.
- Cualquier cambio de API o de `@elite/shared`.

## Never

- Nunca una acción que cambie un lavado desde el tablero.
- Nunca Playwright, Chromium ni el MCP de navegador: la revisión visual la hace el usuario.

## Verify

```bash
pnpm build && pnpm lint && pnpm test
```
