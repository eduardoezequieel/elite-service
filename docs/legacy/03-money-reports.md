<!-- Extracto del legado. Fuente: zips elite-service-taller.zip y elite-service-erp.zip (sep 2026). Índice: ../LEGACY_BUSINESS_LOGIC.md. No es una spec: no autoriza implementar. -->

# 03 — Dinero, caja, reportes, impresión y autenticación (proyecto legado)

Fuente: `elite-service-taller` (Next.js App Router + Prisma, server actions). Todo lo que sigue está
leído del código; cuando algo no existe en el código se dice explícitamente ("no existe").

Convenciones del legado relevantes para este bloque:

- Todos los montos son `Prisma.Decimal` (`@db.Decimal(12, 2)` en BD). Nunca `number` para persistir;
  sólo se pasa a `number` para pintar/agrupar en pantalla o para ESC/POS.
- Un pago "cuenta" si `Payment.status === "REGISTRADO"`. Todos los saldos, cierres, reportes e
  impresiones filtran `payments: { where: { status: "REGISTRADO" } }`; los `ANULADO` no suman nunca.
- Los permisos se chequean con `hasPermission("module.action")` (`lib/auth.ts`); no hay chequeos por
  nombre de rol en el código de estos módulos.

---

## 1. COBROS (`modules/payments/actions.ts`, `modules/payments/queries.ts`)

### 1.1 Tres tipos de cobro

| Server action | Contra qué | Vincula `Payment.*` | Tipo de `CashMovement` |
| --- | --- | --- | --- |
| `collectPayment(workOrderId, prev, formData)` | Orden de trabajo (`WorkOrder`) | `workOrderId`, `customerId`, `cashSessionId`, `allocations[{workOrderId, amount}]` | `ANTICIPO` si es parcial, `VENTA_COBRADA` si cubre el saldo |
| `chargeDiagnosticFee(quoteId, prev, formData)` | Cotización **RECHAZADA** (cuota de diagnóstico, no hay orden) | `customerId`, `cashSessionId`, `notes` (sin `workOrderId`, sin `receptionId`, sin allocations) | `VENTA_COBRADA` |
| `chargeReceptionDiagnosticFee(receptionId, prev, formData)` | Recepción sin cotización (cliente se retiró; se cotiza después por WhatsApp) | `receptionId`, `customerId`, `cashSessionId`, `notes` | `VENTA_COBRADA` |

Los tres comparten:

- Permiso: `payments.register`. Error literal: `"No tienes permiso para registrar cobros"`.
- **Caja abierta obligatoria**: `prisma.cashSession.findFirst({ where: { status: "ABIERTA" } })`. Sin
  ella: `"No hay una caja abierta. Abre caja antes de cobrar."` → **no se puede cobrar sin caja
  abierta** (también la UI oculta el formulario y muestra "No hay una caja abierta. Abre caja para
  poder cobrar." en `components/work-orders/work-order-detail-body.tsx` y `components/quotes/quote-case-tabs.tsx`;
  en la tarjeta de recepción: `"Abre caja para poder cobrar el diagnóstico."` en
  `components/work-orders/open-accounts.tsx`).
- Numeración: `nextPaymentNumber()` = `PAG-` + `count(payment)+1` con `padStart(6,"0")` (ej.
  `PAG-000001`). Es un `count()` global (incluye anulados) y no está dentro de la transacción, así
  que dos cobros simultáneos pueden colisionar en `number @unique` (no hay manejo de ese caso).
- `createdById = getCurrentUser()?.id ?? null`.
- Todo (pago + movimiento de caja + efectos) se hace en `prisma.$transaction`.
- Después, `revalidatePath` de `/caja`, `/caja/{sessionId}` y las rutas de la entidad.

### 1.2 `collectPayment` — cobro contra orden (paso a paso)

1. Permiso `payments.register`.
2. Caja abierta (`status: "ABIERTA"`); toma la primera que encuentre (no filtra por caja física).
3. Carga `workOrder` con `payments` REGISTRADO y `status`. Si no existe: `"Orden de trabajo no encontrada"`.
4. **Gate de etapa**: busca `workOrderStatus.key === "listo"` ("Listo para entrega", `order: 70` en
   `prisma/seed.ts`). Si `workOrder.status.order < readyStatus.order`:
   `` `No se puede cobrar todavía — el trabajo debe estar en "${readyStatus.label}" o una etapa posterior.` ``
   (si el status `listo` no existiera en BD, no hay gate). La UI replica el gate:
   `isReadyForPayment = workOrder.status.order >= readyStatus.order` y muestra
   `Todavía no se puede cobrar — el trabajo debe estar en "Listo para entrega" o una etapa posterior.`
5. `alreadyPaid = Σ payments(REGISTRADO).amount`; `balance = workOrder.saleNet − alreadyPaid`.
   Si `balance ≤ 0`: `"Esta orden ya está pagada"`.
6. Monto: `formData.amount` (string, trim). **Si viene vacío se cobra el saldo completo**
   (`amount = balance`). Si `amount ≤ 0`: `"Ingresa un monto válido"`.
7. **Sobrepago prohibido**: si `amount > balance`:
   `` `El monto no puede ser mayor al saldo pendiente (${balance})` `` (el saldo va como Decimal sin formato de moneda).
8. `paymentMethodId` obligatorio: `"Selecciona un método de pago"`; debe existir: `"Método de pago no encontrado"`.
9. `transferRef` (opcional, texto libre "Referencia") y `bankName` (opcional en servidor; en el
   formulario el `<select name="bankName" required>` solo aparece si `method.key === "transferencia"`).
   Ninguno se valida contra la lista `BANKS`.
10. `isAdvance = amount < balance` (**abono/pago parcial**). El pago parcial es válido: la orden no
    pasa a pagada; el cliente puede volver después. Se persiste `Payment.isAdvance`.
11. Transacción:
    - `payment.create` con `allocations: { create: { workOrderId, amount } }` (siempre 1 allocation
      al 100% a la misma orden; el modelo `PaymentAllocation` permite repartir entre órdenes pero el
      código no lo usa).
    - `cashMovement.create` `type: isAdvance ? "ANTICIPO" : "VENTA_COBRADA"`, `amount`,
      `paymentId`, `reference: workOrder.number`.
    - **Crédito 30 días**: si `method.isCredit` (seed: método `credito`, "Crédito 30 días"), se crea un
      `Reminder` `type: "CUENTA_COBRAR"`, `customerId`, `vehicleId`,
      `dueDate = now + 30 días` (`CREDIT_TERM_DAYS = 30`, `addDays`),
      `message: "${payment.number} — ${workOrder.number}: crédito 30 días por ${amount}"`.
      Ojo: el cobro a crédito **cuenta como cobro normal** (entra al saldo pagado, al movimiento de
      caja y al cierre en "otros"); lo único distinto es el recordatorio. No usa las tablas
      `Receivable`/`ReceivablePayment`/`CustomerCreditProfile` (existen en schema, no en código).
    - `maybeAutoCloseWorkOrder(tx, workOrderId, userId)` (`modules/work-orders/service.ts`).
12. Revalida `/ordenes/{id}`, `/ordenes`, `/inventario`, `/caja`, `/caja/{sessionId}` y, si es
    crédito, `/recordatorios`.

**Qué pasa con la orden al quedar pagada** (`maybeAutoCloseWorkOrder`, `modules/work-orders/service.ts:114`):

- Si `status.isTerminal` → no hace nada.
- Si `saleNet − Σ pagos REGISTRADO > 0` → no hace nada (sigue con saldo).
- Si saldo ≤ 0 y existe status `key: "cerrado"`: `workOrder.statusId = cerrado`,
  `deliveredAt = deliveredAt ?? now`, inserta `WorkOrderStatusHistory` con nota
  `"Cerrada automáticamente al completar el pago"` y llama `releaseReservationsForWorkOrder` (libera
  reservas de inventario). Es decir: **pagar el saldo completo cierra la orden automáticamente**
  (salta "entregado"; va directo a "cerrado", `order 90`, terminal).

**UI del cobro** (`app/(dashboard)/ordenes/[id]/collect-payment-form.tsx`):

- Métodos primarios visibles: `efectivo`, `tarjeta` (`PRIMARY_KEYS`); el resto detrás de "Más métodos".
  Íconos por `key`: `efectivo`, `tarjeta`, `transferencia`, `credito`, `link_pago`.
- Montos rápidos `[5, 10, 20, 50, 100]` filtrados por `q <= balance`, botón "Monto total" (= balance),
  teclado numérico con punto decimal. Botón deshabilitado si `amount` vacío o ≤ 0.
- Texto del botón: `Registrar abono de $X` si `amount < balance`, si no `Cobrar $X`.
- Se renderiza sólo si `canCollectPayment && isReadyForPayment && openSession` y `balance > 0`.
  La lista de pagos y el bloque entero requieren `payments.view` (`canViewPayments`).

### 1.3 `chargeDiagnosticFee` — cuota de diagnóstico de cotización rechazada

- Permiso `payments.register`; caja abierta (mismos errores).
- `quote` debe existir (`"Cotización no encontrada"`) y `quote.status === "RECHAZADA"`; si no:
  `"Esta cotización no está rechazada"`.
- `amount = Decimal(formData.amount || "0")`; si ≤ 0: `"Ingresa un monto válido"`. **No hay tope**
  (no hay saldo contra el cual comparar) y **no se impide cobrarla dos veces** (no revisa pagos previos
  de la cotización; `Payment` no tiene `quoteId`).
- `paymentMethodId` obligatorio: `"Selecciona un método de pago"` (no verifica que exista el método).
- Crea `Payment` con `notes: "Cuota de diagnóstico — cotización ${quote.number} rechazada"`, sin
  `workOrderId`, sin `isAdvance`, sin `bankName/transferRef`, y `CashMovement` `VENTA_COBRADA`,
  `reference: quote.number`.
- Monto por defecto en el formulario (`components/quotes/quote-case-tabs.tsx`):
  `Σ lineTotal` de los ítems de la versión actual cuyo `service.type === "DIAGNOSTICO"`.
- El formulario sólo aparece si `quote.status === "RECHAZADA"` y `payments.register` y caja abierta.

### 1.4 `chargeReceptionDiagnosticFee` — diagnóstico sin cotización (override)

- Permiso `payments.register`; caja abierta.
- `reception` debe existir (`"Recepción no encontrada"`). Si ya tiene algún `Payment` REGISTRADO:
  `"El diagnóstico de esta recepción ya está cobrado"` (aquí sí es un solo cobro por recepción).
- `amount > 0` (`"Ingresa un monto válido"`), `paymentMethodId` (`"Selecciona un método de pago"`).
- **Código de autorización de otra persona**: `authCode` debe cumplir `/^\d{4}$/`
  (`"Ingresa el código de autorización del superadmin"`). Se recorre **todos** los usuarios
  `status: "ACTIVO", deletedAt: null` haciendo `bcrypt.compare(authCode, passwordHash)` hasta hallar
  al dueño del código; ese usuario debe tener el permiso `payments.diagnostic_override`
  (`userHasPermission`, que replica la resolución de permisos de `lib/auth.ts` pero para un usuario
  arbitrario). Si no hay match o no tiene el permiso: `"Código de autorización inválido"`.
  En el seed sólo `superadmin` (permisos `ALL`) tiene `payments.diagnostic_override`.
- Crea `Payment` con `receptionId`, `notes: "Cuota de diagnóstico — recepción ${reception.number} (sin cotización completa, autorizado por ${authorizer.fullName})"`
  y `CashMovement` `VENTA_COBRADA`, `reference: reception.number`.
- La recepción **no cambia de estado**: sigue "Pendiente de cotizar". La tarjeta muestra luego
  `Diagnóstico cobrado: $X` (`diagnosticPaid` = Σ pagos REGISTRADO de la recepción,
  `modules/receptions/queries.ts:listOpenPendingReceptions`).
- UI: `app/(dashboard)/ordenes/reception-diagnostic-fee-form.tsx`, campos `amount`, `paymentMethodId`,
  `authCode` (password, 4 dígitos). Texto: "La recepción se queda pendiente de cotizar — esto solo
  cobra el diagnóstico ahora mismo. Requiere el código de un superadmin para autorizar."

### 1.5 Métodos de pago y bancos

- `PaymentMethod { key @unique, name, isCash, isCredit, status }`. `listPaymentMethods()` devuelve
  los `ACTIVO` ordenados por `name`.
- Seed (`prisma/seed.ts` PAYMENT_METHODS):

  | key | name | isCash | isCredit |
  | --- | --- | --- | --- |
  | `efectivo` | Efectivo | true | false |
  | `tarjeta` | Tarjeta | false | false |
  | `transferencia` | Transferencia | false | false |
  | `credito` | Crédito 30 días | false | true |
  | `link_pago` | Link de pago | false | false |

- `lib/banks.ts`: `BANKS = ["Banco Agrícola", "Banco de América Central", "Banco Hipotecario", "Banco Azul"] as const`.
  Se usa sólo en el `<select name="bankName">` del cobro de orden cuando `methodKey === "transferencia"`.
  Se guarda como texto en `Payment.bankName`. No se valida en servidor.
- `Payment.transferRef` = campo "Referencia (opcional)" del formulario (texto libre). No hay
  comprobante/archivo adjunto.
- Los cierres agrupan por `method.isCash` (efectivo), `method.key === "tarjeta"`,
  `method.key === "transferencia"`, y "otros" = todo lo demás (`credito`, `link_pago`).

### 1.6 Anulación de pago — `voidPayment(paymentId, prev, formData)`

- Permiso `payments.void`. Error: `"No tienes permiso para anular pagos"`. En el seed lo tienen
  `gerente` y `superadmin` (el cajero **no**).
- `reason` obligatorio (trim): `"Escribe el motivo de la anulación"`.
- Pago debe existir (`"Pago no encontrado"`) y no estar ya anulado (`"Este pago ya está anulado"`).
- **No hay otras condiciones**: se puede anular aunque la caja del pago esté CERRADA, aunque la orden
  esté cerrada, sin límite de tiempo.
- Transacción:
  - `payment.status = "ANULADO"` (no se borra).
  - Si `payment.cashSessionId`: `cashMovement.create` `type: "DEVOLUCION"`,
    `amount: payment.amount.negated()` (negativo), `paymentId`,
    `reference: "Anulación de ${payment.number}"`. Va a la **misma sesión de caja original**, aunque
    esté cerrada (el `DailyClosure` ya creado no se recalcula).
  - `auditLog.create` `action: "ANULAR"`, `entity: "Payment"`, `entityId`,
    `beforeData: { number, amount(string), workOrderId }`, `reason`.
- Efectos derivados: como todo filtra por REGISTRADO, el saldo de la orden vuelve a subir. **No
  reabre la orden**: si ya se había cerrado automáticamente queda en `cerrado` con saldo pendiente
  (aparece en Cuentas por cobrar porque `getReceivables` no filtra por estado).
- UI: `void-payment-button.tsx` → botón "Anular" → input `reason` requerido + "Confirmar"/"Cancelar".

### 1.7 Saldo pendiente

`getWorkOrderBalance(workOrderId)` (`modules/payments/queries.ts`) =
`workOrder.saleNet − Σ payments(REGISTRADO).amount`. La misma fórmula se repite en
`collectPayment`, `maybeAutoCloseWorkOrder`, `listOpenWorkOrders`, `getReceivables`,
`printWorkOrderTicket` y las páginas de impresión. `hasAdvance = payments.some(p => p.isAdvance)`
(etiqueta "Con abono — vuelve luego" en tarjetas).

### 1.8 Vista Transacciones (`app/(dashboard)/caja/transacciones/page.tsx`, `getTransactionsInRange`)

- Permiso `cash.view` (`"No tienes permiso para ver esta sección."`).
- Rango `from`/`to` (query string, default hoy en TZ negocio); si `from === to` hay flechas ◀ ▶ de día.
- `getTransactionsInRange(from, to)`: pagos `REGISTRADO` con `createdAt ∈ [from, to]`, ordenados desc,
  **independiente de la sesión de caja**; totales por método (`{ name, total, count }`), inicializando
  todos los métodos activos en 0.
- Columnas: Fecha, # Orden (o `payment.number` si no tiene orden), Cliente, Método (+ ` — banco`,
  + etiqueta "Abono" si `isAdvance`), Total.

---

## 2. CAJA (`modules/cash/actions.ts`, `modules/cash/queries.ts`, `app/(dashboard)/caja/**`)

### 2.1 Modelo

- `CashRegister` (caja física). Seed crea una sola: `id = "cash_register_main"`
  (`MAIN_REGISTER_ID` en `modules/cash/actions.ts`).
- `CashSession { cashRegisterId, cashierId (User), status: ABIERTA|CERRADA|REABIERTA, openingFloat, openedAt, closedAt }`
  con relaciones `payments`, `movements`, `expenses`, `closure (DailyClosure?)`.
- `CashMovement { cashSessionId, type, amount, paymentId?, expenseId?, reference?, createdById? }`.
  Enum `CashMovementType`: `VENTA_COBRADA, ANTICIPO, ABONO, GASTO, RETIRO, INGRESO_EXTRA, DEVOLUCION, DEPOSITO`.
  **El código sólo crea** `VENTA_COBRADA`, `ANTICIPO` y `DEVOLUCION`. `ABONO`, `GASTO`, `RETIRO`,
  `INGRESO_EXTRA`, `DEPOSITO` no se generan nunca (los gastos NO crean CashMovement; se restan
  directamente desde la tabla `Expense` al cerrar).
- `DailyClosure` (1:1 con la sesión): `expectedCash, countedCash, cardTotal, transferTotal, otherTotal, countedCard, countedTransfer, countedOther, cardDifference, transferDifference, otherDifference, expenseTotal, withdrawalTotal, refundTotal, difference, explanation, closedById, reopenedById, reopenedAt`.

### 2.2 Apertura — `openCashSession(prev, formData)`

- Permiso `cash.open` (`"No tienes permiso para abrir caja"`).
- **Una sola abierta a la vez** (por caja física): si existe `cashSession` con
  `cashRegisterId: "cash_register_main", status: "ABIERTA"`:
  `` `Ya hay una caja abierta por ${existing.cashier.fullName}` ``.
- Usuario válido requerido (`"Sesión inválida"`).
- `openingFloat = Decimal(formData.openingFloat || "0")` ("Monto inicial en caja", default 0). No se
  valida que sea ≥ 0.
- Crea la sesión con `cashierId = user.id` (quien abre es el cajero de la sesión) y redirige a
  `/caja/{id}`.
- Nota: el cobro busca `findFirst({ status: "ABIERTA" })` sin filtrar por caja; en la práctica es
  la misma porque sólo hay una caja física.

### 2.3 Cierre — `closeCashSession(sessionId, prev, formData)`

- Permiso `cash.close` (`"No tienes permiso para cerrar caja"`). **Cualquier usuario con el permiso
  puede cerrar**, no tiene que ser el cajero que abrió. En seed: `cajero` y `superadmin`; el
  `gerente` como rol no lo tiene (Fausto lo tiene por llevar también rol `cajero`).
- Sesión debe existir (`"Sesión de caja no encontrada"`) y estar `ABIERTA` (`"Esta caja ya está cerrada"`).
- Cálculo (sólo pagos `REGISTRADO` de **esa sesión**, `Prisma.Decimal`):
  - `expenseTotal = Σ expense.amount where cashSessionId = sessionId AND deletedAt = null`
  - `cashTotal = Σ pagos con method.isCash`
  - `cardTotal = Σ pagos con method.key === "tarjeta"`
  - `transferTotal = Σ pagos con method.key === "transferencia"`
  - `otherTotal = Σ pagos con !isCash && key ∉ {tarjeta, transferencia}` (crédito 30 días, link de pago)
  - **`expectedCash = openingFloat + cashTotal − expenseTotal`**
  - `countedCash = Decimal(formData.countedCash || "0")` (campo requerido en UI)
  - **`difference = countedCash − expectedCash`** (positivo = sobrante, negativo = faltante)
  - `countedCard/countedTransfer/countedOther` = conteo manual (en UI vienen pre-llenados con el
    total del sistema); `cardDifference = countedCard − cardTotal`, etc.
  - `explanation` opcional ("Explicación de diferencia (opcional)").
  - `withdrawalTotal = 0`, `refundTotal = 0` (hardcodeado; no hay retiros ni se consideran las
    `DEVOLUCION`).
- **Las devoluciones por anulación (`CashMovement DEVOLUCION`) no entran en el cierre**: el cierre
  suma `Payment`s REGISTRADO, no `CashMovement`s. Un pago anulado simplemente desaparece del total.
- Transacción: `cashSession.update({ status: "CERRADA", closedAt: now })` + `dailyClosure.create({...})`
  con `closedById = user.id`.
- No genera `AuditLog`.

### 2.4 Reapertura

**No existe**. Hay enum `REABIERTA`, permiso `cash.reopen` ("Reabrir caja (supervisión)"), campos
`reopenedById/reopenedAt` y `AuditAction.REAPERTURA_CAJA`, y la UI muestra la etiqueta "Reabierta",
pero ninguna server action lo implementa.

### 2.5 Transacciones manuales (retiros, ingresos extra, depósitos)

**No existen**. Permiso `cash.movement` está en el seed pero no hay acción que cree `RETIRO`,
`INGRESO_EXTRA` ni `DEPOSITO`.

### 2.6 Relación con DTE / facturación externa

Sólo en schema: `ExternalTaxDocument { type FE|CCF|NC|ND|FSE|OTRO, status EMITIDO|ANULADO|CONTINGENCIA|RECHAZADO, generationCode @unique, controlNumber, receptionSeal, ... }`,
permisos `tax_docs.view`, `tax_docs.link`. **Ningún módulo lo usa**. Lo único visible es la leyenda
impresa "Comprobante de servicio — no sustituye documento tributario electrónico" (ver §7).

### 2.7 Pantallas

- `/caja` (`caja/page.tsx`): últimas 25 sesiones (`listRecentCashSessions`, orden `openedAt desc`)
  con Cajero, Estado (`ABIERTA→"Abierta"`, `CERRADA→"Cerrada"`, `REABIERTA→"Reabierta"`), Apertura,
  Cierre, Diferencia (`closure.difference`). Si no hay abierta y `cash.open`: `OpenSessionForm`.
  Si no hay abierta y sin permiso: "No hay una caja abierta en este momento." Links a
  "Transacciones" y "Ver caja abierta". El acceso al menú requiere `cash.view` (sidebar), pero la
  página en sí no chequea permiso.
- `/caja/[id]` (`caja/[id]/page.tsx`): fondo inicial, tabla de cobros de la sesión (Número, Cliente,
  Orden, Método + banco + "Abono", Monto), "Hoja de cierre — desglose por método" (agrupa por
  `method.name`, salvo transferencia con banco que se separa como `"Transferencia — {bankName}"`),
  gastos de la sesión con total, formulario de cierre si `ABIERTA && cash.close`, y bloque "Cierre"
  con los 13 campos del `DailyClosure` + `explanation`.
- `/caja/transacciones`: ver §1.8.
- Dashboard `getTodayCashMovements()`: `CashMovement` con `createdAt >= inicio de hoy`, etiquetas
  `CASH_MOVEMENT_LABEL` (`VENTA_COBRADA→"Venta cobrada"`, `ANTICIPO→"Anticipo"`, `ABONO→"Abono"`,
  `GASTO→"Gasto"`, `RETIRO→"Retiro"`, `INGRESO_EXTRA→"Ingreso extra"`, `DEVOLUCION→"Devolución"`,
  `DEPOSITO→"Depósito"`).

---

## 3. GASTOS (`modules/expenses/actions.ts`, `modules/expenses/queries.ts`, `app/(dashboard)/gastos/**`)

### 3.1 Alta — `registerExpense(prev, formData)`

- Permiso `expenses.create` (`"No tienes permiso para registrar gastos"`). Seed: gerente, cajero, superadmin.
- **Caja abierta obligatoria**: `"No hay una caja abierta. Abre caja antes de registrar un gasto."`
  El gasto queda amarrado a `cashSessionId = openSession.id`.
- `description` obligatoria (trim): `"Describe el gasto"`.
- `amount = Decimal(formData.amount || "0")`; si ≤ 0: `"El monto debe ser mayor a $0.00"`.
- `categoryId` opcional (select "Sin categoría" = `""` → `null`), `documentRef` opcional
  ("N° de recibo/factura (opcional)").
- Se guarda con `status: "PAGADO"` (fijo), `type` default `OPERATIVO`, `taxRate` default 0,
  `createdById`. No se usa `authorizedById`, `supplierId`, `workOrderId`, `area`, `isConfidential`.
- **No crea `CashMovement`**. El impacto en caja es indirecto: al cerrar,
  `expectedCash = openingFloat + cashTotal − expenseTotal`. Es decir, **todo gasto se asume pagado en
  efectivo desde la caja** (texto de la pantalla: "Gastos pagados en efectivo desde la caja actual —
  se descuentan del efectivo esperado al cerrar caja.").
- No hay flujo de autorización previa (`PENDIENTE/AUTORIZADO/RECHAZADO` del enum no se usan).

### 3.2 Categorías

`ExpenseCategory { name, status }`; `listExpenseCategories()` = `ACTIVO` por nombre. Seed:
Combustible, Papelería y oficina, Alimentación, Herramientas y equipo, Servicios (agua, luz,
internet), Transporte y mandados, Otros. No hay UI para crear categorías.

### 3.3 Anulación — `voidExpense(expenseId)`

- Permiso `expenses.authorize` (`"No tienes permiso para anular gastos"`). Seed: gerente, superadmin.
- Gasto debe existir y no estar borrado (`"Gasto no encontrado"`).
- **Sólo si la caja del gasto sigue `ABIERTA`**: si no, `"No se puede anular un gasto de una caja ya cerrada"`.
- Es soft delete: `deletedAt = now`. **No pide motivo** y **no escribe AuditLog**.
- Al estar filtrado por `deletedAt: null`, deja de restar del efectivo esperado.

### 3.4 Listado

`/gastos` muestra sólo los gastos de la **caja abierta actual** ("Gastos de hoy" con total). Si no
hay caja: "No hay una caja abierta. Abre caja para poder registrar gastos." No hay histórico de
gastos por rango; sólo se ven dentro de cada `/caja/[id]` (`listExpensesForSession`).
`getExpenseTotalForSession` = `Σ amount where cashSessionId AND deletedAt null`.

---

## 4. CUENTAS POR COBRAR / CUENTAS ABIERTAS

### 4.1 Reporte `/reportes/cuentas-por-cobrar` — `getReceivables()` (`modules/reports/queries.ts`)

- Toma **todas** las `WorkOrder` con `deletedAt: null` (cualquier estado, cualquier fecha), orden
  `createdAt asc`, con `payments` REGISTRADO.
- `paid = Σ payments.amount`; `balance = saleNet − paid`; se queda sólo con `balance > 0`.
- Columnas: Orden, Cliente, Vehículo, Estado, Fecha, Total (`saleNet`), Pagado, Saldo; pie "Total
  pendiente" = Σ balance (sumado como `number`).
- No usa la tabla `Receivable` del schema. No distingue crédito de simplemente no cobrado. Incluye
  órdenes en cualquier etapa (incluso "Recibido" con `saleNet > 0`) y órdenes canceladas si tienen
  `saleNet > 0` (no filtra por `isTerminal`).
- Acceso: el layout de `/reportes` exige `profit.view`.

### 4.2 "Cuentas abiertas" (`components/work-orders/open-accounts.tsx`, usado en Tablero y `/ordenes`)

- Tarjetas de dos tipos ordenadas por `createdAt asc`:
  - **Órdenes** con `status.isTerminal === false` (`listOpenWorkOrders`, respetando
    `getWorkOrderScopeFilter` para técnicos sin `work_orders.view_all`): número, estado (color del
    status), tiempo transcurrido (`formatElapsed`), "Ingresada por" (advisor), cliente/vehículo, líneas
    (`×qty descripción` + `lineTotal` si `work_orders.view_prices`), Total, "Saldo pendiente" o
    "Pagada", badge "Con abono — vuelve luego" si `hasAdvance && balance > 0`, botón "Cobrar" (link a
    la orden) si `payments.register && balance > 0`, "Imprimir cuenta" (`/imprimir/orden/{id}`) si ve
    precios, "Orden de trabajo" (`/imprimir/orden-trabajo/{id}`) y `PrintTicketButton` si puede cobrar.
  - **Recepciones pendientes de cotizar** (`listOpenPendingReceptions`: `deletedAt null`, sin
    quotes y sin workOrders): "Pendiente de cotizar" (color fijo `#F59E0B`), servicios solicitados,
    botón "Cotizar", y `Diagnóstico cobrado: $X` si `diagnosticPaid > 0`; si no y puede cobrar:
    `ReceptionDiagnosticFeeForm` si hay caja abierta, si no "Abre caja para poder cobrar el diagnóstico.".
- Vacío: "Sin cuentas abiertas."

---

## 5. REPORTES (`modules/reports/queries.ts`, `modules/dashboard/queries.ts`, `app/(dashboard)/reportes/**`)

Acceso: `app/(dashboard)/reportes/layout.tsx` exige `profit.view`
(`"No tienes permiso para ver esta sección."`). Tabs: Ventas, Cuentas por cobrar, Análisis 80/20,
Mapa de calor. Todos los rangos usan `startOfDay(from) = new Date("YYYY-MM-DDT00:00:00")` y
`endOfDay(to) = new Date("YYYY-MM-DDT23:59:59.999")` — **en la TZ del servidor**, no en la del
negocio (sólo el "hoy" por defecto se calcula con `todayInBusinessTz()`).

### 5.1 Ventas por vendedor — `getSalesReport(from, to)` (`/reportes/ventas`)

- Default: `from = to = hoy`. Atajos "Hoy" y "Este mes" (`YYYY-MM-01` → hoy).
- Propósito declarado: base para comisiones ("no calcula la comisión en sí").
- Dos fuentes, agrupadas por `advisorId` (`"sin_asignar"` → "Sin asignar"; id sin usuario → "Usuario eliminado"):
  1. `workOrder.groupBy(advisorId)` con `deletedAt null, createdAt ∈ rango`:
     `orderCount = _count`, `orderTotal = Σ saleNet`. **Se atribuye por fecha de creación de la
     orden y por `saleNet` (facturado), no por lo cobrado**; incluye órdenes canceladas si no están
     soft-deleted.
  2. `quote` con `status: "RECHAZADA"`, `deletedAt null`, `createdAt ∈ rango`:
     `diagnosticCount += 1`, `diagnosticTotal += versions(isCurrent).total`. Es el total de la
     **cotización** rechazada (no lo realmente cobrado por diagnóstico).
- Orden: desc por `orderTotal + diagnosticTotal`. Columnas: Vendedor, # Órdenes, Venta en órdenes,
  # Diagnósticos, Diagnósticos cobrados, Total; pie con sumas.

### 5.2 Mapa de calor — `getSalesHeatmap(from, to)` (`/reportes/mapa-calor`)

- Default: `from = inicio de mes`, `to = hoy`.
- Fuente: `Payment` `REGISTRADO` con `createdAt ∈ rango` (**cobros**, no facturación).
- Ejes: filas = **hora del día** (0–23), columnas = **día de la semana** (Domingo=0…Sábado=6 en
  datos; se muestra Lunes→Domingo, `DISPLAY_ORDER = [1,2,3,4,5,6,0]`). Día y hora se calculan con
  `Intl.DateTimeFormat` en `BUSINESS_TIMEZONE = "America/El_Salvador"` (`hourCycle: "h23"`).
- `grid[weekday][hour] += amount.toNumber()`; `maxValue` = celda máxima.
- Rango de horas mostradas: desde `max(0, minActiveHour − 1)` hasta `min(23, maxActiveHour)`; sin
  pagos, 7–19.
- Celda: fondo `rgba(37,99,235, opacity)` con `opacity = value/maxValue` (mínimo 0.15 si `value > 0`),
  texto `$` + `Math.round(value)`, tooltip `formatUSD(value)` o "Sin ventas".

### 5.3 Análisis 80/20 (Pareto) — `getProductAnalysis(from, to)` (`/reportes/analisis`)

- Default: inicio de mes → hoy.
- Fuente: `WorkOrderItem` cuya orden tiene `deletedAt null` y `createdAt ∈ rango` (facturado, no cobrado).
- Agrupa por `item.description` (texto exacto): `total += lineTotal`, `quantity += quantity`.
- `grandTotal = Σ total`; ordena desc por `total`; `pct = total / grandTotal × 100` (0 si
  grandTotal = 0); `cumulativePct` acumulado en ese orden.
- UI: Servicio/línea, Cantidad, Venta, % de venta (`toFixed(2)`), % acumulado con badge verde si
  `cumulativePct ≤ 80`.

### 5.4 Dashboard `/` (`app/(dashboard)/page.tsx`, `modules/dashboard/queries.ts`)

`startOfToday() = new Date(todayInBusinessTz() + "T00:00:00")` (fecha del negocio, hora local del
servidor). Sin límite superior (`gte` solamente).

| KPI (etiqueta) | Permiso para verlo | Fórmula exacta |
| --- | --- | --- |
| **Cobrado hoy** | `cash.view` | `getTodayIncome().total = Σ Payment(REGISTRADO, createdAt ≥ hoy).amount` |
| "$X en abonos" (subtexto) | `cash.view`, si > 0 | `advances = Σ amount where isAdvance` |
| Ingresos por método (hoy) | `cash.view` | `byMethod[method.name] = Σ amount` |
| **Facturado hoy** | `work_orders.view_prices` | `getTodayCostAndRevenue().revenue = Σ WorkOrder(deletedAt null, createdAt ≥ hoy).saleNet`; subtexto `orderCount` "orden(es) creada(s)" |
| **Costo estimado hoy** | `profit.view` | `cost = Σ_items (item.service?.internalCost ?? item.product?.cost ?? 0) × item.quantity` de esas órdenes (se recalcula del catálogo actual, no de `WorkOrderItem.unitCost`, que "no se llena") |
| **Utilidad estimada hoy** | `profit.view` | `profit = revenue − cost` |
| Movimientos de caja (hoy) | `cash.view` | `CashMovement createdAt ≥ hoy`, desc |
| Vehículos por recibir | `receptions.view` | `listWorkOrdersPendingReception()` = órdenes en status `recepcion_reparacion` |
| Cuentas abiertas | — (componente decide) | §4.2 |
| Productos bajo el mínimo | — | `Product ACTIVO, deletedAt null` con `stockOnHand ≤ minStock` |

Notas del código: el KPI de costo usa `profit.view` y no `cost.view` a propósito ("el rol inventario
también tiene cost.view… pero el vendedor NO debe ver utilidad"). "Facturado" no ve el asesor sin
`cash.view` pero sí ve lo facturado; técnico/jefe no ven ningún monto.

---

## 6. DINERO (`lib/money.ts`, schema)

- `DEFAULT_TAX_RATE = new Decimal("0.13")` (IVA 13%). `BusinessSettings.defaultTaxRate` default
  `0.1300`, `pricesIncludeTax: true`, `currency: "USD"`.
- **Decisión #1: los precios de catálogo incluyen IVA.** El desglose se calcula hacia atrás:
  `taxBreakdown(priceWithTax, taxRate = 0.13)`:
  - `base = price / (1 + rate)` → `toDecimalPlaces(2)` (redondeo por defecto de decimal.js, `ROUND_HALF_UP`)
  - `tax = price − base` → `toDecimalPlaces(2)` (el IVA se obtiene por diferencia para que
    `base + tax === total` exactamente)
  - `total = price.toDecimalPlaces(2)`
- Formato: `formatUSD(amount)` = `Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" })`
  sobre `Decimal(amount).toNumber()` (ej. `$1,234.50`). El ticket ESC/POS usa su propio
  `money()` = `"$" + value.toFixed(2)` sin separador de miles (`modules/printing/actions.ts`).
- Tipo `DecimalInput = Prisma.Decimal | number | string`.
- En la orden: `saleNet` es el total con IVA; `taxTotal` el IVA; "Subtotal (sin IVA)" impreso =
  `saleNet − taxTotal`; `discountTotal` se muestra si > 0 (se imprime como línea informativa; el
  cálculo del neto ya lo incluye).
- Sumas de dinero en servidor: siempre `Decimal.plus/minus/times/dividedBy`. En pantallas de
  reporte se suman `number` para pies de tabla (`toNumber()`), y el heatmap y el desglose de caja
  también usan `number` (sólo presentación).

---

## 7. IMPRESIÓN

### 7.1 Tres documentos HTML (ventana del navegador, `window.print()` automático al cargar)

Comunes: requieren sesión (`getCurrentUser()` o `redirect("/login")`); no chequean permiso
adicional; `notFound()` si no existe la entidad; `PrintButton` dispara `window.print()` en
`useEffect` y deja botón "Imprimir" de respaldo (`print:hidden`). Encabezado: logo `/logo.png`,
`printHeader.address`, `Tel: whatsapp · NIT: nit · NRC: nrc`, `Giro: giro` (datos en
`BusinessSettings.settings.printHeader`, seed: dirección "Paque Residencial San Luis, Local 6A, San
Salvador", WhatsApp 7742-1900, NIT 0614-070624-103-3, NRC 3446580, giro "Alquiler de equipo de
transporte terrestre"). Separación de ítems: `PART_TYPES = {"REPUESTO", "PRODUCTO"}` → tabla
"Repuestos"; todo lo demás → "Mano de obra"/"Trabajo a realizar".

**a) Comprobante de servicio / cuenta — `/imprimir/orden/[id]`** (`app/imprimir/orden/[id]/page.tsx`)

- Título "Comprobante de servicio" (verde), `workOrder.number`, Fecha (`formatDate(createdAt)`).
- Cliente: Nombre, Teléfono. Vehículo: Marca/Modelo, Año, Placa, Km (`currentMileage`).
- Tabla Repuestos (Repuesto, Cant., P.Unit., Total) y Mano de obra (Trabajo, Cant., Precio, Total).
- Totales: Subtotal repuestos, Subtotal mano de obra, Subtotal (sin IVA) = `saleNet − taxTotal`,
  IVA (13%) = `taxTotal`, Descuento (si > 0, con signo "-"), TOTAL = `saleNet`.
- "Pagos recibidos": No. (`payment.number`), Método (+ ` — banco`), Fecha, Monto; o "Sin pagos registrados todavía."
- "SALDO PENDIENTE $X" si `balance > 0`, si no "Pagado en su totalidad".
- Firmas: "Entregado por" / "Recibido conforme".
- Pie legal: **"Comprobante de servicio — no sustituye documento tributario electrónico."**
- NO imprime: costos internos, `internalNotes`, técnico asignado, diagnóstico, `transferRef`,
  pagos anulados, proveedor de repuestos.

**b) Cotización — `/imprimir/cotizacion/[id]`** (`app/imprimir/cotizacion/[id]/page.tsx`)

- Título "Cotización" (naranja), `quote.number`, Fecha. Cliente y Vehículo igual que arriba.
- Bloque "Diagnóstico: …" si `quote.diagnosis`.
- Tabla Repuestos incluye columna **Proveedor** (`item.supplierNote ?? "--"`); subtotal al pie de
  cada tabla. Usa la `QuoteVersion` con `isCurrent: true`.
- Totales: Subtotal repuestos, Subtotal mano de obra, Subtotal (sin IVA) = `version.subtotal`, IVA
  (13%) = `version.taxTotal`, Descuento si > 0, **TOTAL A PAGAR** = `version.total`.
- Firmas: "Elaborado por" / "Aceptado por el cliente".
- Pie: **"Garantía de {laborWarrantyDays} días · Torno incluido cuando sea necesario"**
  (`BusinessSettings.laborWarrantyDays`, default 45) y
  **"Precios válidos 10 días · Pueden variar según mercado y proveedor · No representa factura."**
- NO imprime: costos, decisiones por línea (aprobado/rechazado), historial de versiones.

**c) Orden de trabajo interna — `/imprimir/orden-trabajo/[id]`** (`app/imprimir/orden-trabajo/[id]/page.tsx`)

- Para el técnico. Encabezado reducido: dirección y `WA: whatsapp` (sin NIT/NRC/giro).
- Título "Orden de trabajo", número, fecha, Cliente (nombre, teléfono), Vehículo (marca/modelo,
  año, placa, km), "Diagnóstico:" (de `workOrder.quote.diagnosis`), "Técnico(s) asignado(s)"
  (`assignments[].technician.displayName`, orden `assignedAt asc`).
- Tablas Repuestos (Repuesto, Cant.) y "Trabajo a realizar" (Descripción, Cant.) — **sin precios**.
- Caja "Notas" vacía (rectángulo punteado), firmas "Asignado a" / "Control de calidad".
- Pie: **"Orden de trabajo interna — no incluye precios ni es comprobante de pago."**

### 7.2 Ticket térmico ESC/POS — `printWorkOrderTicket(workOrderId)` (`modules/printing/actions.ts`)

- Requiere usuario (`"Sesión no válida"`); **no chequea permiso** (la UI lo muestra a quien tiene
  `payments.register` en tarjetas y a quien ve pagos en el detalle). Orden inexistente:
  `"Orden de trabajo no encontrada"`.
- Se imprime **sin acentos ni ñ**: `stripAccents()` = `normalize("NFD")` + quitar `U+0300–U+036F`
  (por tabla de códigos de la impresora). Sólo afecta el papel.
- Contenido (ancho `TICKET_WIDTH = 42` columnas, `lib/escpos.ts`):
  1. `CMD.init`, centrado, `CMD.big` + `commercialName` (default "ELITE SERVICE"), dirección,
     `TEL: whatsapp`, `legalName` en mayúsculas, `NIT:`, `NRC:`, `Giro:`; divisor.
  2. `Fecha: createdAt.toLocaleString("es-SV")` (TZ del servidor), `Atendio: user.fullName` (quien
     imprime, no el asesor), `Orden No:`, `Cliente:`, `Vehiculo: make model`, `Placa:`; divisor.
  3. Líneas `qty x descripcion … $total` (`twoCol`: recorta la izquierda con "…" si no cabe, la
     derecha nunca se corta); divisor.
  4. `Subtotal (sin IVA)`, `IVA (13%)`, `Descuento -$X` si > 0, **`Total`** en negrita; divisor.
  5. "Pagos realizados": `metodo … $monto` por cada pago REGISTRADO (sin número ni fecha ni banco).
  6. `SALDO PENDIENTE $X` (negrita) si `balance > 0`, si no centrado `TOTAL PAGADO: $X`.
  7. Pie centrado: línea de `*`×42, **"TODOS LOS MONTOS EN USD"**, `*`×42, "Gracias por tu compra!",
     "Comprobante de servicio", "No sustituye documento", "tributario electronico".
  8. `CMD.feed(3)` + `CMD.cut`.
- Comandos ESC/POS (`lib/escpos.ts`): `init = ESC @`, `alignLeft/Center/Right = ESC a 0/1/2`,
  `bold(on) = ESC E 1/0`, `big = ESC ! 0x18` (doble alto+ancho), `normal = ESC ! 0x00`,
  `feed(n) = "\n"×n`, `cut = GS V 0x41 0x03` (corte parcial con avance). `centered()`, `divider()`
  (`-`×width), `twoCol(left, right, width)`.
- **Cola**: `payload = Buffer.from(t, "binary").toString("base64")`;
  `printJob.create({ workOrderId, payload })` (`status` default `PENDIENTE`). Luego la acción
  **espera** hasta `MAX_WAIT_MS = 15000` sondeando cada `POLL_MS = 1000`:
  - `IMPRESO` → `{ success: true }` (UI: "Enviado").
  - `ERROR` → `{ error: job.error ?? "La impresora no pudo imprimir el ticket" }`.
  - timeout → `"La computadora del taller no respondió. Verificá que el agente de impresión esté encendido."`
    (el job queda `PENDIENTE` y se imprimirá igual cuando el agente vuelva; no se cancela).
- `PrintJob { workOrderId?, payload, status: PENDIENTE|IMPRESO|ERROR, error?, createdAt, completedAt? }`.
  No hay reimpresión explícita ni `AuditAction.REIMPRESION` en uso; cada clic crea un job nuevo.

### 7.3 API para el agente (`app/api/print-jobs/route.ts`, `app/api/print-jobs/[id]/complete/route.ts`)

- Ambas exigen header `x-agent-token === process.env.PRINT_AGENT_TOKEN`; si no:
  `401 { error: "No autorizado" }`. **`PRINT_AGENT_TOKEN` no está en `.env.example`** (sólo
  `DATABASE_URL` y `SESSION_SECRET`).
- `GET /api/print-jobs`: hasta 10 jobs `PENDIENTE` (`createdAt asc`), `{ id, payload }`. No marca
  "en proceso": si dos agentes sondean, ambos imprimen.
- `POST /api/print-jobs/{id}/complete` body `{ status?: "ERROR", error?: string }`: `status` =
  `"ERROR"` si viene así, cualquier otra cosa → `"IMPRESO"`; `error` recortado a 500 chars;
  `completedAt = now`. Job inexistente: `404 { error: "Trabajo no encontrado" }`. Responde `{ ok: true }`.

### 7.4 Agente local (`printer-agent/print-agent.js`, `iniciar.bat`, `README.md`)

- Node ≥ 18, sin dependencias (`net` + `fetch`). Corre en una PC del taller en la misma LAN que la
  impresora; la PC sale hacia Vercel, no hay puertos entrantes.
- Config por env (o defaults en el .bat): `APP_URL` (default `https://elite-service-taller.vercel.app`),
  `PRINT_AGENT_TOKEN` (placeholder `PEGA_AQUI_EL_TOKEN`), `PRINTER_IP` (default `192.168.3.113`),
  `PRINTER_PORT` (default `9100`, raw TCP/JetDirect).
- Loop: `pollOnce()` cada `POLL_MS = 3000` (`setTimeout` recursivo; errores de red se loguean y sigue).
  Por job: `Buffer.from(payload, "base64")` → `sendToPrinter` (socket TCP, `setTimeout(5000)`,
  `write` + `end`; timeout → `Error("La impresora no respondió a tiempo")`) → `reportResult(id, "IMPRESO")`
  o `reportResult(id, "ERROR", err.message)`. Si HTTP no ok al sondear:
  `"Error consultando trabajos pendientes (HTTP ${status}). ¿Token correcto?"`.
- `iniciar.bat`: setea las 4 variables y ejecuta `node print-agent.js`; `pause` al salir. README:
  instalación única, dejar la ventana abierta, opcional en `shell:startup`, y troubleshooting
  ("No autorizado" = token; "La impresora no respondió a tiempo" = red/IP; el botón espera 15 s).
- Ancho de papel: `BusinessSettings.ticketWidthMm = 80` (no se lee en código); el ancho real que
  manda es `TICKET_WIDTH = 42` columnas (comentario: fuente A en 80 mm suele dar 48, se dejó 42 "por
  seguridad hasta confirmar").

---

## 8. AUTENTICACIÓN Y PERMISOS

### 8.1 Login por código (PIN) — `app/login/actions.ts:login`, `app/login/page.tsx`

- **No hay usuario+contraseña.** Un solo campo `code`. Vacío: `"Ingresa tu código"`.
- Recorre **todos** los `User` con `status: "ACTIVO", deletedAt: null` y hace
  `bcrypt.compare(code, user.passwordHash)`; el primero que coincide entra. Si ninguno:
  `"Código incorrecto"`. Consecuencia: el código debe ser único entre cuentas activas (lo garantiza
  `changeUserCode`, ver 8.5). El hash es bcrypt cost 10 del PIN.
- UI: teclado numérico de 12 teclas (`1–9`, vacío, `0`, `del`), 4 puntos indicadores; **auto-submit
  al cuarto dígito** (`requestSubmit()` cuando `code.length === 4 && !pending`); al fallar limpia el código.
  Texto: "Introduzca el código de usuario". El `<input hidden name="code">`; no hay límite de intentos
  ni rate limit ni `AuditLog LOGIN`.
- Al entrar: cookie de sesión + `user.lastLoginAt = now` + `redirect("/")`.

### 8.2 Sesión — `lib/session.ts`, `lib/auth.ts`

- Cookie `elite_session` (`SESSION_COOKIE_NAME`), `httpOnly`, `sameSite: "lax"`,
  `secure` sólo en producción, `path: "/"`, `maxAge = SESSION_TTL_SECONDS = 8 h`.
- Token = `` `${userId}.${expiresAt}.${hmacSha256(SESSION_SECRET, `${userId}.${expiresAt}`)}` `` (hex).
  `verifySessionToken`: 3 partes, compara firma con `timingSafeEqual`, rechaza si
  `Date.now() > expiresAt`. Sin `SESSION_SECRET` lanza `"Falta SESSION_SECRET en el entorno"`.
- **No hay tabla `Session` en BD**: la sesión es stateless (no se puede revocar del lado servidor
  salvo desactivando al usuario). Expira a las 8 h desde el login; no se renueva con actividad.
- `getCurrentUser()` (cacheado por request con `react.cache`): lee cookie → verifica → carga `User`
  con `userRoles.role.rolePermissions.permission` y `directPermissions.permission`. Devuelve `null`
  si no existe, `status !== "ACTIVO"` o `deletedAt` (desactivar al usuario invalida su sesión al
  siguiente request). Retorna `{ id, fullName, email, permissions: Set<string> }`.
- `logout()`: borra la cookie y redirige a `/login`.
- Guard de rutas: `app/(dashboard)/layout.tsx` hace `redirect("/login")` si no hay usuario; las
  páginas `/imprimir/**` lo hacen individualmente. **No hay `middleware.ts`.**

### 8.3 Idle lock — `components/idle-lock.tsx`, `unlockSession`

- Montado en `DashboardShell` para todo el panel. `IDLE_MS = 60_000` (**1 minuto**).
- Actividad = `mousemove, mousedown, keydown, touchstart, scroll, wheel` (listeners pasivos).
  Un `setInterval` de 2 s compara `Date.now() − lastActivity ≥ IDLE_MS` (funciona aunque la pestaña
  estuviera en segundo plano). Al desbloquear se reinicia el reloj.
- Overlay `fixed inset-0 z-50` "Sesión bloqueada" — "{userName}, ingresa tu código para continuar",
  mismo teclado de 4 dígitos con auto-submit. Es **sólo visual/cliente**: la cookie sigue válida; el
  bloqueo no invalida nada en servidor.
- `unlockSession(prev, formData)`: `code` debe ser `/^\d{4}$/` (`"Ingresa tu código de 4 dígitos"`);
  si no hay sesión → `redirect("/login")`; compara `bcrypt.compare(code, fullUser.passwordHash)`
  **del mismo usuario logueado** (no cambia de usuario); mal código: `"Código incorrecto"`. Éxito
  `{}` → `setLocked(false)`.
- Enlace "No soy yo — salir y cambiar de usuario" → `logout()`.

### 8.4 Resolución de permisos (Decisión #3 del legado)

- **Por usuario, no por rol**: `permissions = ⋃ rolePermissions de todos sus roles` ∪
  `directPermissions(granted = true)` − `directPermissions(granted = false)`. La revocación directa
  gana sobre cualquier rol.
- `hasPermission(key)` = `user.permissions.has(key)`; `false` sin sesión.
- `Permission { key @unique (module.action), module, action, name }`, `Role { key, name, isSystem }`,
  `UserRole`, `RolePermission`, `UserPermission { granted }`.
- La navegación (`components/layout/sidebar.tsx`, `NAV_LINKS`) filtra por permiso:
  `/`→ninguno, `/clientes`→`customers.view`, `/vehiculos`→`vehicles.view`, `/recepcion`→`receptions.view`,
  `/servicios`→`services.view`, `/cotizaciones`→`quotes.view`, `/ordenes`→`work_orders.view`,
  `/inventario`→`inventory.view`, `/caja`→`cash.view`, `/gastos`→`expenses.view`,
  `/reportes/ventas`→`profit.view`, `/recordatorios`→`reminders.view`, `/usuarios`→`users.view`.
  Botón "Nueva recepción" → `receptions.view`. **Ocultar en el menú no protege la ruta**: varias
  páginas (p. ej. `/caja`, `/caja/[id]`, `/gastos`, `/usuarios`, `/recordatorios`,
  `/reportes/cuentas-por-cobrar` fuera del layout) no re-chequean permiso de lectura; sí lo hacen las
  server actions de escritura y `/caja/transacciones` y `/reportes/*` (layout).

**Claves usadas en el código de este bloque** (`hasPermission`/`userHasPermission`/sidebar):
`payments.register`, `payments.void`, `payments.view`, `payments.diagnostic_override`, `cash.view`,
`cash.open`, `cash.close`, `expenses.create`, `expenses.authorize`, `expenses.view`, `profit.view`,
`work_orders.view_prices`, `receptions.view`, `reminders.manage`, `reminders.view`, `users.update`,
`users.view`. Definidas en seed pero **sin uso en código**: `cash.reopen`, `cash.movement`,
`tax_docs.view`, `tax_docs.link`, `reports.view`, `reports.financial`, `reports.export`,
`commissions.*`, `goals.*`, `audit.view`, `settings.*`, `users.create`, `users.deactivate`, `roles.manage`.

### 8.5 Cambio de código — `modules/users/actions.ts:changeUserCode(userId, prev, formData)`

- Permiso `users.update` (`"No tienes permiso para cambiar códigos de usuario"`). Seed: gerente, superadmin.
- `code` debe ser `/^\d{4}$/`: `"El código debe ser de 4 dígitos"`.
- **Unicidad**: compara contra el hash de cada usuario `ACTIVO` no borrado distinto de `userId`;
  si coincide: `` `Ese código ya lo usa ${u.fullName}. Elige otro.` ``.
- `passwordHash = bcrypt.hash(code, 10)`. No pide el código anterior, no invalida sesiones abiertas,
  no audita. Cualquier usuario con `users.update` puede cambiar el código de cualquier otro (incluido
  superadmin). UI: `/usuarios` tabla Nombre, Correo, Roles, y `ChangeCodeForm` (input password
  numérico `maxLength 4`) si `users.update`.
- `listUsers()`: sólo `ACTIVO` no borrados, con roles. No hay alta/baja de usuarios ni edición de
  roles/permisos en la UI (`users.create`, `users.deactivate`, `roles.manage` sin uso).

### 8.6 Roles del seed (`prisma/seed.ts`)

`superadmin` (ALL), `gerente`, `asesor`, `tecnico`, `inventario`, `cajero`, `carwash`,
`jefe_mecanicos`, `auditor`. Puntos relevantes a dinero:

- `cajero`: `cash.view/open/close/movement`, `payments.view/register`, `tax_docs.*`,
  `expenses.view/create`, ve precios y todas las órdenes. **No** `payments.void`, no `cost/profit`.
- `gerente`: `payments.view`, `payments.void`, `cash.view`, `cash.reopen`, `expenses.*`,
  `cost.view`, `profit.view`, reportes… **No** `payments.register`, `cash.open`, `cash.close`,
  `work_orders.void`, `payments.diagnostic_override`.
- `asesor`: sin ningún permiso de caja/pagos/gastos; ve precios; `reminders.*`.
- `tecnico`/`jefe_mecanicos`: sin precios ni dinero.
- `auditor`: lectura de pagos/caja/gastos/costos/utilidades.
- Usuarios base: `admin` y `kevin` (superadmin), `fausto` (asesor + cajero + gerente: "cotiza,
  cobra, ve costos y hace cierres"), `vendedor` (asesor + inventario), `jefe.mecanicos`. Cuenta
  `gerente@eliteservice.sv` desactivada (`INACTIVO`) en vez de borrada por FK `CashSession.cashierId`.
  El seed no pisa `passwordHash` en `update` (cambios de código sobreviven al re-seed).

---

## 9. RECORDATORIOS (`modules/reminders/*`, `app/(dashboard)/recordatorios/**`)

- Modelo `Reminder { type, status, customerId?, vehicleId?, dueDate?, dueMileage?, message?, createdById? }`.
  Enum `ReminderType`: `FECHA, KILOMETRAJE, SERVICIO, PROX_MANTENIMIENTO, TRABAJO_RECHAZADO, RECOMENDACION, GARANTIA, CUENTA_COBRAR, PROMESA_PAGO`.
  Enum `ReminderStatus`: `PENDIENTE, EN_SEGUIMIENTO, COMPLETADO, DESCARTADO`.
- **Qué los genera** (únicos dos lugares en código):
  1. `modules/approvals/actions.ts` (registro de aprobación del cliente): si la cotización queda
     `RECHAZADA` → `type: "TRABAJO_RECHAZADO"`, `customerId`, `vehicleId`,
     `message: "Cotización ${quote.number} rechazada — dar seguimiento"`, **sin `dueDate`**.
  2. `modules/payments/actions.ts:collectPayment`: si `method.isCredit` → `type: "CUENTA_COBRAR"`,
     `dueDate = now + 30 días`, `message: "${payment.number} — ${workOrder.number}: crédito 30 días por ${amount}"`.
  No hay creación manual ni por kilometraje/mantenimiento/garantía.
- **Vencimiento**: `isOverdue(dueDate)` (`lib/dates.ts`) = `dueDate < now`. En la tabla, la columna
  "Vence" se pinta en rojo con sufijo " · Vencido". Sin `dueDate` → "—" y nunca vence.
- `listPendingReminders()`: `status ∈ {PENDIENTE, EN_SEGUIMIENTO}`, con cliente y vehículo,
  `createdAt desc`. Nadie pone `EN_SEGUIMIENTO` ni `DESCARTADO` en código.
- **Completar** — `completeReminder(reminderId)`: permiso `reminders.manage`
  (`"No tienes permiso para gestionar recordatorios"`); `status = "COMPLETADO"`. Botón "Marcar como
  contactado". No pide nota ni audita. No se puede reabrir.
- Pantalla `/recordatorios`: "Recordatorios / Seguimiento" — "Clientes que se fueron sin aprobar una
  cotización, u otros pendientes de contacto." Columnas Tipo (labels: Fecha, Kilometraje, Servicio,
  Próximo mantenimiento, Cotización rechazada, Recomendación, Garantía, Cuenta por cobrar, Promesa de
  pago), Cliente (link), Vehículo (link), Nota, Fecha, Vence. Vacío: "Sin pendientes de seguimiento."

---

## 10. Reglas de negocio extraídas

### Cobros
1. Registrar cualquier cobro exige el permiso `payments.register`.
2. No se puede registrar ningún cobro (orden, diagnóstico de cotización o de recepción) sin una `CashSession` en estado `ABIERTA`; el pago se asocia a esa sesión.
3. Un cobro contra orden sólo se acepta si `workOrder.status.order ≥ order` del status `listo` ("Listo para entrega").
4. El saldo de una orden es `saleNet − Σ Payment.amount` con `status = REGISTRADO`; los pagos `ANULADO` no cuentan en ningún cálculo.
5. Si el saldo de la orden es ≤ 0, no se acepta otro cobro ("Esta orden ya está pagada").
6. El monto cobrado debe ser > 0 y ≤ saldo pendiente; el sobrepago se rechaza.
7. Si el monto viene vacío, se cobra el saldo completo.
8. Un cobro con monto < saldo es un abono: `Payment.isAdvance = true` y `CashMovement.type = ANTICIPO`; si cubre el saldo, `isAdvance = false` y `type = VENTA_COBRADA`.
9. Cada pago genera exactamente un `CashMovement` en la sesión abierta con `reference` = número de la orden/cotización/recepción.
10. Cada pago contra orden genera una `PaymentAllocation` por el 100% del monto a esa misma orden.
11. Los números de pago son `PAG-` + contador global de 6 dígitos (`count(payment)+1`).
12. El banco (`bankName`) se pide en la UI sólo cuando el método es `transferencia`, elegido de la lista fija `BANKS` (Banco Agrícola, Banco de América Central, Banco Hipotecario, Banco Azul); el servidor lo guarda sin validar.
13. `transferRef` es una referencia de texto opcional para cualquier método.
14. Cobrar con un método `isCredit` ("Crédito 30 días") se registra como cobro normal y además crea un `Reminder` `CUENTA_COBRAR` con `dueDate = hoy + 30 días`.
15. Cuando el saldo de una orden no terminal llega a 0, la orden pasa automáticamente al status `cerrado`, se fija `deliveredAt` si estaba vacío, se registra historial "Cerrada automáticamente al completar el pago" y se liberan las reservas de inventario.
16. La cuota de diagnóstico de cotización sólo se puede cobrar si `quote.status = RECHAZADA`; el monto sugerido es la suma de líneas de servicios tipo `DIAGNOSTICO` de la versión vigente; no hay tope ni control de duplicados.
17. La cuota de diagnóstico de recepción sólo se cobra si la recepción no tiene ningún pago REGISTRADO previo.
18. La cuota de diagnóstico de recepción exige un código de 4 dígitos de un usuario ACTIVO distinto que tenga `payments.diagnostic_override`; el nombre del autorizador queda en `Payment.notes`.
19. Cobrar el diagnóstico de una recepción no cambia el estado de la recepción (sigue pendiente de cotizar).
20. Anular un pago exige `payments.void` y un motivo no vacío.
21. Un pago anulado no se borra: pasa a `ANULADO`, genera un `CashMovement DEVOLUCION` con monto negativo en su sesión original (aunque esté cerrada) y un `AuditLog ANULAR` con `beforeData` y `reason`.
22. Anular un pago no reabre la orden ni recalcula un `DailyClosure` ya existente.
23. No hay límite temporal ni de estado de caja para anular un pago.

### Caja
24. Abrir caja exige `cash.open`; cerrar exige `cash.close`; quien cierra no tiene que ser quien abrió.
25. Sólo puede existir una `CashSession` `ABIERTA` por caja física (`cash_register_main`); el intento repetido devuelve "Ya hay una caja abierta por {cajero}".
26. La apertura registra `openingFloat` (monto inicial; default 0) y `cashierId` = usuario que abre.
27. Al cerrar: `expectedCash = openingFloat + Σ pagos con método isCash − Σ gastos no anulados de la sesión`.
28. Al cerrar: `difference = countedCash − expectedCash` (positivo = sobrante).
29. Al cerrar se guardan totales del sistema por grupo (`tarjeta`, `transferencia`, "otros" = resto no efectivo) y el conteo manual de cada uno, con su diferencia `contado − sistema`.
30. Al cerrar, `withdrawalTotal` y `refundTotal` se guardan siempre en 0; las `DEVOLUCION` no afectan el cierre.
31. Una caja `CERRADA` no puede cerrarse de nuevo ("Esta caja ya está cerrada") y no existe función de reapertura.
32. No existen movimientos manuales de caja (retiro, ingreso extra, depósito).
33. La vista Transacciones agrupa cobros REGISTRADO por rango de fechas y método, sin depender de la sesión de caja.

### Gastos
34. Registrar un gasto exige `expenses.create` y una caja abierta; el gasto queda ligado a esa sesión.
35. Un gasto requiere descripción no vacía y monto > 0; categoría y N° de documento son opcionales.
36. Todo gasto nace `PAGADO` y se asume pagado en efectivo: reduce el efectivo esperado del cierre de su sesión; no crea `CashMovement`.
37. Anular un gasto exige `expenses.authorize`, sólo es posible mientras su caja siga `ABIERTA`, es un soft delete (`deletedAt`) y no pide motivo.
38. La pantalla de gastos sólo lista los de la caja abierta; el histórico se consulta por sesión en `/caja/[id]`.

### Cuentas por cobrar
39. Cuentas por cobrar = toda `WorkOrder` no borrada, de cualquier estado y fecha, con `saleNet − Σ pagos REGISTRADO > 0`.
40. Las tablas `Receivable`, `ReceivablePayment`, `Refund`, `CustomerCreditProfile` y `ExternalTaxDocument` existen en el schema pero ningún flujo las escribe.

### Reportes y dashboard
41. Los reportes están detrás de `profit.view` (layout de `/reportes`).
42. Ventas por vendedor atribuye a `WorkOrder.advisorId` la suma de `saleNet` de órdenes creadas en el rango (facturado, no cobrado) y a `Quote.advisorId` el `total` de la versión vigente de cotizaciones RECHAZADA creadas en el rango.
43. El mapa de calor suma `Payment.amount` REGISTRADO por (día de semana × hora) en la zona `America/El_Salvador`; muestra Lunes→Domingo y sólo el rango horario con actividad (−1 h), o 7–19 si no hay datos.
44. El análisis 80/20 agrupa `WorkOrderItem.lineTotal` por `description` exacta para órdenes creadas en el rango, ordena desc y acumula porcentaje; ≤ 80% acumulado se resalta.
45. Los rangos de reportes se construyen con `T00:00:00`/`T23:59:59.999` en la TZ del servidor; sólo el "hoy" por defecto usa la TZ del negocio.
46. Dashboard "Cobrado hoy" = Σ pagos REGISTRADO con `createdAt ≥ hoy 00:00` (TZ negocio); visible con `cash.view`; se desglosa "en abonos" (`isAdvance`) y por método.
47. Dashboard "Facturado hoy" = Σ `saleNet` de órdenes creadas hoy; visible con `work_orders.view_prices`.
48. Dashboard "Costo estimado hoy" = Σ (`service.internalCost` ?? `product.cost` ?? 0) × `quantity` de las líneas de esas órdenes, y "Utilidad estimada" = facturado − costo; ambos sólo con `profit.view`.
49. "Productos bajo el mínimo" = productos ACTIVO con `stockOnHand ≤ minStock`.

### Dinero
50. Los precios incluyen IVA 13%; el desglose es `base = round2(precio / 1.13)`, `iva = round2(precio − base)`.
51. Todo cálculo monetario persistido usa `Prisma.Decimal` (12,2); la moneda es USD y se formatea con `Intl.NumberFormat("es-SV", currency USD)`.

### Impresión
52. Existen tres impresiones HTML (comprobante de servicio, cotización, orden de trabajo interna) y un ticket ESC/POS; todas exigen sesión iniciada y ninguna exige un permiso específico.
53. La orden de trabajo interna nunca imprime precios ni pagos; la cotización y el comprobante sí imprimen precios y nunca imprimen costos internos.
54. Repuestos/productos (`type ∈ {REPUESTO, PRODUCTO}`) se listan en tabla "Repuestos"; el resto en "Mano de obra"/"Trabajo a realizar".
55. El comprobante y el ticket imprimen sólo pagos REGISTRADO y muestran "SALDO PENDIENTE" si saldo > 0, o "Pagado en su totalidad"/"TOTAL PAGADO".
56. Leyendas obligatorias: comprobante "Comprobante de servicio — no sustituye documento tributario electrónico."; cotización "Garantía de {laborWarrantyDays} días · Torno incluido cuando sea necesario" y "Precios válidos 10 días · Pueden variar según mercado y proveedor · No representa factura."; orden interna "Orden de trabajo interna — no incluye precios ni es comprobante de pago."; ticket "TODOS LOS MONTOS EN USD" y "Comprobante de servicio / No sustituye documento / tributario electronico".
57. El ticket se imprime sin acentos ni ñ, a 42 columnas, con cabecera del negocio (`commercialName`, dirección, TEL, `legalName`, NIT, NRC, Giro) y quien imprime como "Atendio".
58. Imprimir en ticketera crea un `PrintJob PENDIENTE` (payload ESC/POS en base64) y espera hasta 15 s (sondeo cada 1 s) el resultado `IMPRESO`/`ERROR`; si no hay respuesta informa que el agente no respondió y el job queda pendiente.
59. El agente local sondea `GET /api/print-jobs` cada 3 s con header `x-agent-token = PRINT_AGENT_TOKEN`, toma hasta 10 jobs PENDIENTE en orden de creación, los envía por TCP a `PRINTER_IP:9100` con timeout de 5 s y reporta `POST /api/print-jobs/{id}/complete` con `IMPRESO` o `ERROR` + mensaje.
60. Las rutas del agente responden 401 "No autorizado" sin el token correcto; el token no está documentado en `.env.example`.

### Autenticación y permisos
61. El login es sólo por código numérico de 4 dígitos; se compara con bcrypt contra todos los usuarios ACTIVO y entra el primero que coincide.
62. El código de usuario debe ser único entre cuentas activas; cambiarlo exige `users.update`, 4 dígitos exactos y rechaza códigos ya usados por otra cuenta activa.
63. La sesión es una cookie `elite_session` httpOnly, firmada HMAC-SHA256 con `SESSION_SECRET`, con vencimiento fijo de 8 h desde el login y sin renovación por actividad.
64. Un usuario `INACTIVO` o borrado deja de tener sesión válida en el siguiente request, aunque su cookie no haya vencido.
65. Tras 60 s sin actividad (mouse, teclado, touch, scroll) el panel se bloquea en cliente; se desbloquea con el código del mismo usuario (bcrypt) o se cierra sesión con "No soy yo".
66. Los permisos efectivos de un usuario son la unión de los permisos de todos sus roles, más los concedidos directamente, menos los revocados directamente; la autorización siempre es por clave `module.action`.
67. El menú lateral oculta secciones por permiso `*.view`, pero varias páginas de lectura no vuelven a verificar el permiso en servidor; todas las server actions de escritura sí lo hacen.
68. Sólo `superadmin` (permisos ALL) tiene `payments.diagnostic_override`; `payments.void` lo tienen `gerente` y `superadmin`; `payments.register`/`cash.open`/`cash.close` los tiene `cajero` (y superadmin), no el rol `gerente`.

### Recordatorios
69. Un recordatorio se crea automáticamente al rechazar una cotización (`TRABAJO_RECHAZADO`, sin fecha de vencimiento) y al cobrar con método a crédito (`CUENTA_COBRAR`, vence en 30 días); no hay creación manual.
70. Un recordatorio está vencido si `dueDate < ahora`; sin `dueDate` nunca vence.
71. Se listan los recordatorios `PENDIENTE` o `EN_SEGUIMIENTO`; completarlos exige `reminders.manage` y los pasa a `COMPLETADO` sin nota ni vuelta atrás.
