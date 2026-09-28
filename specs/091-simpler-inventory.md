# 091 — Inventario más simple

**Estado:** Terminada, sin correr los verify (aprobada por chat, 28 sept 2026: «me parece perfecto ya, así intégralo» ·
«cuando termines la spec, lo implementas de una»)
**Módulo:** inventory (web + api) + shared | **Depende de:** 065, 068, 070, 072, 085

## Contexto

`/inventory` confunde: cuatro botones del mismo peso arriba («Consumo de empleado» y «Consumo de
empleados» uno al lado del otro), el kardex con ocho columnas llenas de guiones, «Activo» en cada
fila y la entrada y el despacho de a un artículo. Prototipo aprobado, revisado con el usuario paso a
paso: `docs/prototype/inventory-redesign.html`. Catálogo no cambia.

## Historias

- Como oficina (`inventory.move`), quiero sumar lo que llegó desde la misma existencia, o registrar
  una factura entera paso a paso, para no buscar el artículo dos veces.
- Como oficina, quiero entregar a un trabajador varios artículos de una vez sin pensar si es
  «consumo» o «despacho»: el sistema lo decide por el tipo del artículo.
- Como encargado (`inventory.adjust`), quiero escribir cuántos conté y que el sistema calcule la
  diferencia.
- Como dueño (`inventory.read`), quiero ver lo que tomó el personal en cualquier rango de fechas.

## Criterios de aceptación

**Marco.**

- **Dado** `/inventory`, `/inventory/movements` o `/inventory/consumption`, **entonces** comparten
  título «Inventario», subtítulo y pestañas «Existencias · Movimientos · Consumos del personal»
  (enlaces a esas tres rutas, la activa subrayada).
- **Dado** `inventory.move`, **entonces** la cabecera muestra exactamente dos acciones: «Entregar a
  empleado» (`outline`) y «Registrar entrada» (primaria). Sin `inventory.move`, ninguna.
- **Dado** `inventory.manage`, **entonces** el subtítulo enlaza «Los artículos se crean en
  Catálogo» a `/settings/catalog?tab=products`.

**Existencias.**

- **Dado** la lista, **entonces** la barra lleva: buscador, selector «Productos N · Insumos N»,
  «Bajo mínimo · N» y «Filtros» (Categoría del tipo elegido + interruptor «Incluir inactivos»).
- **Dado** una fila, **entonces** las columnas son Ref. · Artículo (nombre; abajo `categoría ·
código`) · Existencia (cantidad y unidad; abajo «mínimo N» o «sin mínimo») · Precio de venta
  (solo productos) · Estado. Estado es «Inactivo» o «Bajo mínimo»; vacío si no. No hay columna
  «Acciones».
- **Dado** `inventory.move` y un artículo activo, **cuando** se toca el «+» de su existencia,
  **entonces** debajo de esa fila se abre la entrada rápida: cantidad `− N +` (arranca en 1), «Te
  costó c/u (opcional)», «Referencia (opcional)» y «Pasa de A a B». Enter o «Sumar entrada» la
  registra (`POST /items/:id/entries`); Escape o «Cancelar» la cierra. Una abierta a la vez.

**Registrar entrada (asistente).**

- **Dado** el botón de la cabecera, **entonces** el diálogo pregunta de a un paso, con barra de
  progreso de 5: Tipo («¿Qué vas a ingresar?» Producto / Insumo) → Artículo (buscador con 250 ms de
  espera y lista del tipo agrupada por categoría) → Cantidad (`− N +` grande, +6 +12 +24, «Hay A →
  quedan B») → «¿Cuánto te costó cada unidad?» (opcional) → Revisar (líneas con Editar y Quitar,
  «Agregar otro artículo», Referencia, total con costo).
- **Dado** un artículo que ya está en la entrada, **cuando** se lo elige de nuevo, **entonces** se
  edita su línea; nunca va dos veces.
- **Dado** «Registrar entrada» en Revisar, **entonces** todo va en una sola petición
  (`POST /inventory/entries`): entran todas las líneas o ninguna.
- **Dado** la ficha de un artículo, **cuando** se toca «Registrar entrada», **entonces** el
  asistente arranca en Cantidad con ese artículo.

**Entregar a empleado.**

- **Dado** el diálogo, **entonces** primero va «¿A quién?»: un buscador (250 ms de espera, sin
  tildes ni mayúsculas) con lista flotante «N coincidencias» como la de la placa: flechas, Enter
  elige el marcado, Escape cierra. Elegido, se pliega en una línea con «Cambiar».
- **Dado** «¿Qué se lleva?», **entonces** es el selector del lavado (085): buscador + chips de
  categoría, en dos renglones «Productos» e «Insumos»; cada fila con `− N +`; lo elegido arriba.
  Cada fila dice «Consumo» (producto) o «Despacho» (insumo); un producto muestra
  `2 × $1.25 = $2.50`.
- **Dado** una cantidad mayor que la existencia, **entonces** la fila se marca «No alcanza: hay N»
  y «Entregar» se apaga.
- **Dado** «Entregar», **entonces** va en una sola petición (`POST /inventory/deliveries`): los
  productos quedan como `CONSUMPTION` y los insumos como `DISPATCH`, todos o ninguno.
- **Dado** el detalle de consumo de un trabajador activo, **cuando** se toca «Anotar consumo»,
  **entonces** es el mismo diálogo con el empleado fijo y solo productos.

**Ficha del artículo.**

- **Dado** `/inventory/:id`, **entonces** las cifras son: Existencia (con «Mínimo N» o «Sin
  mínimo» debajo), «Te costó (promedio)» («Lo que pagaste vos, promediando tus entradas») y, en un
  producto, «Precio de venta» («Lo que paga el cliente. Se cambia en Catálogo»).
- **Dado** `inventory.adjust`, **cuando** se abre «Ajustar por conteo», **entonces** se escribe
  cuántos hay; el diálogo dice «Faltan N» / «Sobran N» / «Cuadra» y manda la diferencia con signo.
  Con diferencia 0 no deja ajustar. Motivo obligatorio, como hoy.

**Kardex (ficha y Movimientos).**

- **Dado** el kardex, **entonces** las columnas son Fecha y hora · Tipo · (Artículo, solo en
  Movimientos) · Cantidad · Saldo · Detalle. Detalle es una frase: «Factura 88 · $1.10 c/u ·
  registró Ana», «Lavado #141 · vendió Rosa», «Recibió Luis · entregó Ana · nota», «Tomó Carlos ·
  $2.50 · anotó Ana», «Conteo del viernes · ajustó Ana».
- **Dado** Movimientos, **entonces** el tipo se elige con chips visibles: Todo · Entradas · Ventas
  (venta + devolución) · Despachos · Consumos (consumo + anulado) · Ajustes. Artículo y Empleado
  siguen en Filtros; las fechas, en el `DateRangeField`.

**Consumos del personal.**

- **Dado** el reporte y el detalle de un trabajador, **entonces** el rango es el `DateRangeField`
  (el de Rendimiento), no el selector de mes; por defecto, el mes en curso hasta hoy. El rango vive
  en la URL (`start`, `end`) y el detalle vuelve al reporte con el mismo rango.
- **Dado** el detalle, **entonces** las columnas son Fecha y hora · Artículo · Cantidad · Valor ·
  Estado · Acciones; al tocar la fila se despliega debajo: Anotó (quién y cuándo), Precio c/u, Nota
  y, si se anuló, quién, cuándo y el motivo.

**Densidad.** En `bahia`: el asistente sube el número a 72px de alto, los chips y el `− N +` a
`--touch-min` 44px, las filas del buscador de empleados a 12×18 px de padding.

## Reglas de negocio

- **RN-1: el tipo decide el movimiento.** En una entrega, un `PRODUCT` genera `CONSUMPTION` con el
  precio de venta congelado (070 RN-4) y un `SUPPLY` genera `DISPATCH` (065 RN-10). No se elige.
- **RN-2: todo o nada.** `entries` y `deliveries` escriben todas sus líneas en una transacción.
  Si una falla (inactivo, sin existencia, no existe), no se escribe ninguna y el error nombra el
  artículo en `details.itemId`.
- **RN-3: una línea por artículo.** Un `itemId` repetido en `lines` es `422 VALIDATION_ERROR` (convención 5 del API). Entre
  1 y 50 líneas.
- **RN-4: el rango del consumo.** Fechas civiles de `America/El_Salvador`, inclusive (como
  Movimientos). `from > to` es `422`. Sin rango, el mes en curso hasta hoy. RN-5 de la 070 (el mes
  es el del consumo) pasa a ser: cuenta la fecha del consumo, no la de la anulación.
- **RN-5: el conteo manda la diferencia.** El ajuste por conteo sigue siendo `ADJUSTMENT` con
  cantidad con signo; la web la calcula contra la existencia que tiene a la vista. Si mientras tanto
  cambió, el API igual valida que no quede bajo cero (065 RN-12).
- **RN-6: precio y costo, con su nombre.** «Precio de venta» es del producto y se cambia en
  Catálogo. «Te costó» es el costo de una entrada; «Te costó (promedio)» es el promedio ponderado
  que ya calcula el API (065 RN-11). Inventario no edita precios.

## Permisos

Sin claves nuevas. `entries` y `deliveries` piden `inventory.move`, igual que las de un artículo.

## Datos

Sin cambios de schema.

## API

| Método | Ruta                                  | Request                                                            | Response                                     | Errores                                                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/inventory/entries`                  | `{ reference?, lines: [{ itemId, quantity, unitCost? }] }`         | `{ results: InventoryMovementResult[] }`     | `422 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 ITEM_INACTIVE`                                |
| POST   | `/inventory/deliveries`               | `{ employeeId, note?, lines: [{ itemId, quantity }] }`             | `{ results: InventoryMovementResult[] }`     | `422`, `404`, `409 ITEM_INACTIVE`, `409 INSUFFICIENT_STOCK`, `404 EMPLOYEE_NOT_FOUND` (070) |
| GET    | `/inventory/movements`                | `type` acepta uno o varios separados por coma (`SALE,SALE_RETURN`) | igual                                        | `422` si un tipo no existe                                                                  |
| GET    | `/inventory/consumptions`             | `from?`, `to?` (civiles) — reemplaza a `month`                     | `EmployeeConsumptionReport` con `from`, `to` | `422` si `from > to`                                                                        |
| GET    | `/inventory/consumptions/:employeeId` | `from?`, `to?` — reemplaza a `month`                               | `EmployeeConsumptionDetail` con `from`, `to` | `422`, `404`                                                                                |

Los errores de una línea llevan `details.itemId`. `POST /items/:id/entries`, `/dispatches`,
`/consumptions` y `/adjustments` no cambian.

## UI

- `features/inventory/components/inventory-frame.tsx`: título, subtítulo, las dos acciones y las
  pestañas; lo monta el layout del grupo `(tabs)` para las tres pantallas (092).
- `inventory-screen.tsx`: barra nueva, columnas nuevas, «+» y `QuickEntryRow`.
- `entry-wizard.tsx` (reemplaza `entry-dialog.tsx`), `delivery-dialog.tsx` (reemplaza
  `dispatch-dialog.tsx` y `consumption-dialog.tsx`), `employee-search-field.tsx` (reemplaza
  `employee-radio-grid.tsx`), `delivery-picker.tsx` (chips del 085 sobre productos e insumos).
- `adjust-dialog.tsx` por conteo; `kardex-table.tsx` con «Detalle»; `movements-screen.tsx` con
  chips de tipo; `consumption-report-screen.tsx` y `employee-consumption-screen.tsx` con
  `DateRangeField` y fila desplegable.
- `components/ui/data-table.tsx` suma `renderExpanded(row)`: la fila con detalle abierto dibuja
  debajo una fila a lo ancho; en la tarjeta apilada cuelga pegada a la tarjeta.
- La lógica suelta (agrupar, frase del detalle, diferencia del conteo, líneas del asistente) va en
  archivos `.ts` con su `.spec.ts`, como `product-browse.ts`.

## Fuera de alcance

- Histórico de precios en Catálogo: spec aparte, pendiente de alcance (¿solo productos o también servicios?).
- Catálogo, la pista (`/floor`) y el bloque «Productos» del lavado.
- Reponer desde un aviso de bajo mínimo.

## Tareas

- [x] `@elite/shared`: `createInventoryEntriesSchema`, `createInventoryDeliverySchema`,
      `InventoryBatchResult`; `type` de movimientos como lista; `consumptionRangeQuerySchema`
      (reemplaza `consumptionMonthQuerySchema`); `from`/`to` en los contratos del reporte.
- [x] API: `recordMovements` en el repositorio (una transacción), casos de uso `recordEntries` y
      `deliver` con specs (RN-1..RN-3), rango del consumo (RN-4) con specs, controlador.
- [x] Web: marco con pestañas, lista nueva, entrada rápida, asistente, entrega, empleado con
      buscador, ajuste por conteo, kardex con Detalle, chips de tipo, rango en consumos, fila
      desplegable; tests de la lógica suelta.
- [x] `scripts/verify-065.sh`: `entries` con dos líneas suma las dos; con una inactiva no suma
      ninguna. `deliveries` con un producto y un insumo deja `CONSUMPTION` + `DISPATCH`.
- [x] `scripts/verify-070.sh`: `consumptions?from=&to=` en lugar de `month`.
- [x] `apps/web/AGENTS.md` / `DESIGN.md`: el asistente, la entrada rápida y la fila desplegable.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-065.sh && bash scripts/verify-070.sh`

`pnpm build`, `pnpm lint` y `pnpm test` pasan (shared 97, web 506, api 832). Los dos `verify-NNN.sh` no se corrieron: el API local no estaba levantado.
