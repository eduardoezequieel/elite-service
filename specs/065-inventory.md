# 065 — Inventario: productos que se venden e insumos que se despachan

**Estado:** Terminada (aprobada por chat, 26 sept 2026)
**Módulo:** inventory (nuevo) + sales (nuevo) + carwash + shared | **Depende de:** 003 (lavado), 017 (editar ticket
abierto), 039 (un servicio por categoría), 042/058 (avisos), 045 (anulación), 059 (cuenta de cobro),
060 (precio autorizado)

## Contexto

Hoy el catálogo son solo servicios y nada lleva existencia. El taller aplica productos al carro
(cera, aromatizante, restaurador) que hoy se cobran como si fueran un servicio o no se cobran, y
gasta insumos (franelas, desengrasante, guantes) que nadie registra. Esta spec introduce un solo
inventario con dos tipos de artículo: el **producto** se vende como una línea más del lavado y sale
del inventario al agregarlo; el **insumo** no se vende, se despacha a un empleado desde la oficina.
Ambos comparten kardex, categorías, entradas, ajustes y alertas de mínimo.

Prototipo: `docs/prototype/inventory.html`.

## Decisiones del usuario

- 2026-09-20: un solo módulo con dos tipos (`PRODUCT` / `SUPPLY`), no dos módulos.
- 2026-09-20: el producto sale del inventario **al agregarlo al ticket**, no al cobrar. No debería
  haber tickets abiertos varios días.
- 2026-09-20: **todo lo que se cancela vuelve**: quitar la línea, bajar la cantidad o anular el
  lavado repone el stock.
- 2026-09-20: sin existencia **no se agrega**: el API bloquea, nunca stock negativo.
- 2026-09-20: los insumos los despacha la **oficina a un empleado**; la pista no saca insumos sola.
- 2026-09-20: el producto **no paga comisión**; solo los servicios.
- ~~2026-09-20: no hay venta suelta~~ → **2026-09-26: sí hay venta suelta.** Un producto se vende
  sin lavado, en la misma caja y el mismo turno, con pago partido y vuelto de la 059 (RN-18 a RN-22).
  Se hace en esta misma spec («Todo junto ahora»).
- 2026-09-26: el producto sale del inventario **al agregarlo a la orden**, también en la venta
  suelta (RN-19).
- 2026-09-26: la comisión es **solo por servicios**; la venta suelta no paga comisión a nadie.
- 2026-09-26: al tocar un artículo se ve su historial completo: qué pasó, cuántos, quién, a quién,
  en qué lavado o venta, fecha y hora (kardex).
- 2026-09-26: el aviso de «se está acabando» cae en el cajón de avisos de la 058, con su propio
  filtro **«Inventario»**, y suena **una vez** al cruzar el mínimo (RN-13).

## Historias

- Como dueño con `inventory.manage`, quiero dar de alta productos e insumos con categoría, unidad,
  costo, precio y mínimo, para que el sistema se adapte a lo que compre el taller sin tocar código.
- Como oficina con `inventory.move`, quiero registrar una entrada con cantidad y costo, para que la
  existencia y el costo promedio reflejen la compra.
- Como oficina con `inventory.move`, quiero despachar insumos a un empleado, para que quede quién lo
  entregó, quién lo recibió y cuándo.
- Como recepción o pista, quiero agregar un producto al lavado con su cantidad, para cobrárselo al
  cliente y que salga del inventario sin un paso extra.
- Como quien tiene `inventory.adjust`, quiero corregir la existencia tras un conteo físico dejando
  el motivo, para que el kardex explique cada diferencia.
- Como quien tiene `inventory.read` y `notifications.read`, quiero un aviso cuando un artículo baja
  del mínimo, para comprar antes de quedarme sin.

## Criterios de aceptación

- **Dado** `inventory.manage`, **cuando** creo un artículo tipo `SUPPLY`, **entonces** el precio no
  se pide, se guarda `0` y el artículo **no** aparece en el selector de productos del lavado.
- **Dado** un producto con existencia 3, **cuando** agrego 2 al lavado, **entonces** el ticket tiene
  la línea con `quantity = 2`, el kardex un `SALE` de −2 con `workOrderId` y la existencia queda 1.
- **Dado** ese producto con existencia 1, **cuando** intento agregar 2, **entonces** el API responde
  `409 INSUFFICIENT_STOCK` con `details.available = 1`, el ticket no cambia y la UI muestra «Hay 1».
- **Dado** un lavado `OPEN` con 2 unidades de un producto, **cuando** edito y dejo 1, **entonces** el
  kardex agrega `SALE_RETURN` de +1 y la existencia sube 1; **y cuando** quito la línea, `+2`.
- **Dado** un lavado con productos, **cuando** se anula con `carwash.void` (045), **entonces** cada
  producto vuelve al inventario con un `SALE_RETURN` que apunta al lavado, en la misma transacción.
- **Dado** un lavado con productos ya cobrado, **cuando** se deshace el cobro (022), **entonces** el
  inventario **no** se toca: la línea sigue en el ticket.
- **Dado** un lavado con un servicio de $10 y un producto 2 × $3, **cuando** se cobra, **entonces** la
  cuenta es $16 y `commissionTotal` se calcula solo sobre los $10.
- **Dado** un insumo con existencia 10, **cuando** despacho 4 a un empleado, **entonces** el kardex
  tiene `DISPATCH` −4 con `employeeId`, `createdByUserId` y la existencia queda 6; **y cuando**
  despacho 7, **entonces** `409 INSUFFICIENT_STOCK`.
- **Dado** un artículo con `minStock = 5` y existencia 6, **cuando** un movimiento la deja en 5 o
  menos, **entonces** sale un evento `inventory.low_stock` por el stream de la 042 y entra al cajón
  de la 058 de quien tiene `inventory.read`; **y cuando** otro movimiento la baja a 3, **entonces**
  **no** sale otro aviso hasta que vuelva a subir por encima del mínimo.
- **Dado** un artículo desactivado, **cuando** intento agregarlo a un lavado o despacharlo,
  **entonces** `409 ITEM_INACTIVE`; el historial de los tickets que lo tenían no cambia.
- **Dado** un ajuste de −3 sobre existencia 2, **cuando** confirmo, **entonces** `409
  INSUFFICIENT_STOCK`; un ajuste sin motivo responde `422 VALIDATION_ERROR`.
- **Dado** un producto en un lavado `READY`, **cuando** quiero bajarle el precio, **entonces** aplica
  el mismo candado y autorización de la 060.
- **Dado** el kardex de un artículo, **cuando** lo abro, **entonces** cada fila muestra tipo, cantidad
  con signo, saldo después, quién, a quién (si es despacho), lavado (si es venta) y motivo.

## Reglas de negocio

- **RN-1: un artículo, un tipo.** `kind` es `PRODUCT` o `SUPPLY` y se fija al crear; no se cambia
  después (si un insumo pasa a venderse, se crea el producto y se desactiva el insumo). `PRODUCT`
  tiene precio > 0 y aparece en el selector del lavado; `SUPPLY` tiene precio `0` y solo se despacha.
- **RN-2: kardex append-only.** Todo cambio de existencia es un `InventoryMovement` con cantidad con
  signo y `balanceAfter`. Nunca se edita ni se borra un movimiento; se corrige con otro. La
  existencia del artículo (`stockOnHand`) es una copia del último `balanceAfter` y se actualiza en
  la misma transacción que el movimiento.
- **RN-3: nunca negativo.** Ningún movimiento deja `balanceAfter < 0`. Venta, despacho y ajuste
  negativo validan contra la existencia actual dentro de la transacción (bloqueo de fila) y fallan
  con `409 INSUFFICIENT_STOCK`.
- **RN-4: el producto sale al agregarlo.** La línea de producto en el ticket genera un `SALE` por su
  cantidad en la misma transacción que guarda el ticket. Como `PATCH items` reemplaza las líneas
  (017), el API calcula la **diferencia** por artículo entre lo que había y lo que queda: más
  cantidad es `SALE`, menos es `SALE_RETURN`. Cobrar y deshacer el cobro no tocan el inventario.
- **RN-5: lo que se cancela vuelve.** Anular el lavado (`VOID`, 045) genera un `SALE_RETURN` por cada
  línea de producto, con `workOrderId`, en la misma transacción. Reabrir un lavado no genera nada.
- **RN-6: snapshot de la línea.** Igual que un servicio (003 RN-4): la línea copia código, nombre,
  `catalogPrice` (precio del artículo al agregarlo) y `unitPrice`. Nuevo: `quantity` (decimal, >0)
  y `total = unitPrice × quantity`. Un producto tiene **un solo precio**, sin matriz por tipo de
  carro.
- **RN-7: el precio del producto sigue las reglas del servicio.** `0 <= unitPrice <= catalogPrice`
  mientras el lavado está `OPEN`/`WASHING`; desde `READY` solo con la autorización de la 060.
- **RN-8: sin comisión.** La base de comisión (009) suma solo las líneas `kind = SERVICE`.
- **RN-9: 039 no aplica a productos.** Un lavado puede llevar varios productos, cada uno una vez,
  con su cantidad. La regla de un servicio por categoría sigue valiendo para los servicios.
- **RN-10: el despacho es de oficina y tiene dos nombres.** Solo con sesión de usuario y
  `inventory.move`. Guarda `createdByUserId` (quien despachó) y `employeeId` (quien recibió, un
  empleado activo). Se pueden despachar insumos y también productos (uso interno de algo que además
  se vende); el tipo del artículo no cambia por eso.
- **RN-11: la entrada lleva costo.** `ENTRY` guarda `unitCost` opcional y una referencia libre
  (factura, proveedor). Si trae costo, `averageCost` del artículo se recalcula como promedio
  ponderado con la existencia previa. No hay módulo de compras ni de proveedores.
- **RN-12: el ajuste explica.** `ADJUSTMENT` lleva cantidad con signo y `reason` obligatorio.
  Requiere `inventory.adjust`, separado de `inventory.move`: corregir existencia es más delicado que
  registrar una entrada.
- **RN-13: mínimo y aviso una vez por cruce.** Si `minStock > 0` y un movimiento deja
  `balanceAfter <= minStock` viniendo de arriba, se emite `inventory.low_stock`. Mientras siga
  por debajo no se repite; se vuelve a armar cuando la existencia supera el mínimo.
- **RN-14: bajas lógicas.** Artículos y categorías se desactivan, no se borran (003 RN-13). Un
  artículo inactivo no se vende ni se despacha, pero su kardex y sus líneas históricas quedan.
- **RN-15: código y barcode.** `code` correlativo `INV-` + 4 dígitos, generado por el API. `barcode`
  opcional y único; si viene repetido, `409 BARCODE_TAKEN`.
- **RN-16: parametrizable.** Categorías propias del inventario (no las de servicios), unidad de
  medida como texto libre con sugerencias (`unidad`, `litro`, `galón`, `par`, `caja`), mínimo por
  artículo, costo y precio con dos decimales, cantidades con tres. Nada de esto va fijo en código.
- **RN-17: pista.** El empleado de pista **sí** agrega productos al lavado desde la tablet (es quien
  los aplica), con la misma regla de existencia. No ve costos ni saldos, solo «Hay N».

### Venta suelta

- **RN-18: la venta nace cobrada.** Una `CounterSale` (venta suelta, `V-0001`) junta 1..N productos
  con cantidad y se guarda **en el mismo acto que se cobra**, igual que la cuenta de la 059 (RN-2):
  no hay ventas abiertas ni a medio pagar. Mientras el cajero arma la venta en pantalla no se guarda
  nada; la pantalla muestra «Hay N» al día.
- **RN-19: sale al agregarla.** Al confirmar, cada línea genera un `SALE` con `counterSaleId` en la
  misma transacción que la venta, el cobro y los pagos. Si una línea no tiene existencia, falla toda
  la venta con `409 INSUFFICIENT_STOCK` y no se cobra nada.
- **RN-20: se cobra como un lavado.** Crea una `Charge` de la 059 con sus pagos (1..N métodos, suma
  exacta, `cashTendered` / `changeGiven`), en el turno abierto. Sin turno: `409 CASH_NOT_OPEN`. Los
  pagos entran al turno con su método como cualquier otro (059 RN-9). Un `Payment` cuelga de un
  lavado **o** de una venta, nunca de los dos ni de ninguno. Desde la 066 la misma cuenta puede
  llevar además lavados listos: la venta es una parte más del reparto de la 059 (RN-5).
- **RN-21: solo productos, sin comisión.** Solo artículos `PRODUCT` activos (`ITEM_NOT_SELLABLE`,
  `ITEM_INACTIVE`). Precio unitario entre 0 y el precio del artículo; si baja del precio, pide la
  autorización de la 060 en la misma pantalla (`carwash.discount`, motivo obligatorio). No genera
  comisión. Cliente opcional (nombre libre), sin carro.
- **RN-22: anular devuelve todo.** Anular una venta pide lo mismo que deshacer un cobro (045:
  `carwash.void`, motivo y credenciales) y solo si es del turno abierto. Sus pagos y su cobro salen
  del turno, la venta queda `VOID` con quién, cuándo y motivo (no se borra: el kardex la referencia)
  y cada línea vuelve al inventario con `SALE_RETURN` y `counterSaleId`, en una transacción. Desde
  la 066 anular la venta deshace su cuenta entera: los lavados cobrados con ella vuelven a `READY`.

## Permisos

| Clave              | Descripción                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `inventory.read`   | Ver artículos, existencias, kardex y recibir el aviso de mínimo            |
| `inventory.manage` | Crear, editar y desactivar artículos y categorías del inventario           |
| `inventory.move`   | Registrar entradas y despachar insumos a un empleado                       |
| `inventory.adjust` | Corregir la existencia tras un conteo físico, con motivo                   |

Agregar un producto a un lavado no pide permiso nuevo: es editar el lavado (`carwash.manage` en
oficina, sesión de pista en la bahía). La venta suelta tampoco: se vende con `carwash.charge`, se ve
el listado con `carwash.read` y se anula con `carwash.void`. El catálogo es el de `@elite/shared`; el seed lo sincroniza y
concede las cuatro al rol Administrator. Hay que volver a correr el seed.

## Datos

```prisma
enum InventoryItemKind { PRODUCT SUPPLY }
enum InventoryMovementType { ENTRY SALE SALE_RETURN DISPATCH ADJUSTMENT }
enum WorkOrderItemKind { SERVICE PRODUCT }

model InventoryCategory {
  id        String  @id @default(uuid()) @db.Uuid
  name      String  @unique
  sortOrder Int     @default(0)
  isActive  Boolean @default(true)
  items     InventoryItem[]
  @@map("inventory_categories")
}

model InventoryItem {
  id           String            @id @default(uuid()) @db.Uuid
  code         String            @unique          // INV-0001 (RN-15)
  barcode      String?           @unique
  name         String
  kind         InventoryItemKind
  categoryId   String?           @db.Uuid
  unit         String            @default("unidad")
  /// Precio de venta con IVA. 0 para SUPPLY (RN-1).
  price        Decimal           @db.Decimal(12, 2) @default(0)
  taxRate      Decimal           @db.Decimal(6, 4)  @default("0.1300")
  /// Costo promedio ponderado (RN-11).
  averageCost  Decimal           @db.Decimal(12, 2) @default(0)
  /// Copia del último balanceAfter (RN-2).
  stockOnHand  Decimal           @db.Decimal(12, 3) @default(0)
  minStock     Decimal           @db.Decimal(12, 3) @default(0)
  /// true mientras esté en o bajo el mínimo y ya se avisó (RN-13).
  lowStockNotified Boolean       @default(false)
  isActive     Boolean           @default(true)
  category     InventoryCategory? @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  movements    InventoryMovement[]
  orderItems   WorkOrderItem[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([kind, isActive])
  @@index([name])
  @@map("inventory_items")
}

/// Append-only (RN-2). Cantidad con signo: + entra, − sale.
model InventoryMovement {
  id              String                @id @default(uuid()) @db.Uuid
  itemId          String                @db.Uuid
  type            InventoryMovementType
  quantity        Decimal               @db.Decimal(12, 3)
  balanceAfter    Decimal               @db.Decimal(12, 3)
  unitCost        Decimal?              @db.Decimal(12, 2)  // ENTRY
  reference       String?                                  // ENTRY: factura/proveedor
  reason          String?                                  // ADJUSTMENT obligatorio
  workOrderId     String?               @db.Uuid           // SALE / SALE_RETURN
  employeeId      String?               @db.Uuid           // DISPATCH: quien recibió
  createdByUserId String?               @db.Uuid           // quién lo registró (null = pista)
  createdByEmployeeId String?           @db.Uuid           // pista (SALE desde la tablet)
  createdAt       DateTime              @default(now())
  item      InventoryItem @relation(fields: [itemId], references: [id], onDelete: Restrict)
  workOrder WorkOrder?    @relation(fields: [workOrderId], references: [id], onDelete: Restrict)
  employee  Employee?     @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  @@index([itemId, createdAt])
  @@index([type, createdAt])
  @@index([workOrderId])
  @@index([employeeId])
  @@map("inventory_movements")
}

model WorkOrderItem {
  // nuevo
  kind            WorkOrderItemKind @default(SERVICE)
  inventoryItemId String?           @db.Uuid
  quantity        Decimal           @db.Decimal(12, 3) @default(1)
  // `serviceCode` / `serviceName` pasan a ser el snapshot de código y nombre
  // de la línea, sea servicio o producto. No se renombran para no migrar el
  // historial; el tipo en `@elite/shared` los expone como `code` / `name`.
}
```

```prisma
enum CounterSaleStatus { PAID VOID }

/// Venta suelta (RN-18). Nace cobrada; se anula, no se borra.
model CounterSale {
  id              String            @id @default(uuid()) @db.Uuid
  number          String            @unique        // V-0001
  status          CounterSaleStatus @default(PAID)
  customerName    String?
  total           Decimal           @db.Decimal(12, 2)
  chargeId        String?           @unique @db.Uuid  // null tras anular (el cobro se borra, 059)
  createdByUserId String            @db.Uuid
  createdAt       DateTime          @default(now())
  voidedByUserId  String?           @db.Uuid
  voidedAt        DateTime?
  voidReason      String?
  items           CounterSaleItem[]
  payments        Payment[]
  movements       InventoryMovement[]
  @@index([createdAt])
  @@map("counter_sales")
}

model CounterSaleItem {
  id              String  @id @default(uuid()) @db.Uuid
  counterSaleId   String  @db.Uuid
  inventoryItemId String  @db.Uuid
  code            String   // snapshot
  name            String   // snapshot
  catalogPrice    Decimal @db.Decimal(12, 2)
  unitPrice       Decimal @db.Decimal(12, 2)
  quantity        Decimal @db.Decimal(12, 3)
  taxRate         Decimal @db.Decimal(6, 4)
  priceAuthorizedByUserId String? @db.Uuid
  priceReason     String?
  sortOrder       Int     @default(0)
  @@map("counter_sale_items")
}

model Payment {
  workOrderId   String? @db.Uuid   // pasa a opcional (RN-20)
  counterSaleId String? @db.Uuid   // nuevo; CHECK: exactamente uno de los dos
}

model InventoryMovement {
  counterSaleId String? @db.Uuid   // SALE / SALE_RETURN de una venta suelta
}
```

Migración: las líneas existentes quedan `kind = SERVICE`, `quantity = 1`. `payments.workOrderId`
pasa a nullable con un `CHECK (num_nonnulls(work_order_id, counter_sale_id) = 1)`. Nada se rellena
hacia atrás.

## API

Todo bajo `/api/inventory`, sesión de usuario.

| Método | Ruta                       | Permiso            | Request                                                                    | Response                       | Errores                                                                   |
| ------ | -------------------------- | ------------------ | -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| GET    | `/categories`              | `inventory.read`   | `?includeInactive`                                                         | `InventoryCategory[]`          | 403                                                                       |
| POST   | `/categories`              | `inventory.manage` | `{ name }`                                                                 | `201`                          | `400`, `409 CATEGORY_NAME_TAKEN`                                          |
| PATCH  | `/categories/:id`          | `inventory.manage` | `{ name?, sortOrder?, isActive? }`                                         | `200`                          | `404`, `409`                                                              |
| GET    | `/items`                   | `inventory.read`   | `?kind&search&categoryId&lowStock&includeInactive&page`                    | `Page<InventoryItem>`          | 403                                                                       |
| POST   | `/items`                   | `inventory.manage` | `{ kind, name, categoryId?, unit?, price?, minStock?, barcode? }`          | `201 InventoryItem`            | `400`, `400 SUPPLY_HAS_PRICE`, `409 BARCODE_TAKEN`                        |
| GET    | `/items/:id`               | `inventory.read`   |                                                                            | `InventoryItem`                | `404`                                                                     |
| PATCH  | `/items/:id`               | `inventory.manage` | `{ name?, categoryId?, unit?, price?, minStock?, barcode?, isActive? }`    | `200`                          | `404`, `409 BARCODE_TAKEN`; `kind` no se acepta (RN-1)                    |
| GET    | `/items/:id/movements`     | `inventory.read`   | `?page`                                                                    | `Page<InventoryMovement>`      | `404`                                                                     |
| POST   | `/items/:id/entries`       | `inventory.move`   | `{ quantity, unitCost?, reference? }`                                      | `201 { item, movement }`       | `400`, `404`, `409 ITEM_INACTIVE`                                         |
| POST   | `/items/:id/dispatches`    | `inventory.move`   | `{ quantity, employeeId, note? }`                                          | `201 { item, movement }`       | `400`, `404`, `409 INSUFFICIENT_STOCK`, `409 ITEM_INACTIVE`, `404 EMPLOYEE_NOT_FOUND` |
| POST   | `/items/:id/adjustments`   | `inventory.adjust` | `{ quantity (con signo, ≠0), reason }`                                     | `201 { item, movement }`       | `400`, `404`, `409 INSUFFICIENT_STOCK`                                    |
| GET    | `/movements`               | `inventory.read`   | `?type&itemId&employeeId&from&to&page`                                     | `Page<InventoryMovement>`      | 403                                                                       |
| GET    | `/employees`               | `inventory.move`   |                                                                            | `InventoryEmployeeOption[]`    | 403; empleados activos `{ id, fullName }`, sin pedir `employees.read`     |

Cambios en lo que ya existe:

- `POST /api/carwash/tickets`, `PATCH /api/carwash/tickets/:id`, `POST /api/floor/tickets`,
  `PATCH /api/floor/tickets/:id`: `items[]` acepta `{ serviceId }` **o** `{ inventoryItemId,
  quantity }`. Errores nuevos: `409 INSUFFICIENT_STOCK` (`details: { itemId, available }`),
  `409 ITEM_NOT_SELLABLE` (es `SUPPLY`), `409 ITEM_INACTIVE`.
- `GET /api/floor/inventory-items`: productos activos con `{ id, name, price, unit, stockOnHand }`,
  sin costos (RN-17).
- `GET /api/carwash/inventory-items` (`carwash.read`): lo mismo para oficina —selector de productos del
  lavado y de la venta suelta— sin pedir `inventory.read`.
- `POST .../void` (045): repone productos (RN-5).
- Ticket en respuesta: cada línea trae `kind`, `quantity`, `code`, `name`.
- Venta suelta, bajo `/api/sales`:

| Método | Ruta              | Permiso          | Request                                                                                                   | Response            | Errores                                                                                                                                             |
| ------ | ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/sales`          | `carwash.read`   | `?date&status&page`                                                                                       | `Page<CounterSale>` | 403                                                                                                                                                 |
| GET    | `/sales/:id`      | `carwash.read`   |                                                                                                           | `CounterSale`       | `404`                                                                                                                                               |
| POST   | `/sales`          | `carwash.charge` | `{ customerName?, items: [{ inventoryItemId, quantity, unitPrice? }], payments, cashTendered?, priceAuthorization? }` | `201 CounterSale`   | `422 VALIDATION_ERROR`, `409 INSUFFICIENT_STOCK`, `409 ITEM_NOT_SELLABLE`, `409 ITEM_INACTIVE`, `422 PAYMENT_AMOUNT_MISMATCH`, `422 CASH_TENDERED_SHORT`, `422 PRICE_ABOVE_CATALOG`, `422 PRICE_CHANGE_NOT_AUTHORIZED`, `403 AUTHORIZATION_FAILED`, `409 CASH_NOT_OPEN` |
| POST   | `/sales/:id/void` | `carwash.void`   | `{ reason, authorization }` (045)                                                                         | `200 CounterSale`   | `404`, `409 SALE_ALREADY_VOID`, `409 CASH_SESSION_GONE`, `403 AUTHORIZATION_FAILED`                                                                 |

  `priceAuthorization` = `{ reason, authorization }` y se exige si alguna línea trae `unitPrice`
  menor al precio del artículo (RN-21).
- Evento nuevo en `CARWASH_EVENT_TYPES`: `inventory.low_stock` con
  `{ itemId, name, stockOnHand, minStock }`. Entra a la bandeja solo con `inventory.read` (misma
  mecánica que `ticket.charged` con `carwash.cash`, 058 RN-2).

## UI

Prototipo obligatorio antes de implementar: `docs/prototype/inventory.html` (regla 12).

- **`/inventory`** (riel, con `inventory.read`): `DataTable` (007) con pestañas **Productos /
  Insumos**, buscador, filtro «Bajo mínimo», chip rojo en la fila que está en o bajo el mínimo.
  Columnas: código, nombre, categoría, existencia + unidad, mínimo, precio (solo productos).
  Cabecera: `Nuevo artículo` (`inventory.manage`), `Registrar entrada` y `Despachar`
  (`inventory.move`). Fila clickeable (032) al detalle.
- **`/inventory/:id`**: tarjeta del artículo (stat cards 026: existencia, mínimo, costo promedio,
  precio) y el **kardex** debajo: fecha, tipo con sello de color (ENTRY verde, SALE azul,
  SALE_RETURN azul claro, DISPATCH ámbar, ADJUSTMENT gris), cantidad con signo, saldo, quién, a
  quién, lavado (enlace) y motivo. Acciones: entrada, despacho, ajuste (`inventory.adjust`), editar.
- **Diálogos** (031): `Nuevo artículo` con selector de tipo arriba que oculta precio si es insumo;
  `Registrar entrada` (cantidad, costo, referencia); `Despachar` (artículo, cantidad, empleado con
  combobox 034, nota); `Ajustar` (cantidad con signo, motivo obligatorio, texto de advertencia).
- **`/inventory/movements`**: reporte plano de movimientos con filtros tipo / artículo / empleado /
  fechas (035, 033). Responde «quién despachó qué y a quién».
- **`/settings/inventory/categories`**: lista + `Nueva categoría`, igual que la 016.
- **Lavado (alta, edición, detalle, cobro):** debajo del selector de servicios (050) una sección
  **Productos** con buscador, cada producto con `− 1 +`, «Hay N» y precio. Las líneas de producto
  se muestran `2 × $3.00 = $6.00`. El candado de la 060 aplica al precio unitario. En la pista, el
  mismo bloque sin costo.
- **Venta suelta** — `/sales` (riel «Ventas», con `carwash.read`): lista del día con número, hora,
  cliente, productos, total, método y estado; fila clickeable al detalle `/sales/:id` con líneas,
  pagos, quién vendió y botón `Anular venta` (`carwash.void`). Cabecera: `Nueva venta`
  (`carwash.charge`) → `/sales/new`: buscador de productos (nombre, código o barcode), cada uno con
  `− 1 +` y «Hay N», líneas `2 × $3.00 = $6.00`, candado de precio (060), cliente opcional, y abajo
  el mismo bloque de pago de la 059 (método, partir el pago, con cuánto paga y cambio). Sin turno
  abierto, la pantalla lo dice y no deja cobrar. Al cobrar vuelve a `/sales/:id`.
- **Aviso** en el cajón de la 058: «Cera en pasta se está acabando · quedan 4 (mínimo 5)», toca →
  `/inventory/:id`. Filtro nuevo **«Inventario»** en el carril de tipos (kind `stock`), visible solo
  con `inventory.read`.
- **Densidades:** `bahia` sube los `− +`, las filas y los botones a `--touch-min`; el kardex colapsa
  columnas «a quién» y «motivo» bajo 900px a una segunda línea de la fila.

## Fuera de alcance

- Recibo impreso o factura de la venta suelta; carrito guardado; ventas a crédito.
- Compras, proveedores, órdenes de compra, devolución a proveedor.
- Reservas (apartar stock sin sacarlo), lotes, vencimientos, varias bodegas.
- Descuento automático de insumos por lavado (receta por servicio).
- Escaneo de código de barras con cámara; el campo `barcode` es texto.
- Valoración contable del inventario y costo de venta en el cierre de caja.
- Comisión sobre productos.

## Verificación

`scripts/verify-065.sh` contra el stack levantado: crea categoría, un producto y un insumo; entrada
de 3 al producto y 10 al insumo; abre un lavado con 2 del producto y verifica existencia 1 y
`SALE` −2; intenta agregar 2 más y espera `409 INSUFFICIENT_STOCK`; edita el lavado a 1 y espera
existencia 2; anula el lavado y espera existencia 3 con `SALE_RETURN`; lista los empleados para
despachar (`GET /inventory/employees`); despacha 4 del insumo a un empleado y verifica `employeeId`
y `createdByUserId` en el movimiento; despacha 7 y espera `409`; ajusta −1 sin motivo y espera
`422 VALIDATION_ERROR`; intenta agregar el insumo a un lavado y espera `409 ITEM_NOT_SELLABLE`; cobra un lavado con servicio $10 + producto 2 × $3 y verifica cuenta $16 y
comisión sobre $10; baja un artículo al mínimo y verifica un solo `inventory.low_stock` en dos
movimientos consecutivos; hace una venta suelta de 2 productos con pago partido y verifica
existencias, `SALE` con `counterSaleId` y pagos en el turno; intenta vender más de lo que hay y
espera `409`; anula la venta y verifica `SALE_RETURN` y que los pagos salieron del turno.

## Tareas

- [x] `docs/prototype/inventory.html`: lista, detalle con kardex, diálogos y bloque de productos en
      el lavado; tema y densidad conmutables.
- [x] `packages/shared`: permisos `inventory.*`, tipos y schemas de artículo, categoría, movimiento,
      `items[]` del ticket con las dos variantes, códigos de error nuevos, evento
      `inventory.low_stock`.
- [x] `apps/api`: migración (tres tablas, tres enums, tres columnas en `work_order_items`).
- [x] `apps/api` domain `inventory`: kardex (RN-2, RN-3), promedio ponderado (RN-11), cruce de
      mínimo (RN-13), con tests.
- [x] `apps/api` application `inventory`: casos de uso de categoría, artículo, entrada, despacho,
      ajuste y listado de movimientos, con tests en memoria.
- [x] `apps/api` application `carwash`: diferencia de líneas de producto en alta/edición (RN-4),
      devolución en `VOID` (RN-5), comisión solo servicios (RN-8), con tests.
- [x] `apps/api` presentation: controlador `/api/inventory`, `GET /api/floor/inventory-items`,
      `items[]` en tickets de oficina y pista.
- [x] `apps/api`: seed con las cuatro claves en Administrator.
- [x] `apps/web` `features/inventory`: lista, detalle + kardex, movimientos, categorías, diálogos.
- [x] `apps/web` carwash: bloque Productos en alta, edición, detalle y cobro (oficina y pista);
      líneas con cantidad.
- [x] `apps/web` notifications: `inventory.low_stock` en bandeja, filtro y navegación.
- [x] `apps/web`: entrada `Inventario` en riel y barra inferior, por permiso.
- [x] `apps/api` módulo `sales`: venta suelta (RN-18 a RN-22), `/api/sales`, con tests.
- [x] `apps/web` `features/sales`: lista, nueva venta y detalle con anulación; entrada «Ventas».
- [x] `scripts/verify-065.sh` y sección **Verificación** enlazada.
- [x] `AGENTS.md` de api y web si aparece una convención nueva; `.env.example` no cambia.
- [x] `pnpm build`, `pnpm lint`, `pnpm test`.

Implementado el 2026-09-26. Falta aplicar la migración y correr `scripts/verify-065.sh` contra el stack.
