<!-- Extracto del legado. Fuente: zips elite-service-taller.zip y elite-service-erp.zip (sep 2026). Índice: ../LEGACY_BUSINESS_LOGIC.md. No es una spec: no autoriza implementar. -->

# 02 — Flujo central del taller (legado)

Extraído del proyecto legado Next.js + Prisma en
`scratchpad/taller/elite-service-taller`. Todas las rutas de archivo de este documento son
relativas a esa raíz. Solo se documenta lo que está en el código; donde el código no hace algo,
se dice explícitamente.

Alcance: recepción → cotización/diagnóstico → aprobación → orden de trabajo → inspección →
consumo → estados → cobro/cierre. Módulos leídos completos: `modules/receptions`,
`modules/quotes`, `modules/approvals`, `modules/inspections`, `modules/work-orders`,
`lib/quote-status.ts`, `lib/vehicle-label.ts`, `lib/dates.ts`, `lib/money.ts`, pantallas
`app/(dashboard)/recepcion/**`, `app/(dashboard)/cotizaciones/**`, `app/(dashboard)/ordenes/**`,
`components/quotes/*`, `components/work-orders/*`, `components/case-tabs.tsx`,
`components/customers/customer-vehicle-picker.tsx`, `components/ui/photo-picker.tsx`. Se consultó
además, porque las pantallas del flujo los invocan directamente: `modules/payments/actions.ts`,
`modules/payments/queries.ts`, `modules/inventory/service.ts`, `confirmConsumption` de
`modules/inventory/actions.ts`, `quickCreateCustomer` / `quickCreateVehicle`, el encabezado de
`modules/printing/actions.ts`, `lib/auth.ts`, y `prisma/schema.prisma` + `prisma/seed.ts` para
enums, estados y permisos.

---

## 0. Vocabulario y tipos base (schema)

### Enums usados por el flujo (`prisma/schema.prisma`)

| Enum | Valores |
| --- | --- |
| `QuoteStatus` | `BORRADOR`, `PREPARADA`, `ENVIADA`, `VISTA`, `PARCIALMENTE_APROBADA`, `APROBADA`, `RECHAZADA`, `VENCIDA`, `CANCELADA`, `CONVERTIDA` |
| `QuoteItemType` | `SERVICIO`, `MANO_OBRA`, `PRODUCTO`, `REPUESTO`, `PAQUETE`, `SERVICIO_EXTERNO` |
| `LineDecision` | `PENDIENTE` (default), `APROBADO`, `RECHAZADO` |
| `ServiceType` (catálogo) | `MANO_OBRA`, `DIAGNOSTICO`, `MANT_EXPRESS`, `MANT_PREVENTIVO`, `CARWASH`, `SERVICIO_EXTERNO`, `PAQUETE`, `OTRO` |
| `MediaOwnerType` | `RECEPTION`, `INSPECTION`, `WORK_ORDER`, `PRODUCT`, `WARRANTY_CLAIM`, `QUOTE`, `QUALITY_RESULT` |
| `MediaCategory` | `RECEPCION`, `DANOS`, `DIAGNOSTICO`, `DURANTE_TRABAJO`, `PRODUCTOS`, `REPUESTOS_SUSTITUIDOS`, `CONTROL_CALIDAD`, `ENTREGA` |
| `MediaVisibility` | `INTERNO`, `CLIENTE` |
| `ReservationStatus` | `ACTIVA`, `CONSUMIDA`, `LIBERADA`, `VENCIDA` |
| `PaymentStatus` | `REGISTRADO`, `ANULADO` |
| `ReminderType` (los que usa el flujo) | `TRABAJO_RECHAZADO`, `CUENTA_COBRAR` |

El estado de la orden de trabajo **no es un enum**: es la tabla `WorkOrderStatus`
(`key`, `label`, `order`, `color`, `isInitial`, `isTerminal`, `requiresQc`, `allowsConsumption`,
`countsAsDelivered`). Las filas las crea `prisma/seed.ts` (líneas 403–417):

| `key` | `label` | `order` | flags |
| --- | --- | --- | --- |
| `recibido` | Recibido | 10 | `isInitial` |
| `diagnostico` | En diagnóstico | 20 | — |
| `por_aprobar` | Esperando aprobación | 30 | — |
| `aprobado` | Aprobado | 40 | `allowsConsumption` |
| `recepcion_reparacion` | Recepción para reparación | 42 | `allowsConsumption` |
| `lista_asignacion` | Lista para asignación | 46 | `allowsConsumption` |
| `en_proceso` | En proceso | 50 | `allowsConsumption` |
| `control_calidad` | Control de calidad | 60 | `allowsConsumption`, `requiresQc` |
| `listo` | Listo para entrega | 70 | — |
| `entregado` | Entregado | 80 | `countsAsDelivered` |
| `cerrado` | Cerrado | 90 | `countsAsDelivered`, `isTerminal` |
| `cancelado` | Cancelado | 100 | `isTerminal` |

### Mapeo `ServiceType` → `QuoteItemType`

Dos implementaciones, deliberadamente duplicadas (cliente vs servidor):

- `quoteItemTypeForService(type)` en `modules/receptions/actions.ts:37` y en
  `modules/work-orders/actions.ts:71`: `MANO_OBRA`→`MANO_OBRA`, `SERVICIO_EXTERNO`→`SERVICIO_EXTERNO`,
  `PAQUETE`→`PAQUETE`, cualquier otro → `SERVICIO`.
- `SERVICE_TYPE_TO_QUOTE_ITEM_TYPE` en `components/quotes/quote-items-fields.tsx:18`: idéntico
  resultado (`DIAGNOSTICO`, `MANT_EXPRESS`, `MANT_PREVENTIVO`, `CARWASH`, `OTRO` → `SERVICIO`).

### Campo clave: `ServiceCatalog.quickService`

`prisma/schema.prisma:908`. Servicio de precio fijo y publicado (cambio de aceite, frenos, GDI).
`true` → se vende directo como orden de trabajo sin pasar por cotización. `false` → es un
diagnóstico de costo variable: abre una recepción "pendiente de cotizar".

---

## 1. Ciclo de vida por entidad

### 1.1 Reception

Modelo `Reception` (`prisma/schema.prisma:767`). Campos: `number` (único), `customerId`,
`vehicleId`, `appointmentId?`, `visitReason?`, `symptoms?`, `requestedServices?`, `mileage?`
(Int), `fuelLevel?`, `warningLights?`, `accessories?`, `valuables?`, `exteriorState?`,
`interiorState?`, `existingDamage?`, `notes?`, `promisedAt?`, `customerAccepted` (default
false), `advisorId?` (FK lógica a User, sin relación Prisma), `branchId?`, relaciones
`inspections[]`, `quotes[]`, `workOrders[]`, `payments[]`, `deletedAt?`.

**No tiene columna de estado.** Su "estado" es derivado:

| Estado derivado | Definición en código | Dónde se usa |
| --- | --- | --- |
| **Pendiente de cotizar** ("cuenta abierta" sin orden ni cotización) | `deletedAt: null AND quotes: none AND workOrders: none` | `getOpenReceptionCaseForVehicle`, `listOpenPendingReceptions` (`modules/receptions/queries.ts:17,24`) |
| Con cotización | `quotes.length > 0` | `app/(dashboard)/recepcion/[id]/page.tsx` (pestañas del caso) |
| Con orden directa | `workOrders.length > 0` | idem |
| Diagnóstico cobrado | suma de `payments` con `status: REGISTRADO` > 0 (`diagnosticPaid`) | `listOpenPendingReceptions`, `components/work-orders/open-accounts.tsx` |

Transiciones:

1. **Creación** — solo `registerVehicleIntake` (`modules/receptions/actions.ts:68`). Ver §2.1.
   Efectos: número `REC-`, `requestedServices` = nombres de los servicios de diagnóstico
   separados por ", " (o `null`), `advisorId` = usuario actual, actualización de kilometraje del
   vehículo, fotos `MediaFile`, opcionalmente una `WorkOrder` directa (servicios rápidos) y una
   `Inspection`.
2. **Pasa a "con cotización"** — cuando `createQuote` recibe `receptionId` (hidden input) y crea
   una `Quote` con ese `receptionId`. Deja de aparecer en "Cuentas abiertas" como recepción.
3. **Pasa a "con orden"** — al crear la `WorkOrder` directa en el mismo `registerVehicleIntake`,
   o indirectamente cuando la cotización ligada se convierte (`createWorkOrderFromApprovedQuote`
   copia `receptionId: quote.receptionId` a la orden).
4. **Cobro de diagnóstico sin cotización** — `chargeReceptionDiagnosticFee` crea un `Payment`
   con `receptionId`; la recepción **sigue** pendiente de cotizar (no cambia nada en ella).
5. **No hay** acción de edición, cierre, cancelación ni soft-delete de recepciones en el código
   leído. `deletedAt` existe en el modelo pero ninguna action lo escribe.

Los campos `visitReason`, `symptoms`, `fuelLevel`, `warningLights`, `accessories`, `valuables`,
`exteriorState`, `interiorState`, `existingDamage`, `promisedAt`, `customerAccepted`,
`appointmentId` **se muestran** en `recepcion/[id]/page.tsx` (`DataField`) pero **ningún
formulario ni action los escribe** (grep en `modules/` y `app/`: sin coincidencias fuera de la
pantalla de detalle). Quedan siempre `null`/`false`.

### 1.2 Quote

Modelo `Quote` (`prisma/schema.prisma:1173`): `number` único, `customerId`, `vehicleId`,
`receptionId?`, `status QuoteStatus @default(BORRADOR)`, `validUntil?`, `promisedAt?`,
`diagnosis?` (visible en impresión), `conditions?`, `notes?` (interno), `advisorId?`,
`versions[]` (`QuoteVersion`), `approvals[]` (`CustomerApproval`), `workOrder?` (1:1 vía
`WorkOrder.quoteId @unique`), `deletedAt?`.

`QuoteVersion` (`:1205`): `versionNumber`, `subtotal`, `discountTotal`, `taxTotal`, `total`,
`isCurrent`, `items[]`. `@@unique([quoteId, versionNumber])`.

`QuoteItem` (`:1224`): `type QuoteItemType`, `serviceId?`, `productId?`, `description`,
`supplierNote?` (proveedor, solo aplica a REPUESTO), `quantity Decimal(12,3)`, `unitPrice`
(con IVA), `unitCost` (interno, nunca se escribe en este flujo), `discount`, `taxRate`
(default 0.13), `lineTotal`, `decision LineDecision @default(PENDIENTE)`.

Conjuntos de estados definidos en código:

| Constante | Valores | Archivo |
| --- | --- | --- |
| `OPEN_QUOTE_STATUSES` (bloquea abrir otra cuenta para el vehículo) | `BORRADOR, PREPARADA, ENVIADA, VISTA, PARCIALMENTE_APROBADA, APROBADA` | `modules/quotes/queries.ts:44` |
| `EDITABLE_QUOTE_STATUSES` (se pueden editar líneas) | los mismos 6 | `modules/quotes/constants.ts:4` |
| `APPROVABLE_QUOTE_STATUSES` (se puede registrar aprobación) | `ENVIADA, VISTA, PARCIALMENTE_APROBADA` | `modules/quotes/constants.ts:10` |
| `SENDABLE_STATUSES` (botón "Marcar como enviada") | `BORRADOR, PREPARADA` | `components/quotes/quote-case-tabs.tsx:28` |
| `CONVERTIBLE_STATUSES` (botón manual "Crear orden de trabajo") | `APROBADA, PARCIALMENTE_APROBADA` | `components/quotes/quote-case-tabs.tsx:27` |
| `QUOTE_STATUS_LABEL` | etiquetas ES para los 10 estados | `lib/quote-status.ts` |

Máquina de estados real (solo lo que el código escribe):

```
(creación) ──createQuote──► PREPARADA
PREPARADA ──sendQuote──► ENVIADA
BORRADOR  ──sendQuote──► ENVIADA          (BORRADOR nunca se escribe; solo default del schema)
ENVIADA | VISTA | PARCIALMENTE_APROBADA ──submitApproval──► APROBADA | PARCIALMENTE_APROBADA | RECHAZADA
APROBADA | PARCIALMENTE_APROBADA ──(mismo submitApproval, si crea la orden)──► CONVERTIDA
APROBADA | PARCIALMENTE_APROBADA ──createWorkOrderFromQuote (manual)──► CONVERTIDA
ENVIADA | VISTA | PARCIALMENTE_APROBADA | APROBADA ──updateQuoteItems──► PREPARADA  (needsResend)
```

- **Nadie escribe** `VISTA`, `VENCIDA` ni `CANCELADA` (grep `status: "VISTA"|"VENCIDA"|"CANCELADA"`
  en `modules`, `app`, `lib`, `components`: sin coincidencias). Aparecen en constantes y
  etiquetas, nada más.
- **`validUntil` no se aplica**: se guarda (hoy + 10 días) y se muestra, pero ninguna query ni
  action compara contra la fecha. Una cotización vencida sigue en `OPEN_QUOTE_STATUSES` y sigue
  bloqueando una cuenta nueva para el vehículo.
- `sendQuote` **no valida estado** en el servidor: pone `ENVIADA` sobre cualquier estado (la
  restricción a `BORRADOR/PREPARADA` es solo del botón en UI).
- `updateQuoteItems` en estado `APROBADA` (sin orden creada, p. ej. bloqueada por falta de
  placa) regresa a `PREPARADA` y **borra y recrea** los `QuoteItem` → las decisiones vuelven a
  `PENDIENTE` (default) y los ids de línea guardados en `CustomerApproval.approvedItems /
  rejectedItems` dejan de apuntar a filas existentes.
- Versiones: siempre existe una sola versión (`versionNumber: 1`, `isCurrent: true`);
  `updateQuoteItems` la sobreescribe. No hay código que cree versión 2.
- Soft delete: `deletedAt` se filtra en `listRecentQuotes` y `getOpenQuoteForVehicle`, pero
  ninguna action lo escribe.

### 1.3 Approval (`CustomerApproval` + `ApprovalCode`)

Modelo `CustomerApproval` (`prisma/schema.prisma:1247`): `quoteId`, `quoteVersionId`,
`approvedItems Json?` (ids), `rejectedItems Json?` (ids), `signerName?`, `signatureUrl?`,
`ipAddress?`, `userAgent?`, `termsAccepted` (default false), `comments?`, `approvedAt`
(default now), `codes ApprovalCode[]`.

- Una sola action la crea: `submitApproval` (`modules/approvals/actions.ts:14`). Solo llena
  `quoteId`, `quoteVersionId`, `approvedItems`, `rejectedItems`. **No** se captura firma,
  nombre, IP, términos ni comentarios ("sin código PIN ni firma ceremoniosa", comentario en
  línea 12).
- `ApprovalCode` existe en el modelo y hay una query `getActiveApprovalCode(quoteId)`
  (`modules/quotes/queries.ts:53`: `usedAt: null, invalidated: false, expiresAt > now`), pero
  **nadie la invoca ni genera códigos** en el código leído. Es infraestructura muerta.
- No hay edición ni anulación de aprobaciones. El historial se lista en la pestaña Cotización
  (`quote-case-tabs.tsx:202`) mostrando fecha y conteo "N aprobada(s), M rechazada(s)".
- Cada `submitApproval` agrega un registro nuevo (una cotización `PARCIALMENTE_APROBADA` puede
  recibir una segunda aprobación porque sigue en `APPROVABLE_QUOTE_STATUSES`).

### 1.4 WorkOrder

Modelo `WorkOrder` (`prisma/schema.prisma:1312`). Campos relevantes: `number` único,
`customerId`, `vehicleId`, `receptionId?`, `quoteId? @unique`, `statusId`, `promisedAt?`,
`deliveredAt?`, montos `saleGross`, `discountTotal`, `taxTotal`, `saleNet` (los demás
`productCost`, `laborCost`, `warrantyCost`, `grossProfit`, `marginPct`, `estimatedMinutes`,
`actualMinutes` **no se escriben en este flujo**), `advisorId?` (FK lógica), bloque de costo
externo `externalCost`, `externalInvoiceNumber?`, `externalSupplierId?`, `costsConfirmedById?`,
`costsConfirmedAt?`, relaciones `items[]`, `assignments[]`, `statusHistory[]`, `reservations[]`,
`payments[]`, `inspections[]`, `deletedAt?`.

`WorkOrderItem` (`:1386`): igual que `QuoteItem` más `isAdditional` (default false),
`approved` (default false), `completedAt?`, `completedById?`.

**Formas de nacer:**

| Origen | Action | Estado inicial | Nota en `statusHistory` |
| --- | --- | --- | --- |
| Recepción con servicios `quickService` o productos | `registerVehicleIntake` | el `WorkOrderStatus` con `isInitial: true` (seed: `recibido`) | "Orden creada — recepción" |
| Aprobación con ≥1 línea aprobada | `submitApproval` → `createWorkOrderFromApprovedQuote` | `key: "recepcion_reparacion"` (lookup por key) | "Orden creada desde cotización aprobada" |
| Reintento manual desde la cotización | `createWorkOrderFromQuote` → `createWorkOrderFromApprovedQuote` | `key: "recepcion_reparacion"` | idem |

Al nacer siempre: todas las líneas con `approved: true`; reserva de inventario para líneas con
`productId` (`reserveInventoryForWorkOrder`), en la misma transacción.

**Transiciones de estado** (todas escriben `WorkOrderStatusHistory`):

| De → A | Disparador | Validación | Nota en historial |
| --- | --- | --- | --- |
| `recepcion_reparacion` → `lista_asignacion` | `saveWorkOrderInspection` (automático al guardar inspección) | ninguna adicional | "Inspección completada" |
| `lista_asignacion` → `en_proceso` | `assignTechnician` (automático) | ninguna adicional | "Técnico asignado" |
| cualquier no terminal → `cerrado` | `maybeAutoCloseWorkOrder` (desde `collectPayment` y `confirmWorkOrderCosts`) | `saleNet - pagosREGISTRADO <= 0` | "Cerrada automáticamente al completar el pago" |
| cualquiera → cualquiera (elegido en select) | `changeWorkOrderStatus` (manual) | ver §2.13: gate de inspección, saldo, costo confirmado | nota libre del formulario |

Reglas de `changeWorkOrderStatus`:
- Si el estado actual es `recibido` o `recepcion_reparacion` y el destino es distinto, debe
  existir al menos una `Inspection` con ese `workOrderId` (`REQUIRES_INSPECTION_BEFORE_LEAVING`,
  `modules/work-orders/actions.ts:385`).
- Si el destino tiene `countsAsDelivered` (`entregado`, `cerrado`): saldo debe ser 0 y
  `costsConfirmedAt` debe estar lleno.
- Si el destino es `isTerminal` (`cerrado`, `cancelado`): se liberan las reservas `ACTIVA`.
- Si el destino tiene `countsAsDelivered`: `deliveredAt = now()`.
- **No se valida** orden ascendente, ni `requiresQc`, ni que el estado actual no sea terminal
  (se puede sacar una orden de `cerrado`/`cancelado` por el select si el estado actual aparece
  en la lista; la UI incluye siempre el estado actual en el select).
- La UI (`work-order-detail-body.tsx:90`) solo ofrece en el select `control_calidad`, `listo`,
  `entregado`, `cerrado`, `cancelado` más el estado actual. `diagnostico`, `por_aprobar` y
  `aprobado` existen en la tabla pero **ningún código transiciona hacia ellos**.

`maybeAutoCloseWorkOrder` (`modules/work-orders/service.ts:114`) **no aplica** los gates de
`changeWorkOrderStatus`: cierra sin inspección y sin `costsConfirmedAt` en cuanto el saldo llega
a 0. Al cerrar, `releaseReservationsForWorkOrder` libera (no consume) las reservas `ACTIVA` que
quedaran: si nadie confirmó el consumo antes, el stock físico nunca se descuenta.

**Anulación:** `deleteWorkOrder` (soft delete: `deletedAt = now()`, `AuditLog SOFT_DELETE`,
libera reservas). No toca la `Quote` (sigue `CONVERTIDA` y `quote.workOrder` sigue apuntando a
la orden anulada porque `getQuoteDetail` no filtra `deletedAt`), no anula pagos. Como
`getOpenReceptionCaseForVehicle` usa `workOrders: { none: {} }` sin filtrar `deletedAt`, la
recepción de origen tampoco vuelve a "pendiente de cotizar".

**Terminado por línea:** `toggleWorkOrderItemDone` alterna `completedAt/completedById`; no hay
regla que exija todas las líneas hechas para cambiar de estado.

### 1.5 Inspection

Modelo `Inspection` (`prisma/schema.prisma:834`): `receptionId?`, `workOrderId?`,
`templateId?`, `results Json?`, `notes?`, `createdById?`, `createdAt`. Sin estado.
`InspectionTemplate` (`:808`): `name`, `area?`, `status RecordStatus`, `items[]`.
`InspectionItem` (`:822`): `label`, `order`, `required`.

Forma de `results` (`InspectionResult` en `modules/inspections/actions.ts:9`):
`Record<inspectionItemId, { label: string; status: "ok" | "problema" | null; note: string | null }>`.

Se crea en dos lugares:

| Action | `receptionId` | `workOrderId` | `notes` | Fotos | Efecto sobre estado |
| --- | --- | --- | --- | --- | --- |
| `registerVehicleIntake` (si el form trae `inspectionTemplateId`) | la recepción | la orden directa si se creó, si no `null` | no se captura | las mismas fotos de la recepción, duplicadas como `MediaFile ownerType INSPECTION` | ninguno (la orden nace en `recibido`; la inspección ya satisface el gate) |
| `saveWorkOrderInspection` | `null` | la orden | campo `notes` | fotos propias del formulario | si la orden está en `recepcion_reparacion` → `lista_asignacion` |

- La plantilla usada es siempre la primera con `status: ACTIVO` (`getActiveInspectionTemplate`,
  `modules/inspections/queries.ts:3`), items ordenados por `order`.
- **`required` no se valida** en el servidor: si el radio no viene, `status` queda `null`. La UI
  solo pinta un asterisco rojo.
- No hay edición ni borrado. La lectura toma la más reciente por `createdAt desc`
  (`getWorkOrderInspectionWithPhotos`, `getReceptionDetail` con `take: 1`).
- El gate de estado solo pregunta si existe **alguna** inspección con ese `workOrderId`
  (`prisma.inspection.findFirst({ where: { workOrderId } })`).

---

## 2. Server actions, una por una

Convención común: retornan `FormState = { error?: string } | undefined`; los éxitos retornan
`{}` o `undefined` según la action (se indica). Permisos vía `hasPermission(key)`
(`lib/auth.ts:46`): unión de permisos de todos los roles del usuario + permisos directos
`granted: true` − permisos directos `granted: false`; usuario debe estar `ACTIVO` y sin
`deletedAt`.

### 2.1 `registerVehicleIntake(_prev, formData)` — `modules/receptions/actions.ts:68`

Entrada (FormData): `customerId`, `vehicleId`, `itemsJson` (JSON de `IntakeRawItem[]`:
`{ serviceId, productId, description, quantity, unitPrice }`), `photos` (File[]), `mileage`,
`notes`, `inspectionTemplateId`, `item_{inspectionItemId}` (`"ok" | "problema"`),
`note_{inspectionItemId}`.

Validaciones y mensajes, en orden:

1. `receptions.create` → `"No tienes permiso para registrar la entrada del vehículo"`.
2. `customerId` y `vehicleId` no vacíos → `"Elige o crea el cliente y el vehículo antes de guardar"`.
3. `getOpenQuoteForVehicle(vehicleId)` (status en `OPEN_QUOTE_STATUSES`, `deletedAt: null`) →
   `` `Este vehículo ya tiene una cuenta abierta (cotización ${openQuote.number}). Dale seguimiento a esa en vez de abrir otra.` ``
4. `getOpenReceptionCaseForVehicle(vehicleId)` →
   `` `Este vehículo ya tiene una cuenta abierta (recepción ${openReception.number}, pendiente de cotizar). Dale seguimiento a esa en vez de abrir otra.` ``
5. `JSON.parse(itemsJson)` falla → `"Los servicios elegidos no son válidos"`.
6. Cero ítems → `"Elige al menos un servicio al que viene el vehículo"`.
7. Cada `serviceId` debe existir en `ServiceCatalog` → `"Uno de los servicios elegidos ya no existe en el catálogo"`.
   Clasificación **según catálogo, no según lo que mandó el cliente**: sin `serviceId` (producto)
   → `quickItems`; `service.quickService` → `quickItems`; si no → `diagnosticItems`.
8. `vehicle` debe existir → `"Vehículo no encontrado"`.
9. Solo si hay `quickItems`: `plate` y `model` del vehículo obligatorios →
   `` `Completa ${missing.join(" y ")} del vehículo antes de generar la orden de trabajo.` `` con
   `missing` ⊂ {`"placa"`, `"modelo"`}.
10. Fotos: `> 8` → `` `Máximo ${MAX_PHOTOS} fotos por recepción` `` (`"Máximo 8 fotos por recepción"`);
    alguna `> 4 * 1024 * 1024` bytes → `` `La foto "${photo.name}" pesa demasiado (máx. 4MB)` ``.
11. `mileage`: `Number(mileageRaw)` o `null` si vacío. No se valida rango ni que sea mayor al
    kilometraje anterior.

Efectos (en este orden; **la creación de la recepción NO está en transacción con lo demás**):

1. `Reception.create` con `number = nextReceptionNumber()` (`REC-` + `count+1` en 6 dígitos),
   `mileage`, `notes`, `requestedServices = diagNames || null` (nombres de servicios de
   diagnóstico unidos por `", "`), `advisorId = user.id`.
2. Si `mileage` es truthy (> 0): `Vehicle.currentMileage = mileage` y
   `VehicleMileageHistory.create({ mileage, source: "recepcion", createdById })`.
3. Fotos → cada una a `MediaFile { ownerType: "RECEPTION", ownerId: reception.id, category:
   "RECEPCION", visibility: "INTERNO", url: data:URI base64, mimeType, sizeBytes, uploadedById }`.
   No hay almacenamiento externo: la imagen entera vive en `MediaFile.url`.
4. Si hay `quickItems`:
   - `WorkOrderStatus.findFirst({ isInitial: true })`; si no hay →
     `"No hay un estado inicial configurado para órdenes de trabajo"` (la recepción **ya quedó creada**).
   - Cálculo por línea (§3.2). `quantity = Decimal(Math.round(Number(q) || 1) || 1)`: `0`,
     `NaN` o vacío pasan a `1`; **valores negativos no se rechazan**. `unitPrice =
     Decimal(item.unitPrice || "0")` — **viene del formulario** (editable en el chip), no del
     catálogo. `type` = `quoteItemTypeForService(service.type)` o `"REPUESTO"` si es producto.
     `discount = 0`, `taxRate = service.taxRate ?? 0.13`, `approved: true`.
   - `number = nextWorkOrderNumber()` (`OT-` + `count+1` en 6 dígitos), **calculado fuera de la
     transacción**.
   - `prisma.$transaction`: `WorkOrder.create` (con `receptionId`, `statusId` inicial, totales,
     `advisorId`, `items`, `statusHistory` nota `"Orden creada — recepción"`) +
     `reserveInventoryForWorkOrder` para líneas con `productId`. Cualquier `throw` (p. ej.
     stock insuficiente) → `{ error: e.message }` o `"No se pudo crear la orden de trabajo"`.
     En ese caso la recepción, el kilometraje y las fotos quedan persistidos, y la recepción
     aparece como "Pendiente de cotizar" (bloqueando un reintento por la regla 4).
5. Si `inspectionTemplateId`: lee los `InspectionItem` de la plantilla, arma `results`
   (`status` = `"ok"|"problema"` o `null`; `note` recortada o `null`) y crea `Inspection {
   receptionId, workOrderId (o null), templateId, results, createdById }`. Duplica las mismas
   fotos como `MediaFile ownerType: "INSPECTION"`. No se captura `notes` de inspección.
6. `revalidatePath` de `/recepcion`, `/cotizaciones`, `/ordenes`, `/inventario`.
7. `redirect(/ordenes/${workOrderId})` si hubo orden; si no `redirect(/recepcion/${reception.id})`.

Los ítems de diagnóstico **no generan cotización**: solo quedan en `requestedServices`.
"Cotizar es una decisión aparte" (comentario líneas 58–62).

### 2.2 `createQuote(_prev, formData)` — `modules/quotes/actions.ts:108`

Entrada: `customerId`, `vehicleId`, `receptionId` (hidden, puede ir vacío), `itemsJson`
(`QuoteItemInput[]`: `{ type, description, quantity, unitPrice, discount, productId?,
serviceId?, supplierNote? }`), `discount` (global), `diagnosis`, `conditions`, `notes`,
`promisedDays` (`"" | "1" | "2" | "3" | "mas"`), `confirmCode`.

Validaciones:

1. `quotes.create` → `"No tienes permiso para crear cotizaciones"`.
2. `customerId`, `vehicleId` → `"Elige o crea el cliente y el vehículo antes de guardar"`.
3. `getOpenQuoteForVehicle` → `` `Este vehículo ya tiene una cuenta abierta (cotización ${openQuote.number}). Dale seguimiento a esa en vez de abrir otra.` ``.
   **No** consulta recepción abierta (es normal cotizar desde una recepción pendiente).
4. `parseItems` (JSON) falla → `"Las líneas de la cotización no son válidas"`.
5. `toItemData` normaliza y **filtra**: `description.trim()` no vacío, `quantity =
   round(Number || 0) > 0`, `unitPrice = Decimal(x || "0") > 0`. Si no queda ninguna →
   `"Agrega al menos una línea con descripción, cantidad y precio"`. `discount` por línea no se
   valida; `supplierNote` se recorta.
6. `confirmCode` debe cumplir `/^\d{4}$/` → `"Ingresa tu código de 4 dígitos para confirmar"`.
7. `bcrypt.compare(confirmCode, currentUser.passwordHash)` → `"Código incorrecto"`. Es decir: la
   contraseña del usuario es un código de 4 dígitos y se reingresa para firmar quién generó la
   cotización (puede haber varias personas en el mismo equipo).
8. `globalDiscount = Decimal(String(formData.get("discount") ?? "0") || "0")` — sin validar signo
   ni tope.

Efectos: un solo `prisma.quote.create` anidado (atómico por ser nested write, sin
`$transaction` explícito):
- `number = nextQuoteNumber()` → `` `ES-${year}-${String(count + 1).padStart(3, "0")}` `` donde
  `count` = cotizaciones cuyo `number` empieza con `ES-${year}-`; `year = new Date().getFullYear()`
  (año del servidor, no de la zona del negocio).
- `status: "PREPARADA"` (nunca `BORRADOR`).
- `validUntil = now + 10 días` (`QUOTE_VALIDITY_DAYS = 10`, fijo, no editable).
- `promisedAt` = `now + PROMISED_DAYS_BY_OPTION[promisedDays]` con `{ "1": 1, "2": 2, "3": 3,
  "mas": 5 }`; cualquier otro valor → `null`.
- `diagnosis`, `conditions`, `notes` (vacío → `null`), `advisorId`, `receptionId`.
- `versions: { create: { versionNumber: 1, isCurrent: true, subtotal, taxTotal, discountTotal,
  total, items: { create: lines } } }` (cálculo §3.1).
- `revalidatePath("/cotizaciones")`; si `receptionId`: revalida y `redirect(/recepcion/${receptionId})`
  (la consola del caso ya incrusta la cotización); si no `redirect(/cotizaciones/${quote.id})`.

### 2.3 `updateQuoteDiagnosis(quoteId, _prev, formData)` — `modules/quotes/actions.ts:193`

- `quotes.update` → `"No tienes permiso para modificar cotizaciones"`.
- Sin validación de existencia ni de estado. `diagnosis = emptyToNull(...)`.
- No transaccional. Retorna `{}`.

### 2.4 `updateQuoteItems(quoteId, _prev, formData)` — `modules/quotes/actions.ts:208`

Entrada: `itemsJson`, `discount`.

1. `quotes.update` → `"No tienes permiso para modificar cotizaciones"`.
2. Cotización inexistente → `"Cotización no encontrada"`.
3. `status ∉ EDITABLE_QUOTE_STATUSES` → `"Esta cotización ya no se puede editar (rechazada, cancelada o convertida en orden)"`.
4. Sin versión `isCurrent` → `"La cotización no tiene una versión vigente"`.
5. JSON inválido → `"Las líneas de la cotización no son válidas"`.
6. Sin líneas válidas tras `toItemData` → `"Agrega al menos una línea con descripción, cantidad y precio"`.

Efectos, en `prisma.$transaction([...])` (forma de arreglo):
- `quoteItem.deleteMany({ quoteVersionId })` → **reemplazo total** (ids nuevos, `decision`
  vuelve a `PENDIENTE`).
- `quoteVersion.update` con nuevos totales e `items: { create: lines }`.
- Si `status ∉ {BORRADOR, PREPARADA}` (`needsResend`) → `quote.status = "PREPARADA"` ("hay que
  reenviarla y que el cliente vuelva a aprobar sobre las líneas nuevas").
- Retorna `{}`.

### 2.5 `sendQuote(quoteId)` — `modules/quotes/actions.ts:254`

- `quotes.send`; **si no tiene permiso retorna silenciosamente** (`Promise<void>`, sin mensaje).
- `quote.status = "ENVIADA"` sin comprobar estado previo ni existencia.
- No transaccional.

### 2.6 `submitApproval(quoteId, _prev, formData)` — `modules/approvals/actions.ts:14`

Entrada: `decision_{quoteItemId}` = `"APROBADO"` | otro.

1. `approvals.register` → `"No tienes permiso para registrar la aprobación"`.
2. Inexistente → `"Cotización no encontrada"`.
3. `status ∉ APPROVABLE_QUOTE_STATUSES` → `"Esta cotización todavía no se le ha entregado al cliente — márcala como enviada primero."`
   (regla de negocio citada en `constants.ts:6`: "cuando no se la entreguen la cuenta no puede
   ser cerrada ya que es un ingreso").
4. Sin versión vigente → `"La cotización no tiene una versión vigente"`.

Cálculo de decisiones: para cada `QuoteItem` de la versión vigente, `decision = (form ===
"APROBADO") ? "APROBADO" : "RECHAZADO"`. **Una línea sin radio marcado cuenta como
`RECHAZADO`** (la UI pone `required` en el radio "Aprobar", lo que obliga en el navegador a
elegir una opción por línea).

Estado resultante:
- `rejectedIds.length === 0` → `APROBADA`
- `approvedIds.length === 0` → `RECHAZADA`
- si no → `PARCIALMENTE_APROBADA`

`willCreateWorkOrder = approvedIds.length > 0`. Si falta `plate` o `model` del vehículo:
`workOrderBlockedReason = `` `Aprobación registrada, pero falta ${missing.join(" y ")} del vehículo — complétalo y genera la orden manualmente desde la pestaña "Orden de trabajo".` ``
(nota: el botón manual real está en la pestaña **Cotización**, banner ámbar; la pestaña "Orden de
trabajo" solo existe cuando ya hay orden).

Efectos, en `prisma.$transaction(async tx => ...)` **sin try/catch** (un `throw` de stock
insuficiente revierte también la aprobación y la excepción sube a Next):
1. `quoteItem.update({ decision })` por cada línea.
2. `customerApproval.create({ quoteId, quoteVersionId, approvedItems: approvedIds, rejectedItems: rejectedIds })`.
3. `quote.update({ status })`.
4. Si `status === "RECHAZADA"`: `reminder.create({ type: "TRABAJO_RECHAZADO", customerId,
   vehicleId, message: `` `Cotización ${quote.number} rechazada — dar seguimiento` `` })`.
5. Si `willCreateWorkOrder && !workOrderBlockedReason`: busca `WorkOrderStatus key
   "recepcion_reparacion"`; si existe → `createWorkOrderFromApprovedQuote(tx, quote,
   approvedItems, statusId, user.id)` y `quote.status = "CONVERTIDA"`. Si no existe el estado,
   **no crea orden ni informa nada** (la cotización queda `APROBADA`/`PARCIALMENTE_APROBADA` y la
   UI muestra el banner "ya está aprobada pero todavía no tiene orden").
6. `revalidatePath` de la cotización, `/recordatorios` y, si hubo orden, `/ordenes/{id}`,
   `/ordenes`, `/inventario`.
7. Retorna `{ error: workOrderBlockedReason }` si estaba bloqueada (aprobación **sí** quedó
   registrada), si no `undefined`.

### 2.7 `saveWorkOrderInspection(workOrderId, templateId, _prev, formData)` — `modules/inspections/actions.ts:19`

Entrada: `item_{id}`, `note_{id}`, `photos`, `notes`.

1. `inspections.perform` → `"No tienes permiso para realizar inspecciones"`.
2. Fotos `> 8` → `"Máximo 8 fotos por inspección"`; `> 4MB` → `` `La foto "${photo.name}" pesa demasiado (máx. 4MB)` ``.
3. **No valida** que la orden exista, que no esté terminal, ni que no tenga ya inspección.

Efectos (**sin transacción**):
1. `inspection.create({ workOrderId, templateId, results, notes: trim || null, createdById })`.
2. Cada foto → `MediaFile { ownerType: "INSPECTION", ownerId: inspection.id, category:
   "RECEPCION", visibility: "INTERNO", url: data:URI, mimeType, sizeBytes, uploadedById }`.
3. Si `workOrder.status.key === "recepcion_reparacion"` y existe `lista_asignacion`:
   `workOrder.statusId = lista_asignacion` + `WorkOrderStatusHistory { note: "Inspección completada" }`.
4. `revalidatePath(/ordenes/${workOrderId})`. Retorna `undefined`.

### 2.8 `createWorkOrderFromQuote(quoteId)` — `modules/work-orders/actions.ts:19`

Reintento manual ("solo existe por si la creación automática falla").

1. `work_orders.create` → `"No tienes permiso para crear órdenes de trabajo"`.
2. Inexistente → `"Cotización no encontrada"`.
3. `quote.workOrder` existe → `"Esta cotización ya tiene una orden de trabajo"`.
4. Falta `plate`/`model` → `` `Completa ${missing.join(" y ")} del vehículo antes de crear la orden de trabajo.` ``.
5. Líneas con `decision === "APROBADO"` en la versión vigente; ninguna → `"No hay líneas aprobadas para convertir en orden"`.
6. Sin `WorkOrderStatus key "recepcion_reparacion"` → `"No hay un estado inicial configurado para órdenes de trabajo"`.
7. **No valida `quote.status`** (solo líneas aprobadas + ausencia de orden).

Efectos: `prisma.$transaction` → `createWorkOrderFromApprovedQuote` + `quote.status =
"CONVERTIDA"`; `catch` → `{ error: e.message }` o `"No se pudo crear la orden de trabajo"`.
Revalida `/ordenes`, `/cotizaciones/{id}`, `/inventario`; `redirect(/ordenes/${id})`.

### 2.9 `createWorkOrderFromApprovedQuote(tx, quote, approvedItems, initialStatusId, advisorId)` — `modules/work-orders/service.ts:40`

Función interna (no Server Action, no valida permisos, corre en la transacción del llamador).

- Por línea aprobada: `breakdown = taxBreakdown(item.lineTotal, item.taxRate ?? 0.13)`;
  `saleGross += quantity × unitPrice`; `discountTotal += item.discount`; `taxTotal +=
  breakdown.tax`; `saleNet += breakdown.total` (= `lineTotal`). Copia `type, serviceId,
  productId, description, quantity, unitPrice, discount, taxRate, lineTotal`, `approved: true`.
- `number = nextWorkOrderNumber(tx)` (`OT-` + `count+1`, 6 dígitos, **dentro** de la tx).
- `workOrder.create` con `receptionId: quote.receptionId`, `quoteId`, `promisedAt:
  quote.promisedAt`, `advisorId`, `statusHistory` nota `"Orden creada desde cotización aprobada"`.
- `reserveInventoryForWorkOrder` para líneas con `productId` (lanza si no alcanza).
- **El descuento global de la cotización (`applyGlobalDiscount`) no se traslada**: la orden
  solo suma descuentos por línea, y el formulario de cotización siempre manda `discount: "0"`
  por línea (`itemized-quote-fields.tsx:96`). Consecuencia: `WorkOrder.saleNet` = suma de
  `lineTotal` aprobados, sin el descuento global que el cliente vio en la cotización.

### 2.10 `addWorkOrderItem(workOrderId, _prev, formData)` — `modules/work-orders/actions.ts:82`

Agregar un servicio del catálogo a una orden abierta, sin nueva aprobación.

1. `work_orders.update` → `"No tienes permiso para modificar órdenes de trabajo"`.
2. `serviceId` vacío → `"Selecciona un servicio"`.
3. Orden inexistente → `"Orden de trabajo no encontrada"`; servicio inexistente → `"Servicio no encontrado"`.
4. `status.isTerminal` → `"No se pueden agregar servicios a una orden cerrada"`.
5. No valida `service.status` ni `quickService`.

Efectos (`$transaction`): `workOrderItem.create { type: quoteItemTypeForService(service.type),
serviceId, description: service.name, quantity: 1, unitPrice: service.suggestedPrice, taxRate:
service.taxRate ?? 0.13, lineTotal, isAdditional: true, approved: true }` y `workOrder.update {
saleGross += qty×price, taxTotal += tax, saleNet += total }`. Revalida orden, `/ordenes` y la
cotización ligada. Retorna `undefined`.

### 2.11 `addWorkOrderProduct(workOrderId, _prev, formData)` — `modules/work-orders/actions.ts:138`

Entrada: `productId`, `quantity` (default `"1"`), `unitPrice` (default `product.price`).

1. `work_orders.update` → `"No tienes permiso para modificar órdenes de trabajo"`.
2. `productId` vacío → `"Selecciona un producto"`.
3. Orden/producto inexistentes → `"Orden de trabajo no encontrada"` / `"Producto no encontrado"`.
4. Terminal → `"No se pueden agregar repuestos a una orden cerrada"`.
5. `new Prisma.Decimal(...)` lanza (texto no numérico) → `"Cantidad o precio inválido"`.
6. `quantity <= 0` o `unitPrice < 0` → `"Cantidad o precio inválido"`. (Precio 0 permitido;
   cantidad decimal permitida — a diferencia de la cotización.)

Efectos (`$transaction`): `workOrderItem.create { type: "REPUESTO", productId, description:
product.name, quantity, unitPrice, taxRate: product.taxRate ?? 0.13, lineTotal, isAdditional:
true, approved: true }`, incrementos en la orden, `reserveInventoryForWorkOrder` (si lanza
`Stock insuficiente…` se revierte todo). `catch` → `{ error: e.message }` o
`"No se pudo agregar el repuesto"`. Retorna `{}`.

### 2.12 `toggleWorkOrderItemDone(itemId, workOrderId)` — `modules/work-orders/actions.ts:214`

1. `work_orders.status` → `"No tienes permiso para marcar avance en la orden"` ("misma idea de
   reportar avance" que cambiar estado).
2. Línea inexistente o `item.workOrderId !== workOrderId` → `"Línea no encontrada"`.
3. **No valida** estado terminal (la UI deshabilita el checkbox).

Efecto: si `completedAt` está lleno → `{ completedAt: null, completedById: null }`; si no →
`{ completedAt: now(), completedById: user.id }`. No transaccional. Revalida orden y cotización.

### 2.13 `changeWorkOrderStatus(workOrderId, _prev, formData)` — `modules/work-orders/actions.ts:359`

Entrada: `statusId`, `note`.

1. `work_orders.status` → `"No tienes permiso para cambiar el estado de la orden"`.
2. `statusId` vacío → `"Selecciona un estado"`.
3. Estado inexistente → `"Estado no válido"`; orden inexistente → `"Orden de trabajo no encontrada"`.
4. Gate de inspección: si `workOrder.status.key ∈ {"recibido", "recepcion_reparacion"}` y
   `status.key !== workOrder.status.key` y no existe `Inspection` con `workOrderId` →
   `"Completa la inspección de cómo llegó el vehículo antes de avanzar el estado"`.
   (Aplica también para ir a `cancelado`.)
5. Si `status.countsAsDelivered`:
   - `getWorkOrderBalance` (`saleNet − Σ payments REGISTRADO`) `> 0` →
     `` `No se puede marcar como "${status.label}": tiene un saldo pendiente de ${formatUSD(balance)}. Cóbralo primero.` ``
   - `!workOrder.costsConfirmedAt` →
     `` `No se puede marcar como "${status.label}": falta confirmar el costo/factura/proveedor de esta orden.` ``

Efectos (`$transaction`): `workOrder.update { statusId, deliveredAt: countsAsDelivered ? now :
undefined }`, `WorkOrderStatusHistory { statusId, changedById, note }`, y si `status.isTerminal`
→ `releaseReservationsForWorkOrder`. Revalida orden e `/inventario`. Retorna `undefined`.

### 2.14 `assignTechnician(workOrderId, _prev, formData)` — `modules/work-orders/actions.ts:316`

Entrada: `technicianId`, `role` (texto libre, opcional).

1. `work_orders.update` → `"No tienes permiso para modificar órdenes de trabajo"`.
2. `technicianId` vacío → `"Selecciona un técnico"`.
3. Ya asignado (`@@unique([workOrderId, technicianId])`) → `"Ese técnico ya está asignado a esta orden"`.
4. Orden inexistente → `"Orden de trabajo no encontrada"`.
5. **No valida** que el técnico exista/esté `ACTIVO`, ni estado terminal de la orden, ni la regla
   de `Technician.isHelper` ("ayudante, no debe quedar solo como único mecánico" — comentario
   del schema `:685`, **no implementada**).

Efectos (`$transaction`): `workOrderAssignment.create { workOrderId, technicianId, role }`; si
`status.key === "lista_asignacion"` y existe `en_proceso` → cambia estado + historial
`"Técnico asignado"`. Retorna `undefined`.

### 2.15 `confirmWorkOrderCosts(workOrderId, _prev, formData)` — `modules/work-orders/actions.ts:245`

Entrada: `noInvoice` (`"on"`), `externalCost`, `externalInvoiceNumber`, `supplierName`.

1. `profit.view` → `"No tienes permiso para confirmar costos de esta orden"`.
2. Orden inexistente → `"Orden de trabajo no encontrada"`.
3. **Rama "sin factura externa"** (`noInvoice === "on"`): `$transaction` → `workOrder.update {
   externalCost: 0, externalInvoiceNumber: null, externalSupplierId: null, costsConfirmedById,
   costsConfirmedAt: now }` + `maybeAutoCloseWorkOrder`. Retorna `{}`.
4. **Rama con factura**: los tres campos recortados no vacíos →
   `` `Completa costo, número de factura y proveedor (o marca "sin factura externa")` ``.
   `externalCost < 0` → `"El costo no puede ser negativo"`. (`new Prisma.Decimal(costRaw)` con
   texto inválido lanza sin capturar.)
5. Proveedor: `supplier.findFirst({ name: { equals: supplierName, mode: "insensitive" } })`; si no
   existe lo crea **fuera de la transacción** con `code = nextSupplierCode()` (`PROV-` +
   `count+1` en 4 dígitos).
6. `$transaction` → `workOrder.update { externalCost, externalInvoiceNumber, externalSupplierId,
   costsConfirmedById, costsConfirmedAt }` + `maybeAutoCloseWorkOrder`. Retorna `{}`.

No impide reconfirmar (la UI oculta el formulario cuando `costsConfirmedAt` está lleno).

### 2.16 `deleteWorkOrder(workOrderId)` — `modules/work-orders/actions.ts:440`

1. `work_orders.void` → `"No tienes permiso para anular órdenes de trabajo"`. Comentario: ese
   permiso se quitó de todos los roles menos superadmin en el seed.
2. Inexistente → `"Orden de trabajo no encontrada"`; ya anulada → `"Esta orden ya fue anulada"`.
3. **No valida** estado, saldo ni pagos.

Efectos (`$transaction`): `releaseReservationsForWorkOrder`, `workOrder.deletedAt = now`,
`auditLog.create { actorId, action: "SOFT_DELETE", entity: "WorkOrder", entityId, beforeData: {
number, statusId, saleNet }, reason: "Orden anulada por el propietario" }`. Revalida `/ordenes`,
`/inventario`; `redirect("/ordenes")`.

### 2.17 `maybeAutoCloseWorkOrder(tx, workOrderId, userId)` — `modules/work-orders/service.ts:114`

Interna. Se llama desde `collectPayment` y `confirmWorkOrderCosts`.

- Si la orden no existe o `status.isTerminal` → no hace nada.
- `paid = Σ payments REGISTRADO`; si `saleNet − paid > 0` → no hace nada.
- Busca `WorkOrderStatus key "cerrado"`; si no existe → nada.
- `workOrder.update { statusId: cerrado, deliveredAt: deliveredAt ?? now }`, historial
  `"Cerrada automáticamente al completar el pago"`, `releaseReservationsForWorkOrder`.
- No revisa inspección, `costsConfirmedAt`, ni el estado `listo`. Una orden con `saleNet = 0`
  se cierra en cuanto se confirma el costo.

### 2.18 Actions de otros módulos invocadas desde estas pantallas

#### `collectPayment(workOrderId, _prev, formData)` — `modules/payments/actions.ts:45`
Entrada: `amount`, `paymentMethodId`, `transferRef`, `bankName`.
1. `payments.register` → `"No tienes permiso para registrar cobros"`.
2. Sin `CashSession status ABIERTA` → `"No hay una caja abierta. Abre caja antes de cobrar."`.
3. Orden inexistente → `"Orden de trabajo no encontrada"`.
4. `workOrder.status.order < listo.order` →
   `` `No se puede cobrar todavía — el trabajo debe estar en "${readyStatus.label}" o una etapa posterior.` ``
5. `balance <= 0` → `"Esta orden ya está pagada"`.
6. `amount` (si vacío = saldo) `<= 0` → `"Ingresa un monto válido"`; `> balance` →
   `` `El monto no puede ser mayor al saldo pendiente (${balance})` ``.
7. `paymentMethodId` vacío → `"Selecciona un método de pago"`; inexistente → `"Método de pago no encontrado"`.
Efectos (`$transaction`): `Payment { number: PAG-NNNNNN, customerId, workOrderId, cashSessionId,
paymentMethodId, amount, isAdvance: amount < balance, transferRef, bankName, createdById,
allocations: [{ workOrderId, amount }] }`; `CashMovement { type: isAdvance ? "ANTICIPO" :
"VENTA_COBRADA", reference: workOrder.number }`; si `method.isCredit` → `Reminder {
type: "CUENTA_COBRAR", dueDate: now + 30 días, message: `` `${payment.number} — ${workOrder.number}: crédito 30 días por ${amount}` `` }`;
`maybeAutoCloseWorkOrder`. Retorna `{}`.

#### `chargeDiagnosticFee(quoteId, _prev, formData)` — `modules/payments/actions.ts:150`
Cuota de diagnóstico cuando el cliente **rechazó** la cotización. Entrada: `amount`, `paymentMethodId`.
1. `payments.register` → `"No tienes permiso para registrar cobros"`.
2. Caja abierta → `"No hay una caja abierta. Abre caja antes de cobrar."`.
3. Inexistente → `"Cotización no encontrada"`; `status !== "RECHAZADA"` → `"Esta cotización no está rechazada"`.
4. `amount <= 0` → `"Ingresa un monto válido"`; método vacío → `"Selecciona un método de pago"`.
Efectos (`$transaction`): `Payment { customerId, cashSessionId, paymentMethodId, amount, notes:
`` `Cuota de diagnóstico — cotización ${quote.number} rechazada` `` }` — **sin `workOrderId` ni
`receptionId`**; `CashMovement VENTA_COBRADA reference quote.number`. **No hay control de
duplicado**: se puede cobrar varias veces. Retorna `{}`.

#### `chargeReceptionDiagnosticFee(receptionId, _prev, formData)` — `modules/payments/actions.ts:213`
Cobro del diagnóstico **antes** de que exista cotización (cliente se retira y la cotización se
manda después por WhatsApp). Entrada: `amount`, `paymentMethodId`, `authCode`.
1. `payments.register` → `"No tienes permiso para registrar cobros"`.
2. Caja abierta → `"No hay una caja abierta. Abre caja antes de cobrar."`.
3. Recepción inexistente → `"Recepción no encontrada"`; ya tiene pagos `REGISTRADO` →
   `"El diagnóstico de esta recepción ya está cobrado"`.
4. `amount <= 0` → `"Ingresa un monto válido"`; método → `"Selecciona un método de pago"`.
5. `authCode` `/^\d{4}$/` → `"Ingresa el código de autorización del superadmin"`.
6. Recorre **todos** los usuarios `ACTIVO` sin `deletedAt` y hace `bcrypt.compare(authCode,
   passwordHash)`; el primero que coincide es el autorizador; debe tener el permiso
   `payments.diagnostic_override` (resuelto con `userHasPermission`, misma lógica que
   `getCurrentUser`) → si no `"Código de autorización inválido"`.
Efectos (`$transaction`): `Payment { customerId, receptionId, cashSessionId, paymentMethodId,
amount, notes: `` `Cuota de diagnóstico — recepción ${reception.number} (sin cotización completa, autorizado por ${authorizer.fullName})` `` }`;
`CashMovement VENTA_COBRADA reference reception.number`. La recepción **no cambia** (sigue
pendiente de cotizar). Retorna `{}`.

#### `voidPayment(paymentId, _prev, formData)` — `modules/payments/actions.ts:297`
1. `payments.void` → `"No tienes permiso para anular pagos"`.
2. `reason` vacío → `"Escribe el motivo de la anulación"`.
3. Inexistente → `"Pago no encontrado"`; ya `ANULADO` → `"Este pago ya está anulado"`.
Efectos (`$transaction`): `payment.status = "ANULADO"`; si tenía `cashSessionId` →
`CashMovement { type: "DEVOLUCION", amount: −amount, reference: `` `Anulación de ${payment.number}` `` }`;
`AuditLog { action: "ANULAR", entity: "Payment", beforeData: { number, amount, workOrderId }, reason }`.
**No reabre** una orden auto-cerrada (no hay lógica inversa a `maybeAutoCloseWorkOrder`). Retorna `{}`.

#### `confirmConsumption(workOrderId)` — `modules/inventory/actions.ts:8`
1. `inventory.confirm_consumption` → `"No tienes permiso para confirmar consumo de inventario"`.
2. Orden inexistente → `"Orden de trabajo no encontrada"`.
3. `!status.allowsConsumption` → `` `El estado actual (${workOrder.status.label}) no permite confirmar consumo` ``.
4. Sin reservas `ACTIVA` → `"No hay reservas activas para esta orden"`.
Efectos (`$transaction`), por reserva: `product.stockOnHand −= quantity`, `InventoryMovement {
type: "CONSUMO", quantity: −q, balanceAfter: newStock, reservationId, reason: "Consumo confirmado" }`,
`reservation.status = "CONSUMIDA"`. Retorna `{}`.

#### `reserveInventoryForWorkOrder(tx, workOrderId, items, createdById)` — `modules/inventory/service.ts:11`
Interna. Primero valida todo, luego escribe. `disponible = stockOnHand − Σ reservas ACTIVA`.
Producto inexistente → `throw "Producto no encontrado"`; `disponible < quantity` →
`` throw `Stock insuficiente de "${product.name}" (disponible: ${available}, solicitado: ${quantity})` ``.
Luego por ítem: `InventoryReservation { productId, workOrderId, quantity, createdById }` (status
default `ACTIVA`) y `InventoryMovement { type: "RESERVA", quantity: −q, balanceAfter:
stockOnHand (sin cambio), reason: "Reserva al crear orden de trabajo" }`. La reserva **no
descuenta** stock físico.

#### `releaseReservationsForWorkOrder(tx, workOrderId, createdById)` — `modules/inventory/service.ts:55`
Interna. Por cada reserva `ACTIVA`: `InventoryMovement { type: "LIBERACION_RESERVA", quantity:
+q, balanceAfter: stockOnHand, reason: "Liberada al cerrar/cancelar la orden sin consumo" }` y
`reservation.status = "LIBERADA"`.

#### `printWorkOrderTicket(workOrderId, _prev)` — `modules/printing/actions.ts:28` (solo encabezado leído)
Requiere sesión (`getCurrentUser`) → `"Sesión no válida"`; **sin `hasPermission`**. Orden
inexistente → `"Orden de trabajo no encontrada"`. Calcula `paid`, `balance` y `baseSinIva =
saleNet − taxTotal`; imprime ESC/POS sin tildes (`stripAccents`). Retorna `{ success: true }`
(la UI muestra "Enviado").

#### `quickCreateCustomer(fullName, phone)` — `modules/customers/actions.ts:39`
`customers.create` → `"No tienes permiso para crear clientes"`; nombre vacío → `"El nombre es obligatorio"`.
Crea `Customer { fullName, phone || null, code: nextCustomerCode() }`.

#### `quickCreateVehicle(customerId, plate, make, model)` — `modules/vehicles/actions.ts:35`
`vehicles.create` → `"No tienes permiso para registrar vehículos"`; los tres vacíos →
`"Indica al menos la marca/modelo o la placa del vehículo"`. Crea `Vehicle { plate:
plate.trim().toUpperCase() || null, make || null, model || null, owners: [{ customerId,
isCurrent: true }] }`. Placa **no** se valida como única aquí.

#### `searchCustomersAction(query)` — `modules/customers/actions.ts:56`
Sin `customers.view` retorna `[]`. Busca `fullName contains (insensitive)` o `phone contains`.

---

## 3. Cálculos

### 3.0 Base: `lib/money.ts`

- **Decisión #1: los precios de catálogo incluyen IVA (13%)**. `DEFAULT_TAX_RATE = Decimal("0.13")`.
- `taxBreakdown(priceWithTax, taxRate = 0.13)`:
  `base = price / (1 + rate)` redondeado a 2 decimales; `tax = price − base` a 2 decimales;
  `total = price` a 2 decimales. Todo con `Prisma.Decimal` (nunca `number`).
- `formatUSD` → `Intl.NumberFormat("es-SV", { currency: "USD" })`.

### 3.1 Totales de cotización (`modules/quotes/actions.ts:38–66`)

`toItemData`: `quantity = Decimal(Math.round(Number(q) || 0))` (**enteros**: "piezas de
repuesto, horas de mano de obra — solo el precio admite decimales"); `unitPrice = Decimal(p ||
"0")`; `discount = Decimal(d || "0")`.

`computeTotals(items)` por línea:
```
lineTotal   = quantity × unitPrice − discount          (precio con IVA, menos descuento de línea)
breakdown   = taxBreakdown(lineTotal, 0.13)             (SIEMPRE 0.13; ignora ServiceCatalog.taxRate)
subtotal   += breakdown.base
taxTotal   += breakdown.tax
discountTotal += discount
total      += breakdown.total                           (= lineTotal)
línea guardada: { ...item, taxRate: 0.13, lineTotal: breakdown.total }
```
`applyGlobalDiscount(totals, globalDiscount)`:
```
discountTotal = discountTotal + globalDiscount
total         = max(0, total − globalDiscount)
```
`subtotal` y `taxTotal` **no** se recalculan tras el descuento global, así que
`subtotal + taxTotal − discountTotal ≠ total` cuando hay descuento global (el IVA queda
calculado sobre el precio sin descontar). El descuento es "un solo descuento global sobre el
total (no por línea) — igual que el sistema de referencia del taller".

Cliente (`itemized-quote-fields.tsx`): muestra `Subtotal repuestos`, `Subtotal mano de obra`,
`Descuento ($)` y `Total estimado = max(0, Σ qty×price − descuento)` con `Number` y `toFixed(2)`
— sin IVA desglosado. Cada línea manda `discount: "0"`, `productId: null`, `serviceId: null`.

### 3.2 Totales de orden de trabajo

**Desde recepción (servicios rápidos)** — `registerVehicleIntake`:
```
quantity  = round(Number(q) || 1) || 1
unitPrice = Decimal(form.unitPrice || "0")
lineTotal = quantity × unitPrice
breakdown = taxBreakdown(lineTotal, service.taxRate ?? 0.13)     (productos: 0.13)
saleGross += quantity × unitPrice
taxTotal  += breakdown.tax
saleNet   += breakdown.total
discountTotal = 0
```

**Desde cotización aprobada** — `createWorkOrderFromApprovedQuote` (§2.9): copia `lineTotal`
de la cotización; `saleGross = Σ qty×unitPrice` (antes de descuento de línea); `discountTotal =
Σ discount de línea`; `taxTotal = Σ tax(lineTotal, item.taxRate)`; `saleNet = Σ lineTotal`.
**Sin** descuento global.

**Líneas adicionales** — `addWorkOrderItem` (qty 1, `suggestedPrice`, `service.taxRate`) y
`addWorkOrderProduct` (qty/precio del form, `product.taxRate`): incrementan `saleGross`,
`taxTotal`, `saleNet` con `{ increment }`. `discountTotal` no se toca.

**Saldo** — `getWorkOrderBalance` (`modules/payments/queries.ts:35`) y `listOpenWorkOrders`:
`balance = saleNet − Σ payments.amount con status REGISTRADO`. `hasAdvance = ∃ payment.isAdvance`.

**Margen mostrado** — `work-order-detail-body.tsx:320`: `saleNet − externalCost` (solo en UI;
`grossProfit`/`marginPct` de la tabla no se calculan).

**Ticket** — `printWorkOrderTicket`: `baseSinIva = saleNet − taxTotal`.

### 3.3 Cuota de diagnóstico (diagnostic fee)

Dos mecanismos, ambos son **pagos sueltos** (`Payment` sin `workOrderId`), no descuentan de nada:

1. **Con cotización rechazada** (`chargeDiagnosticFee`, pestaña Cotización en estado `RECHAZADA`).
   Monto sugerido (`quote-case-tabs.tsx:53`): `Σ lineTotal` de las líneas de la versión vigente
   cuyo `service?.type === "DIAGNOSTICO"`. Como el formulario de cotización siempre manda
   `serviceId: null`, en la práctica ese default es `0` salvo que la línea se haya ligado al
   catálogo por otro camino. El monto es editable (`min 0 step 0.01 required`).
2. **Sin cotización** (`chargeReceptionDiagnosticFee`, tarjeta de recepción en Cuentas abiertas).
   Monto libre, requiere código de 4 dígitos de un usuario con `payments.diagnostic_override`.
   Solo una vez por recepción.

**No existe** lógica que descuente la cuota de diagnóstico del total de una orden posterior ni
que la marque como "aplicada". Tampoco existe un precio de diagnóstico configurado aparte: sale
del catálogo (`ServiceType.DIAGNOSTICO`, `suggestedPrice`) o se teclea.

### 3.4 Precio de servicios vs productos

| Contexto | Servicio | Producto |
| --- | --- | --- |
| Recepción (`IntakePicker`) | `service.suggestedPrice` prellenado, editable en el chip (`min 0 step 0.01`); cantidad `min 1 step 1` | `product.price` prellenado, editable; cantidad igual; siempre `quickService: true` |
| Cotización (`ItemizedQuoteFields`) | texto libre "Mano de obra": descripción, cantidad (`min 1 step 1`), precio (`min 0 step 0.01`) | texto libre "Repuestos": + `Proveedor` (`supplierNote`); sin ligar a catálogo |
| Orden (`AddServiceForm`) | `suggestedPrice`, cantidad fija 1, no editable | — |
| Orden (`AddProductForm`) | — | `product.price` default, editable `min 0`; cantidad default 1, `step 0.01 min 0.01`; muestra `stockOnHand` |

`QuoteItemsFields` (`components/quotes/quote-items-fields.tsx`) es un componente alternativo
con tipo de línea seleccionable, typeahead de catálogo y descuento por línea; **no lo usa
ninguna pantalla leída** (los formularios usan `ItemizedQuoteFields` e `IntakePicker`). Su total
cliente es `Σ max(qty×price − discount, 0)`.

### 3.5 Redondeos

- Servidor: solo `taxBreakdown` redondea (`toDecimalPlaces(2)`) `base`, `tax`, `total`. Las
  sumas se hacen sobre esos valores ya redondeados. Cantidades de cotización/recepción:
  `Math.round`. Columnas: `Decimal(12,2)` para dinero, `Decimal(12,3)` para cantidades,
  `Decimal(6,4)` para tasa.
- Cliente: `toFixed(2)` sobre `number` (solo visual).

---

## 4. Reglas de negocio que viven solo en la UI

### 4.1 Recepción (`recepcion/nuevo/*`, `components/quotes/intake-picker.tsx`)

- `/recepcion/nuevo?vehicleId=` prellena cliente = `vehicle.owners[0].customer` y kilometraje =
  `vehicle.currentMileage`; si el vehículo o su dueño no existen → `notFound()`. Enlace
  "(cambiar vehículo)" a `/vehiculos/{id}`. Desde `/vehiculos/[id]` existe el botón "Iniciar
  recepción".
- Sección "¿A qué servicio viene?": filtro **Tipo de vehículo** (`SEDAN`/`CAMIONETA`/`PICKUP`,
  toggle) que filtra servicios por texto de `categoría + nombre` (`matchesBodyType`,
  `quote-items-fields.tsx:56`): contiene "PICK UP"/"PICKUP" → pickup; "CAMIONETA" (y no pickup)
  → camioneta; "SEDAN" → sedán; si no menciona ninguno aplica a todos. "Camioneta y Pick up son
  carrocerías distintas — no se mezclan".
- Buscador de servicios (`includes` sobre nombre, máx. 15 resultados). Chip por ítem: punto
  **verde** = `quickService` ("Precio fijo — va directo a orden"), **ámbar** = diagnóstico
  ("Diagnóstico — abre cuenta para cotizar"). Tooltip del precio: "Precio unitario — ajustalo si
  el trabajo es más complejo de lo normal".
- Productos ocultos tras "+ agregar repuesto/producto".
- Aviso si mezcla verde y ámbar: "Elegiste servicios de precio fijo (verde) y de diagnóstico
  (ámbar) juntos — se crearán una orden y una cuenta de diagnóstico por separado."
- Checklist "Cómo llegó el vehículo" solo si hay plantilla activa con ítems; hidden
  `inspectionTemplateId`. Radios OK/Problema estilizados, nota opcional por ítem; asterisco si
  `required` (sin `required` HTML real).
- `PhotoPicker` "Fotos del estado del vehículo (opcional)", máx. 8.
- Botón "Registrar entrada" / "Guardando...".
- Listado `/recepcion`: filtros `from`/`to` con atajos **Hoy**, **Esta semana** (lunes),
  **Este mes**, calculados con `todayInBusinessTz()`; sin rango solo últimas 25; con rango
  todas + pie "N recepción(es) en el rango." Rango se construye con
  `new Date(`${dateStr}T00:00:00`)` / `T23:59:59.999` (hora local del servidor).

### 4.2 Cotización (`cotizaciones/**`, `components/quotes/quote-case-tabs.tsx`)

- `/cotizaciones/nuevo` sin `quotes.create` renderiza solo "No tienes permiso para crear cotizaciones."
- `?receptionId=` prellena cliente/vehículo y muestra "(ver recepción REC-…)"; encabezado usa
  `plate ?? "Sin placa"`.
- `NewQuoteForm`: "Diagnóstico (aparece en la cotización impresa)", `ItemizedQuoteFields`,
  select "Tiempo de entrega" (`Sin definir`, `1 día`, `2 días`, `3 días`, `+3 días`), texto de
  ayuda **"La cotización queda válida por 10 días desde hoy."**, Condiciones, Notas internas,
  campo "Tu código (confirma quién genera esta cotización)" (`type=password inputMode=numeric
  maxLength=4 required`). Botón "Guardar cotización".
- Listado `/cotizaciones`: columna Estado muestra **el estado de la orden si existe, si no el de
  la cotización** ("Un solo lugar para ver en qué va cada vehículo"); número de orden entre
  paréntesis; "+ Nueva cotización" solo con `quotes.create`.
- Pestaña **Cotización**:
  - "Imprimir" → `/imprimir/cotizacion/{id}` (nueva pestaña).
  - "Marcar como enviada al cliente" solo si `quotes.send` y estado ∈ `SENDABLE_STATUSES`.
  - `DiagnosisForm` editable con `quotes.update`, si no `DataField` de solo lectura.
  - Líneas: `EditItemsForm` si `quotes.update` **y** estado ∈ `EDITABLE_QUOTE_STATUSES`; si no,
    tabla con columnas Descripción, Proveedor, Cant., Precio, Total línea, Decisión
    (Pendiente gris / Aprobado verde / Rechazado rojo).
  - `EditItemsForm` remapea tipos al cargar: `REPUESTO`/`PRODUCTO` → `REPUESTO`; **todo lo demás
    → `MANO_OBRA`** (una línea `SERVICIO` ligada a catálogo se guarda como `MANO_OBRA` con
    `serviceId: null` al re-guardar). Descuento inicial = `discountTotal` si > 0.
  - Resumen Subtotal / IVA / Descuento / Total; Válida hasta, Fecha promesa, Condiciones, Notas internas.
  - Banner ámbar si `work_orders.create` y estado ∈ `CONVERTIBLE_STATUSES` y sin orden: "Esta
    cotización ya está aprobada pero todavía no tiene orden de trabajo generada." + botón "Crear
    orden de trabajo" + aviso "Falta la placa / el modelo del vehículo — completarlo." con enlace
    `/vehiculos/{id}/editar`.
  - Si `RECHAZADA`: sección "Cuota de diagnóstico" con `DiagnosticFeeForm` si `payments.register`
    y caja abierta; si no hay caja: "No hay una caja abierta. Abre caja para poder cobrar."
  - "Historial de aprobaciones": fecha + "N aprobada(s), M rechazada(s)".
- Pestaña **Aprobar trabajos** solo si `approvals.register` y estado ∈ `APPROVABLE_QUOTE_STATUSES`
  y hay versión y no hay orden. `ApprovalForm`: radio Aprobar/Rechazar por línea con monto,
  atajos "Aprobar todo" / "Rechazar todo", botón "Registrar aprobación".
- Pestaña **Orden de trabajo (OT-…)** solo si `quote.workOrder`; incrusta `WorkOrderDetailBody`.

### 4.3 Orden de trabajo (`ordenes/**`, `components/work-orders/*`)

- `/ordenes` texto: "Todo vehículo recibido aparece aquí como cuenta abierta. Desde una
  recepción pendiente se decide si se cotiza; los servicios con precio fijo ya entran como orden."
  Secciones "Cuentas abiertas" (`OpenAccounts`) y "Recientes" (25, columna Total solo con
  `work_orders.view_prices`).
- `OpenAccounts`: tarjetas = órdenes con `status.isTerminal: false` + recepciones pendientes,
  ordenadas por `createdAt` ascendente. Cada tarjeta: tiempo transcurrido (`formatElapsed`),
  "Ingresada por: {advisorName}" (o "—"; "Usuario eliminado" si el id no resuelve).
  - Orden: líneas `×qty descripción` (precios solo con `view_prices`), Total, "Saldo pendiente"
    ámbar o "Pagada" verde, badge "Con abono — vuelve luego" si `hasAdvance && balance > 0`,
    botón "Cobrar" (link a la orden) si `payments.register && balance > 0`, "Imprimir cuenta"
    (`/imprimir/orden/{id}`) si `view_prices`, enlace "Orden de trabajo"
    (`/imprimir/orden-trabajo/{id}`), "Imprimir en ticketera" si `payments.register`.
  - Recepción: rótulo "Pendiente de cotizar" en `#F59E0B`, `requestedServices` o "Sin detalle de
    servicios solicitados", botón "Cotizar" → `/cotizaciones/nuevo?receptionId=`, y: si
    `diagnosticPaid > 0` "Diagnóstico cobrado: $X"; si no y `payments.register`: con caja abierta
    `ReceptionDiagnosticFeeForm` (link "Cobrar diagnóstico (cliente se retiró sin cotización)" que
    despliega Monto / Método / "Código superadmin" y texto "La recepción se queda pendiente de
    cotizar — esto solo cobra el diagnóstico ahora mismo. Requiere el código de un superadmin
    para autorizar."), sin caja "Abre caja para poder cobrar el diagnóstico."
- `/ordenes/[id]`: botón "Anular orden" (rojo) solo con `work_orders.void`; `window.confirm("¿Anular
  esta orden de trabajo? Esta acción queda registrada y no se puede deshacer.")`. Enlace "Ver
  cotización" si `quoteId`. `getWorkOrderDetail` aplica el filtro de alcance por técnico (§9).
- `WorkOrderDetailBody`:
  - "Imprimir orden de trabajo" → `/imprimir/orden-trabajo/{id}`.
  - **Inspección**: si existe, la muestra (fecha, ítems OK/Problema/—, notas, fotos). Si no:
    `InspectionForm` cuando `inspections.perform` y hay plantilla; de lo contrario aviso "Falta
    completar la inspección de cómo llegó el vehículo — la orden no puede avanzar de estado hasta
    hacerlo."
  - **Líneas**: checkbox "Hecho" (`ItemDoneCheckbox`) deshabilitado si `!work_orders.status ||
    status.isTerminal`; descripción tachada si `completedAt`. Columnas Precio/Total línea y el
    Total solo con `view_prices`. "Agregar servicio" (chips por categoría, tarjetas, clic agrega
    directo) y "Agregar repuesto" (buscador nombre/código, cantidad, precio) solo con
    `work_orders.update` y orden no terminal.
  - **Técnicos asignados**: lista `displayName — role`; `AssignTechnicianForm` con
    `work_orders.update` y técnicos activos aún no asignados; select marca "(ayudante)" si
    `isHelper`; campo Rol placeholder "principal, apoyo...".
  - **Repuestos reservados** (solo si hay `ACTIVA`): "Confirmar consumo de repuestos" si
    `inventory.confirm_consumption && status.allowsConsumption`.
  - **Pagos** (solo con `payments.view`): lista `PAG-… — $ (método — banco) Abono · fecha`, botón
    "Anular" (motivo obligatorio) con `payments.void`; "Imprimir recibo" + ticketera si hay pagos.
    `isReadyForPayment = status.order >= listo.order`. Con saldo: "Saldo pendiente: $X"; si no
    listo: "Todavía no se puede cobrar — el trabajo debe estar en "Listo para entrega" o una etapa
    posterior."; `CollectPaymentForm` si `payments.register && ready && caja abierta`; sin caja:
    "No hay una caja abierta. Abre caja para poder cobrar." Sin saldo: "Orden pagada."
  - `CollectPaymentForm`: métodos primarios `efectivo`, `tarjeta`; el resto tras "Más métodos";
    si método `transferencia` → select Banco obligatorio (`BANKS`); montos rápidos
    `[5,10,20,50,100]` filtrados `<= balance`; "Monto total"; teclado numérico; "Referencia
    (opcional)"; botón deshabilitado si monto vacío o `<= 0`; etiqueta "Registrar abono de $X" si
    `amount < balance`, si no "Cobrar $X".
  - **Costo interno (no se imprime al cliente)** (solo `profit.view`): si confirmado muestra
    "Costo real: $ · Factura N · Proveedor P" y "Margen: $" o "Sin factura externa (solo mano de
    obra)." + "Confirmado el …"; si no, `ConfirmCostsForm` con aviso "Falta confirmar el costo
    interno antes de poder entregar/cerrar esta orden." y checkbox "Sin factura externa (fue solo
    mano de obra)" que oculta los tres campos.
  - **Estado**: píldora con color; `ChangeStatusForm` (con `work_orders.status`) cuyo select
    solo lista `control_calidad`, `listo`, `entregado`, `cerrado`, `cancelado` + el actual
    ("los estados que el sistema ya pone solo no se ofrecen"); nota opcional; historial
    descendente `fecha — label (nota)`.

### 4.4 `CustomerVehiclePicker`

Hidden `customerId`/`vehicleId`. Buscar cliente por "Nombre o teléfono"; "O crear cliente
nuevo" (botón deshabilitado sin nombre). Tras elegir cliente: lista "Vehículos de este cliente"
o "O vehículo nuevo" (Marca, Modelo, "Placa (si ya se sabe)"; botón deshabilitado si los tres
vacíos). "Cambiar" resetea. Etiqueta local `[plate, make, model].join(" — ") || "Vehículo sin datos"`.

### 4.5 `PhotoPicker`

Dos inputs ocultos: cámara (`capture="environment"`, una foto por disparo) y galería
(`multiple`). Acumula en estado y sincroniza un input `name` vía `DataTransfer`. `max = 8`
(recorta con `slice`), contador "(n/8)", botones "Tomar foto" / "Elegir de galería"
deshabilitados al llegar al máximo, miniaturas con "Quitar foto".

---

## 5. Concepto de "caso" (`components/case-tabs.tsx`, `components/quotes/quote-case-tabs.tsx`)

El "caso" es la visita de un vehículo vista como una sola consola con pestañas, "desde que llega
el vehículo hasta que se cobra … sin mandar a otra URL". No es una entidad: es composición de
pantallas.

- `CaseTabs({ tabs })`: cliente. Pestaña activa en estado; si el arreglo de pestañas cambia y la
  activa desaparece (p. ej. "Aprobar trabajos" se va y aparece "Orden de trabajo"), salta a la
  **última** pestaña ("la que corresponde al paso siguiente").
- `getQuoteCaseTabs(quoteId)`: servidor. Devuelve `{ quote, tabs }` con:
  1. `cotizacion` — "Cotización ES-…" (siempre).
  2. `aprobar` — "Aprobar trabajos" (condicional, §4.2).
  3. `orden` — "Orden de trabajo (OT-…)" (si `quote.workOrder`), que incrusta `WorkOrderDetailBody`.
- `/cotizaciones/[id]` = encabezado + `CaseTabs(tabs)`.
- `/recepcion/[id]` = encabezado "Recepción REC-…" + pestañas:
  1. `recepcion` — datos de la recepción, fotos, "Inspección de recepción (histórica)" (última),
     "Cotizaciones anteriores" (todas menos la más reciente, con enlace y estado).
  2. Si la recepción tiene cotizaciones: se **incrustan las pestañas de la última cotización**
     (`getQuoteCaseTabs(latestQuote.id)`).
  3. Si no tiene y el usuario tiene `quotes.create`: pestaña `cotizar` — "Cotizar" con
     `NewQuoteForm` prellenado (`receptionId`, cliente, vehículo). Al guardar, `createQuote`
     redirige de vuelta a `/recepcion/{id}`, donde ahora aparecen las pestañas de la cotización.
- Navegación recepción→cotización→orden: `/recepcion/[id]` (Recepción | Cotizar) → guardar →
  `/recepcion/[id]` (Recepción | Cotización | Aprobar trabajos) → aprobar → `/recepcion/[id]`
  (Recepción | Cotización | Orden de trabajo). Alternativas: tarjeta "Pendiente de cotizar" en
  `/ordenes` → "Cotizar" → `/cotizaciones/nuevo?receptionId=` → guardar → `/recepcion/[id]`.
  Servicio rápido: `registerVehicleIntake` redirige directo a `/ordenes/[id]`.
- La orden directa (servicio rápido) **no** aparece como pestaña en `/recepcion/[id]` (la página
  solo consulta `reception.quotes`, no `reception.workOrders`).

---

## 6. Fotos, kilometraje, combustible, checklist, observaciones

| Dato | Recepción (`registerVehicleIntake`) | Inspección de orden (`saveWorkOrderInspection`) | Cotización | Obligatorio |
| --- | --- | --- | --- | --- |
| Fotos | hasta 8, ≤ 4 MB c/u, `MediaFile RECEPTION` + duplicado `INSPECTION` si hay plantilla; data URI, `category RECEPCION`, `visibility INTERNO` | hasta 8, ≤ 4 MB, `MediaFile INSPECTION` | no | **No** (etiquetas dicen "(opcional)") |
| Kilometraje | `mileage` (Int), actualiza `Vehicle.currentMileage` y crea `VehicleMileageHistory source "recepcion"` si > 0 | no | no | No; sin validación de rango |
| Nivel de combustible (`fuelLevel`) | **no se captura** (columna existe, se muestra vacía) | no | no | — |
| Checklist | `results` de la plantilla activa: `ok`/`problema`/`null` + nota por ítem; sin `notes` general | idem + `notes` general (textarea "Notas generales") | no | `required` **no se valida** en servidor |
| Observaciones | `notes` (campo "Notas") | `notes` | `diagnosis` (impresa), `conditions`, `notes` (internas) | No |
| Servicios solicitados | `requestedServices` = nombres de servicios de diagnóstico | — | — | Al menos un ítem en el intake |
| Testigos, accesorios, objetos de valor, estado exterior/interior, daños | **no se capturan** | no | no | — |

Regla derivada: el gate "inspección antes de avanzar" se cumple con **cualquier** `Inspection`
ligada a la orden, aunque todos sus ítems estén en `null` y sin fotos.

---

## 7. Técnico, ítem hecho, costos, consumo, borrado — reglas exactas

**Asignación de técnico** (`assignTechnician`): permiso `work_orders.update`; un técnico no puede
asignarse dos veces a la misma orden; `role` texto libre opcional; si la orden está en
`lista_asignacion` pasa a `en_proceso` automáticamente con historial "Técnico asignado". Sin
límite de técnicos por orden, sin des-asignación, sin regla de `isHelper`. La UI solo ofrece
técnicos `ACTIVO` no eliminados y aún no asignados.

**Alcance por técnico** (`getWorkOrderScopeFilter`, `modules/work-orders/queries.ts:8`): sin
`work_orders.view_all`, el usuario solo ve órdenes donde su `Technician` (por `userId`) está en
`assignments`; sin perfil de técnico → ninguna (`{ id: "__no_access__" }`). Aplica a
`listRecentWorkOrders`, `listOpenWorkOrders`, `getWorkOrderDetail`; **no** a
`listWorkOrdersPendingReception`.

**Ítem hecho** (`toggleWorkOrderItemDone`): permiso `work_orders.status`; toggle
`completedAt`/`completedById`; la línea debe pertenecer a la orden; sin efecto sobre el estado
de la orden; UI lo bloquea en orden terminal.

**Confirmación de costos** (`confirmWorkOrderCosts`): permiso `profit.view` ("solo
Fausto/gerente/superadmin lo ven y lo llenan"); dos modos (sin factura → costo 0; con factura →
costo ≥ 0, número y proveedor obligatorios; proveedor se crea si no existe, match
case-insensitive por nombre); llena `costsConfirmedAt/By`; dispara `maybeAutoCloseWorkOrder`.
Requisito previo para `entregado`/`cerrado` manuales. Nunca se imprime al cliente.

**Confirmación de consumo** (`confirmConsumption`): permiso `inventory.confirm_consumption`;
estado debe tener `allowsConsumption` (`aprobado`, `recepcion_reparacion`, `lista_asignacion`,
`en_proceso`, `control_calidad` — **no** `listo`, `entregado`, `cerrado`); debe haber reservas
`ACTIVA`; descuenta `stockOnHand`, movimiento `CONSUMO`, reserva → `CONSUMIDA`. Si nadie
confirma antes del cierre (manual o automático), las reservas se **liberan** y el stock no baja.

**Borrado de orden** (`deleteWorkOrder`): permiso `work_orders.void` (solo superadmin por seed);
soft delete + liberar reservas + `AuditLog`; sin condiciones de estado/saldo; confirm en UI. No
revierte pagos ni cotización.

---

## 8. Numeración, fechas, zona horaria, etiquetas

### Folios (todos por conteo, sin secuencia en base)

| Entidad | Formato | Generación | Archivo |
| --- | --- | --- | --- |
| Reception | `REC-000001` | `prisma.reception.count() + 1`, 6 dígitos | `modules/receptions/actions.ts:23` |
| WorkOrder | `OT-000001` | `workOrder.count() + 1`, 6 dígitos; dos implementaciones: fuera de tx (`receptions/actions.ts:28`) y dentro de tx (`work-orders/service.ts:9`) | — |
| Quote | `ES-2026-001` | `quote.count({ number startsWith "ES-{año}-" }) + 1`, 3 dígitos, **consecutivo por año**; año = `new Date().getFullYear()` del servidor. Formato tomado de las cotizaciones impresas del taller ("ES-2026-108") | `modules/quotes/actions.ts:28` |
| Payment | `PAG-000001` | `payment.count() + 1`, 6 dígitos | `modules/payments/actions.ts:12` |
| Supplier | `PROV-0001` | `supplier.count() + 1`, 4 dígitos | `modules/work-orders/actions.ts:236` |

`count()` no filtra `deletedAt`, así que los anulados siguen contando (no se reutilizan folios).
Dos creaciones concurrentes pueden calcular el mismo número; `number` es `@unique`, por lo que
la segunda fallaría en base.

### Fechas (`lib/dates.ts`)

- `BUSINESS_TIMEZONE = "America/El_Salvador"` ("zona horaria fija del negocio,
  `BusinessSettings.timezone`").
- `formatDate(date, options)` → `Intl.DateTimeFormat("es-SV", { timeZone })`.
- `formatDateTime` → `dateStyle: "short", timeStyle: "short"`.
- `todayInBusinessTz()` → `YYYY-MM-DD` con `en-CA` en la zona del negocio ("un `new Date()` sin
  más ya puede caer en el día siguiente").
- `startOfWeek(dateStr)` → lunes de esa semana (UTC).
- `isOverdue(date)` → `date < Date.now()`.
- `formatElapsed(date)` → `"2d 5h"` / `"3h 20m"` / `"12m"`.
- Plazos de negocio calculados con `Date.now() + días × 86400000` (sin zona): validez 10 días,
  promesa 1/2/3/5 días, crédito 30 días.

### Etiqueta de vehículo (`lib/vehicle-label.ts`)

`vehicleLabel({ plate, make, model })` → `plate` si existe; si no `"${make} ${model}"` (los que
existan); si nada → `"Sin placa"`. Motivo: "La placa puede faltar (se completa al registrar la
orden de trabajo, no al cotizar)". Variantes locales: picker `join(" — ") || "Vehículo sin
datos"`; `quickCreateVehicle` `|| "Vehículo nuevo"`; ticket `make model || "--"` y `plate ?? "--"`.

---

## 9. Permisos requeridos

| Action / vista | Permiso | Roles del seed que lo tienen (`prisma/seed.ts`) |
| --- | --- | --- |
| `registerVehicleIntake` | `receptions.create` | superadmin, gerente, asesor, carwash |
| `createQuote` | `quotes.create` (+ código de 4 dígitos del propio usuario) | superadmin, gerente |
| `updateQuoteDiagnosis`, `updateQuoteItems` | `quotes.update` | superadmin, gerente |
| `sendQuote` | `quotes.send` | superadmin, gerente |
| `submitApproval` | `approvals.register` | superadmin, gerente |
| `createWorkOrderFromQuote` | `work_orders.create` | superadmin, gerente, asesor, carwash |
| `addWorkOrderItem`, `addWorkOrderProduct`, `assignTechnician` | `work_orders.update` | superadmin, gerente, asesor, jefe_mecanicos |
| `changeWorkOrderStatus`, `toggleWorkOrderItemDone` | `work_orders.status` | superadmin, gerente, asesor, tecnico, carwash, jefe_mecanicos |
| `confirmWorkOrderCosts` | `profit.view` | superadmin, gerente, (rol de solo lectura línea 318) |
| `deleteWorkOrder` | `work_orders.void` | solo superadmin (`permissions: "ALL"`) |
| `saveWorkOrderInspection` | `inspections.perform` | superadmin, gerente(no), asesor, tecnico, jefe_mecanicos |
| `confirmConsumption` | `inventory.confirm_consumption` | superadmin, gerente, tecnico, inventario, jefe_mecanicos |
| `collectPayment`, `chargeDiagnosticFee`, `chargeReceptionDiagnosticFee` | `payments.register` (+ caja abierta) | superadmin, cajero |
| autorizar `chargeReceptionDiagnosticFee` | `payments.diagnostic_override` (del **autorizador**, por código) | superadmin |
| `voidPayment` | `payments.void` | superadmin, gerente |
| ver sección Pagos | `payments.view` | superadmin, gerente, cajero, lectura |
| ver precios/totales de orden | `work_orders.view_prices` | superadmin, gerente, asesor, cajero, carwash, lectura |
| ver todas las órdenes (no solo asignadas) | `work_orders.view_all` | todos menos tecnico |
| `printWorkOrderTicket` | solo sesión válida (sin permiso) | cualquiera autenticado |
| `quickCreateCustomer` / `searchCustomersAction` | `customers.create` / `customers.view` | — |
| `quickCreateVehicle` | `vehicles.create` | — |
| `quotes.discount` | **definido en seed pero no se comprueba en ninguna action leída** | — |

(La lista de roles es la del bloque `seed.ts:180–330`; "gerente(no)" indica que el gerente no
tiene `inspections.perform` en el seed.)

---

## 10. Reglas de negocio extraídas

1. Un vehículo no puede tener dos cuentas abiertas: `registerVehicleIntake` rechaza si existe
   una cotización en `OPEN_QUOTE_STATUSES` o una recepción sin cotización ni orden para ese `vehicleId`.
2. `createQuote` rechaza si el vehículo ya tiene una cotización en `OPEN_QUOTE_STATUSES`; no
   revisa recepciones pendientes.
3. Los servicios se clasifican en la recepción **según `ServiceCatalog.quickService` de la
   base**, nunca según el flag que envíe el cliente.
4. Toda línea de producto en la recepción es servicio rápido (va a orden).
5. Servicios `quickService` en la recepción crean una `WorkOrder` inmediata en el estado
   `isInitial` (`recibido`), con `receptionId`, líneas `approved: true` y reserva de inventario.
6. Servicios no `quickService` en la recepción **no** crean cotización: solo quedan como texto
   en `Reception.requestedServices` y la recepción aparece como "Pendiente de cotizar".
7. Una recepción puede generar a la vez una orden directa y una cuenta de diagnóstico.
8. Para crear una orden (directa o desde cotización) el vehículo debe tener `plate` y `model`;
   para cotizar no.
9. Máximo 8 fotos por recepción y por inspección; cada foto ≤ 4 MB; se guardan como data URI en
   `MediaFile.url` (no hay almacenamiento externo).
10. Las fotos de la recepción se duplican como fotos de la inspección de llegada cuando hay
    plantilla activa, para que "el vendedor solo suba la foto una vez".
11. Un kilometraje > 0 en la recepción actualiza `Vehicle.currentMileage` y crea
    `VehicleMileageHistory` con `source: "recepcion"`.
12. La recepción se persiste antes de crear la orden directa; si la orden falla (p. ej. stock
    insuficiente) la recepción queda creada como pendiente de cotizar.
13. La cotización nace en `PREPARADA`; `BORRADOR`, `VISTA`, `VENCIDA` y `CANCELADA` nunca se
    escriben desde código.
14. La cotización vale 10 días fijos desde su creación (`validUntil`), y esa fecha no se
    aplica en ninguna validación.
15. `promisedAt` de la cotización se elige en días relativos: 1, 2, 3 o "+3" (= 5 días); otro
    valor → sin fecha.
16. Crear una cotización exige reingresar el código de 4 dígitos (contraseña) del usuario con
    sesión, verificado con bcrypt.
17. Solo se guardan líneas de cotización con descripción no vacía, cantidad entera ≥ 1 y precio > 0.
18. Las cantidades de cotización se redondean a entero; los precios admiten dos decimales.
19. Los precios son con IVA incluido; el desglose es hacia atrás: `base = precio / 1.13`,
    `IVA = precio − base`, ambos a 2 decimales.
20. Las líneas de cotización usan siempre `taxRate = 0.13`; las líneas de orden usan la tasa del
    servicio/producto (`?? 0.13`).
21. El descuento de cotización es global: se suma a `discountTotal` y se resta del `total`
    (mínimo 0) sin recalcular subtotal ni IVA.
22. El descuento global de la cotización no se traslada a la orden de trabajo; la orden suma
    solo descuentos por línea, que el formulario siempre manda en 0.
23. Editar líneas de una cotización reemplaza todas las líneas de la versión vigente (borrar y
    recrear); las decisiones por línea vuelven a `PENDIENTE`.
24. Solo se pueden editar líneas de cotizaciones en `EDITABLE_QUOTE_STATUSES`; `RECHAZADA`,
    `VENCIDA`, `CANCELADA` y `CONVERTIDA` son inmutables.
25. Editar líneas de una cotización ya `ENVIADA`, `VISTA`, `PARCIALMENTE_APROBADA` o `APROBADA`
    la regresa a `PREPARADA` (debe reenviarse).
26. `updateQuoteDiagnosis` no valida estado: el diagnóstico se puede cambiar incluso en
    `CONVERTIDA`.
27. `sendQuote` pone `ENVIADA` sin verificar el estado anterior; la UI solo lo ofrece en
    `BORRADOR`/`PREPARADA`.
28. Solo se registra aprobación sobre cotizaciones en `ENVIADA`, `VISTA` o
    `PARCIALMENTE_APROBADA` ("no se registra aprobación de una cotización que no se entregó").
29. En la aprobación, cada línea sin decisión explícita `APROBADO` cuenta como `RECHAZADO`.
30. Estado tras aprobar: todas aprobadas → `APROBADA`; ninguna → `RECHAZADA`; mezcla →
    `PARCIALMENTE_APROBADA`.
31. Toda aprobación crea un `CustomerApproval` con los ids aprobados y rechazados; no captura
    firma, nombre, IP ni términos.
32. Una cotización `RECHAZADA` genera un `Reminder TRABAJO_RECHAZADO` con mensaje
    "Cotización {number} rechazada — dar seguimiento".
33. Si al menos una línea se aprueba y el vehículo tiene placa y modelo, la orden de trabajo se
    crea en el mismo paso y la cotización pasa a `CONVERTIDA`.
34. Si falta placa o modelo, la aprobación se registra igual y la orden queda para crearse
    manualmente con el botón "Crear orden de trabajo".
35. La orden creada desde cotización nace en `recepcion_reparacion` (no en `recibido`) y hereda
    `receptionId`, `promisedAt` y solo las líneas `APROBADO`.
36. `createWorkOrderFromQuote` exige que la cotización no tenga orden y que existan líneas
    `APROBADO`; no valida `quote.status`.
37. Una cotización tiene como máximo una orden de trabajo (`WorkOrder.quoteId @unique`).
38. Crear una orden reserva inventario para cada línea con `productId`; si
    `stockOnHand − reservas ACTIVA < cantidad` se lanza "Stock insuficiente…" y toda la creación
    se revierte.
39. En `submitApproval` no hay captura de errores: un fallo de stock revierte también la
    aprobación y la excepción se propaga.
40. La reserva no descuenta stock físico; el consumo sí.
41. Consumo solo en estados con `allowsConsumption` y solo si hay reservas `ACTIVA`.
42. Al llegar a un estado `isTerminal` (`cerrado`, `cancelado`), por cambio manual, cierre
    automático o anulación, las reservas `ACTIVA` se liberan (no se consumen).
43. No se puede salir de `recibido` ni de `recepcion_reparacion` sin al menos una `Inspection`
    ligada a la orden; la regla vale también para ir a `cancelado`.
44. Guardar la inspección de una orden en `recepcion_reparacion` la pasa automáticamente a
    `lista_asignacion`.
45. Asignar un técnico a una orden en `lista_asignacion` la pasa automáticamente a `en_proceso`.
46. Un mismo técnico no puede asignarse dos veces a la misma orden; no hay límite de técnicos ni
    des-asignación.
47. Los estados `diagnostico`, `por_aprobar` y `aprobado` existen en la tabla pero ningún código
    transiciona hacia ellos.
48. El cambio manual de estado solo ofrece `control_calidad`, `listo`, `entregado`, `cerrado`,
    `cancelado` (más el actual), pero el servidor acepta cualquier `statusId` válido.
49. No se puede marcar `entregado` ni `cerrado` (estados `countsAsDelivered`) con saldo > 0.
50. No se puede marcar `entregado` ni `cerrado` sin `costsConfirmedAt`.
51. Al pasar a un estado `countsAsDelivered` se fija `deliveredAt = now`.
52. No se valida que las transiciones manuales sean hacia adelante ni que se respete `requiresQc`.
53. No se cobra una orden cuyo `status.order` sea menor al de `listo` (70).
54. No se cobra sin una `CashSession` en estado `ABIERTA`.
55. El cobro puede ser parcial (abono, `isAdvance: true`, movimiento `ANTICIPO`); si cubre el
    saldo es `VENTA_COBRADA`. El monto no puede exceder el saldo ni ser ≤ 0.
56. Un cobro con método `isCredit` crea un `Reminder CUENTA_COBRAR` con vencimiento a 30 días.
57. Cuando el saldo llega a 0 (por cobro o por confirmar costo) la orden pasa sola a `cerrado`
    con nota "Cerrada automáticamente al completar el pago", sin exigir inspección ni costo
    confirmado.
58. Confirmar costo interno requiere `profit.view`; admite "sin factura externa" (costo 0) o
    costo ≥ 0 + número de factura + proveedor; el proveedor se crea si no existe (match por
    nombre sin distinguir mayúsculas).
59. El costo interno nunca se imprime al cliente; el margen mostrado es `saleNet − externalCost`.
60. Agregar servicio/repuesto a una orden abierta no requiere nueva aprobación del cliente: la
    línea nace `isAdditional: true, approved: true` y suma al total de inmediato.
61. No se agregan líneas a una orden en estado terminal.
62. Cantidad de repuesto adicional debe ser > 0 (admite decimales); precio ≥ 0.
63. Marcar una línea como hecha requiere `work_orders.status`; es un toggle sin efecto sobre el
    estado de la orden.
64. Anular una orden requiere `work_orders.void`, es soft delete, libera reservas, deja
    `AuditLog SOFT_DELETE` con motivo "Orden anulada por el propietario" y no revierte pagos ni
    cotización.
65. Anular un pago requiere `payments.void` y motivo; marca `ANULADO`, crea movimiento de caja
    `DEVOLUCION` negativo y `AuditLog ANULAR`; no reabre la orden.
66. La cuota de diagnóstico con cotización rechazada es un pago suelto contra el cliente
    (sin orden ni recepción), monto sugerido = suma de líneas cuyo servicio es `DIAGNOSTICO`,
    repetible sin límite.
67. La cuota de diagnóstico sin cotización es un pago ligado a la recepción, una sola vez, y
    exige el código de 4 dígitos de un usuario activo con `payments.diagnostic_override`; la
    recepción sigue pendiente de cotizar.
68. Ningún código aplica la cuota de diagnóstico como descuento de una orden posterior.
69. Sin `work_orders.view_all`, un usuario solo ve las órdenes donde su perfil de técnico está
    asignado; sin perfil de técnico no ve ninguna.
70. Sin `work_orders.view_prices` no se muestran precios, totales ni saldos de la orden.
71. Los folios se calculan por conteo de filas (`count() + 1`) con formatos `REC-000001`,
    `OT-000001`, `ES-AAAA-001` (consecutivo por año), `PAG-000001`, `PROV-0001`.
72. Todas las fechas se muestran en `America/El_Salvador` con locale `es-SV`; "hoy" y "esta
    semana" se calculan en esa zona; los plazos (10, 1–5, 30 días) se suman en milisegundos sobre
    `Date.now()`.
73. La etiqueta de un vehículo es la placa; sin placa, "marca modelo"; sin nada, "Sin placa".
74. El `required` de los ítems de la plantilla de inspección es solo visual; el servidor acepta
    ítems sin respuesta.
75. Los campos `fuelLevel`, `visitReason`, `symptoms`, `warningLights`, `accessories`,
    `valuables`, `exteriorState`, `interiorState`, `existingDamage` de la recepción se muestran
    pero ningún formulario los captura.
76. La primera plantilla de inspección con `status: ACTIVO` es la que se usa en recepción y en orden.
77. El listado de cotizaciones muestra el estado de la orden si existe; si no, el de la cotización.
78. "Cuentas abiertas" = órdenes no terminales + recepciones sin cotización ni orden, ordenadas
    por antigüedad; la recepción pendiente se rotula "Pendiente de cotizar".
79. La consola del caso (`/recepcion/[id]`) incrusta las pestañas de la **última** cotización de
    la recepción; las anteriores se listan como enlaces.
80. Al guardar una cotización desde una recepción, se vuelve a `/recepcion/[id]`; sin recepción,
    a `/cotizaciones/[id]`.
81. Al cambiar el conjunto de pestañas del caso, la pestaña activa que desaparece se reemplaza
    por la última (el paso siguiente).
82. `quotes.discount` existe como permiso pero ninguna action lo verifica.
83. `printWorkOrderTicket` no verifica permisos, solo sesión.
84. `ApprovalCode` y `getActiveApprovalCode` existen pero no se usan en el flujo.
