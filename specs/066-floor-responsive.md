# 066 — Pista en tablet y celular

**Estado:** Aprobada (por chat, 26 sept 2026, sobre el prototipo)
**Módulo:** web | **Depende de:** 036, 064, 065

## Task

En la ficha de pista, el botón del siguiente paso queda al fondo, debajo de productos y nota; el
estado es un chip chico, y en la fila los filtros están escondidos en un popover. Se aplica
`docs/prototype/floor-responsive.html`.

1. **Ficha (`floor-ticket-detail.tsx`):** placa grande + chip en la cabecera; estado grande con los
   tres pasos de pista (`TicketStatusHero` con `steps`); servicios como «Qué hacerle»; Responsable,
   Teléfono (`tel:`), A cargo de y Entró en rejilla de dos; Productos plegable.
2. **Siguiente paso:** por debajo de `lg`, en una barra fija abajo (`sticky bottom-0`) con el botón a
   todo el ancho en celular y a la derecha, con contexto, desde `md`. Desde `lg`, dos columnas y el
   botón en el panel derecho (`sticky`), sin barra.
3. **Fila (`floor-queue.tsx`):** chips de estado con conteo (Todos / En espera / Lavando / Listos)
   sobre el filtro `status` de la URL; la carrocería sigue en el popover. Tarjetas con franja del
   tono del estado y botón a todo el ancho; 1 / 2 (`md`) / 3 (`lg`) columnas. «Anotar carro» en una
   barra fija abajo por debajo de `md`.
4. **Encabezado (`floor-shell.tsx`):** por debajo de `sm` el nombre se vuelve iniciales.

## Done

- [x] Mismos cambios de estado y la misma confirmación (036); solo cambia dónde está el botón.
- [x] `< lg`: barra fija abajo en la ficha; `lg`: panel derecho con el botón y sin barra.
- [x] Los chips cuentan sobre lo que devuelve la búsqueda y la carrocería elegida, y filtran por
      `status`.
- [x] `TicketStatusHero` acepta los pasos a dibujar; oficina sigue con cuatro.
- [x] Iniciales del empleado bajo `sm`; `Salir` no salta de línea.
- [x] `DESIGN.md` actualizado.

## Always

- La pista es `bahia` siempre; todo objetivo táctil ≥ `--touch-min`.
- La nota del último lavado sigue arriba de datos y botones (052).

## Ask first

- Cambiar qué acciones tiene la pista.

## Never

- Botones, endpoints o permisos nuevos.

## Verify

`pnpm lint && pnpm test && pnpm build`
