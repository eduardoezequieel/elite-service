# Lógica de negocio del legado

Este documento **no es una spec** y **no autoriza implementar nada**. Es el
rescate de lo que ya existía en los dos prototipos de los primos, para saber
qué hay, qué falta y qué no hay que copiar.

Identificadores en inglés tal cual el código. Texto de negocio en español.

**No re-extraigas los zips ni reescribas `docs/legacy/`** salvo que esos zips
cambien. Lo que ya se portó a este repo se anota en §2. Si una spec queda
`Terminada`, actualizá §2 en el mismo commit: columna "Este repo" y bitácora.

Estados en §2: `hecho` (spec NNN) · `parcial` (qué falta) · `no` · `no copiar`.

---

## 0. Cómo usarlo

| Pregunta | Dónde |
| --- | --- |
| Qué ya está en este repo (no volver a analizar) | [§2](#2-qué-hay-hoy-en-elite-service) |
| Qué construyeron y qué dejaron a medias | el resto de este archivo |
| Campos, enums, seed, migraciones del taller | [legacy/01-data-model.md](legacy/01-data-model.md) |
| Recepción → cotización → orden, acción por acción | [legacy/02-core-flow.md](legacy/02-core-flow.md) |
| Cobros, caja, gastos, reportes, impresión, login PIN | [legacy/03-money-reports.md](legacy/03-money-reports.md) |
| Inventario, catálogo, clientes, vehículos | [legacy/04-catalogs-inventory.md](legacy/04-catalogs-inventory.md) |
| Prototipo HTML del carwash (comisiones, tienda, PIN) | [legacy/05-carwash-erp.md](legacy/05-carwash-erp.md) |

Los extractos numeran reglas verificables contra el código (50 + 84 + 71 + 67 + 82).
Si una regla de este índice choca con un extracto, manda el extracto: se leyó el
código. Si el extracto choca con un `CLAUDE.md` del prototipo, manda el código.

---

## 1. Fuentes

Dos zips, septiembre 2026:

| Zip | Qué es | Stack | Persistencia |
| --- | --- | --- | --- |
| `elite-service-taller.zip` | App del taller, la más grande | Next.js App Router + Prisma + server actions | PostgreSQL, 78 modelos, 36 enums |
| `elite-service-erp.zip` | Prototipo del lavado | Un `index.html` (JS puro, ~1059 líneas) | `localStorage['elite_erp_state']` |

El producto actual (`elite-service` este repo) **no es un fork**. Es un
monorepo nuevo (Next.js + NestJS + `@elite/shared`) con auth, diseño, carwash
y clientes ya vivos. El legado es la memoria de negocio, no el código a portar.

---

## 2. Qué hay hoy en Elite Service

Fuente de verdad para agentes: **no reanalizar el legado** de una fila
`hecho`. Las filas `parcial` / `no` siguen descritas en §4–§8.

### 2.1 Bitácora de specs (este repo)

| Spec | Estado | Qué cubre del legado | Qué dejó afuera a propósito |
| --- | --- | --- | --- |
| [001-auth](../specs/001-auth.md) | Terminada | RBAC por `module.action`, usuarios, roles a demanda, cookie httpOnly | Login por PIN de 4 dígitos (taller) y PIN por acción (ERP). Acá: correo + contraseña. |
| [002-design-system](../specs/002-design-system.md) | Terminada | — (no es negocio) | — |
| [003-carwash](../specs/003-carwash.md) | Terminada | Ticket de lavado, catálogo con precio por tipo de carro, pista (empleado + PIN), cobro de un pago exacto, anulación `VOID` (no borrar), `WorkOrderAssignment` para comisión futura | Comisión, DTE, varios lavadores, tienda, insumos, máquinas, servicios `WORKSHOP` en UI, cotización. Caja pasó a 010. |
| [004-customers](../specs/004-customers.md) | Terminada | Alta/búsqueda de cliente (nombre + teléfono), ficha, carros, historial de lavados, match al vuelo en el ticket | Elegir carro del cliente en la ficha, merge de duplicados, historial de taller, más datos de contacto |
| [005-visual-redesign](../specs/005-visual-redesign.md) | Terminada | — (piel) | — |
| [006-change-own-password](../specs/006-change-own-password.md) | Terminada | Cambio de clave propia (001 lo había dejado fuera) | — |
| [007-unified-data-table](../specs/007-unified-data-table.md) | Terminada | — (UI) | — |
| [008-back-navigation](../specs/008-back-navigation.md) | Terminada | — (UI) | — |
| [009-carwash-commissions](../specs/009-carwash-commissions.md) | Terminada | Comisión por tramos del ERP, varios lavadores, reporte a pagar | Comisión al crear/listo, tienda, DTE, pagar al lavador dentro del sistema |
| [010-carwash-cash](../specs/010-carwash-cash.md) | Terminada | Turno de caja persistido, cobro atado, arqueo de efectivo | Reapertura, gastos, contar tarjeta, DTE, caja del taller |

### 2.2 Capacidades

| Capacidad | Este repo | Spec |
| --- | --- | --- |
| Auth oficina (correo + contraseña, sesión 8 h) | hecho | 001 |
| Auth pista (usuario + PIN, cookie propia) | hecho | 003 |
| RBAC dinámico, roles a demanda | hecho | 001 |
| Usuarios / roles (CRUD, matriz de permisos) | hecho | 001 |
| Empleados de pista | hecho | 003 |
| Clientes (nombre, teléfono, match, desactivar) | hecho | 003, 004 |
| Vehículos (placa única activa, tipo, dueño con historial) | hecho | 003, 004 |
| Catálogo de lavado + matriz por tipo de carro | hecho | 003 |
| Ticket de lavado `OPEN → READY → PAID \| VOID` | hecho | 003 |
| Cobro de lavado: un pago, total exacto, efectivo/tarjeta/transferencia | hecho | 003 |
| Anular lavado abierto/listo (no se borra; `PAID` no se anula) | hecho | 003 |
| Quién lavó (`WorkOrderAssignment`) | hecho, con comisión al cobrar | 003 RN-8, 009 |
| Elegir el carro del cliente desde la ficha | no | 004 lo dejó fuera |
| Fusionar clientes duplicados | no | 004 lo dejó fuera |
| Comisión de lavado (tramos §8.2) | hecho (al cobrar, no al crear) | 009 |
| Varios lavadores en el mismo ticket | hecho | 009 |
| Caja (abrir / cerrar / arqueo) | hecho | 010 |
| DTE / marca factura externa | no | 003 lo dejó fuera |
| Abonos, crédito, más de un pago | no | 003 lo dejó fuera |
| Servicios `WORKSHOP` en la UI | no | 003 lo dejó fuera |
| Recepción de taller | no | — |
| Cotización / aprobación por renglón | no | — |
| Orden de taller (diagnóstico o precio fijo) | no | — |
| Inspección, QC, bahías, citas | no | — |
| Inventario / reservas / consumo | no | — |
| Tienda / POS | no | — |
| Insumos, máquinas | no | — |
| Gastos | no | — |
| Impresión térmica / ESC/POS | no | — |
| Reportes (ventas, heatmap, 80/20, tablero) | no | — |
| Garantías, compras, crédito formal, metas | no | (en el taller legado: modelo sin UI) |

### 2.3 Modelo y permisos vivos

Prisma de este repo: `User`, `Role`, `Permission`, `Employee`, `Customer`,
`Vehicle`, `VehicleOwner`, `VehicleBodyType`, `ServiceCategory`, `Service`,
`ServicePrice`, `WorkOrder`, `WorkOrderItem`, `WorkOrderAssignment`,
`Payment`, `CashSession`. Área `CARWASH` \| `WORKSHOP` (la UI solo ofrece
CARWASH). Un pago por ticket, por el total exacto, atado a un turno de caja
(010).

Permisos: `users.read/manage`, `roles.read/manage`, `employees.read/manage`,
`customers.read/manage`, `vehicles.read/manage`, `services.read/manage`,
`carwash.read/manage/charge/cash/void`. Siempre por clave `module.action`.

Rutas vivas: `/login`, `/floor`, `/carwash`, `/carwash/cash`, `/customers`, `/settings/{users,roles,employees,catalog}`.

### 2.4 Decisiones del producto nuevo (no se revierten)

- Login de oficina por correo y contraseña, no por PIN de 4 dígitos.
- Dos mundos: `User` (oficina) y `Employee` (pista). No hay FK entre ellos.
- Roles creados a demanda; ningún nombre de rol en el código.
- El ERP no emite DTE: a lo sumo se concilia uno externo.
- Precios con IVA 13 % incluido, moneda USD, zona `America/El_Salvador`.
- Ticket de lavado: estados `OPEN/READY/PAID/VOID`, un pago exacto, con caja (010).
- Anular ≠ borrar. `PAID` no se anula en 003.
- `WorkOrder` + `area` se reutilizan para el taller; no se inventa otra entidad paralela (003).
- Nada se implementa sin spec aprobada.

---

## 3. Los dos sistemas y cómo se relacionan

```
                    ┌──────────────────────────┐
                    │   Cliente + Vehículo     │  (compartido)
                    └────────────┬─────────────┘
           ┌─────────────────────┴─────────────────────┐
           │                                           │
   TALLER (legado Next.js)                    CARWASH (legado HTML
   recepción → cotización →                   y spec 003 actual)
   aprobación → orden →                       ticket OPEN/READY/PAID
   consumo → cobro con caja                   sin cotización
           │                                           │
           └──────────────┬────────────────────────────┘
                          │
                     Caja / cobro
```

En el schema del taller, taller y carwash **comparten** cliente, vehículo,
recepción, orden y caja. Se distinguen por `BusinessArea` (`TALLER` |
`CARWASH` | …) en categoría, servicio, orden, gasto, checklist y comisión.
El rol sembrado `carwash` opera recepciones y órdenes pero **no cotiza**.

El prototipo HTML del lavado es un mundo aparte: no hay cotización, no hay
sesión, cada acción pide PIN, la comisión se congela al crear la orden.

El carwash de este repo (spec 003) reescribe ese prototipo con dos sujetos,
sesión de verdad y un ticket con líneas. **No** porta tienda, insumos,
máquinas ni el cálculo de comisión. `WorkOrderAssignment` queda asentado
"para comisiones futuras".

---

## 4. Taller: el caso

Un **caso** es la consola de un vehículo en visita: recepción + última
cotización + orden. Las pestañas (`case-tabs` / `quote-case-tabs`) cambian
según qué exista. Al perderse la pestaña activa, salta a la última.

### 4.1 Dos entradas

| Entrada | Condición | Resultado |
| --- | --- | --- |
| Servicio rápido (`ServiceCatalog.quickService = true`) | Precio fijo de folleto (aceite, frenos, GDI, afinado menor…) | Recepción **y** orden en el mismo acto, estado inicial `recibido` |
| Diagnóstico / alcance variable (`quickService = false`) | El precio no se sabe hasta cotizar | Recepción "pendiente de cotizar" (cuenta abierta). Los nombres van a `requestedServices` |

La clasificación quick vs diagnóstico la toma el **servidor** del catálogo,
nunca un flag del cliente.

Un vehículo **no puede tener dos cuentas abiertas**: hay cotización en estado
abierto, o recepción sin cotización ni orden.

### 4.2 Cadena, todos los eslabones opcionales hacia atrás

```
Cita? → Recepción? → Cotización? → Orden
```

Se puede abrir orden directa (rápidos) o cotizar sin recepción.
**Una cotización → máximo una orden** (`WorkOrder.quoteId @unique`).
**Una cita → máximo una recepción**. El módulo de citas **no está construido**.

### 4.3 Recepción

No tiene columna de estado. El estado es derivado:

- Pendiente de cotizar: sin quotes y sin workOrders.
- Con cotización / con orden.
- Diagnóstico cobrado: hay `Payment REGISTRADO` ligado a la recepción.

Campos de ficha (`fuelLevel`, `visitReason`, `symptoms`, `warningLights`,
`accessories`, `valuables`, `exteriorState`, `interiorState`, `existingDamage`,
`promisedAt`, `customerAccepted`) **se muestran y nadie los escribe**. Quedan
siempre vacíos. No hay edición, cierre ni soft-delete de recepciones.

Al crear: folio `REC-000001`, kilometraje del vehículo, fotos, inspección
opcional. Placa **exigida** si se va a generar orden.

### 4.4 Cotización

Estados que el código **escribe de verdad**:

```
createQuote → PREPARADA
sendQuote   → ENVIADA
submitApproval → APROBADA | PARCIALMENTE_APROBADA | RECHAZADA
                 (+ CONVERTIDA si crea la orden)
updateQuoteItems en APROBADA (sin orden) → vuelve a PREPARADA
```

Nadie escribe `BORRADOR` (default del schema), `VISTA`, `VENCIDA` ni
`CANCELADA`. `validUntil` se guarda (hoy + 10 días) y **no se aplica**: una
cotización vencida sigue bloqueando una cuenta nueva.

Aprobación **por renglón** (`PENDIENTE | APROBADO | RECHAZADO`). Sin firma,
sin código de 6 dígitos, sin términos: el modelo los tiene, la action no los
llena. Cada `submitApproval` agrega un registro; una parcial puede aprobarse
de nuevo.

Versiones: el modelo es versionado; el código **siempre** usa versión 1 y la
sobrescribe.

### 4.5 Orden de trabajo

Los estados **son datos**, no un enum. Tabla `WorkOrderStatus` con flags.
El código decide por `isInitial`, `isTerminal`, `requiresQc`,
`allowsConsumption`, `countsAsDelivered` — no por el `key`.

| key | label | order | flags que importan |
| --- | --- | --- | --- |
| `recibido` | Recibido | 10 | `isInitial` — nace acá la orden de recepción rápida |
| `diagnostico` | En diagnóstico | 20 | **nadie transiciona hacia acá** |
| `por_aprobar` | Esperando aprobación | 30 | **nadie transiciona hacia acá** |
| `aprobado` | Aprobado | 40 | `allowsConsumption` — **nadie transiciona hacia acá** |
| `recepcion_reparacion` | Recepción para reparación | 42 | nace acá la orden desde cotización aprobada |
| `lista_asignacion` | Lista para asignación | 46 | al guardar inspección de la orden |
| `en_proceso` | En proceso | 50 | al asignar el primer técnico |
| `control_calidad` | Control de calidad | 60 | `requiresQc` — **no hay checklist que lo satisfaga** |
| `listo` | Listo para entrega | 70 | a partir de acá se puede cobrar |
| `entregado` | Entregado | 80 | `countsAsDelivered` |
| `cerrado` | Cerrado | 90 | terminal + entregado |
| `cancelado` | Cancelado | 100 | terminal |

Flujo automático real:

```
recepcion_reparacion  --inspección-->  lista_asignacion
lista_asignacion      --técnico---->  en_proceso
cualquier no terminal --saldo 0---->  cerrado   (maybeAutoCloseWorkOrder)
```

El cierre automático **no exige** inspección ni `costsConfirmedAt`. Si nadie
confirmó consumo, las reservas se **liberan** (no se consumen) y el stock
físico nunca baja.

Cambio manual: la UI solo ofrece `control_calidad`, `listo`, `entregado`,
`cerrado`, `cancelado` (+ el actual). El servidor acepta cualquier
`statusId`. No valida orden ascendente ni `requiresQc`. Para salir de
`recibido` / `recepcion_reparacion` hace falta al menos una `Inspection`.
Para marcar entregado/cerrado a mano: saldo 0 **y** costos confirmados.

Líneas adicionales (servicio o repuesto) a una orden abierta: nacen
`isAdditional: true, approved: true`, **sin nueva aprobación del cliente**,
y suman al total. No se agregan en estado terminal.

Un técnico no se asigna dos veces a la misma orden. No hay des-asignación ni
límite de técnicos. Marcar línea hecha es un toggle y no mueve el estado.

Anular orden (`work_orders.void`): soft-delete, libera reservas, no revierte
pagos ni cotización. La cotización queda `CONVERTIDA` apuntando a la orden
anulada. La recepción de origen **no** vuelve a pendiente de cotizar.

### 4.6 Inspección

Plantilla = la primera con `status ACTIVO`. Ítems `ok | problema | null`.
El `required` de la plantilla es **solo visual**. El gate de estado pregunta
si existe **alguna** inspección de esa orden, no si está completa.

### 4.7 Totales

Precios de catálogo **incluyen IVA 13 %**. Desglose hacia atrás:
`base = round2(precio / 1.13)`, `iva = round2(precio − base)`.

Cotización: `lineTotal = qty × unitPrice − discount` (qty se redondea a
entero). El descuento global se resta del total **sin** recalcular IVA, así
que `subtotal + tax − discount ≠ total` cuando hay descuento global.

Orden: copia `lineTotal` de lo aprobado; líneas extra incrementan
`saleGross` / `taxTotal` / `saleNet`. Saldo = `saleNet − Σ pagos REGISTRADO`.

La cuota de diagnóstico es un **pago suelto** (contra cotización rechazada o
contra recepción). **Nunca se descuenta** de una orden posterior. El override
sin cotización pide el código de **otro** usuario con
`payments.diagnostic_override` (solo superadmin en el seed).

Costo interno (`confirmWorkOrderCosts`, permiso `profit.view`): "sin factura
externa" (costo 0) o costo ≥ 0 + número + proveedor (se crea si no existe).
Nunca se imprime al cliente. Margen mostrado = `saleNet − externalCost`.

### 4.8 Folios y fechas

Folios por `count() + 1` (pueden colisionar): `REC-`, `OT-`, `ES-AAAA-`,
`PAG-`, `PROV-`, `SRV-`, `CLI-`. Productos `PRD-` usan el máximo real.

Fechas en `America/El_Salvador`, locale `es-SV`. Plazos (10, 30 días) se
suman en milisegundos sobre `Date.now()`.

Etiqueta de vehículo: placa; si no, "marca modelo"; si no, "Sin placa".
Placa **no única ni obligatoria** en base; la orden sí la exige.

---

## 5. Taller: dinero

### 5.1 Cobros

Sin caja `ABIERTA` **no hay cobro ni gasto**. El pago se asocia a esa sesión.

Tres tipos:

1. Contra orden, solo si `status.order ≥ 70` (`listo`). Abonos permitidos
   (`isAdvance`, movimiento `ANTICIPO`). Sobrepago rechazado. Monto vacío =
   saldo completo. Saldo 0 → cierra la orden sola.
2. Cuota de diagnóstico de cotización `RECHAZADA`. Sin tope ni control de
   duplicados.
3. Cuota de diagnóstico de recepción, una sola vez, con override.

Métodos sembrados: efectivo, tarjeta, transferencia (4 bancos SV), crédito 30
días. El "crédito" es un cobro normal **más** un `Reminder CUENTA_COBRAR` a
30 días. **No usa** las tablas `Receivable` / `CustomerCreditProfile`.

Anular pago (`payments.void` + motivo): pasa a `ANULADO`, movimiento
`DEVOLUCION` negativo en la sesión **original** (aunque esté cerrada),
`AuditLog ANULAR`. No reabre la orden ni recalcula el cierre. Sin límite
temporal.

### 5.2 Caja

Una sola caja física (`cash_register_main`). Una sola sesión `ABIERTA`.
Apertura con `openingFloat`. Cierre:

```
expectedCash = openingFloat + efectivo cobrado − gastos de la sesión
difference   = countedCash − expectedCash
```

Se cuenta a mano también tarjeta / transferencia / otros. `withdrawalTotal` y
`refundTotal` se guardan siempre 0: las devoluciones **no** afectan el cierre.
No hay reapertura ni movimientos manuales (existen permiso y enum, no código).

Gastos: se asumen en efectivo, no generan `CashMovement`. Anulación = soft
delete, solo con caja abierta, **sin motivo**. IVA de gasto default 0.

### 5.3 Cuentas por cobrar vs cuentas abiertas

- **Cuentas por cobrar** (reporte): `saleNet − Σ pagos REGISTRADO` por orden.
  No lee la tabla `Receivable`.
- **Cuentas abiertas** (tablero y órdenes): órdenes no terminales +
  recepciones sin cotización ni orden, por antigüedad.

### 5.4 Reportes (ojo al eje de fecha)

| Reporte | Qué suma | Eje de fecha |
| --- | --- | --- |
| Ventas por vendedor | `saleNet` de órdenes + totales de cotizaciones rechazadas | creación |
| Análisis 80/20 | `WorkOrderItem.lineTotal` agrupado por `description` exacta | creación de la orden |
| Mapa de calor | `Payment.amount REGISTRADO` | cobro, TZ negocio |
| Dashboard "Cobrado hoy" | pagos REGISTRADO de hoy | cobro |
| Dashboard "Facturado hoy" | `saleNet` de órdenes creadas hoy | creación |

Rangos de reportes usan la TZ del **servidor**, salvo el "hoy" por defecto.

### 5.5 Impresión

Tres HTML (`window.print`): comprobante de servicio, cotización, orden
interna. La orden interna **nunca** imprime precios ni pagos. Leyenda
obligatoria: el comprobante **no sustituye DTE**.

Ticket térmico ESC/POS 80 mm, 42 columnas, sin acentos. Cola `PrintJob`
(`PENDIENTE → IMPRESO | ERROR`), agente local que sondea con
`x-agent-token`. El token **no** está en `.env.example`.

### 5.6 Login del legado (taller)

Código numérico de 4 dígitos, bcrypt, primer usuario `ACTIVO` que coincida.
Cookie `elite_session` 8 h fijas, sin renovación. Idle lock a los 60 s.
Permisos = unión de roles + concesiones − revocaciones (`UserPermission`
existe y **nada lo escribe**).

Esto **no** es el login de este repo (correo + contraseña, spec 001).

---

## 6. Taller: inventario, catálogo, clientes, vehículos

### 6.1 Inventario

Kardex **append-only**. Disponible = `stockOnHand − Σ reservas ACTIVA`
(calculado en app).

```
aprobar / agregar repuesto  → reserva ACTIVA   (no baja existencia)
confirmar consumo           → CONSUMO + reserva CONSUMIDA
estado terminal / anular    → reserva LIBERADA (existencia intacta)
```

Consumo solo en estados `allowsConsumption`, todas las reservas de la orden
de una vez, **sin revalidar** existencia (puede quedar negativa).

Salida manual valida contra `stockOnHand`, **no** contra disponible: se puede
sacar stock ya reservado.

Tipos de movimiento que el código **nunca genera**: `COMPRA`,
`DEVOLUCION_ORDEN`, `DEVOLUCION_PROVEEDOR`, `AJUSTE`, `PERDIDA`,
`CORRECCION`, `REVERSION`. Estado de reserva `VENCIDA`: nunca.

No hay módulo de compras ni proveedores en UI. Entradas = `ENTRADA_MANUAL`.
No hay pantalla de alta/edición/baja de producto salvo el flujo de escaneo
(código no reconocido) y asociar barcode.

`forSale = false` (`internalUse`): insumo interno, precio 0, no se vende.

### 6.2 Servicios

Precio copiado a la línea: el catálogo puede cambiar después, los documentos
viejos no. `listActiveServices` usa `area: { not: "CARWASH" }`, que en Prisma
**también excluye `area = null`**. Los servicios creados desde `/servicios`
no fijan `area` → **no aparecen** en recepción ni al agregar a una orden.

`setServiceStatus` existe y ninguna pantalla lo llama.

### 6.3 Clientes y vehículos

Alta de cliente: el nombre es lo único obligatorio. DUI/NIT/teléfono **no
únicos**. Sin soft-delete de clientes en el código construido.

Vehículo: placa opcional en alta rápida, exigida al generar orden. Dueño
actual = `VehicleOwner.isCurrent`. El modelo soporta historial de dueños;
**no hay** action de cambio de dueño. Kilometraje histórico solo lo escribe
la recepción.

El historial de visitas del vehículo recorre `Quote`. Las órdenes creadas
directo desde recepción **no aparecen**.

Picker: primero cliente, después vehículo de ese dueño. Cambiar de cliente
descarta el vehículo.

---

## 7. Taller: construido vs intención

78 modelos, 36 enums, 12 migraciones. El `init` ya traía casi todo; las
migraciones posteriores revelan reglas que se descubrieron en uso: placa
opcional, cuota de diagnóstico, completado por ítem, print jobs, `forSale`,
`SALIDA_MANUAL`, cierre por método, costos externos, inspección
post-aprobación.

### 7.1 Construido de verdad

Identidad (lectura), clientes/vehículos (CRUD parcial), recepción, cotización
(sin versionado real), aprobación simple, orden + estados-como-datos,
inspección de plantilla, inventario con reserva/consumo/salida, cobros con
abono, caja abrir/cerrar, gastos, recordatorios automáticos, reportes
básicos, impresión HTML + ESC/POS, login por código.

### 7.2 Sembrado y sin pantalla / sin escritura

| Dominio | Modelos | Permisos sembrados |
| --- | --- | --- |
| Permiso por usuario | `UserPermission` (se lee, nadie escribe) | — |
| Sucursal | `Branch` (solo "Casa Matriz" del seed) | — |
| Crédito | `CustomerCreditProfile`, autorizaciones, movimientos | `credit.*` |
| Citas / bahías | `Appointment`, `ServiceBay`, `AvailabilityBlock` | `appointments.*` |
| Paquetes | `ServicePackage` | `QuoteItemType.PAQUETE` |
| Compras | `PurchaseOrder`, `Purchase`, `Supplier*` (UI) | `purchases.*` |
| Tiempos | `TimeEntry` | `time.track` |
| QC | `QualityChecklistTemplate/Result` | `quality.*` |
| Garantías | `Warranty`, `WarrantyClaim` (default 45 días en settings) | `warranties.*` |
| CxC formal | `Receivable`, `PaymentAllocation` (se escribe 1:1 al cobrar), `Refund` | — |
| DTE | `ExternalTaxDocument` | `tax_docs.*` |
| Metas / comisiones | `Goal`, `CommissionRule*`, `CommissionEntry` | `goals.*`, `commissions.*` |
| Notificaciones | `Notification`, `CommunicationLog` | — |
| Gestión de roles | `Role`/`Permission` solo lectura | `roles.manage` sin pantalla |
| Auditoría | 2 escrituras (`ANULAR`, `SOFT_DELETE`) de 20 acciones | `audit.view` |

Settings sembrados: IVA 13 %, `pricesIncludeTax = true`, garantía mano de
obra 45 días, ticket 80 mm, datos fiscales en `printHeader` (NIT
`0614-070624-103-3`, NRC `3446580`).

### 7.3 Separación de funciones del seed (taller)

9 roles `isSystem`. Comentario de diseño: Fausto (asesor + cajero + gerente)
cotiza, cobra y cierra; el vendedor recibe y maneja bodega **sin** cobrar ni
ver costos. El `gerente` **no** tiene `payments.register` ni `cash.open/close`
ni `work_orders.void`. Anular órdenes y el override de diagnóstico son de
superadmin.

En **este repo** esa separación no existe como roles fijos: se arma desde la
administración. Lo que sí hay que preservar como idea de producto es:

- Quien ve costos no es, por defecto, quien cobra.
- El técnico no ve precios (`work_orders.view_prices` aparte de `view`).
- El técnico sin `view_all` solo ve las órdenes donde está asignado.
- Anular un documento de dinero o una orden es un permiso chico y explícito.

---

## 8. ERP carwash (prototipo HTML)

Un solo archivo, sin sesión. Cada acción protegida pide PIN y toma el
**primer** usuario cuyo PIN coincida y tenga el permiso. El campo `rol` es
etiqueta. PINs en claro y únicos. Órdenes y Tienda son libres; el resto de
secciones se desbloquean por dispositivo y se pierden al recargar.

### 8.1 Orden de lavado

Nace `En proceso`, solo pasa a `Cobrado`. No hay edición: anular y crear
otra. Anular = **borrado físico**, incluso cobrada; solo queda una línea de
bitácora sin id. Anular una cobrada saca el monto de la caja del día en que
se cobró.

Al crear: servicio (texto), monto > 0, ≥1 empleado activo. Placa/tipo/marca/
color opcionales. El monto se autocompleta del catálogo y queda editable.
`comisionTotal` se calcula **al crear** y no se recalcula.

Cobro: PIN con `perm.cobrar`, método Efectivo/Tarjeta/Transferencia **o**
marca `facturaExterna` (DTE). Monto = total de la orden, sin abonos ni
descuento. `fechaCobro` es el día de caja; `fecha` (creación) es el día de
comisión. Son dos fechas.

Al cobrar se puede anotar nombre/teléfono → nace o se actualiza un cliente
(match placa mayúsculas, luego teléfono). No hay alta manual de clientes.

### 8.2 Comisión (la fórmula que la spec 003 dejó para después)

```
< 14        → $0
< 20        → $1
< 25        → $2
< 35        → $3
< 40        → $4
>= 40       → 12 % del monto, round 2 decimales
```

Por orden individual, nunca acumulada. Varios empleados: se divide
`comisionTotal / n` **sin redondeo por parte**. Cuenta desde la **creación**,
aunque siga sin cobrar. DTE externo **sí** comisiona. Tienda **no**. Orden
anulada desaparece y deja de comisionar. Empleado borrado desaparece del
"Total a pagar" de la pantalla, no del total de Tablero/Cierre.

Hay un salto en $40: 39.99 → $4; 40 → $4.80.

### 8.3 Tienda, insumos, máquinas

- Tienda: carrito en memoria, nace cobrada, stock `max(0, stock − cant)`
  **sin validar**. Anular venta **no** repone stock. Solo se listan ventas
  del día.
- Insumos (bodega, no se venden): entrada/salida, piso en 0, el movimiento
  guarda la cantidad pedida no la efectiva. **No** se descuentan al lavar.
  Código comparado case-insensitive, **sin unicidad**.
- Máquinas + mantenimientos preventivo/correctivo. El costo de mantenimiento
  **no toca caja**.

### 8.4 Cierre y tablero

Caja del día = órdenes `Cobrado` no DTE por `fechaCobro` + ventas de tienda
no DTE por `fecha`. DTE se totaliza aparte y no entra a "Total a entregar".
Ese total suma efectivo **más** tarjeta **más** transferencia.

El cierre **no persiste nada**: no hay conteo, diferencia, gastos ni fondo.
Fechas en UTC (`toISOString().slice(0,10)`): una orden a las 19:00 local
cae en el día siguiente.

9 permisos reales en código (`tablero`, `clientes`, `inventario`,
`mantenimiento`, `comisiones`, `cierre`, `config`, `cobrar`, `anular`). El
`CLAUDE.md` del prototipo dice 4 y está desactualizado.

---

## 9. Hueco: legado vs este repo

La columna "Este repo" vive en **§2.2**. Acá solo el contraste con el legado,
para no reabrir extractos.

| Capacidad | Legado taller | Legado ERP | Este repo |
| --- | --- | --- | --- |
| Auth oficina | PIN 4 dígitos | PIN por acción | hecho (001, correo) |
| Auth pista | no existe | el mismo PIN | hecho (003) |
| RBAC dinámico | sí, roles de seed | `perm.*` por usuario | hecho (001, a demanda) |
| Clientes / vehículos | sí | al cobrar | hecho (003/004) |
| Catálogo servicios | sí, `quickService` | precio único | hecho para lavado (003); `WORKSHOP` no en UI |
| Ticket de lavado | área `CARWASH` en la OT | orden plana | hecho (003) |
| Cobro de lavado | caja + abonos | PIN + método o DTE | hecho: un pago exacto, sin caja (003) |
| Comisión de lavado | tablas vacías | fórmula de tramos | parcial: assignment, sin cálculo |
| Recepción / cotización / OT de taller | sí | no | no |
| Inventario / reservas | sí | insumos + tienda | no |
| Caja con apertura/cierre | sí | cierre fantasma | no |
| Gastos | sí | no | no |
| Tienda / POS | productos `forSale` | sí | no |
| Máquinas | no | sí | no |
| DTE | modelo sin UI | flag `facturaExterna` | no |
| Impresión térmica | sí | `window.print` | no |
| Reportes | ventas, heatmap, 80/20 | tablero | no |
| Citas, QC, garantías, compras, crédito | modelo, sin UI | no | no |

El carwash actual **ya es mejor** que el HTML en sesión, dos mundos, anulación
`VOID`, snapshot de precio y dueño con historial.

El taller legado es el único lugar donde está escrita la mecánica de
reparación. Nada de eso está en este repo.

---

## 10. Lo que no hay que copiar

Bugs, atajos y reglas muertas del legado. Si una spec futura los reintroduce,
es un error, no fidelidad.

**Dinero y stock**

- Anular ≠ borrar. El ERP borra órdenes y ventas cobradas; el taller anula
  pagos pero no reabre la orden ni recalcula el cierre.
- Anular una venta/consumo tiene que reponer stock, o no se anula.
- No vender ni sacar por debajo de disponible (el ERP y la salida manual del
  taller lo permiten).
- Confirmar consumo tiene que revalidar existencia.
- Cerrar una orden sin confirmar consumo no puede **liberar** reservas y
  fingir que el stock se usó. O se consume, o queda explícito que no.
- Folios por `count()+1` colisionan. Usar secuencia o `max+1` atómico.
- Fechas de "día" en UTC en un negocio UTC−6. Siempre TZ `America/El_Salvador`.
- Cierre de caja que no persiste no es cierre.
- Sobrepago silencioso o `max(0, stock − cant)` silencioso: no.

**Flujo**

- No sembrar estados a los que nadie transiciona (`diagnostico`,
  `por_aprobar`, `aprobado` en el taller) "por si acaso".
- `requiresQc: true` sin checklist es teatro.
- `validUntil` que no vence no se pone en pantalla como vigencia.
- Campos de ficha de recepción que se muestran y no se capturan: o se
  capturan o no se muestran.
- `listActiveServices` no puede usar `area: { not: "CARWASH" }` si el alta
  deja `area` null.
- Historial del vehículo tiene que incluir órdenes sin cotización.

**Auth**

- PIN en claro: no.
- "El primer usuario cuyo PIN coincida": no.
- Login por código de 4 dígitos **no** sustituye el de spec 001.
- Páginas que solo se esconden en el sidebar y no se guardan en servidor: no.
- Permisos sembrados que nadie verifica (`products.view/manage`,
  `quotes.discount` en el taller): no se declaran si no se usan.

**Fiscal y reportes**

- Un comprobante de servicio no es DTE. La leyenda del legado se queda.
- "Facturado" y "cobrado" son ejes distintos. Un reporte tiene que decir cuál.
- Comisión por fecha de creación vs caja por fecha de cobro: si se porta,
  documentarlo en la spec, no mezclarlo callado.

---

## 11. Ideas de producto que sí valen la pena

No son specs. Son invariantes que el legado descubrió en el piso y que el
producto nuevo ya comparte o debería tener presentes cuando se escriba la
spec correspondiente.

1. **La orden es el centro.** El resto existe para abrirla, ejecutarla o
   cerrarla.
2. **Dos velocidades en el taller:** precio de folleto → orden directa;
   alcance variable → cotización con aprobación por renglón.
3. **Un vehículo, una cuenta abierta.**
4. **Precios se copian a la línea.** El catálogo no reescribe el pasado.
5. **El técnico no ve dólares** salvo permiso explícito.
6. **Sin caja abierta no se cobra.**
7. **Kardex append-only.** Se corrige con un movimiento inverso, no editando.
8. **Reserva ≠ consumo.** Aprobar no baja existencia; usar sí.
9. **Taller y lavado comparten ficha de cliente/vehículo** y se distinguen
   por área, no por sistema paralelo.
10. **El lavado no cotiza.** Ticket corto: anotar, marcar listo, cobrar.
11. **Comisión del lavado es por ticket, por tramos, se congela al crear**
    y se reparte en partes iguales entre quienes lavaron. DTE externo
    comisiona; tienda no. (Fórmula exacta en §8.2; la spec 003 ya dejó el
    hueco en `WorkOrderAssignment`.)
12. **Autorización por permiso, nunca por nombre de rol.** El ERP HTML ya
    lo hacía (`perm.*`); el taller también; este repo lo convirtió en ley.

---

## 12. Extractos

| Archivo | Páginas de reglas | Contenido |
| --- | --- | --- |
| [legacy/01-data-model.md](legacy/01-data-model.md) | 50 reglas de modelo | 36 enums, 78 modelos en 21 dominios, seed (78 permisos, 9 roles, 12 estados, 84 servicios), 12 migraciones, modelos sin uso |
| [legacy/02-core-flow.md](legacy/02-core-flow.md) | 84 reglas | Ciclo de vida, cada server action, totales, UI-only, caso, fotos, técnico, folios |
| [legacy/03-money-reports.md](legacy/03-money-reports.md) | 71 reglas | Cobros, caja, gastos, CxC, reportes, dinero, impresión, auth PIN, recordatorios |
| [legacy/04-catalogs-inventory.md](legacy/04-catalogs-inventory.md) | 67 reglas | Productos, reservas, consumo, salida, servicios, clientes, vehículos, picker |
| [legacy/05-carwash-erp.md](legacy/05-carwash-erp.md) | 82 reglas | State completo, comisión literal, órdenes, cobro, tienda, insumos, máquinas, cierre, tablero, PIN, ticket |

Zips originales: `/Users/elopez/Downloads/elite-service-taller.zip` y
`elite-service-erp.zip`. Extraídos en septiembre 2026 contra ese código.
Si los zips cambian, hay que re-extraer.
