# 032 — Filas y tarjetas clickeables sin botón de abrir

**Estado:** Aprobada
**Módulo:** web | **Depende de:** 002, 007, 023

## Task

1. Eliminar botones redundantes de navegación («Abrir», «Ver», «Ver recibo») de las tablas de datos (`DataTable`) donde la fila o tarjeta ya lleva al detalle correspondiente.
2. Asegurar que las tablas que navegan al detalle (`/customers`, `/customers/:id` lavados, `/carwash/cash`, `/carwash`) tengan `rowHref` configurado para que toda la fila (escritorio) y la tarjeta (táctil) sean clickeables.
3. En `DataTable`, no renderizar el contenedor de acciones ni el borde separador inferior en la tarjeta móvil si la fila no tiene acciones activas (cuando `actions` devuelve `null`).
4. Soportar `onRowClick` opcional en `DataTable` y apertura con Cmd/Ctrl+clic cuando hay `rowHref`.
5. En `/floor` (`QueueCard`), hacer la tarjeta clickeable para navegar al detalle `/floor/:id` y quitar el botón «Ver» redundante.

## Done

- [ ] `DataTable` filtra acciones vacías en la tarjeta táctil para no mostrar un pie vacío con borde.
- [ ] `DataTable` soporta `onRowClick` y navegación con Cmd/Ctrl+clic en `rowHref`.
- [ ] `/customers`: `rowHref` hacia `/customers/:id`, se quita el botón «Abrir» de la columna de acciones y se conserva «Editar» si hay permiso.
- [ ] `/customers/:id` (Lavados): `rowHref` hacia `/carwash/:id`, se elimina la columna «Acciones» que solo contenía «Abrir».
- [ ] `/carwash/cash` (Historial): se elimina la columna «Acciones» que solo contenía «Abrir», manteniendo `rowHref`.
- [ ] `/carwash` (Tickets): `RowActions` no renderiza «Abrir», «Ver» ni «Ver recibo»; solo renderiza acciones operativas directas («Cobrar», «Marcar listo»). Clic en la fila o tarjeta abre el detalle.
- [ ] `/floor` (`QueueCard`): la tarjeta es clickeable hacia `/floor/:id` y se remueve el botón «Ver».
- [ ] `design-reference.tsx`: actualizada la muestra de `DataTable`.

## Always

- Toda fila o tarjeta con `rowHref` tiene cursor pointer y foco accesible con Enter y Espacio.
- Los clics sobre botones internos (`button`, `a`, `input`, etc.) nunca disparan la navegación de la fila.
- Si una fila no tiene botones de acción, no queda un borde o espacio huérfano al pie de la tarjeta táctil.

## Ask first

- ¿Quitar también «Ver recibo» y «Ver» de `/carwash` dejando solo «Cobrar» y «Marcar listo»? (Sí, toda la tarjeta navega al detalle).
- ¿Hacer clickeable la tarjeta de `/floor` (`QueueCard`) y quitar el botón «Ver»? (Sí, mismo criterio de interacción directa).

## Never

- Nunca dejar botones que solo digan «Abrir» o «Ver» cuando la fila o tarjeta entera ya navega a ese mismo destino.
- Nunca interferir con botones de acción interactivos dentro de una fila.

## Verify

`pnpm build && pnpm lint && pnpm test`
