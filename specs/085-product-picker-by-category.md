# 085 — Productos del lavado por categoría

**Estado:** En desarrollo (aprobada por chat, 28 sept 2026: «adelante, arreglalo, me parece perfecto»)
**Módulo:** carwash (web + api) + shared | **Depende de:** 065 (inventario), 072 (categorías por tipo)

## Contexto

El bloque «Productos» del lavado (065) pinta siempre los primeros 8 productos, aunque nadie los vaya
a usar, y con 40 el resto queda escondido detrás de «Hay N productos más». Prototipo:
`docs/prototype/product-picker-browse.html`, propuesta **B · búsqueda + categorías**. Vale para
oficina (alta y edición) y para la pista (alta y ficha): las cuatro pantallas usan el mismo
`ProductPicker`.

## Historias

- Como quien arma un lavado (`carwash.create` / pista), quiero ver las categorías de productos y
  abrir una, para llegar al producto sin acordarme del nombre.
- Como quien ya sabe qué busca, quiero escribir y que busque en todas las categorías.

## Criterios de aceptación

- **Dado** el bloque sin nada escrito ni elegido, **cuando** se abre, **entonces** se ven solo los
  chips de categoría (nombre + cuántos productos hay) y la ayuda «Tocá una categoría o buscá por
  nombre». Ninguna fila de producto.
- **Dado** un chip, **cuando** se toca, **entonces** debajo aparecen los productos de esa categoría
  que no están elegidos; otro toque lo cierra. Solo una categoría abierta a la vez.
- **Dado** productos elegidos, **entonces** van siempre arriba con su fórmula, separados por una
  línea, y el chip de su categoría muestra en naranja cuántas unidades llevás de ella.
- **Dado** algo escrito, **entonces** la búsqueda es en todas las categorías (la del API, por
  nombre, código o barcode), agrupada por categoría con su título, con la ayuda «Buscando en todas
  las categorías»; los chips no presionados se atenúan. Sin resultados: «Nada con «x». Probá con
  otra palabra o tocá una categoría.»
- **Dado** algo escrito, **cuando** se toca un chip, **entonces** se borra la búsqueda y queda esa
  categoría abierta.
- **Dado** un producto sin categoría, **entonces** va en el chip «Sin categoría», al final.
- **Dado** `Escape` en el buscador, **entonces** se borra lo escrito.
- Densidad `bahia`: chips y stepper de `--touch-min` 44px y nombre de fila en `text-title`; `mostrador` 36px.

## Reglas de negocio

- **RN-1:** La opción del lavado (`InventoryItemOption`) lleva `category: { id, name } | null`.
  Sin costos, igual que antes (065 RN-17).
- **RN-2:** El conteo del chip (cuántos productos) sale de la lista completa; el naranja suma las
  cantidades elegidas de esa categoría, en unidades enteras.
- **RN-3:** Chips y títulos de grupo van en orden alfabético de categoría; «Sin categoría» último.
- **RN-4:** Un solo `ProductPicker` para oficina y pista; el tope de 8 (`BROWSE_LIMIT`) desaparece.

## Datos

Sin cambios de schema: `InventoryItem.categoryId` ya existe (065/072).

## API

| Método | Ruta                                                 | Cambio                                            |
| ------ | ---------------------------------------------------- | ------------------------------------------------- |
| GET    | `/carwash/inventory-items`, `/floor/inventory-items` | cada opción suma `category: { id, name } \| null` |

## UI

`features/carwash/components/product-picker.tsx` (chips + lista) y la lógica pura en
`features/carwash/product-browse.ts`: agrupar por categoría, contar por chip, filtrar por
categoría abierta. El chip es un botón `aria-pressed` con `rounded-full`, tokens de `DESIGN.md`.

## Fuera de alcance

- El buscador de la venta suelta (`features/sales/components/product-search.tsx`): otro flujo, con
  lector de barras.
- Cambiar el endpoint de búsqueda (ya busca por nombre, código y barcode).

## Tareas

- [x] `InventoryItemOption.category` en `@elite/shared`; `PrismaInventoryCatalog.listOptions` y
      `InMemoryStock.listOptions` lo devuelven; el test de RN-17 en `ticket-products.usecases.spec.ts`
      lo espera.
- [x] `product-browse.ts` + `product-browse.spec.ts` (grupos, conteos, «Sin categoría» al final,
      filtro por categoría).
- [x] `ProductPicker` con chips, categoría abierta, búsqueda agrupada y los textos de arriba.
- [ ] `scripts/verify-065.sh`: el producto creado con categoría vuelve de `/carwash/inventory-items`
      con `category.name`.
- [x] `apps/web/DESIGN.md`: nota del bloque «Productos» por categoría.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-065.sh`
