# 030 — Alinear barra fija de resumen con riel colapsado

**Estado:** Terminada
**Módulo:** web (carwash + app-shell) | **Depende de:** 005, 013

## Task

1. Resolver el ancho variable del riel de navegación (248px expandido vs 68px colapsado) mediante la variable `--rail-width`.
2. Reemplazar el valor fijo `md:left-[248px]` en la barra inferior de `TicketSummary` por `md:left-(--rail-width)` y animar la transición.
3. Marcar el estado colapsado en `document.documentElement` (`data-rail-collapsed="true"`) desde `NavRail`.

## Done

- [x] Definir `--rail-width: 248px` por defecto y `68px` cuando `[data-rail-collapsed='true']` en `globals.css`.
- [x] En `nav-rail.tsx`, sincronizar el estado `collapsed` con el atributo `data-rail-collapsed` en `document.documentElement` y persistir en `localStorage`.
- [x] En `ticket-summary.tsx`, cambiar `md:left-[248px]` por `md:left-(--rail-width)` con transición fluida `transition-[left] duration-(--duration-state) ease-standard`.

## Always

- La barra inferior debe cubrir exactamente desde el borde derecho del riel hasta el borde derecho de la pantalla bajo 1180px.
- Mantener compatibilidad con pantallas táctiles/móviles (< 900px) y pista (`/floor`), donde el riel lateral no existe.

## Ask first

- ¿Ninguno pendiente; el comportamiento esperado es alinearse al riel tanto expandido como colapsado?

## Never

- Nunca dejar huecos o márgenes fijos desincronizados entre el riel lateral y las barras fijas de contenido.
- Nunca romper el flujo lateral del resumen en pantallas anchas (≥ 1180px).

## Verify

`pnpm lint && pnpm --filter @elite/web build`
