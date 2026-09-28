# 086 — Crear categoría desde el campo, sin salir del diálogo

**Estado:** Terminada (aprobada por chat, 28 sept 2026: «Adelante, me parece perfecto»)
**Módulo:** web (catalog + inventory) | **Depende de:** 034/047 (combobox), 072 (categorías por tipo)

## Task

El campo «Categoría» de los diálogos de servicio (`catalog-screen.tsx`) y de artículo
(`item-dialog.tsx`, usado por Productos, Insumos y la ficha de inventario) pasa a ser un buscador:
se escribe, filtra, y si no hay una categoría con ese nombre ofrece «Crear categoría: «x»». Al
tocarla se crea con el endpoint que ya existe y queda elegida, sin cerrar el diálogo. Un solo
componente `CategoryField` en `apps/web/src/components/` que reciben ambos diálogos; la lógica de
opciones (filtro + cuándo ofrecer crear) en una función pura con test.

## Done

- [x] Escribir filtra las categorías sin acentos ni mayúsculas (`filterOptions`).
- [x] Con texto y sin coincidencia exacta (normalizada), aparece la fila de acción «Crear categoría: «x»»; con coincidencia exacta no.
- [x] Tocar la fila (o Enter sobre ella) llama `POST /service-categories` o `POST /inventory/categories` con el `kind` del artículo, y deja elegida la nueva.
- [x] Mientras crea, la fila dice «Creando…» y no se puede tocar dos veces; si falla, el mensaje del API queda bajo el campo.
- [x] Servicio nuevo sin categorías: desaparece el aviso «Ir a Categorías»; el campo permite crear la primera.
- [x] Al salir sin elegir, el texto vuelve al nombre de la categoría elegida (o vacío).
- [x] `bahia`: la fila de acción usa `min-h-touch` como las demás (44px).
- [x] Test de la función pura en `category-options.spec.ts`.

## Always

- Crear usa el mismo permiso que ya pide el diálogo (`services.manage` / `inventory.manage`): sin él, no hay fila de crear.
- La categoría inline se crea solo con nombre (y `kind` en inventario); `isExtra` y orden quedan con el valor por defecto del API y se cambian en Categorías.
- Se mantiene la opción «Sin categoría» en artículos.

## Ask first

- Tocar el API o `@elite/shared`.

## Never

- Crear sin que el usuario toque la fila (nada de crear con Enter sobre texto libre).
- Duplicar el combobox: se usa `Combobox` en modo `search`.

## Verify

`pnpm build && pnpm lint && pnpm test`

`pnpm lint` falla solo en `apps/web/scripts/run-next.mjs` (`process`/`console` no definidos), un
archivo sin commitear que ya estaba antes de esta spec y que no toca.
