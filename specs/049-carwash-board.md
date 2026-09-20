# 049 — Tablero de pista en vivo

**Estado:** Terminada
**Módulo:** carwash (web + contrato + api mínimo) | **Depende de:** 019, 020, 035, 042, 046

## Task

Una pantalla nueva, `/carwash/board`, para **mirar** la pista de lejos: una columna por lavador con
el carro que tiene encima y su cronómetro, lo que le espera, y abajo cuántos terminó hoy y cuánto
tarda en promedio. No reemplaza `/carwash` (oficina opera) ni `/floor` (el empleado actúa): acá no
hay ningún botón que mueva un lavado. Vive en dos lugares con la misma pantalla: una TV en la pista
con un usuario «Tablero» que solo tiene `carwash.read` (nunca ve dinero) y el monitor del dueño, que
con `carwash.cash` además ve lo cobrado del día. La letra crece sola en pantalla completa.

Se alimenta de lo que ya existe: `useTickets({ date: hoy })` y el hilo SSE de la 042. El único
cambio de API es que el `Ticket` viaje con `readyAt`, que sale del historial de la 046: sin eso no
hay forma de saber cuánto tardó un lavado terminado.

## Done

- [x] `@elite/shared`: `Ticket.readyAt: string | null` (ISO). Hora de la **última** entrada a
      `READY` según `WorkOrderStatusEvent`; `null` si nunca llegó o si el ticket es anterior a la 046. Se mapea en `prisma-ticket.repository.ts` y en el repositorio en memoria; sin migración.
- [x] `apps/web/src/features/carwash/board.ts` (puro, sin React): `buildBoard(tickets, now)`
      devuelve `{ washers, ready, totals }`. Cada `washer` (clave `washers[0]`, o
      `washer` si la lista está vacía) trae `current` (su `WASHING`, con `elapsedSeconds`), `queued`
      (sus `OPEN`), `doneToday` (sus `READY`+`PAID`), `averageSeconds` (media de `readyAt −
washingStartedAt` sobre los que tienen los dos; `null` si ninguno). Un `OPEN` **sin lavador no se
      dibuja** (es raro y es asunto de oficina): solo suma en `totals.open`. `ready` = todos los `READY`. `totals` = `{ open, washing, ready, paidCents }`.
      `VOID` no cuenta en ningún lado. Columnas ordenadas por nombre.
- [x] `board.spec.ts`: ticket sin lavador no abre columna y cuenta en `totals.open`; `OPEN → READY` directo (sin
      `washingStartedAt`) no entra al promedio; `VOID` no aparece; dos lavadores hoy dan dos
      columnas ordenadas; `paidCents` suma solo `PAID`.
- [x] Grupo de rutas `apps/web/src/app/(board)/carwash/board/page.tsx` con su propio `layout.tsx`:
      `SessionGuard` + `NotificationsSession` + `CarwashLiveProvider`, **sin** `AppShell`. La página
      exige `carwash.read` con `RequirePermission` como el resto.
- [x] `features/carwash/components/board-screen.tsx`: cabecera (título «Pista», reloj vivo, etiqueta
      de `OFFICE_REFRESH_LABELS`, botón «Pantalla completa» y el regreso a «Lavados» que ya da el
      `ScreenHeader`), fila de `StatCard` en cola / lavando / listos, columnas por lavador, franja
      «Listos para cobrar» y pie con terminados hoy y promedio por lavador. Con `carwash.cash` se suma
      la tarjeta «Cobrado hoy»; sin ese permiso el nodo **no se renderiza**.
- [x] El cronómetro del lavado en curso avanza cada segundo en el cliente (misma técnica que la 046)
      y no dispara ningún fetch.
- [x] Pantalla completa con la Fullscreen API. Bajo `:fullscreen` la escala tipográfica sube (mínimo
      ×1.5 en placas y cronómetros) para leerse a 3 m. Si el navegador no la soporta, el botón no
      aparece.
- [x] `/carwash` gana un botón «Ver tablero» en su cabecera. El riel no gana un ítem.
- [x] Bajo 900px las columnas van en scroll horizontal con `scroll-snap`, una columna por pantalla;
      el pie se apila. Sin `hover` para nada.
- [x] Vacíos: sin lavadores hoy → «Todavía nadie tomó un carro»; columna sin `current` → «Libre».
- [x] `docs/prototype/carwash-board.html`: standalone, datos falsos, conmutador de tema y densidad,
      conmutador «con / sin dinero» que simula el permiso, botón de pantalla completa que aplica la
      escala. Va **antes** que el código de Next y el usuario lo aprueba.
- [x] `DESIGN.md`: sección «Tablero de pista» con la escala de pantalla completa y las columnas.
- [x] `scripts/verify-049.sh`: abre un lavado, lo pasa a `WASHING` y a `READY` por el API, y comprueba
      que el `GET` lo devuelve con `readyAt` no nulo y que un `OPEN` lo trae en `null`.

## Always

- Autorización por permiso: `carwash.read` abre la pantalla, `carwash.cash` muestra dinero. Nada
  por nombre de rol ni de usuario.
- `readyAt` lo calcula el servidor; la web no lo infiere de `updatedAt` ni de `payment.paidAt`.
- El hilo de la 042 es la única fuente de novedad: `refetchInterval` sigue siendo por hook y solo
  como respaldo cuando el hilo cae.
- Tokens de `globals.css`; ningún color, radio ni tamaño literal fuera de la escala de `:fullscreen`.
- Densidad `bahia` contemplada aunque la TV no sea táctil: el dueño también lo abre en la tablet.

## Ask first

- Agregar un ítem «Tablero» al riel.
- Cualquier endpoint nuevo (resumen mensual, ranking) o una tabla nueva.
- Mostrar comisiones o cualquier importe distinto de «Cobrado hoy».

## Never

- Nunca un botón que cambie un lavado desde el tablero: es solo lectura.
- Nunca dinero sin `carwash.cash`, ni siquiera oculto por CSS.
- Nunca una columna para quien no tocó un lavado hoy.
- Nunca Playwright, Chromium ni el MCP de navegador: la revisión visual la hace el usuario.

## Verify

```bash
pnpm build && pnpm lint && pnpm test && bash scripts/verify-049.sh
```
