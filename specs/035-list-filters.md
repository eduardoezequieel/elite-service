# 035 — Filtros de lista con Combobox

**Estado:** En desarrollo
**Módulo:** web/ui | **Depende de:** 007-unified-data-table, 014-carwash-search-and-date, 034-combobox

## Task

En las listas, un botón **Filtros** abre una tarjeta con `Combobox` (spec 034). La búsqueda, el día y las pestañas de estado de lavados no se tocan. Los filtros extra recortan las filas **ya cargadas**.

## Done

- [x] `components/ui/filters-popover.tsx` exporta `FiltersPopover`, `FilterBar` y `useFilterValues`. El panel va en portal, alineado al botón; el listado del Combobox queda por encima.
- [x] `lib/list-filters.ts` concentra `ALL_FILTER`, `uniqueOptions`, `matchesActivity`, `ticketMatchesFilters` y `placeFiltersPanel`; hay tests.
- [x] Listas con el botón: Lavados, La fila, Clientes, ficha de cliente (lavados), Caja, Comisiones, Catálogo, Categorías, Empleados, Usuarios.
- [x] Cada Combobox arranca en «Todos…». Badge con la cantidad distinta de «Todos». Restablecer vuelve todos a «Todos».
- [x] Clic fuera o Escape cierra la tarjeta. Clic en un Combobox no la cierra.
- [x] Sin `<select>` nativo. Sin query nueva al API.

## Always

- Combobox de spec 034. Tokens, los dos temas y las dos densidades.
- Las pestañas y los recuentos de Lavados siguen contando el día, no el recorte del popover.
- `date` y `q` siguen en la URL; los filtros extra no.

## Ask first

- Nada: el gesto lo cerró el prototipo `docs/prototype/filters-and-search.html`.

## Never

- Nunca `<select>` nativo, ni shadcn Popover/Command, ni Playwright/Chromium en el prototipo.
- Nunca mandar al API un filtro que el endpoint no acepta.
- Nunca poner el popover en formularios, logins ni detalles que no sean lista.

## Verify

`pnpm --filter @elite/web test && pnpm lint && pnpm --filter @elite/web build`
