# 042 — Lavados en vivo y centro de notificaciones

**Estado:** Terminada
**Módulo:** carwash (web + api) | **Depende de:** 003, 019, 020, 035, 036, 037

## Task

La fila de lavados deja de preguntar cada 15 s y pasa a enterarse cuando algo cambia: el API
empuja por SSE (`GET /carwash/stream` y `GET /floor/stream`) y las dos pantallas se mueven solas.
En oficina, lo que hace otra persona queda anotado en un centro de notificaciones con campana y no
leídos. En pista, el empleado recibe un aviso cuando le entra un carro a su fila.

Esto pisa el «refrescan solos cada 15 s» de la 019: el refresco periódico queda como respaldo y solo
corre cuando el hilo está caído.

## Done

- [x] `@elite/shared` define `CarwashEvent` (`id`, `type`, `at`, `ticket`, `previousStatus`,
      `actor`), `CarwashHeartbeat` y los siete tipos. El evento lleva el `Ticket` entero: la web no
      vuelve a pedirlo.
- [x] `TicketUseCases` publica por un puerto (`application/ports/ticket-events.ts`) en las diez
      mutaciones: alta, edición, nota, transición, estado de oficina, responsable, cobro, reverso,
      anulación y reasignación. El bus (`infrastructure/ticket-events.bus.ts`) estampa `id` y hora.
- [x] Un cobro publica **un** evento, no dos, aunque de paso pegue el responsable.
- [x] Una mutación rechazada no publica nada, y un oyente roto no tumba la mutación.
- [x] `GET /api/carwash/stream` exige `carwash.read`. Sin sesión, 401.
- [x] `GET /api/floor/stream` va con `@FloorSession()` y recorta con `isVisibleToEmployee` (036):
      el lavado de otro, el que no tiene asignado y el cobrado o anulado no viajan.
- [x] El stream late cada 25 s y se cierra solo a los 30 min; `EventSource` reconecta y la conexión
      nueva vuelve a pasar por los guards, así que los permisos se siguen resolviendo contra la base.
- [x] La web abre el hilo con `EventSource` sobre `/api` (mismo origen, la cookie viaja sola) y
      cada evento invalida `['carwash','tickets']` / `['floor','tickets']` por prefijo.
- [x] `refetchInterval` pasa a `false` mientras el hilo está vivo y vuelve a 15 s si se cae. Por
      hook, nunca global.
- [x] Centro de notificaciones en el pie del riel y en la barra inferior, oculto sin `carwash.read`.
      Badge con número, no solo color. Objetivo táctil ≥44px.
- [x] La bandeja vive en `localStorage` por usuario, deduplica por id de evento, tope de 50 y se
      poda al día siguiente. Sin tabla, sin migración, sin endpoints de lectura.
- [x] No se avisa de lo que hizo quien está mirando.
- [x] Cada aviso dice **quién lo movió y desde dónde** («Carlos · pista», «Ana · oficina») en
      renglón propio, nunca pegado a la placa: oficina y pista pueden mover el mismo lavado (037) y
      un nombre junto a una placa se lee como quien lo lava. El toast de pista también lo dice.
- [x] La cabecera dice «en vivo», «actualizando» o «se actualiza sola», en los dos lados.
- [x] Tests: `carwash-event.spec.ts`, las emisiones en `ticket.usecases.spec.ts`,
      `notification.spec.ts`, `store.spec.ts` y `live-label.spec.ts`.

## Always

- El recorte de pista se decide en el dominio y en el servidor, nunca en la tablet.
- Autorización por permiso, nunca por nombre de rol. El stream no introduce claves nuevas.
- Contrato en `@elite/shared`; errores `{ code, message, details? }`.
- Quien hizo la mutación sale de la sesión que resolvió el guard, jamás del cuerpo del request.
- Densidad `bahia` y ≥44px en la campana y en el panel.

## Ask first

- (Cerrado) SSE, no WebSocket: mismo origen, cero dependencias, la cookie funciona tal cual. El
  porqué y lo descartado, en el ADR-012.
- (Cerrado) Alcance: oficina y pista. La caja queda fuera y sigue como está.
- (Cerrado) La bandeja se guarda en el navegador, no en la base. Otra máquina empieza de cero.
- (Cerrado) Sin campana en pista: el empleado no tiene roles ni permisos, y trabaja de pie.

## Never

- Nunca `refetchInterval` global en el QueryClient (019).
- Nunca empujar a pista un lavado que su fila no muestra.
- Nunca un toast por una acción propia, ni un error en un toast.
- Nunca confiar en un `actor` que venga del cliente.
- Nunca Playwright, Chromium ni el MCP de navegador: la revisión visual la hace el usuario.

## Verify

```bash
pnpm build && pnpm lint && pnpm test && bash scripts/verify-042.sh
```
