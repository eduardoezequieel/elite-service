# 050 — Rubros plegados para elegir el servicio

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 025, 030, 039
**Prototipo:** `docs/prototype/service-picker-collapsed.html`

## Task

1. La lista plana de servicios del alta pasa a un acordeón: **una fila por rubro**, plegada. La fila
   muestra el nombre del rubro y, debajo, el servicio elegido con su precio, o «Elegir» y cuántas
   opciones tiene.
2. Abrir un rubro cierra el que estuviera abierto. Elegir un servicio pliega su rubro.
3. El mismo componente sirve al alta (pista y oficina) y a la edición de un ticket abierto: el
   acordeón vive en un solo archivo, no copiado en dos pantallas.
4. Se conservan las reglas de la 039 (uno por rubro, los rubros se suman) y de la 030 (descuento por
   línea con tope del catálogo y atajos −$1 / −$2 / −$5 / −10%).

## Done

- [x] `ServicePicker` es un único componente y lo usan `TicketForm` y `EditTicketDialog`.
- [x] Con el catálogo plegado, el alto de la sección crece con la cantidad de **rubros**, no de servicios.
- [x] Abrir un rubro cierra el anterior; elegir un servicio pliega el rubro y deja lo elegido a la vista.
- [x] Tocar el servicio ya elegido lo suelta y la fila vuelve a «Elegir».
- [x] El precio se edita desde la fila abierta, con los atajos y el tope del catálogo.
- [x] Cambiar el tipo de carro recorta los descuentos al nuevo tope.
- [x] Objetivos táctiles `min-h-touch` en bahía: la fila plegada, el chevron y el precio.
- [x] Tests de la selección y de las líneas resultantes en `service-groups.spec.ts`.

## Always

- El agrupado y el orden salen de `service.category`; ningún nombre de rubro en el código.
- Un rubro sin servicios activos no se pinta.
- Semántica accesible: la fila plegada es un `button` con `aria-expanded` y `aria-controls`; las
  opciones siguen siendo `radiogroup` / `radio` con `aria-checked`.

## Ask first

- Si el taller quiere un rubro abierto por defecto: es un flag del catálogo, no un nombre en el código.

## Never

- Nunca dos rubros abiertos a la vez.
- Nunca esconder lo elegido: la fila plegada siempre dice qué servicio quedó y a qué precio.
- Nunca depender del `hover` para abrir, cerrar o descontar.

## Verify

`pnpm lint && pnpm test && pnpm build` · la comprobación visual (tablet y densidad `bahia`) la hace
el usuario.
