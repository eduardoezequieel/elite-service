<!-- Extracto del legado. Fuente: zips elite-service-taller.zip y elite-service-erp.zip (sep 2026). Índice: ../LEGACY_BUSINESS_LOGIC.md. No es una spec: no autoriza implementar. -->

# 01 — Modelo de datos del proyecto legado (Next.js + Prisma)

Fuente: `prisma/schema.prisma` (1999 líneas), `prisma/seed.ts` (847 líneas), `prisma/_tmp-wipe-prod.ts`,
`prisma/migrations/*/migration.sql` (12 migraciones) y `.env.example`, todos bajo
`/private/tmp/claude-501/-Users-elopez-Documents-elite-service/75ac910a-e08b-475e-8c87-5ee0a05b94b3/scratchpad/taller/elite-service-taller/`.
Para la sección 6 se cruzó contra `modules/`, `app/`, `lib/` y `printer-agent/` del mismo repo.

Identificadores en inglés tal cual el código; valores de enum en español tal cual el código (el legado
mezcla). Notación: `Decimal(12,2)` = dinero, `Decimal(12,3)` = cantidades, `Decimal(6,4)` = tasas.

---

## 0. Convenciones globales del schema (encabezado de `schema.prisma`)

- IDs `cuid()`.
- Dinero `Decimal(12,2)`, cantidades `Decimal(12,3)`, tasas `Decimal(6,4)` (`0.1300` = 13 %).
- Soft-delete: campo `deletedAt` (nulo = activo). "Nunca se borra físicamente pagos, cierres, inventario,
  aprobaciones, órdenes ni auditoría (sec. 33)".
- Referencias a `User` y `Branch` (`createdById`, `advisorId`, `branchId`, `authorizedById`,
  `closedById`, `completedById`, `costsConfirmedById`, `uploadedById`, `changedById`, `reviewedById`…)
  son **FK lógicas**: `String?` indexado o no, sin relación Prisma ni constraint en base. Excepciones con
  FK real a `User`: `Technician.userId`, `CashSession.cashierId`, `AuditLog.actorId`, `UserRole.userId`,
  `UserPermission.userId`.
- Las relaciones del grafo de dominio (cliente↔vehículo↔orden↔pago↔caja, producto↔inventario) sí son
  relaciones Prisma con integridad referencial. En `init` todas las FK de campos obligatorios son
  `ON DELETE RESTRICT`; las de campos opcionales `ON DELETE SET NULL`; todas `ON UPDATE CASCADE`.
- Todas las tablas usan `@@map` a snake_case plural (`users`, `work_orders`, `daily_closures`…).
- `.env.example` (2 líneas): `DATABASE_URL="postgresql://usuario:password@localhost:5432/elite_service?schema=public"`
  y `SESSION_SECRET="cambia-esto-por-una-cadena-aleatoria-larga"`. No hay más variables documentadas
  (el token del agente de impresión que menciona `printer-agent/README.md` no está en `.env.example`).
- `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }`, Prisma `^6.19.3`.

---

## 1. Enums (todos, con todos sus valores)

Al final de cada enum se anota qué valores aparecen literalmente en `modules/`, `app/`, `lib/`
(grep heurístico `"VALOR"` / `.VALOR`). Sirve para separar lo que el código construido usa de lo que solo
está en el modelo.

### `PersonType` — tipo de persona del cliente
| Valor | Significado |
|---|---|
| `NATURAL` | persona natural (default de `Customer.personType`) |
| `JURIDICA` | persona jurídica / empresa (`Customer.fullName` "o razón social") |

Usados en código: ambos.

### `RecordStatus` — activo/inactivo genérico de catálogos y maestros
| Valor | Significado |
|---|---|
| `ACTIVO` | registro operativo (default en todos los modelos que lo usan) |
| `INACTIVO` | desactivado sin borrar; el seed lo usa para inutilizar la cuenta `gerente@eliteservice.sv` y el comentario dice "Login exige status ACTIVO" |

Se usa en: `User`, `Branch`, `Customer`, `Vehicle`, `Technician`, `ServiceBay`, `InspectionTemplate`,
`ServiceCategory`, `ServiceCatalog`, `ServicePackage`, `ProductCategory`, `Product`, `InventoryLocation`,
`Supplier`, `PaymentMethod`, `CashRegister`, `ExpenseCategory`, `QualityChecklistTemplate`, `Goal`.

### `CreditStatus` — estado de la línea de crédito del cliente
| Valor | Significado |
|---|---|
| `SIN_CREDITO` | no tiene crédito (default de `CustomerCreditProfile.status`) |
| `PENDIENTE` | solicitud de crédito en trámite |
| `ACTIVO` | crédito vigente |
| `SUSPENDIDO` | crédito suspendido temporalmente |
| `BLOQUEADO` | crédito bloqueado |
| `VENCIDO` | crédito con saldo vencido |

Usados en código: ninguno (no hay módulo de crédito).

### `CreditMovementType` — movimientos de cuenta por cobrar
| Valor | Significado (comentario del schema) |
|---|---|
| `CARGO` | "venta a crédito -> aumenta cuenta por cobrar" |
| `ABONO` | "pago posterior -> reduce cuenta por cobrar" |
| `AJUSTE` | ajuste manual del saldo |
| `ANULACION` | anulación de un cargo/abono |

Usados en código: ninguno.

### `AppointmentStatus` — ciclo de vida de una cita
| Valor | Significado |
|---|---|
| `TENTATIVA` | cita propuesta, sin confirmar (default) |
| `CONFIRMADA` | confirmada por el taller |
| `CLIENTE_NOTIFICADO` | se le avisó al cliente (recordatorio) |
| `PRESENTE` | el cliente llegó |
| `EN_RECEPCION` | se está recibiendo el vehículo |
| `CONVERTIDA` | se convirtió en `Reception` (relación 1:1 `Reception.appointmentId`) |
| `REPROGRAMADA` | movida a otra fecha |
| `CANCELADA` | cancelada |
| `NO_ASISTIO` | no-show |

Usados en código: ninguno (no hay módulo de citas).

### `Priority` — prioridad de cita y de orden de trabajo
`BAJA`, `NORMAL` (default), `ALTA`, `URGENTE`. Usados en código: ninguno literal.

### `MediaCategory` — categoría de una foto/archivo
| Valor | Significado |
|---|---|
| `RECEPCION` | fotos al recibir el vehículo |
| `DANOS` | daños preexistentes |
| `DIAGNOSTICO` | evidencia del diagnóstico |
| `DURANTE_TRABAJO` | fotos durante la reparación |
| `PRODUCTOS` | fotos de productos del catálogo |
| `REPUESTOS_SUSTITUIDOS` | repuestos viejos retirados (evidencia al cliente) |
| `CONTROL_CALIDAD` | evidencia del QC |
| `ENTREGA` | fotos al entregar |

Usados en código: `RECEPCION`, `DIAGNOSTICO`.

### `MediaVisibility` — quién puede ver el archivo
`INTERNO` (default, solo taller) · `CLIENTE` (visible para el cliente). Usados en código: `INTERNO`.

### `MediaOwnerType` — a qué entidad pertenece el archivo (polimórfico)
`RECEPTION`, `INSPECTION`, `WORK_ORDER`, `PRODUCT`, `WARRANTY_CLAIM`, `QUOTE`, `QUALITY_RESULT`.
Usados en código: `RECEPTION`, `INSPECTION`.

### `ServiceType` — naturaleza de un servicio del catálogo
| Valor | Significado (inferido del seed) |
|---|---|
| `MANO_OBRA` | trabajo de mecánica puro (default). Seed: frenos, suspensión |
| `DIAGNOSTICO` | diagnóstico / revisión de costo o alcance variable. Seed: A/C, escaneo, diagnóstico de suspensión, GDI |
| `MANT_EXPRESS` | mantenimiento rápido. Seed: "AFINADO MENOR" por carrocería |
| `MANT_PREVENTIVO` | mantenimiento preventivo. Seed: cambios de aceite de motor y caja |
| `CARWASH` | lavado/detallado. Seed: paquetes LAVADO + ASPIRADO (+ PASTEADO) |
| `SERVICIO_EXTERNO` | trabajo tercerizado |
| `PAQUETE` | combo de servicios/productos |
| `OTRO` | resto |

Usados en código: `MANO_OBRA`, `DIAGNOSTICO`, `MANT_EXPRESS`, `MANT_PREVENTIVO`, `CARWASH`, `OTRO`.

### `BusinessArea` — área del negocio
`TALLER`, `CARWASH`, `REPUESTOS`, `ADMINISTRACION`, `CAJA`. Se usa en `InspectionTemplate.area`,
`ServiceCategory.area`, `ServiceCatalog.area`, `WorkOrder.area`, `QualityChecklistTemplate.area`,
`Expense.area`, `CommissionRule.area`. Seed usa `TALLER` y `CARWASH`. Usados en código: `CARWASH`.

### `QuoteStatus` — ciclo de vida de la cotización
| Valor | Significado (`lib/quote-status.ts` da la etiqueta) |
|---|---|
| `BORRADOR` | "Borrador" (default) |
| `PREPARADA` | "Preparada" — lista, aún no enviada |
| `ENVIADA` | "Enviada" al cliente |
| `VISTA` | "Vista" — el cliente la abrió |
| `PARCIALMENTE_APROBADA` | "Parcialmente aprobada" — aprobación por renglón |
| `APROBADA` | "Aprobada" completa |
| `RECHAZADA` | "Rechazada" |
| `VENCIDA` | "Vencida" (pasó `validUntil`) |
| `CANCELADA` | "Cancelada" |
| `CONVERTIDA` | "Convertida" en orden de trabajo (`WorkOrder.quoteId` único) |

Usados en código: `BORRADOR`, `PREPARADA`, `ENVIADA`, `VISTA`, `PARCIALMENTE_APROBADA`, `APROBADA`,
`RECHAZADA`, `CONVERTIDA`. No aparecen `VENCIDA` ni `CANCELADA` fuera del mapa de etiquetas.

### `QuoteItemType` — tipo de renglón (cotización y orden comparten el enum)
| Valor | Significado |
|---|---|
| `SERVICIO` | servicio del catálogo (`serviceId`) |
| `MANO_OBRA` | mano de obra suelta |
| `PRODUCTO` | producto de inventario (`productId`) |
| `REPUESTO` | repuesto; único tipo al que aplica `QuoteItem.supplierNote` |
| `PAQUETE` | paquete |
| `SERVICIO_EXTERNO` | trabajo de tercero |

Usados en código: todos.

### `LineDecision` — decisión del cliente por renglón
`PENDIENTE` (default), `APROBADO`, `RECHAZADO`. Usados en código: los tres.

### `InventoryMovementType` — tipos de movimiento (kardex append-only)
| Valor | Significado |
|---|---|
| `COMPRA` | entrada por compra a proveedor |
| `ENTRADA_MANUAL` | entrada manual |
| `SALIDA_MANUAL` | salida manual (**agregado en migración 20260822040338**, no existía en `init`) |
| `RESERVA` | reserva al aprobar trabajo (no mueve existencia física) |
| `LIBERACION_RESERVA` | reserva liberada sin consumir |
| `CONSUMO` | descuento real al confirmar consumo |
| `DEVOLUCION_ORDEN` | devuelto desde una orden |
| `DEVOLUCION_PROVEEDOR` | devuelto al proveedor |
| `AJUSTE` | ajuste de inventario |
| `PERDIDA` | merma/pérdida |
| `CORRECCION` | corrección (se hace con un nuevo movimiento, no editando) |
| `REVERSION` | revierte otro movimiento (`reversalOfId`) |

Usados en código: `ENTRADA_MANUAL`, `SALIDA_MANUAL`, `RESERVA`, `LIBERACION_RESERVA`, `CONSUMO`.

### `ReservationStatus` — estado de la reserva de inventario
`ACTIVA` (default), `CONSUMIDA`, `LIBERADA`, `VENCIDA`. Usados en código: `ACTIVA`, `CONSUMIDA`, `LIBERADA`.

### `PurchaseStatus` — estado de orden de compra
`BORRADOR` (default), `ORDENADA`, `RECIBIDA_PARCIAL`, `RECIBIDA`, `CANCELADA`. Usados en código: ninguno.

### `TimeEntryState` — cronómetro del técnico
`EN_CURSO` (default), `PAUSADO`, `FINALIZADO`. Usados en código: ninguno.

### `PaymentStatus`
`REGISTRADO` (default) · `ANULADO`. Usados en código: ambos (el reporte de cuentas por cobrar suma solo `REGISTRADO`).

### `CashSessionStatus` — sesión de caja
`ABIERTA` (default), `CERRADA`, `REABIERTA`. Usados en código: los tres.

### `CashMovementType` — movimientos de caja
| Valor | Significado |
|---|---|
| `VENTA_COBRADA` | cobro de una venta |
| `ANTICIPO` | anticipo del cliente |
| `ABONO` | abono a cuenta por cobrar |
| `GASTO` | salida por gasto |
| `RETIRO` | retiro de efectivo |
| `INGRESO_EXTRA` | ingreso no ligado a venta |
| `DEVOLUCION` | devolución al cliente |
| `DEPOSITO` | depósito |

Usados en código: `VENTA_COBRADA`, `ANTICIPO`, `DEVOLUCION`.

### `ExpenseType` — naturaleza del gasto
| Valor | Significado |
|---|---|
| `OPERATIVO` | gasto operativo (default) |
| `COMPRA_INVENTARIO` | compra de inventario |
| `ACTIVO` | compra de activo |
| `RETIRO` | retiro de socio/dueño |
| `REEMBOLSO` | reembolso |
| `COSTO_ORDEN` | costo cargado a una orden (`Expense.workOrderId`) |
| `COSTO_GARANTIA` | costo por garantía |

Usados en código: ninguno literal (el módulo de gastos usa el default).

### `ExpenseStatus`
`PENDIENTE` (default), `AUTORIZADO`, `RECHAZADO`, `PAGADO`. Usados en código: `PAGADO`, `RECHAZADO`
(`RECHAZADO` comparte literal con `LineDecision`).

### `TaxDocumentType` — DTE de El Salvador (comentario del schema)
"FE = Factura (consumidor final) · CCF = Comprobante de Crédito Fiscal · NC = Nota de Crédito · ND = Nota
de Débito · FSE = Factura Sujeto Excluido". Valores: `FE`, `CCF`, `NC`, `ND`, `FSE`, `OTRO`. Usados en código: ninguno.

### `TaxDocumentStatus`
`EMITIDO` (default), `ANULADO`, `CONTINGENCIA` (emitido en contingencia ante Hacienda), `RECHAZADO`. Usados: ninguno propio.

### `WarrantyType`
`MANO_OBRA` (default), `REPUESTO`, `EXTERNO`. Usados en código: ninguno como garantía.

### `WarrantyClaimStatus`
`ABIERTO` (default), `EN_REVISION`, `APROBADO`, `RECHAZADO`, `RESUELTO`. Usados: ninguno como reclamo.

### `CommissionBaseType` — base de cálculo de comisión
`FIJA`, `PORCENTAJE_VENTA`, `PORCENTAJE_UTILIDAD`, `POR_PRODUCTO`, `POR_SERVICIO`, `POR_RANGO`, `POR_META`. Usados: ninguno.

### `CommissionEntryStatus`
`SIMULADA` (default), `PENDIENTE`, `APLICADA`, `ANULADA`. Usados: ninguno.

### `GoalSubjectType` — a quién aplica una meta/comisión
`USUARIO`, `TECNICO`, `ASESOR`, `AREA`, `GLOBAL`. Usados: ninguno.

### `ReminderType` — tipo de recordatorio
| Valor | Significado |
|---|---|
| `FECHA` | por fecha |
| `KILOMETRAJE` | por kilometraje (`Reminder.dueMileage`) |
| `SERVICIO` | servicio pendiente |
| `PROX_MANTENIMIENTO` | próximo mantenimiento |
| `TRABAJO_RECHAZADO` | trabajo que el cliente rechazó en la cotización (para volver a ofrecerlo) |
| `RECOMENDACION` | recomendación del técnico |
| `GARANTIA` | vencimiento de garantía |
| `CUENTA_COBRAR` | saldo pendiente |
| `PROMESA_PAGO` | promesa de pago |

Usados en código: `TRABAJO_RECHAZADO`, `CUENTA_COBRAR`.

### `ReminderStatus`
`PENDIENTE` (default), `EN_SEGUIMIENTO`, `COMPLETADO`, `DESCARTADO`. Usados: `EN_SEGUIMIENTO`, `COMPLETADO`, `PENDIENTE`.

### `NotificationStatus`
`PENDIENTE` (default), `ENVIADA`, `LEIDA`. Usados: ninguno propio.

### `CommunicationChannel`
`WHATSAPP`, `CORREO`, `SMS`, `INTERNO`. Usados: ninguno propio.

### `AuditAction` — acciones auditables
`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `ANULAR`, `SOFT_DELETE`, `CAMBIO_PRECIO`, `CAMBIO_COSTO`, `DESCUENTO`,
`CREDITO_AUTORIZADO`, `EXCESO_CREDITO`, `AJUSTE_INVENTARIO`, `CONFIRMA_CONSUMO`, `DEVOLUCION`,
`APROBACION_CLIENTE`, `CAMBIO_ESTADO`, `REAPERTURA_CAJA`, `REIMPRESION`, `CAMBIO_PERMISOS`, `EXPORTACION`.
Usados en código: `ANULAR` (`modules/payments/actions.ts:327`) y `SOFT_DELETE` (`modules/work-orders/actions.ts:454`).
Son los dos únicos `auditLog.create` del código.

### `PrintJobStatus` — cola de impresión (agregado en migración 20260828170844; declarado al final del schema)
`PENDIENTE` (default), `IMPRESO`, `ERROR`. Usados en código: los tres.

---

## 2. Modelos agrupados por dominio

Formato: **Modelo** (`tabla`) — propósito. Campos de negocio · Relaciones · Índices/uniques · Soft-delete.

### 2.1 Identidad, roles y permisos

**User** (`users`) — cuenta que entra al sistema. `fullName`, `email @unique`, `passwordHash` (el seed guarda ahí el hash bcrypt de un código numérico de 4 dígitos: "Login por código (no por correo+contraseña)"), `phone?`, `status RecordStatus`, `lastLoginAt?`. Relaciones: `userRoles`, `directPermissions`, `technicianProfile` (1:1 opcional), `auditLogs` (`"AuditActor"`), `cashSessions` (`"CashierSessions"`). `@@index([status])`. Soft-delete `deletedAt`.

**Role** (`roles`) — rol nombrado. `key @unique` (comentario: "superadmin, gerente, asesor, tecnico, inventario, cajero, carwash, auditor"), `name`, `description?`, `isSystem`. Relaciones `userRoles`, `rolePermissions`. Soft-delete.

**Permission** (`permissions`) — capacidad atómica. `key @unique` (comentario: "ej. work_order.view, cost.view, credit.authorize, cash.open"), `module`, `action` (comentario: "ver, crear, modificar, eliminar, autorizar, anular, exportar, imprimir, ver_costos, ver_utilidades, aplicar_descuento, reabrir"), `name`. Sin soft-delete.

**UserRole** (`user_roles`) — N:M usuario↔rol. `@@unique([userId, roleId])`, `@@index([roleId])`. FK reales `RESTRICT`.

**RolePermission** (`role_permissions`) — N:M rol↔permiso. `@@unique([roleId, permissionId])`, `@@index([permissionId])`.

**UserPermission** (`user_permissions`) — "Concesión / revocación de un permiso a un usuario específico (caso gerente=cajero)". `granted Boolean @default(true)` ("false = revocado explícitamente"). `@@unique([userId, permissionId])`. `lib/auth.ts` resuelve: permisos = ∪ permisos de roles ∪ directos `granted`, menos directos `granted=false`.

### 2.2 Organización y configuración

**Branch** (`branches`) — sucursal. `name`, `isDefault`, `address?`, `phone?`, `status`. Sin relaciones Prisma: todos los `branchId` del sistema son FK lógicas (`Customer`, `Appointment`, `Reception`, `Quote`, `WorkOrder`, `CashRegister`). Soft-delete. Seed crea `branch_main` "Casa Matriz".

**BusinessSettings** (`business_settings`) — singleton de configuración (seed usa `id = "settings_default"`). `legalName` ("Rivera's Investments Group S.A.S. de C.V."), `commercialName` ("Elite Service"), `defaultTaxRate Decimal(6,4) @default(0.1300)` ("IVA 13%"), `pricesIncludeTax @default(true)` ("precios con IVA incluido"), `currency "USD"`, `timezone "America/El_Salvador"`, `dateFormat "dd/MM/yyyy"`, `laborWarrantyDays 45`, `ticketWidthMm 80`, `brandPrimary "#1E3A8A"`, `brandSecondary "#F97316"`, `settings Json?` ("otras llaves configurables (leyendas, plantillas…)"; el seed guarda ahí `printHeader`). Solo `updatedAt`.

### 2.3 Clientes y crédito

**Customer** (`customers`) — cliente. `code @unique`, `personType`, `fullName` ("o razón social"), `dui?`, `nit?`, `otherDoc?`, `phone?`, `whatsapp?`, `email?`, `address?`, `customerType?` (texto libre), `tags String[]`, `notes?`, `status`, `branchId?` y `createdById?` (FK lógicas). Relaciones: `contacts`, `creditProfile` (1:1), `creditMovements`, `vehicleOwners`, `appointments`, `receptions`, `quotes`, `workOrders`, `receivables`, `payments`, `warrantyClaims`, `reminders`, `communications`, `taxDocuments`. Índices de búsqueda: `phone`, `whatsapp`, `dui`, `nit`, `email`. Soft-delete.

**CustomerContact** (`customer_contacts`) — contactos de un cliente jurídico. `name`, `role?`, `phone?`, `email?`. `@@index([customerId])`.

**CustomerCreditProfile** (`customer_credit_profiles`) — línea de crédito, una por cliente (`customerId @unique`). `creditAllowed @default(false)`, `status CreditStatus @default(SIN_CREDITO)`, `creditLimit Decimal(12,2)`, `termDays Int`, `usedBalance Decimal(12,2)`, `nextReviewAt?`, `notes?`. Relación `authorizations`.

**CustomerCreditAuthorization** (`customer_credit_authorizations`) — historial de autorizaciones de crédito. `status`, `creditLimit`, `termDays`, `reason?`, `authorizedById?` ("FK lógica -> User (nunca el asesor)"), `authorizedAt`. Regla implícita: cada cambio de límite queda como fila nueva.

**CustomerCreditMovement** (`customer_credit_movements`) — libro mayor de la cuenta por cobrar. `type CreditMovementType`, `amount`, `balanceAfter` (saldo corrido), `workOrderId?`, `paymentId?` (FK lógicas), `reason?`, `createdById?`. Índices `customerId`, `createdAt`.

### 2.4 Vehículos

**Vehicle** (`vehicles`) — `plate String?` ("puede faltar al cotizar; se exige al registrar la orden"; era `NOT NULL` en `init`, migración 20260721201802 lo hizo opcional), `vin?`, `make?`, `model?`, `year?`, `trim?`, `engine?`, `transmission?`, `fuelType?`, `color?`, `currentMileage?`, `nextServiceAt?`, `alerts?`, `notes?`, `status`. Relaciones: `owners`, `mileageHistory`, `appointments`, `receptions`, `quotes`, `workOrders`, `warranties`, `warrantyClaims`, `reminders`. Índices `plate`, `vin` (no únicos: la placa no es única en base). Soft-delete.

**VehicleOwner** (`vehicle_owners`) — "Relación cliente<->vehículo (permite varios dueños e historial al cambiar propietario)". `isCurrent @default(true)`, `fromDate @default(now())`, `toDate?`. `@@unique([vehicleId, customerId, fromDate])`, `@@index([customerId])`. El código crea siempre `isCurrent: true` al crear/editar vehículo (`modules/vehicles/actions.ts`) y filtra `isCurrent: true` al leer.

**VehicleMileageHistory** (`vehicle_mileage_history`) — `mileage Int`, `source?` ("recepción, servicio, manual"), `recordedAt`, `createdById?`. `@@index([vehicleId])`.

### 2.5 Citas, técnicos y bahías

**Technician** (`technicians`) — mecánico. `userId? @unique` ("FK real -> User (un técnico puede ser usuario)", `ON DELETE SET NULL`), `displayName`, `isHelper @default(false)` ("ayudante (no debe quedar solo como único mecánico)"), `status`. Relaciones `appointments`, `availabilityBlocks`, `assignments`, `timeEntries`. Soft-delete.

**ServiceBay** (`service_bays`) — bahía física. `name`, `status`. Relaciones `appointments`, `availabilityBlocks`, `workOrders`. Soft-delete (sin `updatedAt`).

**AvailabilityBlock** (`availability_blocks`) — bloqueo de agenda de técnico o bahía. `technicianId?`, `bayId?`, `reason?` ("ausencia, descanso, bloqueo"), `startAt`, `endAt`. `@@index([startAt])`.

**Appointment** (`appointments`) — cita. `customerId`, `vehicleId`, `serviceRequested?`, `scheduledStart`, `estimatedMinutes?`, `priority`, `status AppointmentStatus`, `notes?`, `reminderAt?`, `customerConfirmed`, `advisorId?` (FK lógica), `technicianId?`, `bayId?`, `branchId?`. Relación 1:1 inversa `reception`. Índices `scheduledStart`, `status`. Soft-delete.

### 2.6 Recepción e inspección

**Reception** (`receptions`) — ingreso del vehículo al taller. `number @unique`, `customerId`, `vehicleId`, `appointmentId? @unique` (una cita → máx. una recepción), `visitReason?`, `symptoms?`, `requestedServices?`, `mileage?`, `fuelLevel?`, `warningLights?`, `accessories?`, `valuables?`, `exteriorState?`, `interiorState?`, `existingDamage?`, `notes?`, `promisedAt?`, `customerAccepted @default(false)`, `advisorId?`, `branchId?`. Relaciones: `inspections`, `quotes`, `workOrders`, `payments` (esta última agregada en migración 20260829084814 para la cuota de diagnóstico). Índices `customerId`, `vehicleId`. Soft-delete.

**InspectionTemplate** (`inspection_templates`) — checklist configurable. `name`, `area?`, `status`. Relaciones `items`, `inspections`.

**InspectionItem** (`inspection_items`) — punto del checklist. `label`, `order`, `required`. `@@index([templateId])`.

**Inspection** (`inspections`) — inspección ejecutada. `receptionId?` (era obligatorio en `init`; migración 20260721200918 lo hizo opcional y pasó la FK a `SET NULL`), `workOrderId?` (agregado en la misma migración: inspección post-aprobación sobre la orden), `templateId?`, `results Json?` ("resultados por ítem (checklist configurable)"), `notes?`, `createdById?`. Índices `receptionId`, `workOrderId`.

**MediaFile** (`media_files`) — "Fotografías/documentos. Polimórfico por (ownerType, ownerId) para no inflar las relaciones. Cada archivo se marca interno o visible para el cliente." `ownerType MediaOwnerType`, `ownerId`, `category MediaCategory`, `visibility @default(INTERNO)`, `url`, `thumbUrl?`, `mimeType?`, `sizeBytes?`, `uploadedById?`. `@@index([ownerType, ownerId])`. Sin FK real (polimórfico).

### 2.7 Catálogo de servicios

**ServiceCategory** (`service_categories`) — `name`, `area?`, `status`. Relación `services`.

**ServiceCatalog** (`service_catalog`) — servicio vendible. `code @unique`, `name`, `description?`, `categoryId?`, `type ServiceType @default(MANO_OBRA)`, `area?`, `suggestedPrice Decimal(12,2)` ("con IVA incluido"), `internalCost Decimal(12,2)`, `estimatedMinutes?`, `unit?`, `taxRate Decimal(6,4) @default(0.1300)`, `warrantyEnabled @default(true)`, `warrantyDays @default(45)`, `status`, `notes?`, `quickService @default(false)` (agregado en migración 20260722000148; ver comentario transcrito en §3). Relaciones `category`, `packageItems`, `quoteItems`, `workOrderItems`, `warranties`. Soft-delete.

**ServicePackage** (`service_packages`) — combo con precio propio. `code @unique`, `name`, `price Decimal(12,2)`, `status`. Relación `items`.

**ServicePackageItem** (`service_package_items`) — componente de paquete: `serviceId?` o `productId?`, `quantity Decimal(12,3) @default(1)`. `@@index([packageId])`.

### 2.8 Productos e inventario

**ProductCategory** (`product_categories`) — `name`, `status`.

**Product** (`products`) — producto/repuesto/insumo. `code @unique`, `barcode? @unique` (migración 20260822040338; "código de barras físico (EAN/UPC); se asocia al escanear si aún no lo tiene"), `partNumber?`, `name`, `description?`, `categoryId?`, `brand?`, `presentation?`, `unit?`, `cost Decimal(12,2)`, `price Decimal(12,2)` ("con IVA incluido"), `forSale @default(true)` (migración 20260822173438; "false = insumo de uso interno del taller, no se cotiza ni se vende"), `taxRate @default(0.1300)`, `stockOnHand Decimal(12,3)` ("existencia física"), `minStock Decimal(12,3)`, `locationId?`, `supplierId?` ("proveedor principal"), `status`. Comentario: "disponible = stockOnHand - SUM(reservas activas) [se calcula en la app]". Relaciones `category`, `location`, `supplier`, `movements`, `reservations`, `packageItems`, `quoteItems`, `workOrderItems`, `purchaseOrderItems`, `purchaseItems`. Índices `name`, `partNumber`, `brand`. Soft-delete.

**InventoryLocation** (`inventory_locations`) — ubicación física. `name`, `status`.

**InventoryMovement** (`inventory_movements`) — kardex. "Movimientos append-only. Nunca se editan ni borran; las correcciones se hacen con un nuevo movimiento (REVERSION / CORRECCION). Cantidad con signo según tipo." `type`, `quantity Decimal(12,3)` ("+ entra, - sale"), `unitCost? Decimal(12,2)`, `balanceAfter Decimal(12,3)`, `workOrderId?`, `purchaseId?`, `reservationId?`, `reversalOfId?` ("apunta al movimiento que revierte") — todos FK lógicas —, `reason?`, `createdById?`. Índices `productId`, `type`, `workOrderId`, `createdAt`. Sin soft-delete (no se borra).

**InventoryReservation** (`inventory_reservations`) — "Reserva creada al APROBAR el trabajo. No reduce existencia física. Se consume (descuenta) al confirmar consumo; o se libera si no se usa." `productId`, `workOrderId` (FK real `RESTRICT`), `quantity Decimal(12,3)`, `status ReservationStatus @default(ACTIVA)`, `expiresAt?`, `createdById?`. Índices `productId`, `workOrderId`, `status`.

### 2.9 Proveedores y compras

**Supplier** (`suppliers`) — `code @unique`, `name`, `taxId?`, `phone?`, `email?`, `status`. Relaciones `contacts`, `products`, `purchaseOrders`, `purchases`, `expenses`, `workOrders` (como `externalSupplier`). Soft-delete.

**SupplierContact** (`supplier_contacts`) — `name`, `phone?`, `email?`. `@@index([supplierId])`.

**PurchaseOrder** (`purchase_orders`) — pedido a proveedor. `number @unique`, `supplierId`, `status PurchaseStatus @default(BORRADOR)`, `notes?`, `createdById?`. Relaciones `items`, `purchases`. `@@index([supplierId])`.

**PurchaseOrderItem** (`purchase_order_items`) — `productId?`, `description?`, `quantity Decimal(12,3)`, `unitCost Decimal(12,2)`.

**Purchase** (`purchases`) — recepción de mercadería/factura de compra. `number @unique`, `supplierId`, `purchaseOrderId?`, `documentRef?`, `total Decimal(12,2)`, `receivedAt`, `createdById?`. Relación `items`.

**PurchaseItem** (`purchase_items`) — `productId?`, `description?`, `quantity`, `unitCost`, `previousCost? Decimal(12,2)` ("costo anterior (para mostrar variación)").

### 2.10 Cotizaciones y aprobación digital

**Quote** (`quotes`) — cabecera de cotización. `number @unique`, `customerId`, `vehicleId`, `receptionId?`, `status QuoteStatus @default(BORRADOR)`, `validUntil?`, `promisedAt?`, `diagnosis?` (migración 20260721203605; "diagnóstico visible en la cotización impresa"), `conditions?`, `notes?` ("interno"), `advisorId?`, `branchId?`. Relaciones `versions`, `approvals`, `workOrder` (1:1 inversa). Índices `customerId`, `status`. Soft-delete.

**QuoteVersion** (`quote_versions`) — "Cada cambio a una cotización enviada crea una nueva versión (historial completo)." `versionNumber Int`, `subtotal`, `discountTotal`, `taxTotal`, `total` (todos `Decimal(12,2)`), `isCurrent @default(true)`. `@@unique([quoteId, versionNumber])`. Relaciones `items`, `approvals`.

**QuoteItem** (`quote_items`) — renglón de una versión. `type QuoteItemType`, `serviceId?`, `productId?`, `description`, `supplierNote?` (migración 20260810171254; "proveedor del repuesto, texto libre (solo aplica a REPUESTO)"), `quantity Decimal(12,3) @default(1)`, `unitPrice Decimal(12,2)` ("con IVA incluido"), `unitCost Decimal(12,2)` ("interno, nunca al cliente"), `discount Decimal(12,2)`, `taxRate @default(0.1300)`, `lineTotal`, `decision LineDecision @default(PENDIENTE)` ("aprobación por renglón"). `@@index([quoteVersionId])`.

**CustomerApproval** (`customer_approvals`) — evidencia de la aprobación del cliente sobre una versión. `quoteId`, `quoteVersionId`, `approvedItems Json?` ("ids de renglones aprobados"), `rejectedItems Json?` ("ids de renglones rechazados"), `signerName?`, `signatureUrl?` ("firma en pantalla"), `ipAddress?`, `userAgent?`, `termsAccepted @default(false)`, `comments?`, `approvedAt`. Relación `codes`. `@@index([quoteId])`.

**ApprovalCode** (`approval_codes`) — "Código de 6 dígitos: se guarda HASH (no texto plano), con expiración e intentos." `approvalId?`, `quoteId`, `codeHash`, `expiresAt`, `attempts @default(0)`, `maxAttempts @default(5)`, `usedAt?`, `invalidated @default(false)`. `@@index([quoteId])`.

### 2.11 Órdenes de trabajo

**WorkOrderStatus** (`work_order_statuses`) — estados **en tabla, no enum**. Comentario: "Estados configurables CON semántica de sistema (flags de los que dependen las reglas: QC obligatorio, permite consumo, terminal…). Etiqueta y orden se editan; los flags controlan el flujo." `key @unique`, `label`, `order`, `color?`, `isInitial`, `isTerminal`, `requiresQc`, `allowsConsumption`, `countsAsDelivered`. Relaciones `workOrders`, `statusHistory`.

**WorkOrder** (`work_orders`) — la orden. `number @unique`, `customerId`, `vehicleId`, `receptionId?`, `quoteId? @unique` (**una cotización genera a lo sumo una orden**), `statusId` (FK real `RESTRICT`), `area?`, `bayId?`, `priority`, `promisedAt?`, `deliveredAt?`.
Bloque "Costos y venta (calculados; internos salvo permiso)": `saleGross`, `discountTotal`, `taxTotal`, `saleNet`, `productCost`, `laborCost`, `externalCost`, `warrantyCost`, `grossProfit` (todos `Decimal(12,2)`), `marginPct Decimal(6,4)`.
`estimatedMinutes?`, `actualMinutes?`, `internalNotes?`, `advisorId?`, `branchId?`.
Bloque de factura externa (migración 20260721200918): `externalInvoiceNumber?`, `externalSupplierId?` (FK real a `Supplier`, `SET NULL`), `costsConfirmedById?` ("FK lógica -> User (Fausto/gerente/superadmin)"), `costsConfirmedAt?`. Comentario transcrito en §3.
Relaciones: `items`, `assignments`, `statusHistory`, `timeEntries`, `workNotes`, `reservations`, `qualityResults`, `warranties`, `payments`, `paymentAllocations`, `receivables`, `taxDocuments`, `inspections`. Índices `customerId`, `vehicleId`, `statusId`, `promisedAt`. Soft-delete.

**WorkOrderItem** (`work_order_items`) — renglón de la orden (mismo shape que `QuoteItem`, sin `supplierNote` ni `decision`). `type QuoteItemType`, `serviceId?`, `productId?`, `description`, `quantity`, `unitPrice`, `unitCost`, `discount`, `taxRate`, `lineTotal`, `isAdditional @default(false)` ("trabajo adicional (requiere nueva aprobación)"), `approved @default(false)`, `completedAt?` y `completedById?` (migración 20260812223210; "el técnico/jefe de mecánicos la marca hecha (repuesto cambiado / trabajo realizado)"; `completedById` "FK lógica -> User, igual que WorkOrder.advisorId"). `@@index([workOrderId])`.

**WorkOrderAssignment** (`work_order_assignments`) — técnico asignado. `role?` ("principal, apoyo"), `assignedAt`. `@@unique([workOrderId, technicianId])` (un técnico una sola vez por orden). FK reales `RESTRICT`.

**WorkOrderStatusHistory** (`work_order_status_history`) — bitácora de cambios de estado. `statusId`, `changedById?`, `note?`, `changedAt`. `@@index([workOrderId])`.

**TimeEntry** (`time_entries`) — cronómetro por técnico. `workOrderId`, `technicianId`, `workOrderItemId?` (FK lógica), `state TimeEntryState @default(EN_CURSO)`, `startedAt`, `pausedAt?`, `resumedAt?`, `finishedAt?`, `effectiveMinutes?`, `pauseReason?`. Índices `workOrderId`, `technicianId`.

**WorkOrderNote** (`work_order_notes`) — nota de bitácora. `body`, `visibleToCustomer @default(false)`, `createdById?`.

### 2.12 Control de calidad

**QualityChecklistTemplate** (`quality_checklist_templates`) — `name`, `area?`, `items Json` ("puntos del checklist (algunos obligatorios)"), `status`.

**QualityChecklistResult** (`quality_checklist_results`) — `workOrderId`, `templateId`, `results Json` ("respuesta por punto"), `passed @default(false)`, `completedById?`, `reviewedById?`, `notes?`. `@@index([workOrderId])`.

### 2.13 Garantías

**Warranty** (`warranties`) — garantía emitida por orden/servicio. `workOrderId`, `serviceId?`, `vehicleId`, `type WarrantyType @default(MANO_OBRA)`, `days @default(45)`, `startAt @default(now())` ("desde la entrega"), `endAt?`, `conditions?`, `exclusions?`. Relación `claims`. `@@index([workOrderId])`.

**WarrantyClaim** (`warranty_claims`) — reclamo. `warrantyId`, `customerId`, `vehicleId`, `status WarrantyClaimStatus @default(ABIERTO)`, `reason?`, `diagnosis?`, `resolution?`, `internalCost Decimal(12,2)` ("costo de garantía (no es venta nueva)"), `claimedAt`, `authorizedById?`. Índices `warrantyId`, `customerId`.

### 2.14 Pagos y cuentas por cobrar

**PaymentMethod** (`payment_methods`) — catálogo. `key @unique` ("efectivo, tarjeta, transferencia, credito, otros"), `name`, `isCash`, `isCredit`, `status`.

**Payment** (`payments`) — cobro. `number @unique`, `customerId`, `workOrderId?`, `receptionId?` (migración 20260829084814; "cuota de diagnóstico sin cotización — ver chargeReceptionDiagnosticFee"), `cashSessionId?`, `paymentMethodId` (FK `RESTRICT`), `amount Decimal(12,2)`, `isAdvance @default(false)` ("anticipo"), `status PaymentStatus @default(REGISTRADO)`, `transferRef?`, `bankName?` (migración 20260721200918; "banco cuando el método es transferencia"; valores en `lib/banks.ts`: Banco Agrícola, Banco de América Central, Banco Hipotecario, Banco Azul), `notes?`, `createdById?`. Relaciones `allocations`, `receivablePayments`, `refunds`. Índices `customerId`, `workOrderId`, `receptionId`, `cashSessionId`. Sin soft-delete: se anula con `status=ANULADO`.

**PaymentAllocation** (`payment_allocations`) — "Reparte un pago (o pago mixto) entre una o varias órdenes." `paymentId`, `workOrderId?`, `amount`. `@@index([paymentId])`.

**Receivable** (`receivables`) — cuenta por cobrar. `customerId`, `workOrderId?`, `originalAmount`, `balance`, `dueDate?`, `isSettled @default(false)`. Relación `payments` (`ReceivablePayment`). Índices `customerId`, `dueDate`.

**ReceivablePayment** (`receivable_payments`) — aplica un `Payment` a un `Receivable`. `amount`. Índices `receivableId`, `paymentId`.

**Refund** (`refunds`) — devolución de dinero. `paymentId?`, `workOrderId?` (lógica), `amount`, `reason?`, `authorizedById?`. `@@index([paymentId])`.

### 2.15 Caja

**CashRegister** (`cash_registers`) — caja física. `name`, `branchId?` (lógica), `status`. Seed: una sola, `cash_register_main` "Caja principal" ("una sola caja física para el MVP de una sucursal").

**CashSession** (`cash_sessions`) — turno de caja. `cashRegisterId`, `cashierId` ("FK real -> User", `RESTRICT`), `status CashSessionStatus @default(ABIERTA)`, `openingFloat Decimal(12,2)`, `openedAt`, `closedAt?`. Relaciones `movements`, `payments`, `closure` (1:1), `expenses`. Índices `cashRegisterId`, `cashierId`, `status`. El código abre sesión buscando `{ cashRegisterId: MAIN_REGISTER_ID, status: "ABIERTA" }` (`modules/cash/actions.ts:19`).

**CashMovement** (`cash_movements`) — movimiento dentro de la sesión. `type CashMovementType`, `amount`, `paymentId?`, `expenseId?` (lógicas), `reference?`, `createdById?`. `@@index([cashSessionId])`.

**DailyClosure** (`daily_closures`) — cierre de una sesión. `cashSessionId @unique` (**un solo cierre por sesión**). Calculados por sistema: `expectedCash`, `cardTotal`, `transferTotal`, `otherTotal`, `expenseTotal`, `withdrawalTotal`, `refundTotal`. Contados a mano: `countedCash`, y (migración 20260722170927) `countedCard`, `countedTransfer`, `countedOther` con sus `cardDifference`, `transferDifference`, `otherDifference`. `difference` (efectivo), `explanation?`, `closedById?`, `reopenedById?`, `reopenedAt?`. Todo `Decimal(12,2) @default(0)`.

### 2.16 Gastos

**ExpenseCategory** (`expense_categories`) — `name`, `status`. Seed: 7 categorías con ids fijos.

**Expense** (`expenses`) — `categoryId?`, `type ExpenseType @default(OPERATIVO)`, `area?`, `supplierId?` (FK real `SET NULL`), `cashSessionId?` (FK real), `workOrderId?` (lógica), `description`, `amount Decimal(12,2)`, `taxRate Decimal(6,4) @default(0)` (**los gastos por default no llevan IVA**), `status ExpenseStatus @default(PENDIENTE)`, `documentRef?`, `isConfidential @default(false)`, `createdById?`, `authorizedById?`. Índices `categoryId`, `cashSessionId`. Soft-delete.

### 2.17 Documentos tributarios externos (DTE)

**ExternalTaxDocument** (`external_tax_documents`) — conciliación con el emisor externo. `type TaxDocumentType`, `status @default(EMITIDO)`, `customerId?`, `workOrderId?`, `paymentId?` (lógica), `generationCode? @unique` ("código de generación DTE"), `controlNumber?` ("número de control"), `receptionSeal?` ("sello de recepción (Hacienda)"), `issuedAt?`, `amount Decimal(12,2)`, `fileUrl?`, `notes?`. Índices `workOrderId`, `controlNumber`.

### 2.18 Metas y comisiones ("motor preparado; sin fórmulas fijas todavía")

**Goal** (`goals`) — meta mensual. `subjectType GoalSubjectType`, `subjectId?` ("userId / technicianId / area"), `periodMonth Int` ("1-12"), `periodYear Int`, `target Decimal(12,2)`, `metric String` ("ventas, utilidad, órdenes, etc."), `status`. `@@index([periodYear, periodMonth])`.

**CommissionRule** (`commission_rules`) — `name`, `active @default(false)` ("\"Reglas pendientes de configuración\""), `area?`. Relación `versions`.

**CommissionRuleVersion** (`commission_rule_versions`) — `versionNumber`, `baseType CommissionBaseType`, `config Json` ("parámetros de la fórmula (porcentaje, rangos, bonos, exclusiones…)"), `effectiveFrom?`, `effectiveTo?`. `@@unique([ruleId, versionNumber])`.

**CommissionEntry** (`commission_entries`) — comisión calculada. `ruleVersionId`, `subjectType`, `subjectId`, `workOrderId?`, `periodMonth`, `periodYear`, `amount`, `status CommissionEntryStatus @default(SIMULADA)`. Índices `subjectId`, `[periodYear, periodMonth]`.

### 2.19 Recordatorios, notificaciones y comunicaciones

**Reminder** (`reminders`) — `type ReminderType`, `status @default(PENDIENTE)`, `customerId?`, `vehicleId?` (FK reales `SET NULL`), `dueDate?`, `dueMileage?`, `message?`, `createdById?`. Índices `status`, `dueDate`.

**Notification** (`notifications`) — notificación interna a usuario. `userId?` (lógica), `title`, `body?`, `status NotificationStatus`, `readAt?`. `@@index([userId])`.

**CommunicationLog** (`communication_logs`) — bitácora de contacto con el cliente. `channel CommunicationChannel`, `direction?` ("saliente / entrante"), `body?`, `createdById?`. `@@index([customerId])`.

### 2.20 Auditoría

**AuditLog** (`audit_logs`) — "append-only; nunca se borra". `actorId?` (FK real a `User`, `SET NULL`), `action AuditAction`, `entity String`, `entityId?`, `beforeData Json?`, `afterData Json?`, `reason?`, `ipAddress?`. Índices `[entity, entityId]`, `actorId`, `createdAt`. `_tmp-wipe-prod.ts` lo conserva explícitamente.

### 2.21 Impresión en ticketera

**PrintJob** (`print_jobs`) — cola para el agente local (migración 20260828170844). `workOrderId?` (lógica), `payload String` (ESC/POS en base64), `status PrintJobStatus @default(PENDIENTE)`, `error?`, `completedAt?`. `@@index([status, createdAt])`. Consumido por `app/api/print-jobs/*` y `printer-agent/print-agent.js`.

---

## 3. Comentarios del schema que expresan reglas (transcripción)

Encabezado (`schema.prisma:1-28`):

> Decisiones de diseño ya acordadas:
> 1. Precios de catálogo con IVA INCLUIDO (13%). Desglose hacia atrás: base = precio / (1 + tasaIVA). Ver BusinessSettings.defaultTaxRate.
> 2. Período de cierre MENSUAL (cierres, comisiones, "no recalcular cerrado").
> 3. El usuario gerente TAMBIÉN es cajero/compras: ve e ingresa costos. Por eso los permisos se asignan por USUARIO (UserRole + UserPermission), no se amarran capacidades al nombre del rol. AuditLog es el control compensatorio.
> 4. Inventario: se RESERVA al aprobar el trabajo, se DESCUENTA al confirmar consumo, y el EFECTIVO entra solo al pagar. disponible = onHand - reservado.
> 5. DTE: la emisión fiscal vive en el sistema EXTERNO del cliente. El ERP no reconstruye el emisor; solo CONCILIA cada venta con su DTE por el código de generación / número de control (ver ExternalTaxDocument).
>
> Convenciones:
> - IDs: cuid(). Dinero: Decimal(12,2). Cantidades: Decimal(12,3). Tasas: Decimal(6,4) (0.1300 = 13%).
> - Soft-delete: campo deletedAt (nulo = activo). Nunca se borra físicamente pagos, cierres, inventario, aprobaciones, órdenes ni auditoría (sec. 33).
> - Referencias cruzadas a User y Branch (createdById, advisorId, branchId…) se guardan como FK LÓGICA escalar (String indexado), no como relación Prisma, para mantener User/Branch manejables. Las relaciones del GRAFO del dominio (cliente↔vehículo↔orden↔pago↔caja, producto↔inventario…) sí son relaciones Prisma con integridad referencial. Se pueden endurecer a FK reales por módulo en las migraciones cuando convenga.

Enums:
> ENUMS (semántica del sistema de la que depende el código). Los estados de ORDEN DE TRABAJO van en tabla (WorkOrderStatus): llevan reglas.
> `CreditMovementType.CARGO` — venta a crédito -> aumenta cuenta por cobrar · `ABONO` — pago posterior -> reduce cuenta por cobrar
> `TaxDocumentType`: FE = Factura (consumidor final) · CCF = Comprobante de Crédito Fiscal · NC = Nota de Crédito · ND = Nota de Débito · FSE = Factura Sujeto Excluido

Identidad:
> Sección: AUTENTICACIÓN, ROLES Y PERMISOS (permisos por usuario + auditoría)
> `Role.key` — superadmin, gerente, asesor, tecnico, inventario, cajero, carwash, auditor
> `Permission.key` — ej. work_order.view, cost.view, credit.authorize, cash.open
> `Permission.action` — ver, crear, modificar, eliminar, autorizar, anular, exportar, imprimir, ver_costos, ver_utilidades, aplicar_descuento, reabrir
> `UserPermission` — Concesión / revocación de un permiso a un usuario específico (caso gerente=cajero). `granted` false = revocado explícitamente

Configuración:
> `BusinessSettings.legalName` — Rivera's Investments Group S.A.S. de C.V. · `commercialName` — Elite Service · `defaultTaxRate` — IVA 13% · `pricesIncludeTax` — precios con IVA incluido · `settings` — otras llaves configurables (leyendas, plantillas…)

Clientes / vehículos:
> `Customer.fullName` — o razón social · `branchId` — FK lógica -> Branch · `createdById` — FK lógica -> User
> `CustomerCreditAuthorization.authorizedById` — FK lógica -> User (nunca el asesor)
> `Vehicle.plate` — puede faltar al cotizar; se exige al registrar la orden
> `VehicleOwner` — Relación cliente<->vehículo (permite varios dueños e historial al cambiar propietario).
> `VehicleMileageHistory.source` — recepción, servicio, manual

Técnicos / citas:
> `Technician.userId` — FK real -> User (un técnico puede ser usuario) · `isHelper` — ayudante (no debe quedar solo como único mecánico)
> `AvailabilityBlock.reason` — ausencia, descanso, bloqueo
> `Appointment.advisorId`, `Reception.advisorId`, `Quote.advisorId`, `WorkOrder.advisorId` — FK lógica -> User

Recepción / media:
> `Inspection.results` — resultados por ítem (checklist configurable)
> `MediaFile` — Fotografías/documentos. Polimórfico por (ownerType, ownerId) para no inflar las relaciones. Cada archivo se marca interno o visible para el cliente.

Catálogo:
> `ServiceCatalog.suggestedPrice` — con IVA incluido
> `ServiceCatalog.quickService` — Servicio de precio fijo y publicado (cambio de aceite, frenos, GDI...). Se vende directo como orden de trabajo, sin pasar por Cotización — a diferencia de un diagnóstico de costo variable (ej. suspensión), que sí necesita que Fausto revise el carro antes de cotizar la reparación.

Inventario:
> `Product.barcode` — código de barras físico (EAN/UPC); se asocia al escanear si aún no lo tiene · `price` — con IVA incluido · `forSale` — false = insumo de uso interno del taller, no se cotiza ni se vende · `stockOnHand` — existencia física · `supplierId` — proveedor principal
> `Product` — disponible = stockOnHand - SUM(reservas activas) [se calcula en la app]
> `InventoryMovement` — Movimientos append-only. Nunca se editan ni borran; las correcciones se hacen con un nuevo movimiento (REVERSION / CORRECCION). Cantidad con signo según tipo. `quantity` — + entra, - sale · `reversalOfId` — apunta al movimiento que revierte
> `InventoryReservation` — Reserva creada al APROBAR el trabajo. No reduce existencia física. Se consume (descuenta) al confirmar consumo; o se libera si no se usa.
> `PurchaseItem.previousCost` — costo anterior (para mostrar variación)

Cotización:
> `Quote.diagnosis` — diagnóstico visible en la cotización impresa · `notes` — interno
> `QuoteVersion` — Cada cambio a una cotización enviada crea una nueva versión (historial completo).
> `QuoteItem.supplierNote` — proveedor del repuesto, texto libre (solo aplica a REPUESTO) · `unitPrice` — con IVA incluido · `unitCost` — interno, nunca al cliente · `decision` — aprobación por renglón
> `CustomerApproval.approvedItems` — ids de renglones aprobados · `rejectedItems` — ids de renglones rechazados · `signatureUrl` — firma en pantalla
> `ApprovalCode` — Código de 6 dígitos: se guarda HASH (no texto plano), con expiración e intentos.

Orden de trabajo:
> `WorkOrderStatus` — Estados configurables CON semántica de sistema (flags de los que dependen las reglas: QC obligatorio, permite consumo, terminal…). Etiqueta y orden se editan; los flags controlan el flujo.
> `WorkOrder` — Costos y venta (calculados; internos salvo permiso)
> `WorkOrder` bloque externo — Costo real de factura externa (repuestos comprados fuera). Interno, nunca en el ticket del cliente; visible solo con permiso cost.view. No se puede cerrar la orden (status countsAsDelivered/terminal) sin confirmar este bloque — costsConfirmedAt se llena al confirmar (puede ser "sin factura externa" si el trabajo fue solo mano de obra). `costsConfirmedById` — FK lógica -> User (Fausto/gerente/superadmin)
> `WorkOrderItem.isAdditional` — trabajo adicional (requiere nueva aprobación) · `completedAt` — el técnico/jefe de mecánicos la marca hecha (repuesto cambiado / trabajo realizado) · `completedById` — FK lógica -> User, igual que WorkOrder.advisorId
> `WorkOrderAssignment.role` — principal, apoyo
> `QualityChecklistTemplate.items` — puntos del checklist (algunos obligatorios) · `QualityChecklistResult.results` — respuesta por punto

Garantía / pagos / caja:
> `Warranty.startAt` — desde la entrega
> `WarrantyClaim.internalCost` — costo de garantía (no es venta nueva)
> `PaymentMethod.key` — efectivo, tarjeta, transferencia, credito, otros
> `Payment.receptionId` — cuota de diagnóstico sin cotización — ver chargeReceptionDiagnosticFee · `isAdvance` — anticipo · `bankName` — banco cuando el método es transferencia
> `PaymentAllocation` — Reparte un pago (o pago mixto) entre una o varias órdenes.
> `CashSession.cashierId` — FK real -> User
> `DailyClosure` — Conteo manual por método (aparte del total que ya calcula el sistema a partir de los cobros registrados) — para poder verificar cada método contra el comprobante físico (voucher de datáfono, comprobante de transferencia/QR, etc.), igual que se hace con el efectivo.

DTE / metas / comunicaciones / auditoría / impresión:
> Sección: DOCUMENTOS TRIBUTARIOS EXTERNOS (DTE) — conciliación con el emisor externo. `generationCode` — código de generación DTE · `controlNumber` — número de control · `receptionSeal` — sello de recepción (Hacienda)
> Sección: METAS Y COMISIONES (motor preparado; sin fórmulas fijas todavía). `Goal.subjectId` — userId / technicianId / area · `periodMonth` — 1-12 · `metric` — ventas, utilidad, órdenes, etc. · `CommissionRule.active` — "Reglas pendientes de configuración" · `CommissionRuleVersion.config` — parámetros de la fórmula (porcentaje, rangos, bonos, exclusiones…)
> `CommunicationLog.direction` — saliente / entrante
> Sección: AUDITORÍA (append-only; nunca se borra)
> `PrintJob` — El servidor (Vercel) no puede llegar a la IP local de la impresora — un programita en una computadora del taller consulta esta cola por internet (sondeo cada pocos segundos) y es él quien le manda el ticket a la impresora dentro de su misma red. `payload` va en base64 porque el contenido ESC/POS incluye bytes crudos (incluido 0x00), que un campo de texto no puede guardar tal cual. Ver printer-agent/ en el repo.

---

## 4. Qué siembra `prisma/seed.ts`

Idempotente (upsert por llave única). Orden de ejecución: settings → sucursal → permisos → roles → usuarios →
estados de orden → métodos de pago → categorías de gasto → plantilla de inspección → técnicos → productos →
caja → categorías y servicios.

### 4.1 BusinessSettings (`id = "settings_default"`)
`legalName "Rivera's Investments Group S.A.S. de C.V."`, `commercialName "Elite Service"`, `defaultTaxRate 0.13`,
`pricesIncludeTax true`, `currency "USD"`, `timezone "America/El_Salvador"`, `laborWarrantyDays 45`,
`ticketWidthMm 80`, `settings.printHeader = { address: "Paque Residencial San Luis, Local 6A, San Salvador",
whatsapp: "7742-1900", nit: "0614-070624-103-3", nrc: "3446580", giro: "Alquiler de equipo de transporte terrestre" }`.
En re-seed solo actualiza `settings.printHeader`.

### 4.2 Branch
`id "branch_main"`, `name "Casa Matriz"`, `isDefault true`.

### 4.3 Permisos (78 claves, `module.action`)

| Módulo | Claves |
|---|---|
| users | `users.view`, `users.create`, `users.update`, `users.deactivate` |
| roles | `roles.manage` |
| customers | `customers.view`, `customers.create`, `customers.update` |
| credit | `credit.view`, `credit.authorize`, `credit.override` ("Autorizar exceso de crédito") |
| vehicles | `vehicles.view`, `vehicles.create`, `vehicles.update` |
| appointments | `appointments.view`, `appointments.create`, `appointments.update` |
| receptions | `receptions.view`, `receptions.create` |
| inspections | `inspections.perform` |
| services | `services.view`, `services.manage`, `services.price` ("Cambiar precios de catálogo") |
| products | `products.view`, `products.manage` |
| inventory | `inventory.view`, `inventory.adjust`, `inventory.confirm_consumption` |
| suppliers | `suppliers.view`, `suppliers.manage` |
| purchases | `purchases.view`, `purchases.create` (comentario: "compras SÍ ven costo") |
| quotes | `quotes.view`, `quotes.create`, `quotes.update`, `quotes.send`, `quotes.discount` |
| approvals | `approvals.register` |
| work_orders | `work_orders.view`, `work_orders.create`, `work_orders.update`, `work_orders.status`, `work_orders.void`, `work_orders.view_prices`, `work_orders.view_all` |
| cost / profit | `cost.view`, `profit.view` (comentario: "lo que el asesor NO ve; el gerente SÍ") |
| time | `time.track` |
| quality | `quality.perform`, `quality.review` |
| warranties | `warranties.view`, `warranties.manage` |
| payments | `payments.view`, `payments.register`, `payments.void`, `payments.diagnostic_override` |
| cash | `cash.view`, `cash.open`, `cash.close`, `cash.reopen` ("Reabrir caja (supervisión)"), `cash.movement` |
| expenses | `expenses.view`, `expenses.create`, `expenses.authorize` |
| tax_docs | `tax_docs.view`, `tax_docs.link` ("Conciliar/enlazar DTE") |
| goals | `goals.view`, `goals.manage` |
| commissions | `commissions.view`, `commissions.configure` |
| reminders | `reminders.view`, `reminders.manage` |
| reports | `reports.view`, `reports.financial`, `reports.export` |
| audit | `audit.view` |
| settings | `settings.view`, `settings.manage` |

Comentarios del seed sobre permisos:
- `work_orders.view_prices`: "Precio de venta por línea (lo que se le cobra al cliente) — separado de work_orders.view para que roles de taller (técnico, jefe de mecánicos) vean el trabajo a hacer sin ver montos en dólares."
- `work_orders.view_all`: "Sin este permiso, work_orders.view queda acotado a las órdenes donde el usuario aparece como técnico asignado (ver getWorkOrderScopeFilter) — así un técnico solo ve el trabajo que se le designó, no todo el taller."
- `payments.diagnostic_override`: "Cobrar la cuota de diagnóstico ANTES de tener una cotización completa (el cliente se retiró y la cotización se le manda después por WhatsApp) — salta el flujo normal, así que exige el código de un superadmin para autorizar, no el de quien está cobrando."

El seed **revoca** del rol lo que ya no esté en su lista (`rolePermission.deleteMany notIn`): la lista del seed es la fuente de verdad de los permisos de rol.

### 4.4 Roles (9, todos `isSystem: true`)

| key | name | Permisos |
|---|---|---|
| `superadmin` | Super administrador | **ALL** (los 78). Único rol con `work_orders.void`, `payments.diagnostic_override`, `inspections.perform`+`time.track`+`quality.perform`+`payments.register`+`cash.open/close/movement`+`tax_docs.link` juntos. |
| `gerente` | Gerente — "Supervisión del negocio: ve costos y utilidades, autoriza crédito/gastos, configura." | users.* (4) + roles.manage; customers.* (3); credit.* (3); vehicles.* (3); appointments.* (3); receptions.view/create; services.* (3); products.* (2); inventory.* (3); suppliers.* (2); purchases.* (2); quotes.view/create/update/send/discount; approvals.register; work_orders.view/create/update/status/view_prices/view_all; cost.view; profit.view; quality.review; warranties.* (2); payments.view/void; cash.view/reopen; expenses.* (3); tax_docs.view; goals.* (2); commissions.* (2); reminders.* (2); reports.* (3); audit.view; settings.* (2). **No tiene**: `work_orders.void`, `inspections.perform`, `time.track`, `quality.perform`, `payments.register`, `payments.diagnostic_override`, `cash.open`, `cash.close`, `cash.movement`, `tax_docs.link`. |
| `asesor` | Asesor de servicio — "Recibe vehículos y registra el servicio de entrada. NO arma/envía cotizaciones ni ve costos." | customers.* (3); credit.view; vehicles.* (3); appointments.* (3); receptions.view/create; inspections.perform; services.view; products.view; inventory.view; quotes.view; work_orders.view/create/update/status/view_prices/view_all; warranties.view/manage; reminders.view/manage; reports.view. Comentario: "El asesor (vendedor de pista, ej. Heber) registra a qué servicio viene el vehículo y arma la orden cuando es precio fijo — pero NO arma ni envía cotizaciones de reparación (mano de obra/repuestos): eso es exclusivo de Fausto (rol gerente) y superadmin." |
| `tecnico` | Técnico / Mecánico — "Ejecuta el trabajo asignado y registra tiempos. NO ve precios ni costos." | work_orders.view, work_orders.status, inspections.perform, time.track, inventory.view, inventory.confirm_consumption, quality.perform. (Sin `view_all`: solo ve las órdenes asignadas.) |
| `inventario` | Encargado de inventario | products.* (2); inventory.* (3); suppliers.* (2); purchases.* (2); cost.view; reports.view. |
| `cajero` | Cajero — "Opera la caja: cobros, pagos, cierres y enlace del DTE. NO ve costos." | cash.view/open/close/movement; payments.view/register; tax_docs.view/link; expenses.view/create; customers.view; quotes.view; work_orders.view/view_prices/view_all. |
| `carwash` | Carwash | customers.view; vehicles.view; receptions.view/create; work_orders.view/create/status/view_prices/view_all; services.view. |
| `jefe_mecanicos` | Jefe de mecánicos — "Supervisa la pista: asigna técnicos, cambia el estado del trabajo, revisa control de calidad. NO ve precios ni costos." | work_orders.view/view_all/update/status; inspections.perform; time.track; inventory.view; inventory.confirm_consumption; quality.perform; quality.review. |
| `auditor` | Auditor — "Solo lectura, incluida la bitácora y los reportes financieros." | customers.view; vehicles.view; receptions.view; quotes.view; work_orders.view/view_prices/view_all; inventory.view; purchases.view; payments.view; cash.view; expenses.view; tax_docs.view; cost.view; profit.view; reports.* (3); audit.view. |

Nota: el comentario de `Role.key` en el schema no lista `jefe_mecanicos`; el seed sí lo crea.

### 4.5 Usuarios base (login por código de 4 dígitos)

| email | fullName | código inicial | roles |
|---|---|---|---|
| `admin@eliteservice.sv` | Administrador del sistema | `9999` | superadmin |
| `kevin@eliteservice.sv` | Kevin Rivera | `7820` | superadmin ("dueño — única cuenta (junto con admin) que puede anular órdenes") |
| `fausto@eliteservice.sv` | Fausto | `0000` | asesor + cajero + gerente ("cotiza, cobra, ve costos y hace cierres") |
| `vendedor@eliteservice.sv` | Vendedor (TODO nombre real) | `1111` | asesor + inventario ("recibe el vehículo y maneja bodega") |
| `jefe.mecanicos@eliteservice.sv` | Jefe de mecánicos (TODO nombre real) | `2222` | jefe_mecanicos |

- `DEACTIVATED_USER_EMAILS = ["gerente@eliteservice.sv"]` → `status INACTIVO`. Razón: "se desactiva en vez de borrarse (CashSession.cashierId es FK real y podría referenciarla). Login exige status ACTIVO, así que el código 2222 deja de funcionar."
- `passwordHash = bcrypt.hash(code, 10)`; el `update` del upsert no toca `passwordHash` ("si se cambia después desde /usuarios, volver a correr el seed no lo pisa").
- Ningún usuario del seed usa `directGrants` (el mecanismo `UserPermission` existe pero el seed no lo ejercita).
- Comentario de diseño: "FAUSTO (asesor + cajero + gerente) cotiza, cobra, ve costos/utilidades y hace los cierres de caja — es quien cuadra el negocio. […] VENDEDOR (asesor + inventario) recibe el vehículo y maneja bodega, pero no cobra ni ve costos — así ninguno de los dos puede hacer todo el ciclo solo, y siempre queda registrado quién hizo cada parte."

### 4.6 Estados de orden de trabajo (12)

Semántica de flags según el seed: `allowsConsumption` "desde este estado se puede confirmar consumo de repuestos"; `requiresQc` "este estado exige control de calidad aprobado para avanzar"; `countsAsDelivered` "cuenta como entregado (para métricas/tiempos)".

| key | label | order | color | isInitial | isTerminal | requiresQc | allowsConsumption | countsAsDelivered |
|---|---|---|---|---|---|---|---|---|
| `recibido` | Recibido | 10 | #64748B | **sí** | | | | |
| `diagnostico` | En diagnóstico | 20 | #0EA5E9 | | | | | |
| `por_aprobar` | Esperando aprobación | 30 | #F59E0B | | | | | |
| `aprobado` | Aprobado | 40 | #6366F1 | | | | **sí** | |
| `recepcion_reparacion` | Recepción para reparación | 42 | #0EA5E9 | | | | **sí** | |
| `lista_asignacion` | Lista para asignación | 46 | #6366F1 | | | | **sí** | |
| `en_proceso` | En proceso | 50 | #3B82F6 | | | | **sí** | |
| `control_calidad` | Control de calidad | 60 | #8B5CF6 | | | **sí** | **sí** | |
| `listo` | Listo para entrega | 70 | #10B981 | | | | | |
| `entregado` | Entregado | 80 | #22C55E | | | | | **sí** |
| `cerrado` | Cerrado | 90 | #15803D | | **sí** | | | **sí** |
| `cancelado` | Cancelado | 100 | #EF4444 | | **sí** | | | |

Comentario sobre `recepcion_reparacion`: "Nace aquí (no en 'recibido') la orden que viene de una cotización ya aprobada — ese tramo inicial ya lo vivió como cotización, repetirlo es justo la confusión de 'no sé en qué va' que se quería resolver." Los `order` 42 y 46 (fuera de la decena) delatan que se insertaron después del diseño original.

### 4.7 Métodos de pago (5)

| key | name | isCash | isCredit |
|---|---|---|---|
| `efectivo` | Efectivo | sí | |
| `tarjeta` | Tarjeta | | |
| `transferencia` | Transferencia ("banco va en Payment.bankName") | | |
| `credito` | Crédito 30 días | | sí |
| `link_pago` | Link de pago | | |

(El comentario del schema mencionaba `otros`; el seed no lo crea y agrega `link_pago`.)

### 4.8 Categorías de gasto (7, ids fijos)
`expense_cat_combustible` Combustible · `expense_cat_papeleria` Papelería y oficina · `expense_cat_alimentacion` Alimentación · `expense_cat_herramientas` Herramientas y equipo · `expense_cat_servicios` Servicios (agua, luz, internet) · `expense_cat_transporte` Transporte y mandados · `expense_cat_otros` Otros.

### 4.9 Plantilla de inspección de recepción
`InspectionTemplate id "insp_template_recepcion"`, name "Inspección de recepción", area `TALLER`. 10 ítems:

| id | label | order | required |
|---|---|---|---|
| insp_item_01 | Llantas y presión | 10 | |
| insp_item_02 | Luces delanteras y traseras | 20 | |
| insp_item_03 | Espejos | 30 | |
| insp_item_04 | Limpiaparabrisas | 40 | |
| insp_item_05 | Nivel de combustible | 50 | |
| insp_item_06 | Tablero / testigos encendidos | 60 | |
| insp_item_07 | Radio / panel electrónico | 70 | |
| insp_item_08 | Tapicería e interiores | 80 | |
| insp_item_09 | Golpes o rayones visibles (carrocería) | 90 | **sí** |
| insp_item_10 | Objetos de valor visibles | 100 | |

### 4.10 Técnicos (4, sin `userId`, `isHelper false`)
`tech_01` Jose Torres · `tech_02` Miguel Zelada · `tech_03` Luis Cuestas · `tech_04` Juan Carlos.

### 4.11 Productos (5, precio con IVA incluido)

| code | name | unit | cost | price | stockOnHand | minStock |
|---|---|---|---|---|---|---|
| PRD-0001 | Aceite de motor 5W-30 (galón) | galón | 12.00 | 18.50 | 40 | 10 |
| PRD-0002 | Filtro de aceite | unidad | 3.50 | 7.00 | 25 | 5 |
| PRD-0003 | Filtro de aire | unidad | 5.00 | 8.50 | 15 | 5 |
| PRD-0004 | Juego de balatas delanteras | juego | 22.00 | 38.00 | 8 | 4 |
| PRD-0005 | Bujía | unidad | 2.50 | 5.00 | 60 | 20 |

El seed **sí pisa** `cost`, `price`, `stockOnHand`, `minStock` en re-seed (a diferencia de servicios).

### 4.12 Caja
`CashRegister id "cash_register_main"`, name "Caja principal".

### 4.13 Catálogo de servicios (15 categorías, 84 servicios)
Comentario: "Extraído de 'COSTO SERVICIOS ELITE S.xlsx' (hojas TALLER COSTOS y CARWASH). Nombres y precios tal cual el Excel del negocio; internalCost = TOTAL COSTO (mano de obra + insumos + otros) de esa misma hoja. suggestedPrice ya incluye IVA (decisión #1); taxRate usa el default de 13% del schema. Las categorías LIMPIEZA DE TAPICERIA, PULIDO DE PINTURA, PULIDO DE SILVINES y LAVADO DE CHASIS quedan creadas sin servicios: el Excel no trae precio para ellas todavía."

Categorías (`area`): TALLER → SERVICIOS VARIOS Y DIAGNOSTICOS, SISTEMA DE FRENOS, CAMBIOS DE ACEITE, AFINADO MENOR, SUSPENSION DELANTERA SEDAN, SUSPENSION TRASERA SEDAN, SUSPENSION DELANTERA CAMIONETA, SUSPENSION TRASERA CAMIONETA. CARWASH → CARWASH SEDAN PREMIUM, CARWASH CAMIONETA PREMIUM, CARWASH PICK UP PREMIUM, LIMPIEZA DE TAPICERIA, PULIDO DE PINTURA, PULIDO DE SILVINES, LAVADO DE CHASIS.

Servicios `SRV-0001`…`SRV-0084`. Resumen por grupo (precio con IVA / costo interno / minutos):
- Diagnósticos (`DIAGNOSTICO`): AIRE ACONDICIONADO 1234YF 100.00/38.6/30 · AIRE ACONDICIONADO R134A 40.00/21.6/30 · ESCANEADO COMPUTARIZADO 15.00/3.6/30 · DIAGNOSTICO DE SUSPENSION 19.99/7.2/60 · **GDI 59.99/0/null, quickService** ("precio estándar confirmado por el negocio. Costo interno y minutos no se dieron todavía […] Es precio fijo (folleto) — no necesita diagnóstico previo, va directo a orden por Servicios rápidos.").
- Frenos (`MANO_OBRA`): MANTENIMIENTO FRENOS INDIV 25/5.45/30 · RECTIFICADO (PAR) 25/20.8/90 · **MANTENIMIENTO COMPLETO SEDAN 54.99 / CAMIONETA 64.99 / PICK UP 74.99, costo 36.25, 120 min, quickService**.
- Cambios de aceite (`MANT_PREVENTIVO`): DELVAC 15W40 y 10W30 125/61.2/45 · ACEITE MOBIL FULL SINTETICO 75/42/45 **quickService** · VALVOLINE FULL SINTETICO 90/46.38 · VALVOLINE SEMISINTETICO 70/43.03 · aceites de caja ATF HK 165/106.05, ATF HK4 165/108.8, CVT IDEMITSU 185/113.95, CVT MOBIL 205/125.2 (90 min, **quickService**).
- Afinado menor (`MANT_EXPRESS`, **quickService**, costo 0 placeholder): SEDAN 44.99, CAMIONETA 49.99, PICK UP 74.99, 60 min. Comentario: "folleto de precios fijos: fajas, bujías, filtro de motor y de cabina — mano de obra, por carrocería."
- Suspensión (`MANO_OBRA`, SRV-0019…0071): mismo listado de trabajos para sedán y camioneta con precio de camioneta ~5–25 USD más alto (bieletas, terminales, flecha, bujes de barra/puente/tijera, puntas de cremallera, cremallera 150/175, brazos, amortiguadores, soportes de amortiguador/motor/caja/cardán, tijeras, bufa y balero, hules de escape). Costo interno 1.2–7.2, 10–60 min.
- Carwash (`CARWASH`): por carrocería (sedán/camioneta/pick up) LAVADO + ASPIRADO 8/10/10 · + PASTEADO A MANO 10/12/14 · + PASTEADO A MAQUINA 14/16/18; costo 4.7/6.44/9.94; 45/60/75 min.

Regla de re-seed: "precio y quickService NO se pisan en el update — se editan desde /servicios y un reseed no debe borrar esos cambios (mismo patrón que passwordHash de usuarios)."

### 4.14 `prisma/_tmp-wipe-prod.ts`
Borra en orden hijo→padre solo lo **transaccional** (46 tablas: comunicaciones, notificaciones, recordatorios, comisiones, metas, DTE, refunds, receivables, allocations, caja, gastos, pagos, garantías, QC, notas, tiempos, historial, asignaciones, ítems, reservas, movimientos, inspecciones, media, órdenes, aprobaciones, cotizaciones, recepciones, citas, bloqueos, compras, kilometraje, dueños, vehículos, crédito, contactos, clientes). Conserva: "usuarios/roles/permisos, catálogo de servicios y productos, métodos de pago, estados de orden, plantillas, caja principal, proveedores (catálogo), configuración del negocio, y la bitácora de auditoría (AuditLog es append-only por diseño, nunca se borra)". No toca `print_jobs`.

---

## 5. Cronología de migraciones (`prisma/migrations/`)

| # | Carpeta (fecha UTC) | Regla de negocio nueva |
|---|---|---|
| 1 | `20260721000923_init` (2026-07-21) | Esquema completo: 35 enums y 77 tablas (el schema actual tiene 36 enums y 78 modelos; la diferencia es `PrintJobStatus`/`PrintJob` de la migración 11). En este punto `vehicles.plate` era `NOT NULL`, `inspections.receptionId` `NOT NULL` con FK `RESTRICT`, `InventoryMovementType` sin `SALIDA_MANUAL`, `products` sin `barcode`/`forSale`, `quotes` sin `diagnosis`, `service_catalog` sin `quickService`, `daily_closures` solo con `countedCash`, `payments` sin `bankName`/`receptionId`, `work_orders` sin bloque de factura externa, `work_order_items` sin `completedAt`, sin tabla `print_jobs`. |
| 2 | `20260721200918_inspection_post_approval_workorder_costs_payment_bank` (2026-07-21) | (a) **Inspección post-aprobación**: `inspections.receptionId` pasa a nullable (FK `SET NULL`) y se agrega `inspections.workOrderId` (FK `SET NULL`) — una inspección puede colgar de la orden y no de la recepción. (b) **Costo real de factura externa**: `work_orders.externalInvoiceNumber`, `externalSupplierId` (FK a `suppliers`), `costsConfirmedById`, `costsConfirmedAt` — no se cierra la orden sin confirmar costos. (c) **Banco en transferencias**: `payments.bankName`. |
| 3 | `20260721201802_vehicle_plate_optional` (2026-07-21) | **Placa opcional**: `vehicles.plate DROP NOT NULL` — se puede cotizar sin placa; se exige al registrar la orden (regla en app). |
| 4 | `20260721203605_quote_diagnosis` (2026-07-21) | **Diagnóstico en la cotización**: `quotes.diagnosis TEXT` visible en la impresión. |
| 5 | `20260722000148_service_quick_flag` (2026-07-22) | **Servicios rápidos**: `service_catalog.quickService BOOLEAN DEFAULT false` — precio fijo que va directo a orden sin cotización. |
| 6 | `20260722170927_daily_closure_counted_by_method` (2026-07-22) | **Cierre contado por método**: `daily_closures.countedCard`, `countedTransfer`, `countedOther`, `cardDifference`, `transferDifference`, `otherDifference` — tarjeta/transferencia/otros se cuadran contra comprobante físico igual que el efectivo. |
| 7 | `20260810171254_quote_item_supplier_note` (2026-08-10) | **Proveedor por repuesto cotizado**: `quote_items.supplierNote TEXT` (texto libre, solo `REPUESTO`). |
| 8 | `20260812223210_work_order_item_completion` (2026-08-12) | **Completado por ítem**: `work_order_items.completedAt`, `completedById` — el técnico/jefe marca cada línea hecha. |
| 9 | `20260822040338_add_product_barcode_and_salida_manual` (2026-08-22) | **Código de barras** `products.barcode` `UNIQUE` (se asocia al escanear) y **salida manual de inventario**: `InventoryMovementType += SALIDA_MANUAL` (ruta `inventario/salida`). |
| 10 | `20260822173438_product_for_sale` (2026-08-22) | **Producto para venta vs insumo interno**: `products.forSale BOOLEAN DEFAULT true`. |
| 11 | `20260828170844_print_jobs` (2026-08-28) | **Cola de impresión**: enum `PrintJobStatus` y tabla `print_jobs` (`workOrderId?`, `payload`, `status`, `error`, `completedAt`, índice `[status, createdAt]`) para el agente local de ticketera. |
| 12 | `20260829084814_payment_reception` (2026-08-29) | **Cobro de cuota de diagnóstico sin cotización**: `payments.receptionId` (FK `SET NULL` a `receptions`, índice) — un pago puede colgar de la recepción cuando aún no hay orden ni cotización (`chargeReceptionDiagnosticFee`, permiso `payments.diagnostic_override`). |

Ritmo: el diseño completo se congeló el 21-07; entre 21-07 y 22-07 se ajustó el flujo real del taller
(inspección, costos externos, placa, diagnóstico, servicios rápidos, cierre por método); en agosto se agregaron
mejoras operativas (proveedor por repuesto, completado por ítem, barcode/salida manual, insumos, impresión,
cuota de diagnóstico). Ningún cambio de migración quitó nada del diseño original.

---

## 6. Modelos del schema sin módulo/UI que los use ("intención no construida")

Método: grep de accesores Prisma (`prisma.<model>.*`, `tx.<model>.*`) y de relaciones (`include`/`select`) en
`modules/`, `app/`, `lib/`. Carpetas existentes: `modules/{approvals,cash,customers,dashboard,expenses,
inspections,inventory,payments,printing,quotes,receptions,reminders,reports,services,users,vehicles,work-orders}`
y rutas `app/(dashboard)/{caja,clientes,cotizaciones,gastos,inventario,ordenes,recepcion,recordatorios,
reportes,servicios,usuarios,vehiculos}`, `app/api/print-jobs`, `app/imprimir/{cotizacion,orden,orden-trabajo}`, `app/login`.

### 6.1 Sin ningún uso en código (ni accesor ni relación)

| Dominio | Modelos | Observación |
|---|---|---|
| Permisos por usuario | `UserPermission` | Se lee en `lib/auth.ts` (`directPermissions`) pero nada lo escribe; el seed tampoco (`directGrants` vacío). Mecanismo listo, no operado. |
| Sucursal | `Branch` | Solo el seed crea `branch_main`. Ningún `branchId` se llena desde la app. |
| Contactos | `CustomerContact`, `SupplierContact` | |
| Crédito | `CustomerCreditProfile`, `CustomerCreditAuthorization`, `CustomerCreditMovement` | Existe método de pago `credito` "Crédito 30 días" pero no hay perfil, límite ni movimientos. Permisos `credit.*` sembrados sin pantalla. |
| Citas / agenda | `Appointment`, `ServiceBay`, `AvailabilityBlock` | Permisos `appointments.*` sembrados sin pantalla. `Reception.appointmentId` nunca se llena. |
| Paquetes | `ServicePackage`, `ServicePackageItem` | `QuoteItemType.PAQUETE` existe pero no hay paquetes. |
| Ubicaciones | `InventoryLocation` | |
| Compras | `PurchaseOrder`, `PurchaseOrderItem`, `Purchase`, `PurchaseItem` | Permisos `purchases.*` y `InventoryMovementType.COMPRA` sin uso; las entradas se hacen como `ENTRADA_MANUAL`. |
| Tiempos | `TimeEntry` | Permiso `time.track` sembrado sin pantalla. `WorkOrder.actualMinutes` no se alimenta. |
| Notas de orden | `WorkOrderNote` | |
| Control de calidad | `QualityChecklistTemplate`, `QualityChecklistResult` | El estado `control_calidad` tiene `requiresQc: true` pero no hay checklist que lo satisfaga. Permisos `quality.*` sin pantalla. |
| Garantías | `Warranty`, `WarrantyClaim` | `ServiceCatalog.warrantyDays`, `BusinessSettings.laborWarrantyDays` y permisos `warranties.*` sin consumidor. |
| Pagos avanzados | `PaymentAllocation`, `Receivable`, `ReceivablePayment`, `Refund` | El reporte `reportes/cuentas-por-cobrar` (`modules/reports/queries.ts:76`) **no lee `Receivable`**: calcula `saleNet − Σ payments REGISTRADO` por orden. `CashMovementType.DEVOLUCION` se usa sin crear `Refund`. |
| DTE | `ExternalTaxDocument` | Permisos `tax_docs.*` sembrados sin pantalla. Decisión #5 del schema no construida. |
| Metas y comisiones | `Goal`, `CommissionRule`, `CommissionRuleVersion`, `CommissionEntry` | Permisos `goals.*`, `commissions.*` sin pantalla. "Motor preparado". |
| Notificaciones / comunicaciones | `Notification`, `CommunicationLog` | |

### 6.2 Usados solo parcialmente (para no sobreestimar lo construido)

- `Role`, `Permission`, `UserRole`, `RolePermission`: solo lectura vía `include` (`lib/auth.ts`, `modules/users/queries.ts`). No hay UI de gestión de roles/permisos (`roles.manage` sin pantalla); los roles se asignan por seed.
- `CashRegister`: solo se referencia por el id fijo `MAIN_REGISTER_ID` y en `include`; una sola caja, sin CRUD.
- `AuditLog`: solo dos escrituras (`ANULAR` pago, `SOFT_DELETE` orden). No hay pantalla de auditoría (`audit.view` sin consumidor). Los otros 18 `AuditAction` no se emiten.
- `VehicleOwner`: se crea siempre con `isCurrent: true` y nunca se cierra (`toDate`) — el historial de cambio de dueño no se opera.
- `VehicleMileageHistory`: una sola escritura.
- `MediaFile`: solo `ownerType` `RECEPTION` e `INSPECTION`, `visibility INTERNO`.
- `Inspection`: `templateId`/`results` sí; `workOrderId` (post-aprobación) sí existe en código de `modules/inspections`.
- `DailyClosure`, `CustomerApproval`, `ApprovalCode`, `QuoteVersion`, `ExpenseCategory`, `InspectionTemplate`, `ServiceCategory`: una sola referencia cada uno (creación o lectura básica).
- `WorkOrderItem.isAdditional`/`approved`, `WorkOrder.bayId`, `WorkOrder.area`, `WorkOrder.priority`, `Quote.validUntil` (estado `VENCIDA`), `Quote` estado `CANCELADA`: campos/valores presentes en el modelo sin flujo que los active (los enums `VENCIDA`/`CANCELADA` no aparecen fuera del mapa de etiquetas).

---

## 7. Reglas de negocio implícitas en el modelo

Lo que el schema y el seed deciden por sí mismos, sin necesidad de leer la lógica de la app.

**Impuestos y dinero**
1. Precios de catálogo (`ServiceCatalog.suggestedPrice`, `Product.price`, `QuoteItem.unitPrice`, `WorkOrderItem.unitPrice`) **incluyen IVA 13 %**; el desglose es hacia atrás `base = precio / 1.13` (`lib/money.ts` lo implementa con `Prisma.Decimal`).
2. La tasa vive por renglón (`taxRate Decimal(6,4) @default(0.1300)` en servicio, producto, ítem de cotización, ítem de orden) y globalmente en `BusinessSettings.defaultTaxRate`; `pricesIncludeTax` es configurable pero el seed lo fija en `true`.
3. Los **gastos** no llevan IVA por default (`Expense.taxRate @default(0)`).
4. Moneda única `USD`, zona `America/El_Salvador`, formato `dd/MM/yyyy`.
5. Todo dinero es `Decimal(12,2)`; cantidades `Decimal(12,3)` (se venden fracciones: galones, litros).

**Período y cierres**
6. Período de cierre **mensual** (decisión #2): `Goal` y `CommissionEntry` se indexan por `[periodYear, periodMonth]`.
7. **Un cierre por sesión de caja** (`DailyClosure.cashSessionId @unique`). La reapertura no crea otro cierre: se anota `reopenedById/reopenedAt` sobre el mismo y la sesión pasa a `REABIERTA`.
8. El cierre compara lo calculado por sistema (`expectedCash`, `cardTotal`, `transferTotal`, `otherTotal`) contra lo contado a mano **por cada método** (`counted*`), con diferencia por método.
9. Una sola caja física (`cash_register_main`) y un cajero por sesión (`cashierId` FK real). Quien fue cajero no puede borrarse (FK `RESTRICT`): se desactiva.

**Autorización**
10. Permisos por clave `module.action`; capacidades = permisos de roles + concesiones directas − revocaciones directas (`UserPermission.granted=false`). Ningún rol es especial en base: `isSystem` solo marca los sembrados.
11. Separación de funciones sembrada: quien ve costos/utilidades (`cost.view`, `profit.view`: gerente, inventario, auditor) no es por defecto quien cobra (`payments.register`, `cash.open/close`: cajero). Fausto rompe esa separación a propósito acumulando tres roles; el `AuditLog` es "el control compensatorio".
12. Anular órdenes (`work_orders.void`) y autorizar cobro de diagnóstico sin cotización (`payments.diagnostic_override`) son exclusivos de superadmin.
13. Un técnico sin `work_orders.view_all` solo ve órdenes donde está asignado (`WorkOrderAssignment`).
14. Login por **código numérico de 4 dígitos** guardado como bcrypt en `passwordHash`; el `email` es solo identificador único. Login exige `status ACTIVO`.

**Cliente y vehículo**
15. Un vehículo puede tener varios dueños en el tiempo (`VehicleOwner` con `isCurrent`, `fromDate`, `toDate`; unique por `[vehicleId, customerId, fromDate]`).
16. La **placa no es obligatoria ni única** en base (`plate String?`, índice no único): se puede cotizar sin placa; la orden la exige (regla de app).
17. Cliente identificado por `code` único generado; DUI/NIT/teléfono/WhatsApp/email indexados para búsqueda, no únicos (un mismo documento puede repetirse).
18. Persona natural o jurídica (`personType`); jurídica puede tener `CustomerContact`s.

**Flujo comercial**
19. Cita → Recepción → Cotización → Orden. Cada eslabón es opcional hacia atrás: `Reception.appointmentId?`, `Quote.receptionId?`, `WorkOrder.receptionId?`, `WorkOrder.quoteId?`. Se puede abrir orden directa (servicios rápidos) o cotizar sin recepción.
20. **Una cotización → máximo una orden** (`WorkOrder.quoteId @unique`); **una cita → máximo una recepción** (`Reception.appointmentId @unique`).
21. Cotización versionada: cada envío modificado crea `QuoteVersion` (`[quoteId, versionNumber]` único, `isCurrent`); los totales viven en la versión, no en la cabecera.
22. Aprobación **por renglón** (`QuoteItem.decision`), con evidencia (`CustomerApproval`: firma, IP, user-agent, términos) y **código de 6 dígitos hasheado**, con expiración y máximo 5 intentos (`ApprovalCode`).
23. `unitCost` en cotización y orden es "interno, nunca al cliente"; `suggestedPrice`/`internalCost` conviven en el catálogo para calcular margen.
24. Servicios `quickService` (precio fijo de folleto: mantenimientos completos de frenos, afinado menor, aceites de caja, Mobil full sintético, GDI) se venden directo como orden sin cotización; los diagnósticos de alcance variable sí requieren cotización.
25. `Product.forSale=false` marca insumos internos que no se cotizan ni se venden.

**Orden de trabajo**
26. Los estados son **datos, no código**: tabla `WorkOrderStatus` con flags. El código decide por flags (`isInitial`, `isTerminal`, `requiresQc`, `allowsConsumption`, `countsAsDelivered`), no por `key`. Etiqueta/orden/color son editables.
27. Consumo de repuestos solo desde estados con `allowsConsumption` (`aprobado`…`control_calidad`); `control_calidad` exige QC aprobado para avanzar; `entregado` y `cerrado` cuentan como entregados; `cerrado` y `cancelado` son terminales.
28. Una orden nacida de cotización aprobada arranca en `recepcion_reparacion` (order 42), no en `recibido`.
29. **No se cierra la orden sin confirmar costos externos** (`costsConfirmedAt`), aun si es "sin factura externa". El bloque es visible solo con `cost.view`.
30. La orden guarda su P&L desnormalizado: `saleGross − discountTotal = saleNet` (con `taxTotal` desglosado), costos `productCost + laborCost + externalCost + warrantyCost`, `grossProfit`, `marginPct`.
31. Trabajo adicional (`WorkOrderItem.isAdditional`) requiere nueva aprobación (`approved`). Cada ítem se marca completado individualmente (`completedAt/completedById`).
32. Un técnico se asigna una sola vez por orden (`[workOrderId, technicianId]` único), con `role` principal/apoyo; un ayudante (`isHelper`) no debería quedar como único mecánico (regla en comentario, no en constraint).
33. Todo cambio de estado deja fila en `WorkOrderStatusHistory`.

**Inventario**
34. Kardex **append-only** (`InventoryMovement`): nunca se edita ni borra; se corrige con `REVERSION`/`CORRECCION` que apuntan al original (`reversalOfId`). Cada movimiento guarda `balanceAfter`.
35. Reserva al aprobar (`InventoryReservation ACTIVA`, no baja `stockOnHand`), descuento al confirmar consumo (`CONSUMO` + reserva `CONSUMIDA`), liberación si no se usa (`LIBERADA`). **Disponible = `stockOnHand` − Σ reservas `ACTIVA`**, calculado en app.
36. `barcode` único por producto, asociado al primer escaneo. `minStock` para alertas.
37. Compras registran `previousCost` para mostrar variación de costo al recibir.

**Pagos**
38. El efectivo entra solo al pagar (decisión #4). Un pago pertenece a un cliente, opcionalmente a una orden **o a una recepción** (cuota de diagnóstico antes de cotizar), y a una sesión de caja.
39. Los pagos **no se borran**: se anulan (`status ANULADO`) y queda `AuditLog ANULAR`.
40. Método de pago es catálogo (`isCash`, `isCredit`); transferencia guarda banco (`bankName`, lista fija de 4 bancos salvadoreños en `lib/banks.ts`) y referencia.
41. Un pago puede repartirse entre varias órdenes (`PaymentAllocation`), aplicarse a cuentas por cobrar (`ReceivablePayment`) y devolverse (`Refund`) — todo previsto, no construido.
42. Anticipos (`isAdvance`) y crédito a 30 días existen como concepto (método `credito`, `CashMovementType.ANTICIPO/ABONO`).

**Fiscal**
43. El ERP **no emite DTE**: solo concilia (`ExternalTaxDocument`) por `generationCode` único, `controlNumber` y `receptionSeal` de Hacienda; tipos FE/CCF/NC/ND/FSE. Datos fiscales del emisor (NIT `0614-070624-103-3`, NRC `3446580`, giro) viven en `BusinessSettings.settings.printHeader`.

**Multi-sucursal**
44. Preparado, no activo: `Branch` con `isDefault`, `branchId` lógico en cliente, cita, recepción, cotización, orden y caja; el seed crea una sola "Casa Matriz" y ningún módulo la asigna.

**Garantía**
45. Mano de obra con garantía por default de **45 días** (`BusinessSettings.laborWarrantyDays`, `ServiceCatalog.warrantyDays`, `Warranty.days`), contada "desde la entrega"; tipos mano de obra / repuesto / externo; el costo de un reclamo es `internalCost`, no venta nueva, y la orden lo acumula en `warrantyCost`.

**Áreas de negocio**
46. Taller y Carwash comparten cliente, vehículo, recepción, orden y caja; se distinguen por `area` (`BusinessArea`) en categoría, servicio, orden, gasto, checklist y regla de comisión. Rol `carwash` opera recepciones y órdenes pero no cotiza.

**Impresión**
47. La impresión de tickets es asíncrona vía cola (`PrintJob PENDIENTE → IMPRESO | ERROR`) consumida por un agente local que sondea la API; el payload ESC/POS va en base64. Ticket de 80 mm (`ticketWidthMm`).

**Persistencia y borrado**
48. Soft-delete (`deletedAt`) en maestros y documentos principales (`User`, `Role`, `Branch`, `Customer`, `Vehicle`, `Technician`, `ServiceBay`, `ServiceCatalog`, `Product`, `Supplier`, `Appointment`, `Reception`, `Quote`, `WorkOrder`, `Expense`). Sin soft-delete (y por convención nunca se borran) en pagos, cierres, movimientos de inventario, reservas, aprobaciones, historial y `AuditLog`.
49. FK a `User`/`Branch` son lógicas (sin constraint) salvo `Technician.userId`, `CashSession.cashierId`, `AuditLog.actorId` y las tablas de permisos: borrar un usuario no rompe órdenes ni cotizaciones, pero sí está bloqueado si fue cajero.
50. El wipe de producción (`_tmp-wipe-prod.ts`) define qué es "catálogo" (se conserva: usuarios, roles, permisos, servicios, productos, métodos de pago, estados, plantillas, caja, proveedores, settings, auditoría) y qué es "transacción" (se borra: todo lo demás).
