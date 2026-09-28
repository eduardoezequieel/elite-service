# 068 — Un solo Catálogo: servicios, productos e insumos en pestañas

**Estado:** Terminada (aprobada por chat, 26 sept 2026)
**Módulo:** web | **Depende de:** 016 (catálogo), 065 (inventario)

## Task

El menú tiene «Catálogo» (servicios) y «Categorías de inventario» por separado, y el alta de artículos
vive en Inventario. Se unifica **la pantalla**, no los datos: servicios y artículos siguen siendo
modelos distintos (precio por tipo de carro y comisión vs. existencia).

- `/settings/catalog` pasa a tener pestañas **Servicios · Productos · Insumos**
  (`?tab=services|products|supplies`, en la URL; por defecto la primera que el usuario puede ver).
  Servicios es la pantalla de hoy. Productos e Insumos listan las **definiciones** de artículo (código, nombre,
  categoría, unidad, precio —solo productos—, mínimo, estado, Editar) con «Nuevo artículo»
  (`inventory.manage`) usando el `ItemDialog` de la 065.
- Cada pestaña tiene su botón «Categorías»: Servicios → `/settings/catalog/categories`; Productos e
  Insumos → `/settings/inventory/categories` (la ruta sigue, con regreso a Catálogo).
- Menú: se va «Categorías de inventario». «Catálogo» se ve con `services.read` **o** `inventory.read`;
  cada pestaña pide su permiso.
- `/inventory` (Operación) queda para el día a día: existencia, entradas, despachos, ajustes y
  movimientos. Pierde «Nuevo artículo» (vive en Catálogo); el detalle del artículo sigue editable.

## Done

- [x] Pestañas en `/settings/catalog` con la pestaña en la URL y por permiso.
- [x] Productos e Insumos: lista de definiciones con alta y edición; lógica pura con test.
- [x] «Categorías» por pestaña; «Categorías de inventario» fuera del menú; regreso a Catálogo.
- [x] `/inventory` sin «Nuevo artículo».
- [x] Densidades `mostrador`/`bahia` y ancho de tablet contemplados.

## Always

- Reusar los componentes de la 016 y la 065; nada de copiar formularios.

## Ask first

- Cualquier cambio de API o de contrato.

## Never

- Unificar servicios y artículos en un solo modelo.

## Verify

`pnpm build && pnpm lint && pnpm test`
