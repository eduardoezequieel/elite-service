<!-- Extracto del legado. Fuente: zips elite-service-taller.zip y elite-service-erp.zip (sep 2026). Índice: ../LEGACY_BUSINESS_LOGIC.md. No es una spec: no autoriza implementar. -->

# 04 — Catálogos e inventario (legado Next.js + Prisma)

Extraído de `elite-service-taller` (proyecto legado: Next.js App Router, server actions, Prisma).
Fuentes leídas completas: `modules/inventory/*`, `modules/services/*`, `modules/customers/*`,
`modules/vehicles/*`, `app/(dashboard)/inventario/**`, `app/(dashboard)/servicios/**`,
`app/(dashboard)/clientes/**`, `app/(dashboard)/vehiculos/**`,
`components/inventory/barcode-scanner.tsx`, `components/customers/customer-vehicle-picker.tsx`,
`components/ui/*.tsx`, `app/(dashboard)/ordenes/[id]/{add-product-form,add-service-form,confirm-consumption-button}.tsx`,
`lib/vehicle-label.ts`, `lib/money.ts`, `lib/auth.ts`, `prisma/schema.prisma` (modelos relevantes),
`prisma/seed.ts` (permisos/roles), y las partes de `modules/work-orders/*`, `modules/receptions/actions.ts`
y `modules/quotes/actions.ts` que consumen estos módulos.

Convención: los identificadores (`stockOnHand`, `forSale`, `RESERVA`, …) se citan tal cual en inglés/español
como están en el código. Los textos entre comillas son literales de la UI o de mensajes de error.

---

## 0. Modelo de datos (Prisma) que usan estos módulos

### Enums (`prisma/schema.prisma`)

| Enum | Valores | Uso |
| --- | --- | --- |
| `PersonType` | `NATURAL`, `JURIDICA` | `Customer.personType` |
| `RecordStatus` | `ACTIVO`, `INACTIVO` | `status` de `Customer`, `Vehicle`, `ServiceCatalog`, `ServiceCategory`, `Product`, `ProductCategory`, `Supplier`, `InventoryLocation`, `ServicePackage` |
| `ServiceType` | `MANO_OBRA`, `DIAGNOSTICO`, `MANT_EXPRESS`, `MANT_PREVENTIVO`, `CARWASH`, `SERVICIO_EXTERNO`, `PAQUETE`, `OTRO` | `ServiceCatalog.type` |
| `BusinessArea` | `TALLER`, `CARWASH`, `REPUESTOS`, `ADMINISTRACION`, `CAJA` | `ServiceCatalog.area`, `ServiceCategory.area` |
| `InventoryMovementType` | `COMPRA`, `ENTRADA_MANUAL`, `SALIDA_MANUAL`, `RESERVA`, `LIBERACION_RESERVA`, `CONSUMO`, `DEVOLUCION_ORDEN`, `DEVOLUCION_PROVEEDOR`, `AJUSTE`, `PERDIDA`, `CORRECCION`, `REVERSION` | `InventoryMovement.type` |
| `ReservationStatus` | `ACTIVA`, `CONSUMIDA`, `LIBERADA`, `VENCIDA` | `InventoryReservation.status` |
| `PurchaseStatus` | `BORRADOR`, `ORDENADA`, `RECIBIDA_PARCIAL`, `RECIBIDA`, `CANCELADA` | `PurchaseOrder.status` (sin módulo de UI en el legado) |
| `QuoteItemType` | `SERVICIO`, `MANO_OBRA`, `PRODUCTO`, `REPUESTO`, `PAQUETE`, `SERVICIO_EXTERNO` | tipo de línea en cotización/orden |

### `Product` (`@@map("products")`)

- `id` cuid; `code String @unique` (formato `PRD-0001`); `barcode String? @unique` (comentario del schema: "código de barras físico (EAN/UPC); se asocia al escanear si aún no lo tiene"); `partNumber?`, `name`, `description?`, `categoryId?`, `brand?`, `presentation?`, `unit?`.
- `cost Decimal(12,2) default 0`; `price Decimal(12,2) default 0` (comentario: "con IVA incluido"); `taxRate Decimal(6,4) default 0.1300`.
- `forSale Boolean default true` (comentario: "false = insumo de uso interno del taller, no se cotiza ni se vende").
- `stockOnHand Decimal(12,3) default 0` ("existencia física"); `minStock Decimal(12,3) default 0`.
- `locationId?` → `InventoryLocation`; `supplierId?` → `Supplier` ("proveedor principal"); `status RecordStatus default ACTIVO`.
- Comentario clave: `// disponible = stockOnHand - SUM(reservas activas)  [se calcula en la app]`.
- Relaciones: `movements InventoryMovement[]`, `reservations InventoryReservation[]`, `packageItems`, `quoteItems`, `workOrderItems`, `purchaseOrderItems`, `purchaseItems`.
- `createdAt`, `updatedAt`, `deletedAt?` (soft-delete). Índices en `name`, `partNumber`, `brand`.

### `ProductCategory` (`product_categories`): `id`, `name`, `status`. Sin unicidad en `name` a nivel BD (la app busca case-insensitive antes de crear).

### `InventoryLocation` (`inventory_locations`): `id`, `name`, `status`. Definido en schema pero **ningún módulo del legado lo usa** en UI/actions.

### `InventoryMovement` (`inventory_movements`)

Comentario del schema: "Movimientos append-only. Nunca se editan ni borran; las correcciones se hacen con un nuevo movimiento (REVERSION / CORRECCION). Cantidad con signo según tipo."

- `productId`, `type InventoryMovementType`, `quantity Decimal(12,3)` ("+ entra, - sale"), `unitCost Decimal(12,2)?`, `balanceAfter Decimal(12,3)`, `workOrderId?`, `purchaseId?`, `reservationId?`, `reversalOfId?` ("apunta al movimiento que revierte"), `reason?`, `createdById?`, `createdAt`.
- Índices: `productId`, `type`, `workOrderId`, `createdAt`.

### `InventoryReservation` (`inventory_reservations`)

Comentario del schema: "Reserva creada al APROBAR el trabajo. No reduce existencia física. Se consume (descuenta) al confirmar consumo; o se libera si no se usa."

- `productId`, `workOrderId` (obligatorio: toda reserva pertenece a una orden de trabajo), `quantity Decimal(12,3)`, `status ReservationStatus default ACTIVA`, `expiresAt?` (no lo usa ningún código), `createdById?`, `createdAt`, `updatedAt`.

### `Supplier`, `SupplierContact`, `PurchaseOrder`, `PurchaseOrderItem`, `Purchase`, `PurchaseItem`

Definidos en el schema (`suppliers`, `supplier_contacts`, `purchase_orders`, `purchase_order_items`, `purchases`, `purchase_items`). `PurchaseItem.previousCost` está comentado como "costo anterior (para mostrar variación)". **No existe ningún módulo, action ni página que los use en el legado**: no hay compras a proveedor implementadas; el movimiento `COMPRA` está en el enum y en las etiquetas de la UI pero nunca se genera.

### `ServiceCategory` (`service_categories`): `id`, `name`, `area BusinessArea?`, `status`.

### `ServiceCatalog` (`service_catalog`)

- `code String @unique` (formato `SRV-0001`), `name`, `description?`, `categoryId?`, `type ServiceType default MANO_OBRA`, `area BusinessArea?`.
- `suggestedPrice Decimal(12,2) default 0` ("con IVA incluido"), `internalCost Decimal(12,2) default 0`, `estimatedMinutes Int?`, `unit?`, `taxRate Decimal(6,4) default 0.1300`.
- `warrantyEnabled Boolean default true`, `warrantyDays Int default 45`, `status RecordStatus default ACTIVO`, `notes?`.
- `quickService Boolean default false`. Comentario del schema: "Servicio de precio fijo y publicado (cambio de aceite, frenos, GDI...). Se vende directo como orden de trabajo, sin pasar por Cotización — a diferencia de un diagnóstico de costo variable (ej. suspensión), que sí necesita que Fausto revise el carro antes de cotizar la reparación."
- Relaciones: `category`, `packageItems`, `quoteItems`, `workOrderItems`, `warranties`. `createdAt`, `updatedAt`, `deletedAt?`.

### `ServicePackage` / `ServicePackageItem`: definidos, sin uso en el legado.

### `Customer` (`customers`)

- `code String @unique` (formato `CLI-00001`), `personType PersonType default NATURAL`, `fullName` ("o razón social"), `dui?`, `nit?`, `otherDoc?`, `phone?`, `whatsapp?`, `email?`, `address?`, `customerType?`, `tags String[]`, `notes?`, `status RecordStatus default ACTIVO`, `branchId?` ("FK lógica"), `createdById?`.
- Relaciones: `contacts CustomerContact[]`, `creditProfile`, `creditMovements`, `vehicleOwners VehicleOwner[]`, `appointments`, `receptions`, `quotes`, `workOrders`, `receivables`, `payments`, `warrantyClaims`, `reminders`, `communications`, `taxDocuments`.
- `createdAt`, `updatedAt`, `deletedAt?`. Índices (no únicos) en `phone`, `whatsapp`, `dui`, `nit`, `email`.
- **No hay `@unique` en `dui`, `nit`, `phone` ni `email`**: el único campo único es `code`.

### `CustomerContact` (`customer_contacts`): `customerId`, `name`, `role?`, `phone?`, `email?`. Sin uso en UI del legado.

### `Vehicle` (`vehicles`)

- `plate String?` (comentario: "puede faltar al cotizar; se exige al registrar la orden"), `vin?`, `make?`, `model?`, `year Int?`, `trim?`, `engine?`, `transmission?`, `fuelType?`, `color?`, `currentMileage Int?`, `nextServiceAt?`, `alerts?`, `notes?`, `status RecordStatus default ACTIVO`.
- Relaciones: `owners VehicleOwner[]`, `mileageHistory VehicleMileageHistory[]`, `appointments`, `receptions`, `quotes`, `workOrders`, `warranties`, `warrantyClaims`, `reminders`.
- `createdAt`, `updatedAt`, `deletedAt?`. Índices (no únicos) en `plate` y `vin`. **La placa no es única en BD.**

### `VehicleOwner` (`vehicle_owners`)

Comentario: "Relación cliente<->vehículo (permite varios dueños e historial al cambiar propietario)."

- `vehicleId`, `customerId`, `isCurrent Boolean default true`, `fromDate DateTime default now()`, `toDate?`.
- `@@unique([vehicleId, customerId, fromDate])`, índice `customerId`.

### `VehicleMileageHistory` (`vehicle_mileage_history`): `vehicleId`, `mileage Int`, `source?` ("recepción, servicio, manual"), `recordedAt`, `createdById?`. Lo escribe `modules/receptions/actions.ts` (`source: "recepcion"`) cuando la recepción trae kilometraje; los módulos de vehículos no lo escriben.

---

## 1. INVENTARIO

### 1.1 Alta de producto — `createProduct` (`modules/inventory/actions.ts`)

Server action `createProduct(_prevState, formData)`. Se invoca únicamente desde el formulario "Nuevo producto" de
`app/(dashboard)/inventario/salida/scan-exit-form.tsx` (el flujo de escaneo). **No existe una pantalla de alta de
producto independiente**: solo se puede dar de alta un producto a partir de un código escaneado/tecleado que no
coincide con nada.

**Permiso:** `inventory.adjust`. Error: `"No tienes permiso para ajustar inventario"`.

**Campos leídos del `FormData`:**

| Campo | Lectura | Regla |
| --- | --- | --- |
| `name` | `trim()` | obligatorio; error `"Indica el nombre del producto"` |
| `barcode` | `trim() || null` | viene oculto con el código escaneado (`<input type="hidden" name="barcode" value={unmatched}>`) |
| `categoryName` | `trim()` | texto libre con `datalist` de categorías activas; opcional |
| `unit` | `trim() || null` | placeholder "unidad"; opcional |
| `internalUse` | checkbox | `forSale = formData.get("internalUse") !== "on"`. Marcado ⇒ `forSale=false` |
| `quantity` | `Prisma.Decimal(... || "0")` | "Cantidad actual"; `required` en UI, `min="0"`, `step="0.01"` |
| `cost` | `Prisma.Decimal(... || "0")` | opcional en UI |
| `price` | `Prisma.Decimal(... || "0")` | campo "Precio de venta"; **solo se renderiza si NO es uso interno** (`{!internalUse && ...}`) y ahí es `required`. Para uso interno se guarda `0` |
| `minStock` | `Prisma.Decimal(... || "0")` | "Mínimo", opcional |

**Validaciones (en orden):**

1. `name` vacío → `"Indica el nombre del producto"`.
2. Cualquier `Decimal` que no parsee → `"Cantidad, costo, precio o mínimo inválido"`.
3. `quantity < 0 || cost < 0 || price < 0 || minStock < 0` → `"Cantidad, costo, precio o mínimo inválido"`. (Cero es válido en los cuatro.)
4. Si hay `barcode`: `prisma.product.findUnique({ where: { barcode } })`; si existe → `` `Ese código ya está asociado a ${existing.name}` ``.

**Transacción:**

1. Categoría: si `categoryName` no vacío, busca `productCategory.findFirst({ name: { equals: categoryName, mode: "insensitive" } })`; si no existe la crea (`productCategory.create({ name: categoryName })`). Las categorías se crean al vuelo y se deduplican por nombre sin distinguir mayúsculas.
2. **Generación de `code`:** lee `select: { code: true }` de TODOS los productos, aplica regex `^PRD-(\d+)$`, toma el máximo y genera `` `PRD-${String(max + 1).padStart(4, "0")}` `` (ej. `PRD-0001`). Es el máximo numérico real, no un `count()`.
3. `product.create({ code, barcode, name, categoryId, unit, cost, price, forSale, stockOnHand: quantity, minStock })`. El `stockOnHand` inicial es la `quantity` capturada.
4. Si `quantity > 0`: crea `InventoryMovement` con `type: "ENTRADA_MANUAL"`, `quantity`, `unitCost: cost`, `balanceAfter: quantity`, `reason: "Alta inicial de inventario"`, `createdById: user?.id ?? null`. Si la cantidad inicial es 0, no hay movimiento.

`revalidatePath("/inventario")` y `("/inventario/salida")`. Éxito en UI: `"Producto creado y dado de alta en inventario."`.

**Campos del modelo que la UI nunca captura:** `partNumber`, `description`, `brand`, `presentation`, `taxRate` (queda 0.13), `locationId`, `supplierId`, `status` (queda `ACTIVO`).

**No existe edición de producto** (nombre, precio, costo, mínimo, `forSale`) en ningún action del legado. Solo `linkBarcode` modifica el producto después del alta. Tampoco existe baja/soft-delete de productos desde la UI (`deletedAt` existe en el schema y las queries lo filtran, pero nada lo escribe).

**Costo vs precio:** `cost` es costo de reposición (se usa como `unitCost` por defecto en entradas y en el kardex); `price` es el precio de venta con IVA incluido (`lib/money.ts`: "Decisión #1: los precios de catálogo incluyen IVA (13%). El desglose se calcula hacia atrás: base = precio / (1 + tasa)"). Si `forSale=false`, la UI muestra `"—"` en vez de precio (`/inventario` y `/inventario/[id]`) y el producto queda fuera de `listSellableProducts`.

### 1.2 Consultas — `modules/inventory/queries.ts`

- `listActiveProducts()`: `status: "ACTIVO", deletedAt: null`, orden por `name asc`. Usada por `/inventario/salida` (incluye insumos internos: se pueden dar salida/entrada).
- `listSellableProducts()`: igual + `forSale: true`. Comentario: "Solo lo que se puede cotizar/vender a un cliente — excluye insumos de uso interno del taller (forSale: false), que no tienen precio de venta." Usada por `components/work-orders/work-order-detail-body.tsx` (agregar repuesto a orden) y `app/(dashboard)/recepcion/nuevo/page.tsx` (intake picker).
- `listProductCategories()`: `status: "ACTIVO"`, `name asc`.
- `listProductsWithAvailability()`: todos los productos con `deletedAt: null` (incluye `INACTIVO`), con `reservations` en estado `ACTIVA`; calcula `reserved = Σ reservations.quantity` y `available = stockOnHand - reserved`. Alimenta `/inventario`.
- `getProductDetail(id)`: producto + reservas `ACTIVA` con su `workOrder`; mismos `reserved`/`available`.
- `getProductKardex(id)`: ver 1.9.

### 1.3 Tipos de movimiento (`InventoryMovementType`) y cuándo se generan

| Tipo | Signo de `quantity` | `balanceAfter` | Quién lo crea | `reason` literal |
| --- | --- | --- | --- | --- |
| `ENTRADA_MANUAL` | + | stock nuevo | `createProduct` (alta con cantidad > 0) | `"Alta inicial de inventario"` |
| `ENTRADA_MANUAL` | + | stock nuevo | `registerManualEntry` | motivo del usuario o `"Entrada manual"` por defecto |
| `SALIDA_MANUAL` | − | stock nuevo | `registerManualExit` | motivo del usuario (obligatorio) |
| `RESERVA` | − (cantidad reservada, negada) | **stock sin cambio** (`product.stockOnHand`) | `reserveInventoryForWorkOrder` (`modules/inventory/service.ts`) | `"Reserva al crear orden de trabajo"` |
| `LIBERACION_RESERVA` | + (cantidad reservada) | **stock sin cambio** | `releaseReservationsForWorkOrder` | `"Liberada al cerrar/cancelar la orden sin consumo"` |
| `CONSUMO` | − | stock nuevo | `confirmConsumption` | `"Consumo confirmado"` |
| `COMPRA`, `DEVOLUCION_ORDEN`, `DEVOLUCION_PROVEEDOR`, `AJUSTE`, `PERDIDA`, `CORRECCION`, `REVERSION` | — | — | **Nadie**: existen en el enum y tienen etiqueta en `MOVEMENT_LABEL` de `/inventario/[id]`, pero ningún código los genera | — |

Etiquetas visibles (`app/(dashboard)/inventario/[id]/page.tsx`, `MOVEMENT_LABEL`): `COMPRA` → "Compra", `ENTRADA_MANUAL` → "Entrada manual", `SALIDA_MANUAL` → "Salida manual", `RESERVA` → "Reserva", `LIBERACION_RESERVA` → "Liberación de reserva", `CONSUMO` → "Consumo", `DEVOLUCION_ORDEN` → "Devolución de orden", `DEVOLUCION_PROVEEDOR` → "Devolución a proveedor", `AJUSTE` → "Ajuste", `PERDIDA` → "Pérdida", `CORRECCION` → "Corrección", `REVERSION` → "Reversión".

Nota: los movimientos `RESERVA` y `LIBERACION_RESERVA` se registran con signo pero **no alteran `stockOnHand`** (`balanceAfter` repite la existencia física). En el kardex PEPS (1.9) sí se procesan como salidas/entradas de lotes porque el algoritmo solo mira el signo de `quantity` — es un efecto secundario del legado, no una decisión documentada.

### 1.4 Reservas — `modules/inventory/service.ts`

Comentario cabecera: "Decisión #4: se RESERVA al aprobar el trabajo (no reduce existencia física), se DESCUENTA al confirmar consumo. disponible = stockOnHand - reservas activas. Corre dentro de la misma transacción que crea la orden de trabajo: si algún producto no alcanza, se lanza un error y toda la creación se revierte."

Estas dos funciones **no son server actions**: reciben `tx: Prisma.TransactionClient` y solo se llaman desde otro código de servidor.

#### `reserveInventoryForWorkOrder(tx, workOrderId, items[{productId, quantity}], createdById)`

1. **Primera pasada (validación de todo antes de escribir nada):** para cada item carga el producto con sus reservas `ACTIVA`; si no existe → `throw new Error("Producto no encontrado")`. Calcula `reserved = Σ reservas activas`, `available = stockOnHand - reserved`. Si `available < item.quantity` → `throw new Error(`Stock insuficiente de "${product.name}" (disponible: ${available}, solicitado: ${item.quantity})`)`.
2. **Segunda pasada:** crea `InventoryReservation { productId, workOrderId, quantity, createdById }` (status por defecto `ACTIVA`) y un `InventoryMovement` tipo `RESERVA` con `quantity: item.quantity.negated()`, `balanceAfter: product.stockOnHand`, `workOrderId`, `reservationId`, `reason: "Reserva al crear orden de trabajo"`.

Como lanza excepción dentro de la transacción del llamador, **la orden completa (o la línea agregada) se revierte** si no hay disponible.

**Dónde se llama (cuándo se crean reservas):**

- `modules/work-orders/service.ts` → `createWorkOrderFromApprovedQuote` (líneas aprobadas de una cotización con `productId`) — conversión de cotización aprobada a orden.
- `modules/receptions/actions.ts` → `registerVehicleIntake`: cuando la recepción trae ítems de precio fijo (servicios `quickService` o productos) se crea la orden de trabajo directo y se reservan los productos.
- `modules/work-orders/actions.ts` → `addWorkOrderProduct`: al agregar un repuesto a una orden abierta (ver 1.5).

#### `releaseReservationsForWorkOrder(tx, workOrderId, createdById)`

Comentario: "Libera las reservas activas de una orden sin afectar la existencia física (se usa cuando la orden llega a un estado terminal sin haber consumido, ej. cancelada)."

Para cada reserva `ACTIVA` de la orden: crea `InventoryMovement` tipo `LIBERACION_RESERVA` con `quantity: r.quantity` (positivo), `balanceAfter: product.stockOnHand`, `reason: "Liberada al cerrar/cancelar la orden sin consumo"`, y pasa la reserva a `status: "LIBERADA"`.

**Dónde se llama (cuándo se liberan):**

- `modules/work-orders/actions.ts` → `changeWorkOrderStatus`: si el nuevo estado tiene `status.isTerminal`.
- `modules/work-orders/actions.ts` → `deleteWorkOrder` (anulación/soft-delete, permiso `work_orders.void`).
- `modules/work-orders/service.ts` → `maybeAutoCloseWorkOrder`: cierre automático al saldarse el pago.

**Consecuencia:** si una orden pasa a estado terminal (cerrado/cancelado) sin que alguien haya pulsado "Confirmar consumo", las reservas se liberan y **el stock físico nunca baja** — el repuesto queda como si no se hubiera usado. Solo `confirmConsumption` descuenta.

#### Estado `VENCIDA` y `expiresAt`

Existen en el schema; ningún código los usa. No hay vencimiento automático de reservas.

#### Cálculo de disponible

Siempre en la app, nunca en BD: `available = product.stockOnHand − Σ(reservations where status = "ACTIVA").quantity`. Se recalcula en `listProductsWithAvailability`, `getProductDetail` y dentro de `reserveInventoryForWorkOrder`.

### 1.5 Consumo desde orden de trabajo

#### Agregar repuesto a una orden — `addWorkOrderProduct` (`modules/work-orders/actions.ts`) + `app/(dashboard)/ordenes/[id]/add-product-form.tsx`

- Permiso: `work_orders.update` → `"No tienes permiso para modificar órdenes de trabajo"`.
- UI (`AddProductForm`): botón "Agregar repuesto"; buscador por nombre o `code` (`includes` case-insensitive, máx. 10 resultados) sobre `listSellableProducts` (solo `forSale`); muestra `{name} {code} · {formatUSD(price)}`. Al elegir: muestra `"· Disponible: {stockOnHand} {unit}"` — **ojo: la UI muestra `stockOnHand`, no el disponible neto de reservas**. Campos: `quantity` (`step 0.01`, `min 0.01`, default `1`, required) y `unitPrice` (default `product.price`, `min 0`, editable).
- Validaciones server: `productId` vacío → `"Selecciona un producto"`; orden inexistente → `"Orden de trabajo no encontrada"`; producto inexistente → `"Producto no encontrado"`; `workOrder.status.isTerminal` → `"No se pueden agregar repuestos a una orden cerrada"`; decimales inválidos → `"Cantidad o precio inválido"`; `quantity <= 0 || unitPrice < 0` → `"Cantidad o precio inválido"`.
- Transacción: crea `WorkOrderItem { type: "REPUESTO", productId, description: product.name, quantity, unitPrice, taxRate: product.taxRate ?? DEFAULT_TAX_RATE, lineTotal, isAdditional: true, approved: true }`; incrementa `saleGross`, `taxTotal`, `saleNet` de la orden; llama `reserveInventoryForWorkOrder` con esa única línea. Si no alcanza el disponible, el `throw` revierte la transacción y el action devuelve `{ error: e.message }` → el usuario ve literalmente `Stock insuficiente de "X" (disponible: N, solicitado: M)`. Comentario: "si no alcanza la existencia disponible, se revierte todo y no se agrega la línea."
- El precio se **copia** en la línea (`unitPrice`), no se referencia; el `productId` queda como FK para trazabilidad y reserva.
- Éxito UI: `` `Agregado: ${selected.name}` ``.

#### Confirmar consumo — `confirmConsumption(workOrderId)` (`modules/inventory/actions.ts`) + `confirm-consumption-button.tsx`

- Permiso: `inventory.confirm_consumption` → `"No tienes permiso para confirmar consumo de inventario"`.
- Orden inexistente → `"Orden de trabajo no encontrada"`.
- Si `!workOrder.status.allowsConsumption` → `` `El estado actual (${workOrder.status.label}) no permite confirmar consumo` `` (el flag `allowsConsumption` vive en `WorkOrderStatus`, configurable por estado).
- Sin reservas `ACTIVA` → `"No hay reservas activas para esta orden"`.
- Transacción, por cada reserva activa: `newStock = product.stockOnHand − r.quantity`; `product.update({ stockOnHand: newStock })`; `InventoryMovement { type: "CONSUMO", quantity: r.quantity.negated(), balanceAfter: newStock, workOrderId, reservationId, reason: "Consumo confirmado" }`; reserva → `status: "CONSUMIDA"`.
- **No revalida disponible ni stock**: descuenta lo reservado aunque `stockOnHand` quedara negativo (puede pasar si hubo `SALIDA_MANUAL` posterior a la reserva, ya que `registerManualExit` compara contra `stockOnHand`, no contra disponible).
- Es **todo o nada por orden**: consume todas las reservas activas de una vez; no hay consumo parcial ni por línea.
- Botón UI: `"Confirmar consumo de repuestos"` / `"Confirmando..."`. Se muestra en el detalle de la orden si el usuario tiene `inventory.confirm_consumption` (`components/work-orders/work-order-detail-body.tsx`).

### 1.6 Salida manual por escaneo — `registerManualExit` + `/inventario/salida`

**Página** `app/(dashboard)/inventario/salida/page.tsx` ("Movimientos de bodega"):

- Guardia server-side: sin `inventory.adjust` renderiza `"No tienes permiso para registrar salidas de inventario."` (único page de estos módulos con guardia de permiso en el render; los demás confían en el sidebar).
- Texto: "Escanea el código de barras del producto (con la cámara o un lector físico) para registrar una entrada o salida. Si el código no existe todavía, también podés darlo de alta ahí mismo."
- Pasa a `ScanExitForm` la lista `listActiveProducts()` (id, name, code, barcode, stockOnHand como string, unit) y los nombres de categorías activas.
- Enlace de entrada desde `/inventario`: botón rojo "Entrada / salida por código", visible solo con `inventory.adjust`.

**Flujo del cliente** (`scan-exit-form.tsx`, estado: `scanning`, `manualCode`, `selected`, `unmatched`, `linkPick`, `creating`, `internalUse`, `mode: "salida" | "entrada"`, `successMsg`):

1. **Identificar producto**, tres caminos:
   - "Escanear con la cámara" → monta `<BarcodeScanner onDetected>`; al detectar, desmonta y llama `lookup(code)`. Botón "Cancelar".
   - Campo de texto "O escribe/escanea el código aquí (también sirve con lector físico)" + botón "Buscar" → `lookup(manualCode.trim())`. Un lector USB/HID que teclea y envía Enter dispara el submit.
   - `ProductSearch` "O busca el producto por nombre..." → filtra en memoria por `name` o `code` (`includes`, lowercase, máx. 10) y selecciona directo.
2. **`lookup(code)`**: busca en memoria `products.find(p => p.barcode === code || p.code === code)` (coincidencia exacta con `barcode` o con `code` interno). Si hay match → `selected`; si no → `unmatched = code`.
3. **Código no asociado** (`unmatched && !creating`): recuadro ámbar `"El código {code} no está asociado a ningún producto todavía."` con dos opciones:
   - **"Ya existe, solo falta asociarlo"**: `ProductSearch` para elegir un producto → muestra `"Asociar a: {name}"` con botón "Confirmar" (→ `linkBarcode`) y "Cambiar". Al éxito, el producto asociado pasa a `selected` y se sigue con el movimiento.
   - **"No existe todavía — darlo de alta con este código"** → formulario de alta (1.1) con `barcode` oculto = código escaneado. Botón "Crear producto" / "Volver".
   - "Cancelar" vuelve al inicio.
4. **Producto seleccionado**: tarjeta con `{name}`, `{code} · Existencia: {stockOnHand} {unit}` y un toggle **Salida** (rojo) / **Entrada** (verde); modo inicial `"salida"`.
   - **Salida** (`registerManualExit`): `quantity` (`step 0.01`, `min 0`, required, autoFocus) y `reason` (required, placeholder "Ej. venta directa, uso interno..."). Botón "Registrar salida" / "Registrando..."; "Cambiar producto".
   - **Entrada** (`registerManualEntry`): `quantity`, `unitCost` (opcional, placeholder "Igual que antes"), `reason` (opcional, placeholder "Ej. compra a proveedor..."). Botón "Registrar entrada".
5. Éxito: `` `Salida registrada: ${name}` `` / `` `Entrada registrada: ${name}` ``; se limpia `selected` para el siguiente escaneo.

**Server `registerManualExit(_prev, formData)`** (`modules/inventory/actions.ts`):

- Permiso `inventory.adjust` → `"No tienes permiso para ajustar inventario"`.
- `productId` vacío → `"Selecciona un producto"`.
- `reason` vacío (tras `trim`) → `"Indica el motivo de la salida"`. **El motivo es obligatorio en salidas.**
- `quantity` no parseable → `"Cantidad inválida"`; `quantity <= 0` → `"Cantidad inválida"`.
- Producto inexistente → `"Producto no encontrado"`.
- `product.stockOnHand < quantity` → `` `Existencia insuficiente (disponible: ${product.stockOnHand})` ``. **Compara contra la existencia física, no contra el disponible neto de reservas** — se puede sacar manualmente stock que ya estaba reservado para una orden.
- Transacción: `stockOnHand −= quantity`; `InventoryMovement { type: "SALIDA_MANUAL", quantity: -quantity, balanceAfter, reason, createdById }`.
- Revalida `/inventario`, `/inventario/salida`, `/inventario/{productId}`.

No se registra a qué cliente/orden fue la salida: el único vínculo es el texto libre `reason`. La "venta directa de mostrador" del legado es exactamente esto: una `SALIDA_MANUAL` con motivo, sin cobro asociado.

### 1.7 Entradas / compras — `registerManualEntry`

- Permiso `inventory.adjust` → `"No tienes permiso para ajustar inventario"`.
- `productId` vacío → `"Selecciona un producto"`.
- `reason` opcional; por defecto `"Entrada manual"`.
- Parse de `quantity` y `unitCost` (este último `null` si vacío); si falla → `"Cantidad o costo inválido"`.
- `quantity <= 0` → `"Cantidad inválida"`; `unitCost < 0` → `"Cantidad o costo inválido"`.
- Producto inexistente → `"Producto no encontrado"`.
- Transacción: `stockOnHand += quantity`; `InventoryMovement { type: "ENTRADA_MANUAL", quantity, unitCost: unitCost ?? product.cost, balanceAfter, reason }`.
- **No actualiza `Product.cost`** aunque se capture un `unitCost` distinto: el costo del catálogo queda fijo; el nuevo costo solo vive en el movimiento (y lo aprovecha el kardex PEPS).
- No existe módulo de compras a proveedor: `Purchase`, `PurchaseOrder`, `Supplier` están en el schema sin ninguna action ni pantalla. La "compra" del legado es una `ENTRADA_MANUAL` con motivo "compra a proveedor".

### 1.8 Ajustes

No existe un action de ajuste de inventario (tipos `AJUSTE`, `CORRECCION`, `REVERSION`, `PERDIDA` sin uso). Un ajuste se hace con una entrada o salida manual con el motivo correspondiente. No hay conteo físico ni edición directa de `stockOnHand`.

### 1.9 Historial / Kardex — `getProductKardex(id)` + `/inventario/[id]`

Comentario: "Kardex PEPS: recorre los movimientos en orden cronológico simulando lotes de entrada (cantidad + costo) y consumiéndolos en ese mismo orden en cada salida, para calcular el costo real de lo que sale y el valor del saldo restante. Es solo informativo — no toca el costo (Product.cost) que usan las órdenes, comisiones ni reportes, que siguen igual que hoy."

Algoritmo:

1. Movimientos del producto ordenados `createdAt asc`.
2. Resuelve `fullName` de los `createdById` distintos (columna "Usuario"; `"—"` si nulo).
3. Lotes `{ quantity, unitCost }`. Si `m.quantity` es positivo: `unitCost = m.unitCost ?? product.cost` y empuja lote. Si negativo: consume `|quantity|` de los lotes en orden FIFO acumulando `costConsumed`; si se agotan los lotes y sobra (`remaining > 0`), el resto se valoriza a `product.cost` (comentario: "Movimientos de antes de que existiera el kardex (sin lotes registrados todavía) — se valorizan con el costo actual del producto."). `unitCost` de la salida = `costConsumed / |quantity|`.
4. `balanceValue = Σ lote.quantity × lote.unitCost` tras cada movimiento.
5. Devuelve filas `{ id, createdAt, type, quantity, unitCost, lineValue = quantity × unitCost, balanceAfter, balanceValue, reason, userName }` en orden **descendente** (`rows.reverse()`).

Página `/inventario/[id]` (`ProductoDetailPage`): título con `name` (+ badge "Uso interno" si `!forSale`) y `code`; `DataField`s: "Código de barras", "Existencia" (`stockOnHand unit`), "Reservado", "Disponible", "Mínimo", "Costo", "Precio" (`"—"` si `!forSale`); sección "Reservas activas" listando `"{quantity} — orden {workOrder.number}"` con enlace a `/ordenes/{id}`; tabla "Kardex (PEPS)" con columnas Fecha, Tipo, Cantidad (rojo si negativo, verde si positivo), Costo unit., Valor, Saldo, Saldo valorizado, Usuario, Nota; vacío: `"Sin movimientos registrados."`. Texto explicativo: "Costo de cada salida calculado por lo primero que entró, primero que sale. Solo informativo — no cambia el costo ni la ganancia de órdenes, comisiones o reportes."

Sin guardia de permiso en el render (el sidebar oculta "Inventario" si falta `inventory.view`, pero la URL directa funciona para cualquier usuario autenticado).

### 1.10 Alertas de stock bajo

Solo visual, en `/inventario` (`InventarioPage`): `lowStock = p.available.lessThan(p.minStock)` (disponible neto, estrictamente menor que el mínimo). La celda "Disponible" se pinta `font-semibold text-red-600` y añade el sufijo `" (bajo mínimo)"`. No hay notificación, recordatorio, correo ni listado filtrado. Con `minStock = 0` nunca se marca (disponible negativo aparte).

Tabla de `/inventario`: columnas Código (enlace a detalle), Nombre (+ badge "Uso interno"), Existencia (`stockOnHand unit`), Reservado, Disponible, Precio (`"—"` si `!forSale`). Vacío: `"Sin productos en el catálogo."`. Lista **todos** los productos no borrados, incluidos `INACTIVO`.

### 1.11 Escáner de código de barras — `components/inventory/barcode-scanner.tsx`

- Librería: `BrowserMultiFormatReader` de `@zxing/browser` (multi-formato: EAN/UPC/Code128/QR, etc.).
- `decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef, callback)`: pide la cámara trasera del dispositivo y decodifica cuadro a cuadro sobre un `<video muted playsInline>` (`aspect-video`).
- Comentario: "La detección real dispara muchos 'NotFoundException' mientras no hay código en pantalla — es normal, se ignoran. onDetected se llama una sola vez por montaje; el padre decide cuándo desmontar (eso libera la cámara)."
- Al primer resultado: `stopped = true`, `controls.stop()`, `onDetected(result.getText())`. Un solo disparo por montaje; el cleanup del efecto detiene la cámara.
- Error de permisos/cámara: `"No se pudo acceder a la cámara. Revisa los permisos del navegador."`.
- Qué hace al leer: el padre (`ScanExitForm`) apaga el escáner y llama `lookup(code)` (1.6). Se compara contra `barcode` **o** contra `code` interno, por igualdad exacta, sobre la lista de productos activos cargada en el servidor al abrir la página (no hay consulta al servidor por código).
- Lector físico: no requiere el componente; teclea en el input y el Enter envía el form.

### 1.12 Asociar código de barras — `linkBarcode`

- Permiso `inventory.adjust` → `"No tienes permiso para ajustar inventario"`.
- `productId` o `barcode` vacíos → `"Faltan datos"`.
- `product.findUnique({ where: { barcode } })`; si existe y es otro producto → `` `Ese código ya está asociado a ${existing.name}` ``.
- `product.update({ barcode })`. **Sobrescribe** el barcode anterior del producto si tenía otro (un producto solo puede tener un barcode; un barcode solo puede estar en un producto — `@unique`).

### 1.13 Qué pasa si no hay stock suficiente (resumen)

| Situación | Comparación | Resultado |
| --- | --- | --- |
| Agregar repuesto a orden / convertir cotización / recepción con producto | `available (stock − reservas activas) < solicitado` | `throw` dentro de la transacción → nada se guarda; error `Stock insuficiente de "X" (disponible: N, solicitado: M)` |
| Salida manual | `stockOnHand < quantity` | `Existencia insuficiente (disponible: N)` (N = existencia física) |
| Confirmar consumo | no compara | Descuenta lo reservado; `stockOnHand` puede quedar negativo |
| Cotizar un producto | no compara | La cotización no toca inventario; solo al convertir a orden |

---

## 2. SERVICIOS (catálogo)

### 2.1 Campos y consultas

Modelo `ServiceCatalog` (ver 0). Campos que la UI captura: `name`, `suggestedPrice`, `categoryId`, `type`, `quickService`. Campos que nunca captura: `description`, `area`, `internalCost`, `estimatedMinutes`, `unit`, `taxRate`, `warrantyEnabled`, `warrantyDays`, `notes` (se llenan por seed o quedan por defecto).

`modules/services/queries.ts`:

- `listActiveServices()`: `status: "ACTIVO", deletedAt: null, area: { not: "CARWASH" }`, con `category`, orden `name asc`. Comentario: "El área Carwash se quita del catálogo por ahora (pedido explícito) — el dato queda intacto en la base, solo se excluye de este listado." Nota Prisma: `area: { not: "CARWASH" }` **también excluye servicios con `area = null`**. Usada en recepción y en "Agregar servicio" a orden.
- `listDiagnosticServices()`: `status ACTIVO, deletedAt null, type: "DIAGNOSTICO", quickService: false`. Comentario: "Diagnósticos de costo variable (ej. suspensión) que se pueden elegir al recibir el vehículo para abrir la cuenta — se excluyen los quickService (GDI, etc.) porque esos van directo a orden, no a este flujo." (Definida; ninguna página la importa en el estado actual.)
- `listQuickServices()`: `status ACTIVO, deletedAt null, quickService: true`, con `category`. Comentario: "Servicios de precio fijo y publicado (cambio de aceite, frenos, GDI...) — se venden directo como orden de trabajo, sin pasar por Cotización." (Definida; ninguna página la importa en el estado actual.)
- `listAllServicesForAdmin()`: `deletedAt: null` (activos e inactivos), con `category`, orden `[category.name asc, name asc]`. Alimenta `/servicios`.
- `listServiceCategories()`: `serviceCategory` con `status ACTIVO`, `name asc`.

### 2.2 Alta — `createService` (`modules/services/actions.ts`) + `new-service-form.tsx`

- Permiso `services.manage` → `"No tienes permiso para agregar servicios al catálogo"`.
- `name` (trim) vacío → `"El nombre es obligatorio"`.
- `suggestedPrice = new Prisma.Decimal(String(formData.get("suggestedPrice") || "0"))`; si `<= 0` → `"El precio debe ser mayor a 0"`. **A diferencia de productos, el precio de un servicio no puede ser 0.** (Un valor no numérico haría `throw` sin capturar.)
- `categoryId`: `emptyToNull` (select "Sin categoría" = `""` → `null`).
- `type`: `(String(formData.get("type") ?? "MANO_OBRA") as ServiceType) || "MANO_OBRA"`. Opciones ofrecidas en el form (`TYPE_OPTIONS`): `MANO_OBRA` "Mano de obra", `MANT_EXPRESS` "Mantenimiento exprés", `MANT_PREVENTIVO` "Mantenimiento preventivo", `DIAGNOSTICO` "Diagnóstico", `OTRO` "Otro". No se ofrecen `CARWASH`, `SERVICIO_EXTERNO`, `PAQUETE`. No se valida contra el enum en servidor (cast directo).
- `quickService = formData.get("quickService") === "on"`. Label del checkbox: "Servicio rápido (precio fijo, va directo a orden)".
- `code = nextServiceCode()` = `` `SRV-${String(count + 1).padStart(4, "0")}` `` con `count = serviceCatalog.count()` (cuenta **incluyendo** borrados/inactivos; si un seed dejó huecos o hay borrados, puede colisionar con `@unique` — distinto al método de máximo real usado en productos).
- `area` no se establece al crear (queda `null`) ⇒ un servicio creado desde `/servicios` **no aparece en `listActiveServices()`** por el filtro `area: { not: "CARWASH" }` (ver nota 2.1). Es un comportamiento observado del código, no documentado.
- `revalidatePath("/servicios")`.

### 2.3 Edición inline — `updateService(id, _prev, formData)` + `edit-service-row.tsx`

- Permiso `services.price` → `"No tienes permiso para cambiar precios del catálogo"`. (Editar nombre/rápido también exige `services.price`, porque es el mismo action.)
- Editables en la fila: `name` (input texto), `suggestedPrice` (`step 0.01`, `min 0.01`), `quickService` (checkbox "Rápido"). Botones "Guardar" / "..." / "Cancelar".
- Validaciones idénticas al alta: `"El nombre es obligatorio"`, `"El precio debe ser mayor a 0"`.
- `serviceCatalog.update({ name, suggestedPrice, quickService })`. **No** se puede cambiar categoría ni tipo después de creado.
- El botón "Editar" solo se renderiza con `services.price` (`canPrice` en `page.tsx`).

### 2.4 Activar / desactivar — `setServiceStatus(id, active)`

- Permiso `services.manage` → `"No tienes permiso para desactivar servicios"`.
- `status = active ? "ACTIVO" : "INACTIVO"`. Definida y exportada, pero **ningún componente la invoca** en la UI actual (la columna "Estado" solo muestra "Activo"/"Inactivo" como texto).
- No existe soft-delete de servicios desde la UI.

### 2.5 Pantalla `/servicios` (`ServiciosPage`)

- Título "Catálogo de servicios". Texto: "Marca "Rápido" en los servicios de precio fijo (cambio de aceite, frenos, GDI...) para que aparezcan en Servicios rápidos y se puedan vender directo como orden, sin cotización."
- Form de alta visible solo con `services.manage`.
- Agrupa por categoría (`"Sin categoría"` para `categoryId null`), grupos ordenados por nombre; tabla por grupo: Código, Nombre, Precio (`formatUSD(suggestedPrice)`), Rápido (badge verde "Rápido" si `quickService`), Estado ("Activo"/"Inactivo"), columna de edición si `canPrice`.
- Sin guardia de permiso en render (sidebar oculta "Catálogo" sin `services.view`).

### 2.6 Qué significa "quick" / Rápido y dónde afecta

- **Definición:** servicio de precio fijo y publicado que se vende directo como orden de trabajo sin cotización ni aprobación. Lo contrario: diagnóstico de costo variable (`quickService: false`) que abre una "cuenta" (recepción pendiente de cotizar).
- **Recepción** (`modules/receptions/actions.ts` → `registerVehicleIntake`): las líneas elegidas se separan **según el catálogo, no según lo que mande el cliente**: si `service.quickService` → `quickItems` (generan orden de trabajo inmediata con `approved: true`); si no → `diagnosticItems` (solo quedan en `Reception.requestedServices` como nombres separados por coma; no generan cotización automática). Productos (`serviceId` null) siempre van a `quickItems`. Si hay `quickItems` y el vehículo no tiene `plate` o `model` → `` `Completa ${missing} del vehículo antes de generar la orden de trabajo.` ``. El intake picker (`components/quotes/intake-picker.tsx`) marca cada línea con un punto verde ("Precio fijo — va directo a orden") o ámbar ("Diagnóstico — abre cuenta para cotizar").
- **Consultas:** `listQuickServices` / `listDiagnosticServices` filtran por este flag.
- **Seed:** `prisma/seed.ts` no pisa `suggestedPrice` ni `quickService` en el `update` del upsert: "precio y quickService NO se pisan en el update — se editan desde /servicios y un reseed no debe borrar esos cambios".

### 2.7 Cómo se agregan servicios a una orden / cotización (precio copiado, no referenciado)

- **Orden abierta** — `addWorkOrderItem(workOrderId, _prev, formData)` (`modules/work-orders/actions.ts`) + `app/(dashboard)/ordenes/[id]/add-service-form.tsx`:
  - Permiso `work_orders.update` → `"No tienes permiso para modificar órdenes de trabajo"`.
  - UI: botón "Agregar servicio"; chips de categoría ("Todos" + `categoryName` únicos ordenados) y tarjetas `{name} / {formatUSD(suggestedPrice)}`; **un clic agrega directo** (sin cantidad ni precio editables). Comentario: "Selector de catálogo por categoría, al estilo Quanto ... clic agrega directo a la orden (sin aprobación ...)". Vacío: `"Sin servicios en esta categoría."`. La lista viene de `listActiveServices()` (excluye CARWASH y `area null`).
  - Server: `serviceId` vacío → `"Selecciona un servicio"`; orden inexistente → `"Orden de trabajo no encontrada"`; servicio inexistente → `"Servicio no encontrado"`; estado terminal → `"No se pueden agregar servicios a una orden cerrada"`.
  - Línea: `quantity = 1`, `unitPrice = service.suggestedPrice` (copiado), `taxRate = service.taxRate ?? 0.13`, `type = quoteItemTypeForService(service.type)` (`MANO_OBRA`→`MANO_OBRA`, `SERVICIO_EXTERNO`→`SERVICIO_EXTERNO`, `PAQUETE`→`PAQUETE`, resto→`SERVICIO`), `description = service.name`, `isAdditional: true`, `approved: true`; se incrementan `saleGross`, `taxTotal`, `saleNet`. Comentario: "sin pasar por una nueva aprobación del cliente — el asesor/técnico ya lo acordó verbalmente".
- **Recepción** (intake picker): al elegir un servicio se crea la línea con `description: service.name`, `quantity: "1"`, `unitPrice: service.price` (string del `suggestedPrice`), y **el precio y la cantidad son editables** antes de guardar (`onPriceChange`, `setQuantityAt`). El servidor reconstruye `quantity = round(Number) || 1` y `unitPrice` desde lo enviado; el `taxRate` sí sale del catálogo.
- **Cotización** (`modules/quotes/actions.ts` → `toItemData`): las líneas llegan como JSON con `type, description, quantity, unitPrice, discount, productId?, serviceId?, supplierNote?`; se guardan tal cual con `quantity` redondeada a entero ("Cantidades en unidades enteras ... solo el precio admite decimales") y `taxRate = DEFAULT_TAX_RATE` fijo; se filtran líneas sin descripción, `quantity <= 0` o `unitPrice <= 0`. El precio del catálogo es solo la sugerencia inicial en el cliente. `serviceId`/`productId` quedan como referencia opcional.
- En los tres casos el precio **se copia** en la línea; cambiar `suggestedPrice` después no afecta órdenes ni cotizaciones existentes.

---

## 3. CLIENTES

### 3.1 Campos capturados

Formularios `app/(dashboard)/clientes/nuevo/page.tsx` y `clientes/[id]/editar/edit-form.tsx` (mismos campos, via `FormField`/`FormSelect` de `components/ui/form-field.tsx`):

| Campo | Label UI | Tipo input | Obligatorio |
| --- | --- | --- | --- |
| `personType` | "Tipo" | select: `NATURAL` "Persona natural", `JURIDICA` "Persona jurídica" | default `NATURAL` |
| `fullName` | "Nombre completo / Razón social" | text | sí (HTML `required` + server) |
| `phone` | "Teléfono" | text | no |
| `whatsapp` | "WhatsApp" | text | no |
| `email` | "Correo" | `type="email"` | no |
| `dui` | "DUI" | text | no |
| `nit` | "NIT" | text | no |
| `address` | "Dirección" | text | no |

No se capturan: `otherDoc`, `customerType`, `tags`, `notes`, `branchId`, `createdById`, `contacts`.

`readCustomerFields(formData)` (`modules/customers/actions.ts`): `fullName` trim; `personType = String(... ?? "NATURAL") as PersonType` (cast sin validar); resto con `emptyToNull` (trim; `""` → `null`).

### 3.2 Validaciones

- **Única validación de servidor:** `fullName` vacío → `"El nombre es obligatorio"`.
- **Teléfono, DUI, NIT, WhatsApp:** sin formato, sin máscara, sin longitud, sin dígitos obligatorios. Texto libre.
- **Email:** solo `type="email"` en el navegador; el servidor no valida.
- **Unicidad:** ninguna. No hay `@unique` en `dui`/`nit`/`phone`/`email` ni chequeo en el action; se pueden crear dos clientes con el mismo DUI o teléfono. Solo `code` es único.

### 3.3 Código de cliente

`nextCustomerCode()` = `` `CLI-${String(count + 1).padStart(5, "0")}` `` con `count = customer.count()` (incluye soft-borrados). Ej. `CLI-00001`.

### 3.4 Alta — `createCustomer(_prev, formData)`

- Permiso `customers.create` → `"No tienes permiso para crear clientes"`.
- `customer.create({ ...fields, code })`; `revalidatePath("/clientes")`; `redirect(`/clientes/${id}`)`.
- Botón "Guardar cliente" / "Guardando..."; enlace "Cancelar" a `/clientes`.

### 3.5 Alta rápida — `quickCreateCustomer(fullName, phone)`

- Comentario: "Creación rápida desde la pantalla de cotización: solo nombre + teléfono, sin salir de la pantalla. El cliente puede completar el resto después desde /clientes."
- Permiso `customers.create` → `"No tienes permiso para crear clientes"`.
- `fullName.trim()` vacío → `"El nombre es obligatorio"`.
- `customer.create({ fullName, phone: phone.trim() || null, code })`. `personType` queda `NATURAL`.
- Devuelve `{ id, fullName }` o `{ error }`.

### 3.6 Edición — `updateCustomer(id, _prev, formData)`

- Permiso `customers.update` → `"No tienes permiso para modificar clientes"`.
- Misma lectura y validación; `customer.update({ where: { id }, data: fields })` — **sobrescribe todos los campos**, incluidos los que llegan vacíos (→ `null`).
- Revalida `/clientes` y `/clientes/{id}`; redirect al detalle. Botón "Guardar cambios".
- No hay control de concurrencia ni auditoría.

### 3.7 Búsqueda

- **Listado `/clientes`** (`searchCustomers(query, from?, to?)` en `modules/customers/queries.ts`): `deletedAt: null`; si `query` no vacío, `OR` sobre `fullName` (`contains`, insensitive), `code` (`contains`, insensitive), `phone`, `whatsapp`, `dui`, `nit` (`contains`, **sensible a mayúsculas**, sin normalizar guiones). Filtro opcional `createdAt` entre `from` y `to`. Orden `createdAt desc`. `take: 25` si no hay rango de fechas; **sin límite** si hay rango (comentario: "un taller de una sucursal no llega a miles de clientes nuevos en un día/semana/mes").
  - UI: campo "Buscar" con placeholder "Nombre, teléfono, DUI o NIT...", fechas "Desde"/"Hasta", botón "Filtrar", atajos "Hoy", "Esta semana", "Este mes" (basados en `todayInBusinessTz`, `startOfWeek`), "Quitar rango". Tabla: Código (enlace), Nombre, Teléfono, DUI/NIT (`dui ?? nit ?? "—"`), Registrado (`formatDateTime(createdAt)`). Vacío: `"Sin resultados."`. Con rango: `"{n} cliente(s) registrados en el rango."`. Botón "+ Nuevo cliente" solo con `customers.create`.
- **Picker** (`searchCustomersAction(query)` en `actions.ts`): permiso `customers.view` (si no, devuelve `[]` silenciosamente); query vacío → `[]`; `deletedAt: null`; `OR` en `fullName` (insensitive), `phone`, `whatsapp` (`contains`); incluye `vehicleOwners` con `isCurrent: true` (vehículo con `id, plate, make, model`), orden `fromDate desc`; `orderBy createdAt desc`, `take: 10`. Devuelve `{ id, fullName, phone, vehicles[] }`.

### 3.8 Soft-delete

El schema tiene `deletedAt` y `status`, y todas las queries filtran `deletedAt: null`. **No existe ningún action que borre o desactive un cliente** (ni soft ni hard). Tampoco hay UI para ello.

### 3.9 Vista de detalle `/clientes/[id]` (`ClienteDetailPage`)

- `getCustomerWithVehicles(id)`: cliente + `vehicleOwners` con `isCurrent: true`, `include: { vehicle }`, orden `fromDate desc`. **No filtra `deletedAt`** (un cliente borrado seguiría accesible por URL).
- Muestra: `fullName`, `code`; `DataField`s Teléfono, WhatsApp, Correo, DUI, NIT, Dirección (`"—"` si vacío); botón "Editar" (solo `customers.update`).
- Sección "Vehículos": tabla Placa (enlace a `/vehiculos/{id}`, `"—"` si sin placa), Marca/Modelo, Año; vacío `"Sin vehículos registrados."`. Formulario `AddVehicleForm` (solo con `vehicles.create`).
- **No muestra** historial de órdenes, cotizaciones, pagos, saldo ni crédito (aunque el modelo tenga `creditProfile`, `receivables`, `payments`). El historial vive en el vehículo (4.7).
- Sin guardia de permiso en render; `notFound()` si no existe.

---

## 4. VEHÍCULOS

### 4.1 Campos capturados

`readVehicleFields(formData)` (`modules/vehicles/actions.ts`):

| Campo | Transformación | Label UI |
| --- | --- | --- |
| `plate` | `String(...).trim().toUpperCase()` (**siempre mayúsculas**) | "Placa" |
| `make` | `emptyToNull` | "Marca" |
| `model` | `emptyToNull` | "Modelo" |
| `year` | `emptyToNullInt` (`Number(str)`, sin validar rango; `"abc"` → `NaN`) | "Año" (`type=number`) |
| `color` | `emptyToNull` | "Color" |
| `vin` | `emptyToNull` (sin mayúsculas, sin longitud 17, sin unicidad) | "VIN" — solo en el form de **edición**; el `AddVehicleForm` del cliente no lo pide |
| `currentMileage` | `emptyToNullInt` | "Kilometraje" (`type=number`) |

No se capturan: `trim`, `engine`, `transmission`, `fuelType`, `nextServiceAt`, `alerts`, `notes`.

### 4.2 Placa opcional: por qué y cómo se etiqueta

- Schema: `plate String?` — "puede faltar al cotizar; se exige al registrar la orden".
- `lib/vehicle-label.ts`: "La placa puede faltar (se completa al registrar la orden de trabajo, no al cotizar), así que en listas y encabezados mostramos marca/modelo como respaldo."
- `modules/vehicles/actions.ts` (`quickCreateVehicle`): "Creación rápida desde la cotización: marca/modelo (y placa si ya se sabe, puede completarse después). La placa sí es obligatoria al registrar la orden de trabajo (ver modules/work-orders/actions.ts)."
- Dónde se exige: `modules/work-orders/actions.ts` → `createWorkOrderFromQuote`: `` `Completa ${missing.join(" y ")} del vehículo antes de crear la orden de trabajo.` `` (missing ∈ {"placa","modelo"}); `modules/receptions/actions.ts` → `registerVehicleIntake` cuando hay ítems de precio fijo: `` `Completa ${missing.join(" y ")} del vehículo antes de generar la orden de trabajo.` ``. **También se exige el `model`.**
- En los formularios completos (`createVehicleForCustomer`, `updateVehicle`) la placa **sí** es obligatoria: `"La placa es obligatoria"`. Solo la creación rápida desde el picker permite omitirla.

**`vehicleLabel(vehicle)`** (`lib/vehicle-label.ts`): si hay `plate` → la placa; si no → `"{make} {model}"` (los que existan, unidos por espacio); si tampoco → `"Sin placa"`. Usado en tablero, recepción, órdenes, cotizaciones, reportes, recordatorios y encabezado de `/vehiculos/[id]`.

El picker tiene su propia variante (`components/customers/customer-vehicle-picker.tsx` → `vehicleLabel` local): `[plate, make, model].filter(Boolean).join(" — ") || "Vehículo sin datos"`. Y `quickCreateVehicle` devuelve `label = [plate, make, model].filter(Boolean).join(" — ") || "Vehículo nuevo"`.

En la lista `/vehiculos`: `plate ?? "Sin placa"`. En la tabla de vehículos del cliente: `plate ?? "—"`.

### 4.3 Unicidad

**La placa no es única** ni en BD (`@@index([plate])`, no `@unique`) ni en actions: se pueden registrar dos vehículos con la misma placa. Lo mismo para `vin`.

### 4.4 Pertenencia a un cliente — `VehicleOwner`

- Todo vehículo creado desde la app nace con un `VehicleOwner { customerId, isCurrent: true }` (`owners: { create: ... }` en `quickCreateVehicle` y `createVehicleForCustomer`). No existe creación de vehículo sin cliente.
- El "dueño actual" en todas las consultas es `owners.where({ isCurrent: true })[0]`.
- **Cambio de dueño:** el modelo lo soporta (`isCurrent`, `fromDate`, `toDate`, `@@unique([vehicleId, customerId, fromDate])`, comentario "permite varios dueños e historial al cambiar propietario"), pero **no existe ningún action ni UI que cierre un `VehicleOwner` (`isCurrent=false`, `toDate`) o cree uno nuevo para otro cliente.** Si hiciera falta, hoy se registra el vehículo de nuevo bajo el otro cliente.
- Un vehículo puede aparecer con varios `isCurrent: true` si se manipula la BD; las queries toman `[0]`.

### 4.5 Alta desde el cliente — `createVehicleForCustomer(customerId, _prev, formData)` + `clientes/[id]/add-vehicle-form.tsx`

- Permiso `vehicles.create` → `"No tienes permiso para registrar vehículos"`.
- Form: Placa (required), Marca, Modelo, Año, Color, Kilometraje. Botón "Agregar vehículo" / "Guardando...".
- Server: `plate` vacío → `"La placa es obligatoria"`.
- `vehicle.create({ ...fields, owners: { create: { customerId, isCurrent: true } } })`; revalida `/clientes/{customerId}`; `redirect(`/vehiculos/${vehicle.id}`)`.
- No verifica que `customerId` exista (Prisma fallaría por FK).

### 4.6 Alta rápida — `quickCreateVehicle(customerId, plate, make, model)`

- Permiso `vehicles.create` → `"No tienes permiso para registrar vehículos"`.
- Si `make`, `model` y `plate` están los tres vacíos (trim) → `"Indica al menos la marca/modelo o la placa del vehículo"`.
- `plate` → `trim().toUpperCase()` o `null`; `make`/`model` → trim o `null`.
- Crea con `owners: { create: { customerId, isCurrent: true } }`. Revalida `/clientes/{customerId}`. Devuelve `{ id, label }`.

### 4.7 Edición — `updateVehicle(id, _prev, formData)` + `vehiculos/[id]/editar/edit-form.tsx`

- Permiso `vehicles.update` → `"No tienes permiso para modificar vehículos"`.
- Form: Placa (required), Marca, Modelo, Año, Color, VIN, Kilometraje. Botón "Guardar cambios".
- `plate` vacío → `"La placa es obligatoria"` — por tanto, **la única forma de completar la placa de un vehículo creado sin ella es este formulario**.
- `vehicle.update({ data: fields })` sobrescribe todo (incluido `currentMileage`). Actualizar el kilometraje aquí **no** escribe `VehicleMileageHistory` (solo la recepción lo hace).
- Redirect a `/vehiculos/{id}`.

### 4.8 Listado y búsqueda — `/vehiculos`

- `listVehicles()`: `deletedAt: null`, dueño actual con `customer`, `createdAt desc`, **`take: 100`** (sin paginación).
- `searchVehiclesByPlate(plate)`: vacío → `[]`; `plate: { contains, mode: "insensitive" }`, `take: 25`. Busca solo por placa (query param `?placa=`).
- Tabla: Placa (`?? "Sin placa"`, enlace), Marca/Modelo, Dueño (`owners[0]?.customer.fullName ?? "—"`). Vacío: `"Sin resultados."` con búsqueda, `"Sin vehículos registrados."` sin ella.
- Sin botón de "nuevo vehículo": se crea desde el cliente o desde el picker.

### 4.9 Detalle — `/vehiculos/[id]` (`VehiculoDetailPage`)

- `getVehicleWithOwners(id)` (sin filtrar `deletedAt`), `getVehicleVisitHistory(id)`, permisos `vehicles.update` y `receptions.create`.
- Encabezado: `vehicleLabel(vehicle)`; subtítulo `"{make} · {model} · {year}"` o `"Sin datos de marca/modelo"`.
- Botones: "Iniciar recepción" → `/recepcion/nuevo?vehicleId={id}` (solo si `receptions.create` **y** hay dueño); "Editar" (solo `vehicles.update`).
- `DataField`s: Color, VIN, Kilometraje.
- "Dueño": enlace `"{fullName} ({code})"` a `/clientes/{id}` o `"Sin dueño registrado."`.
- **"Historial de visitas"** — `getVehicleVisitHistory(vehicleId)`: `quote.findMany({ vehicleId, deletedAt: null }, include: { workOrder: { include: { status } } }, createdAt desc)`. Comentario: "una cotización = una visita (con o sin recepción previa, ya que se puede cotizar directo). Incluye la orden si esa cotización llegó a convertirse." Tabla: Fecha, Cotización (`number`, enlace a `/cotizaciones/{id}`), Estado (`QUOTE_STATUS_LABEL[status]`), Total (`formatUSD(workOrder.saleNet)` o `"—"`), Orden (`"{number} — {status.label}"` enlace a `/ordenes/{id}` o `"—"`). Vacío: `"Sin visitas registradas todavía."`.
  - Limitación: las órdenes creadas **directo desde recepción** (servicio rápido, sin cotización) **no aparecen** en este historial, porque solo recorre `Quote`.

### 4.10 Soft-delete

`deletedAt` existe y las listas lo filtran; **no hay action ni UI para borrar/desactivar vehículos.**

---

## 5. Picker cliente-vehículo — `components/customers/customer-vehicle-picker.tsx`

Usado en `app/(dashboard)/recepcion/nuevo/new-reception-form.tsx` y `app/(dashboard)/cotizaciones/nuevo/new-quote-form.tsx`. Es un bloque dentro del `<form>` padre; emite dos `<input type="hidden">`: `customerId` y `vehicleId` (vacíos si no hay selección). El servidor de recepción valida: `"Elige o crea el cliente y el vehículo antes de guardar"`.

Props: `initialCustomer?: { id, fullName }`, `initialVehicle?: { id, plate, make, model }` (la recepción los precarga cuando llega con `?vehicleId=`; `recepcion/nuevo/page.tsx` hace `notFound()` si el vehículo no existe o no tiene dueño).

**Flujo:**

1. **Sin cliente:** campo "Buscar cliente existente" (placeholder "Nombre o teléfono") → en cada tecla llama `searchCustomersAction(value)` dentro de `useTransition` (máx. 10 resultados; muestra `fullName` + `phone ?? "sin teléfono"`). Debajo, recuadro "O crear cliente nuevo" con inputs "Nombre completo" y "Teléfono" y botón "Crear cliente" (deshabilitado si nombre vacío o pending; texto "Creando..."). → `quickCreateCustomer(name, phone)`. Al crear: el cliente queda seleccionado con lista de vehículos vacía.
2. **Con cliente:** chip `"Cliente: {fullName}"` + "Cambiar" (limpia cliente, vehículo y lista).
   - **Sin vehículo:** si el cliente tiene vehículos actuales, lista "Vehículos de este cliente" con `vehicleLabel(v)` (clic selecciona). Recuadro "O vehículo nuevo" con "Marca", "Modelo", "Placa (si ya se sabe)" y botón "Agregar vehículo" (deshabilitado si los tres vacíos o pending; "Creando...") → `quickCreateVehicle(customer.id, plate, make, model)`.
   - **Con vehículo:** chip `"Vehículo: {label}"` + "Cambiar".
3. Errores de los actions se muestran en rojo bajo el bloque (`"El nombre es obligatorio"`, `"Indica al menos la marca/modelo o la placa del vehículo"`, o los de permiso).

Notas:

- `pickCustomer` resetea el vehículo: cambiar de cliente obliga a re-elegir vehículo (un vehículo siempre se toma de la lista del cliente seleccionado; no se puede elegir un vehículo de otro dueño).
- Los vehículos ofrecidos vienen del resultado de búsqueda (`vehicleOwners isCurrent`), no se recargan tras crear uno nuevo: el recién creado se selecciona directo con el `label` devuelto.
- El cliente rápido solo lleva `fullName` y `phone`; el vehículo rápido solo `plate`/`make`/`model`. El resto se completa desde `/clientes` y `/vehiculos/[id]/editar`.

---

## 6. Permisos requeridos por action / página

Resolución (`lib/auth.ts` → `getCurrentUser`, "Decisión #3"): permisos por **usuario** = unión de permisos de todos sus roles + `UserPermission.granted=true` − `UserPermission.granted=false`. `hasPermission(key)` = `user.permissions.has(key)`. Ningún código compara nombres de rol. El `DashboardLayout` solo exige sesión (`redirect("/login")`); el sidebar (`components/layout/sidebar.tsx`, `NAV_LINKS`) oculta enlaces por permiso pero **las páginas no bloquean la URL directa**, salvo `/inventario/salida`.

| Acción / pantalla | Archivo | Permiso | Mensaje si falta |
| --- | --- | --- | --- |
| `createProduct` | `modules/inventory/actions.ts` | `inventory.adjust` | "No tienes permiso para ajustar inventario" |
| `registerManualExit` | ídem | `inventory.adjust` | ídem |
| `registerManualEntry` | ídem | `inventory.adjust` | ídem |
| `linkBarcode` | ídem | `inventory.adjust` | ídem |
| `confirmConsumption` | ídem | `inventory.confirm_consumption` | "No tienes permiso para confirmar consumo de inventario" |
| `reserveInventoryForWorkOrder` / `releaseReservationsForWorkOrder` | `modules/inventory/service.ts` | ninguno propio (hereda del action que las llama: `work_orders.update`, `receptions.create`, `work_orders.status`, `work_orders.void`, …) | — |
| Página `/inventario` | `app/(dashboard)/inventario/page.tsx` | sin guardia; botón "Entrada / salida por código" solo con `inventory.adjust`; menú con `inventory.view` | — |
| Página `/inventario/salida` | `.../salida/page.tsx` | `inventory.adjust` (guardia en render) | "No tienes permiso para registrar salidas de inventario." |
| Página `/inventario/[id]` | `.../[id]/page.tsx` | sin guardia | — |
| `createService` | `modules/services/actions.ts` | `services.manage` | "No tienes permiso para agregar servicios al catálogo" |
| `updateService` | ídem | `services.price` | "No tienes permiso para cambiar precios del catálogo" |
| `setServiceStatus` | ídem | `services.manage` | "No tienes permiso para desactivar servicios" |
| Página `/servicios` | `app/(dashboard)/servicios/page.tsx` | sin guardia; form alta con `services.manage`; "Editar" con `services.price`; menú con `services.view` | — |
| `addWorkOrderItem` (servicio a orden) | `modules/work-orders/actions.ts` | `work_orders.update` | "No tienes permiso para modificar órdenes de trabajo" |
| `addWorkOrderProduct` (repuesto a orden) | ídem | `work_orders.update` | ídem |
| `quickCreateCustomer` | `modules/customers/actions.ts` | `customers.create` | "No tienes permiso para crear clientes" |
| `createCustomer` | ídem | `customers.create` | ídem |
| `updateCustomer` | ídem | `customers.update` | "No tienes permiso para modificar clientes" |
| `searchCustomersAction` | ídem | `customers.view` | (devuelve `[]`, sin mensaje) |
| Página `/clientes` | `app/(dashboard)/clientes/page.tsx` | sin guardia; "+ Nuevo cliente" con `customers.create`; menú con `customers.view` | — |
| Página `/clientes/[id]` | `.../[id]/page.tsx` | sin guardia; "Editar" con `customers.update`; `AddVehicleForm` con `vehicles.create` | — |
| `quickCreateVehicle` | `modules/vehicles/actions.ts` | `vehicles.create` | "No tienes permiso para registrar vehículos" |
| `createVehicleForCustomer` | ídem | `vehicles.create` | ídem |
| `updateVehicle` | ídem | `vehicles.update` | "No tienes permiso para modificar vehículos" |
| Página `/vehiculos` | `app/(dashboard)/vehiculos/page.tsx` | sin guardia; menú con `vehicles.view` | — |
| Página `/vehiculos/[id]` | `.../[id]/page.tsx` | sin guardia; "Editar" con `vehicles.update`; "Iniciar recepción" con `receptions.create` | — |

Permisos definidos en `prisma/seed.ts` para estos módulos: `customers.view` ("Ver clientes"), `customers.create`, `customers.update`; `vehicles.view`, `vehicles.create`, `vehicles.update`; `services.view` ("Ver catálogo de servicios"), `services.manage` ("Gestionar catálogo de servicios"), `services.price` ("Cambiar precios de catálogo"); `inventory.view` ("Ver inventario"), `inventory.adjust` ("Ajustar inventario"), `inventory.confirm_consumption` ("Confirmar consumo de inventario"); además `products.view` y `products.manage` existen en el seed pero **ningún código los verifica**.

Asignación por rol en el seed (informativo; los roles no se usan en código): `superadmin` todo; `gerente` todos los anteriores; `asesor` customers.*, vehicles.*, services.view, products.view, inventory.view; `tecnico` inventory.view + inventory.confirm_consumption; `inventario` products.*, inventory.view/adjust/confirm_consumption; `cajero` customers.view; `carwash` customers.view, vehicles.view, services.view; `jefe_mecanicos` inventory.view + confirm_consumption; `auditor` customers.view, vehicles.view, inventory.view.

---

## 7. Reglas de negocio extraídas

### Inventario

1. El código interno de producto se genera como `PRD-` + (máximo numérico existente + 1) con 4 dígitos, leyendo todos los códigos con regex `^PRD-(\d+)$` (`createProduct`).
2. `Product.barcode` es único en BD; al crear o asociar un barcode que ya tiene otro producto se rechaza con `Ese código ya está asociado a {nombre}`.
3. Un producto con `internalUse` marcado se guarda con `forSale = false` y precio 0; no aparece en `listSellableProducts`, no se puede agregar a órdenes ni recepciones, y su precio se muestra como "—".
4. Un producto solo puede darse de alta desde el flujo de escaneo con un código no reconocido; no existe pantalla de alta ni edición de producto (salvo asociar barcode).
5. En el alta, `quantity`, `cost`, `price` y `minStock` deben ser ≥ 0 (cero permitido); si `quantity > 0` se registra un `ENTRADA_MANUAL` con `reason "Alta inicial de inventario"` y `unitCost = cost`.
6. La categoría de producto se crea al vuelo si no existe, comparando el nombre sin distinguir mayúsculas.
7. `disponible = stockOnHand − Σ reservas con status ACTIVA`, calculado siempre en la aplicación.
8. Una reserva se crea únicamente dentro de la transacción que crea una orden de trabajo (desde cotización aprobada o desde recepción con ítems de precio fijo) o que agrega un repuesto a una orden abierta.
9. Antes de crear reservas se valida el disponible de **todas** las líneas; si una falla, se lanza `Stock insuficiente de "{nombre}" (disponible: N, solicitado: M)` y toda la transacción se revierte.
10. Crear una reserva registra un movimiento `RESERVA` con cantidad negativa y `balanceAfter` igual a la existencia física; la existencia física no cambia.
11. Las reservas activas de una orden se liberan (status `LIBERADA`, movimiento `LIBERACION_RESERVA` positivo, sin tocar existencia) cuando la orden pasa a un estado con `isTerminal`, cuando se anula (`deleteWorkOrder`) o cuando se cierra automáticamente por pago completo.
12. La existencia física solo baja por `confirmConsumption` (movimiento `CONSUMO`, reserva → `CONSUMIDA`) o por `registerManualExit` (movimiento `SALIDA_MANUAL`).
13. `confirmConsumption` exige que el estado actual de la orden tenga `allowsConsumption = true`; si no: `El estado actual ({label}) no permite confirmar consumo`.
14. `confirmConsumption` consume todas las reservas activas de la orden de una vez; si no hay ninguna: `No hay reservas activas para esta orden`. No hay consumo parcial.
15. `confirmConsumption` no revalida existencia: descuenta lo reservado aunque `stockOnHand` quede negativo.
16. Si una orden llega a estado terminal sin confirmar consumo, sus reservas se liberan y el stock físico no se descuenta nunca.
17. La salida manual exige `quantity > 0`, motivo no vacío (`Indica el motivo de la salida`) y `stockOnHand ≥ quantity`; compara contra existencia física, no contra disponible, y rechaza con `Existencia insuficiente (disponible: {stockOnHand})`.
18. La entrada manual exige `quantity > 0`, acepta `unitCost` opcional ≥ 0 (por defecto `Product.cost`) y motivo opcional (por defecto `"Entrada manual"`); no modifica `Product.cost`.
19. Los movimientos de inventario son append-only: ningún action edita ni borra `InventoryMovement`.
20. Los tipos `COMPRA`, `DEVOLUCION_ORDEN`, `DEVOLUCION_PROVEEDOR`, `AJUSTE`, `PERDIDA`, `CORRECCION`, `REVERSION` y el estado de reserva `VENCIDA` existen en el enum pero ningún código los genera.
21. No existe módulo de compras ni proveedores en la UI: `Supplier`, `PurchaseOrder`, `Purchase` no tienen actions ni páginas.
22. El kardex es PEPS informativo: valoriza salidas consumiendo lotes de entradas en orden cronológico; el remanente sin lote se valoriza a `Product.cost`; no altera ningún dato persistido.
23. Un producto está "bajo mínimo" cuando `available < minStock` (estricto); solo se resalta en rojo con el sufijo " (bajo mínimo)" en `/inventario`, sin notificación.
24. El escáner usa `@zxing/browser` con la cámara trasera, dispara `onDetected` una sola vez por montaje, y el código leído se compara por igualdad exacta contra `barcode` o `code` de los productos activos cargados en la página.
25. Un lector físico funciona tecleando el código en el input de "Movimientos de bodega" y enviando con Enter.
26. `/inventario/salida` es la única página del módulo que bloquea el render sin permiso (`inventory.adjust`); las demás dependen del sidebar.
27. Al agregar un repuesto a una orden, la UI muestra `stockOnHand` como "Disponible", pero el servidor valida contra el disponible neto de reservas.
28. Al agregar un repuesto a una orden, `quantity > 0`, `unitPrice ≥ 0` (editable, por defecto `Product.price`), la orden no puede estar en estado terminal (`No se pueden agregar repuestos a una orden cerrada`), y la línea nace `isAdditional: true, approved: true`.
29. `listProductsWithAvailability` (pantalla `/inventario`) incluye productos `INACTIVO`; `listActiveProducts` y `listSellableProducts` no.

### Servicios

30. El código de servicio se genera como `SRV-` + (`serviceCatalog.count()` + 1) con 4 dígitos.
31. Crear o editar un servicio exige nombre no vacío (`El nombre es obligatorio`) y `suggestedPrice > 0` (`El precio debe ser mayor a 0`).
32. `createService` exige `services.manage`; `updateService` exige `services.price` y solo modifica `name`, `suggestedPrice` y `quickService`; categoría y tipo no se pueden cambiar después.
33. Los tipos ofrecidos al crear son `MANO_OBRA`, `MANT_EXPRESS`, `MANT_PREVENTIVO`, `DIAGNOSTICO`, `OTRO`; el default es `MANO_OBRA`.
34. `quickService = true` significa precio fijo publicado: en recepción genera orden de trabajo inmediata con línea aprobada; `quickService = false` deja la recepción como cuenta abierta pendiente de cotizar, registrando solo el nombre en `requestedServices`.
35. La clasificación quick/diagnóstico en recepción se toma del catálogo en servidor, nunca del flag enviado por el cliente.
36. Un servicio se agrega a una orden abierta con un clic, `quantity = 1`, `unitPrice = suggestedPrice`, `taxRate` del catálogo, `isAdditional: true`, `approved: true`, sin nueva aprobación del cliente; la orden no puede estar en estado terminal (`No se pueden agregar servicios a una orden cerrada`).
37. En órdenes, recepciones y cotizaciones el precio del servicio o producto se copia en la línea; cambios posteriores al catálogo no afectan documentos existentes.
38. `listActiveServices` excluye `area = CARWASH` mediante `area: { not: "CARWASH" }`, lo que en Prisma excluye también los servicios con `area = null` (incluidos los creados desde `/servicios`, que no fijan `area`).
39. `setServiceStatus` existe (`services.manage`) pero ninguna pantalla lo invoca; no hay soft-delete de servicios.
40. El seed no sobrescribe `suggestedPrice` ni `quickService` de servicios existentes.
41. Los precios de catálogo (`Product.price`, `ServiceCatalog.suggestedPrice`) incluyen IVA 13%; la base se calcula hacia atrás `precio / 1.13` (`lib/money.ts`).

### Clientes

42. El código de cliente se genera como `CLI-` + (`customer.count()` + 1) con 5 dígitos.
43. La única validación de cliente es `fullName` no vacío (`El nombre es obligatorio`); teléfono, WhatsApp, DUI, NIT, correo y dirección son texto libre opcional sin formato ni unicidad.
44. `personType` acepta `NATURAL` (default) o `JURIDICA`; la alta rápida siempre crea `NATURAL` con solo nombre y teléfono.
45. `updateCustomer` sobrescribe todos los campos del formulario; un campo enviado vacío se guarda como `null`.
46. La búsqueda de `/clientes` compara `fullName` y `code` sin distinguir mayúsculas y `phone`, `whatsapp`, `dui`, `nit` con `contains` sensible a mayúsculas; sin rango de fechas devuelve máximo 25, con rango devuelve todos.
47. La búsqueda del picker (`searchCustomersAction`) exige `customers.view`, busca en `fullName`, `phone`, `whatsapp`, devuelve máximo 10 con los vehículos actuales de cada cliente.
48. No existe action de borrado ni desactivación de clientes; `deletedAt` solo se filtra en listados y búsquedas, no en `getCustomerWithVehicles`.
49. El detalle de cliente muestra datos de contacto y vehículos actuales; no muestra órdenes, cotizaciones, pagos ni saldo.

### Vehículos

50. La placa se guarda siempre en mayúsculas (`trim().toUpperCase()`).
51. La placa es opcional solo en la alta rápida del picker (`quickCreateVehicle`), que exige al menos placa, marca o modelo (`Indica al menos la marca/modelo o la placa del vehículo`); en `createVehicleForCustomer` y `updateVehicle` es obligatoria (`La placa es obligatoria`).
52. Placa y modelo son obligatorios para generar una orden de trabajo, tanto desde cotización aprobada (`Completa {placa y modelo} del vehículo antes de crear la orden de trabajo.`) como desde recepción con ítems de precio fijo (`... antes de generar la orden de trabajo.`).
53. La placa y el VIN no son únicos: se pueden registrar dos vehículos con la misma placa.
54. `vehicleLabel` muestra la placa; si falta, "marca modelo"; si tampoco, "Sin placa".
55. Todo vehículo se crea con un `VehicleOwner { customerId, isCurrent: true }`; no hay vehículos sin cliente.
56. El dueño actual es el `VehicleOwner` con `isCurrent = true`; el modelo soporta historial de dueños pero no existe action ni UI de cambio de dueño.
57. `year` y `currentMileage` se convierten con `Number()` sin validar rango; VIN no se valida ni se normaliza.
58. Editar el kilometraje desde `/vehiculos/[id]/editar` no registra `VehicleMileageHistory`; solo la recepción lo hace (`source: "recepcion"`).
59. El listado `/vehiculos` muestra los 100 más recientes sin paginación; la búsqueda es solo por placa (`contains`, insensitive, máx. 25).
60. El historial de visitas del vehículo recorre `Quote` (una cotización = una visita) con su orden asociada; las órdenes creadas directo desde recepción sin cotización no aparecen en él.
61. No existe action de borrado ni desactivación de vehículos.
62. "Iniciar recepción" desde el vehículo requiere `receptions.create` y que el vehículo tenga dueño actual; `/recepcion/nuevo?vehicleId=` devuelve 404 si el vehículo no existe o no tiene dueño.

### Picker y permisos

63. El picker exige elegir o crear cliente antes de elegir o crear vehículo; cambiar de cliente descarta el vehículo seleccionado.
64. Solo se pueden elegir vehículos cuyo dueño actual sea el cliente seleccionado; un vehículo nuevo se crea siempre bajo ese cliente.
65. La autorización es por clave de permiso `module.action` resuelta por usuario (roles + concesiones − revocaciones); ningún action compara nombres de rol.
66. Las páginas de estos módulos (salvo `/inventario/salida`) no bloquean la URL directa sin el permiso `*.view`; solo el menú lateral se filtra.
67. `products.view` y `products.manage` están definidos en el seed pero ningún código los verifica; el catálogo de productos se gobierna con `inventory.adjust`.
