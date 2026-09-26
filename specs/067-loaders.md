# 067 — Carga con medidor y esqueletos

**Estado:** Aprobada (por chat, 26 sept 2026, opción «Mixto» del prototipo)
**Módulo:** web | **Depende de:** 002, 063

## Task

Hoy toda espera es la palabra «Cargando…» en gris: no se sabe si la app trabaja o se colgó. Se
aplica la opción C de `docs/prototype/loaders.html`.

1. `components/ui/gauge-loader.tsx`: `GaugeLoader` —el isotipo con la aguja barriendo el arco— con
   `label` y `size` (`md` en bloque, `sm` en línea). `role="status"`.
2. `components/ui/skeleton.tsx`: `Skeleton` (bloque con brillo), `DetailSkeleton` (cabecera + dos
   tarjetas) y `ListSkeleton` (`rows` filas).
3. `globals.css`: `elite-sweep` (aguja) y `elite-shimmer` (brillo), apagadas con
   `prefers-reduced-motion`.
4. Reemplazos: **medidor** en pantalla completa (sesión de pista), tablero y campos/listas chicos
   (cobro conjunto, roles del usuario, catálogo de permisos); **esqueletos** en fichas (lavado de
   oficina y pista, cliente, caja, turno de caja, alta de pista), listas (`DataTable`, fila de pista)
   y línea de tiempo.

## Done

- [x] Ningún «Cargando…» suelto queda en las pantallas listadas.
- [x] Medidor y esqueletos anuncian la carga (`role="status"` + `aria-label`); el brillo es
      `aria-hidden`.
- [x] `prefers-reduced-motion`: aguja quieta y sin brillo.
- [x] Mismo alto de fila (`--row-h`) en `ListSkeleton` que en la lista real, en las dos densidades.
- [x] `DESIGN.md` → Movimiento: medidor y brillo como animaciones en bucle permitidas, solo mientras
      algo carga.

## Always

- Colores solo de tokens; el arco usa el degradado del logo.

## Ask first

- Tocar `inventory/`, `sales/` o `product-picker`: son de la spec 065, en curso.

## Never

- Loaders que bloqueen la pantalla o un tiempo mínimo de espera artificial.

## Verify

`pnpm lint && pnpm test && pnpm build`
