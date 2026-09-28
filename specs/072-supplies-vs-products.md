# 072 — Insumos y productos sin confusión: despacho y categorías

**Estado:** Aprobada (por chat, 26 sept 2026: «hazlo todo en una sola y lo arreglas, adelante»)
**Módulo:** inventory + shared + web | **Depende de:** 065 (inventario), 068 (catálogo en pestañas),
070 (consumo), 034 (combobox)

## Task

La oficina mezcla productos (se venden al cliente) e insumos (se despachan al equipo). Se separan
en dos lugares: el despacho y las categorías.

### A. Despachar solo insumos

1. El despacho es solo de **insumos**. Un producto no se despacha: si un trabajador toma uno, es un
   consumo de la 070. Cambia la RN-10 de la 065.
2. Los diálogos de despacho y entrada dejan el desplegable flotante para elegir el artículo: la
   búsqueda y los resultados van **dentro del diálogo** y se desplazan con él. Elegido, queda una
   tarjeta con nombre, código, existencia y «Cambiar».
3. «Recibe» deja el desplegable: los empleados activos van como botones (radio) en una grilla.
4. El panel del `Combobox` dentro de un `Dialog` se monta dentro del contenido del diálogo, para
   que la rueda y el dedo lo desplacen (hoy el bloqueo de scroll del modal se lo come).

### B. Categorías por tipo

Las categorías de servicios ya son un modelo aparte (016). La categoría de inventario pasa a tener
**tipo** (`PRODUCT` o `SUPPLY`), fijo al crearla, como el del artículo (065 RN-1).

- `InventoryCategory.kind` (`InventoryItemKind`), obligatorio. Nombre único **por tipo**
  (`@@unique([kind, name])`).
- Migración: categoría con solo productos o vacía → `PRODUCT`; con solo insumos → `SUPPLY`; con los
  dos → queda `PRODUCT` y se crea una gemela `SUPPLY` con el mismo nombre, orden y estado, a la que
  pasan sus insumos. Ningún artículo queda sin categoría por la migración.
- API: `GET /inventory/categories?kind=` filtra; `POST` exige `kind`; `PATCH` no lo cambia. Alta o
  edición de un artículo con categoría de otro tipo → `422 CATEGORY_KIND_MISMATCH`.
- Web: «Categorías» de la pestaña Productos abre las de productos y el de Insumos las de insumos
  (`/settings/inventory/categories?kind=products|supplies`, título «Categorías de productos» /
  «Categorías de insumos»). El selector de categoría del artículo solo ofrece las de su tipo.

## Done

- [x] `POST /inventory/items/:id/dispatches` sobre un `PRODUCT` → `409 ITEM_NOT_DISPATCHABLE`,
      nada cambia. Test en la capa application.
- [x] El selector del despacho pide `kind=SUPPLY`: no aparece ningún producto.
- [x] La ficha de un producto no muestra «Despachar».
- [x] En `/inventory`, la pestaña **Productos** no muestra «Despachar» en la cabecera; **Insumos** sí.
- [x] En el despacho, un insumo con existencia 0 aparece deshabilitado con «Sin existencia».
- [x] Selector de artículo en línea (despacho y entrada): sin portal ni capa flotante; lista con
      alto máximo y scroll propio; flechas + Enter eligen; filas de `min-h-touch`.
- [x] «Recibe»: grilla de empleados con `role="radiogroup"`; 2 columnas en tablet, 3 en escritorio;
      el error de validación sigue apareciendo.
- [x] `Combobox` dentro de un `Dialog`: el panel se monta en `[data-slot="dialog-content"]` y se
      ubica contra ese contenedor.
- [x] Schema + migración de categorías con el reparto de arriba.
- [x] `kind` de categoría en `@elite/shared` (tipo, alta, consulta) y códigos
      `ITEM_NOT_DISPATCHABLE`, `CATEGORY_KIND_MISMATCH`.
- [x] Tests application: nombre repetido en el mismo tipo → `409`; mismo nombre en el otro tipo →
      se crea; artículo con categoría de otro tipo → `422 CATEGORY_KIND_MISMATCH` al crear y editar.
- [x] Pantalla de categorías por tipo, con regreso a la pestaña de Catálogo de la que vino (056).
- [x] `ItemDialog`: al cambiar el tipo en un alta, se limpia la categoría elegida.
- [x] 065 RN-10 y su tabla de permisos dicen «insumos», sin «también productos».
- [x] `scripts/verify-065.sh` crea categorías con `kind` y sigue pasando.

## Always

- Tokens de `DESIGN.md`; densidad `bahia` con objetivos táctiles más grandes que `mostrador`.
- Las categorías de servicios (016) no se tocan.

## Ask first

- Cualquier reparto de la migración distinto al de arriba.

## Never

- Borrar o reescribir despachos viejos de productos: el kardex queda como está.
- Borrar categorías o dejar artículos sin categoría al migrar; cambiar el tipo de una ya creada.
- Tocar el `Combobox` fuera de diálogos más allá del punto A.4.

## Verify

`pnpm build && pnpm lint && pnpm test && scripts/verify-065.sh`
