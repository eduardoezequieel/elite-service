# 062 — Refrescar al volver

**Estado:** Terminada (aprobada por chat, 26 sept 2026)
**Módulo:** web | **Depende de:** spec 042 terminada

## Task

El hilo SSE (042) a veces pierde eventos y la pantalla queda con datos viejos: con `staleTime` de
60 s, entrar a una pantalla o volver a la ventana no pide nada si la copia tiene menos de un minuto,
y con el hilo «vivo» el respaldo de 15 s está apagado. Que nada dependa solo del hilo:

1. **Global** (`lib/query-client.tsx`): `staleTime: 0`. Entrar a cualquier pantalla o volver a la
   pestaña pide de nuevo. No hay SSR con hidratación, así que el comentario de los 60 s ya no aplica.
   Los catálogos que fijan su propio `staleTime` lo conservan.
2. **Foco de ventana**: `focusManager` escucha también `window` `focus`, no solo
   `visibilitychange`. El mostrador con dos monitores cambia de ventana sin ocultar la pestaña.
3. **Lavados, caja y pista**: las consultas bajo `['carwash','tickets']`, `['carwash','cash']` y
   `FLOOR_TICKETS_KEY` llevan `refetchOnMount`, `refetchOnWindowFocus` y `refetchOnReconnect` en
   `'always'` (constante `ALWAYS_FRESH` en `lib/`): ignoran `staleTime` aunque alguien lo suba.
4. **Hilo**: cada evento y cada `onReconnect` de oficina invalidan `['carwash']` entero (lavados +
   caja), no solo la lista.
5. **Red de seguridad con hilo vivo**: la lista de lavados y la fila de pista piden cada 60 s aunque
   el hilo esté `live`; sin hilo, siguen los 15 s. Por hook, nunca global (019).

## Done

- [x] `staleTime: 0` global y `focusManager` con `focus` + `visibilitychange`.
- [x] `ALWAYS_FRESH` aplicado a `useTickets`, `useTicket`, `useTicketTimeline`, los tres de caja y
      los dos de pista.
- [x] `CarwashLiveProvider` invalida `['carwash']` en `onMessage` y `onReconnect`.
- [x] `refetchInterval`: 60 s con hilo vivo, 15 s sin hilo, en `useTickets` y `useFloorTickets`.
- [x] `apps/web/AGENTS.md` regla 15 actualizada.

## Always

- La invalidación sigue por prefijo, en un solo lugar por árbol (provider).

## Ask first

- Bajar la red de seguridad de 60 s o aplicarla a otras pantallas.

## Never

- `refetchInterval` global en el `QueryClient`.
- Escuchar el stream desde una pantalla.

## Verify

`pnpm build && pnpm lint && pnpm test`. La prueba de volver a la ventana la hace el usuario.
