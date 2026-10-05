# 105 — Cuentas abiertas: lo que alguien se lleva y paga después

**Estado:** Aprobada (por chat, 5 oct 2026: «okay, me parece bien, implementalo y mandas PR») — fase 1
(shared + API + migración + tests + verify) y fase 2 (web) hechas; falta correr
`scripts/verify-105.sh` con el stack levantado.
**Módulo:** tabs (nuevo) + sales + carwash (turno) + inventory + shared + web | **Depende de:** 038
(turno de caja), 059/066 (cuenta de cobro), 065 (inventario y venta suelta), 069 (cuentas bancarias),
073 (correlativos), 094 (espacio del lavado), 101/102 (paginación) | **Reemplaza:** 070

Prototipo aprobado, fuente de verdad de la UX: `docs/prototype/open-tabs.html`.

## Contexto

Hoy lo que toma el personal de la refrigeradora se anota en Inventario como «consumo» (070) y no se
cobra nunca. Al dueño le resulta confuso: en la práctica la gente se lleva algo y lo paga después.
Esta spec lo reemplaza por **cuentas abiertas** dentro de Ventas: a un empleado o a un cliente se le
anota lo que se lleva (sale del inventario en ese momento) y se le cobra en abonos (entran a la caja
en ese momento). Es del espacio de trabajo del lavado (094).

## Decisiones del usuario

- 2026-10-05: la cuenta es de **un empleado o un cliente** (los dos modelos ya existen), con número
  `C-0001`, y **una sola abierta por titular**.
- 2026-10-05: el producto **sale del inventario al anotar**, a su precio de venta de ese momento, sin
  cambio de precio manual. Quitar una línea pide motivo y la devuelve.
- 2026-10-05: el dinero **entra a la caja del turno al cobrar** cada abono, cuenta en los totales por
  método y sale en «Ventas del día» como «De cuenta». Con saldo cero la cuenta se cierra sola.
- 2026-10-05: solo oficina, nunca la tablet de pista. Se deja de crear consumos (070); los viejos
  quedan en el kardex como historia. El despacho de insumos no cambia.

## Modelo elegido (por qué)

- **Abono = una fila de `payments` con `tabId`**, en el turno abierto y sin `Charge`: entra a los
  totales de caja por método sin tocar la caja, y no pasa por `ChargeUseCases` porque no hay nada que
  repartir ni sacar del kardex (el producto ya salió al anotar). `payments_one_owner` ahora exige un
  dueño entre lavado, venta suelta o cuenta.
- **Kardex = `SALE` / `SALE_RETURN` con `tabLineId`**, sin tipos nuevos: el filtro «Ventas» del kardex
  ya los trae y la referencia `C-0012` y el titular salen de la línea. El `SALE_RETURN` apunta a su
  `SALE` por `reversesMovementId` (único): una línea se devuelve una sola vez.
- **Sin alta de cuenta vacía.** La cuenta nace con su primera línea (`POST /tabs/lines` por titular).
  «Abrir cuenta» en la web elige al titular con `GET /tabs/holders`: si ya tiene cuenta (`openTab`),
  navega a ella; si no, abre Nueva venta en modo «Anotar a cuenta» con el titular puesto.

## Historias

- Como cajero con `carwash.charge`, quiero anotarle productos a un empleado o a un cliente, para que
  se los lleve y los pague después.
- Como cajero con `carwash.charge`, quiero cobrarle un abono o el saldo entero, para que el dinero
  entre a mi turno de caja.
- Como cajero con `carwash.charge`, quiero quitar una línea mal anotada con su motivo, para que el
  producto vuelva al inventario.
- Como encargado con `carwash.read`, quiero ver quién debe y cuánto (total, empleados, clientes),
  para saber cuánto hay por cobrar.

## Criterios de aceptación

API (fase 1, los prueba `pnpm test` y `scripts/verify-105.sh`):

- **Dado** un empleado activo sin cuenta abierta, **cuando** le anoto 2 sodas de $1.25 y 1 agua de
  $0.75, **entonces** `201` con una cuenta `C-NNNN` `OPEN`, `total`/`balance` `3.25`, la existencia
  baja 2 y 1, y el kardex tiene un `SALE` por línea con `tabNumber`, `tabHolderName` y `unitPrice`.
- **Dado** que ya tiene cuenta abierta, **cuando** le anoto otra cosa, **entonces** se suma a la misma
  (mismo `id`); **y dadas** dos anotaciones simultáneas a alguien sin cuenta, queda una sola abierta.
- **Dado** un insumo, un producto inactivo o uno sin existencia suficiente, **cuando** lo anoto,
  **entonces** `409 ITEM_NOT_SELLABLE` / `409 ITEM_INACTIVE` / `409 INSUFFICIENT_STOCK` con su
  `itemId`, y no queda ni la línea, ni la cuenta, ni la salida de los otros productos.
- **Dado** un empleado inactivo, **cuando** le anoto, **entonces** `404 EMPLOYEE_NOT_FOUND`; un
  cliente que no existe, `404 NOT_FOUND`.
- **Dado** que el precio del artículo sube después de anotar, **cuando** abro la cuenta, **entonces**
  la línea y el saldo siguen con el precio viejo; un `unitPrice` en el pedido se ignora.
- **Dado** una línea, **cuando** la quito con motivo, **entonces** `200`, la línea trae
  `voided { at, by, reason }`, el saldo baja, la existencia sube y el kardex tiene un `SALE_RETURN`
  que apunta al `SALE`; sin motivo → `422`; otra vez → `409 TAB_LINE_ALREADY_VOIDED`; si el saldo
  quedaría bajo cero → `409 TAB_LINE_NOT_VOIDABLE`; en una cuenta cerrada → `409 TAB_CLOSED`.
- **Dado** un saldo de $3.75 y un turno abierto, **cuando** abono $2.50 en efectivo, **entonces**
  `201`, `paid 2.50`, `balance 1.25`, `OPEN`, una fila de `payments` con `tabId`, el `cashSessionId`
  del turno y sin `chargeId`, y `cashTotal` del turno sube $2.50.
- **Dado** ese saldo, **cuando** abono más que el saldo → `422 PAYMENT_EXCEEDS_BALANCE`
  (`details.balance`); cero → `422 VALIDATION_ERROR`; transferencia a una cuenta bancaria inactiva →
  `422 BANK_ACCOUNT_UNAVAILABLE`; sin turno abierto → `409 CASH_NOT_OPEN`.
- **Dado** un abono que deja el saldo en cero, **cuando** se guarda, **entonces** la cuenta queda
  `CLOSED` con `closedAt`; abonar después → `409 TAB_CLOSED`; anotarle otra vez abre una cuenta nueva.
- **Dado** un día con ventas sueltas y abonos, **cuando** pido `GET /sales/feed`, **entonces** vienen
  mezclados, lo más nuevo primero, cada abono como `{ kind: 'TAB_PAYMENT' }` con número y titular;
  con `status=VOID` no viene ningún abono.
- **Dado** una sesión de pista (PIN), **cuando** llama a cualquier ruta de `/tabs` o a
  `/sales/feed`, **entonces** `401`/`403`.
- **Dado** el API nuevo, **cuando** llamo a `POST /inventory/items/:id/consumptions` o
  `GET /inventory/consumptions`, **entonces** `404`; entregar un producto por
  `POST /inventory/deliveries` → `409 ITEM_NOT_DISPATCHABLE`; entregar un insumo sigue en `201`.

Web (fase 2): ver **UI**; cada punto ahí es un criterio binario.

## Reglas de negocio

- **RN-1:** el titular es un empleado **o** un cliente, exactamente uno (`tabs_one_holder`). A un
  empleado inactivo no se le anota; sus cuentas viejas se ven, se cobran y se les quita líneas.
- **RN-2:** una sola cuenta abierta por titular (`tabs_one_open_per_employee` / `_customer`). Anotar
  a alguien sin cuenta abierta se la abre en la misma transacción.
- **RN-3:** número `C-0001`, serie propia de la tabla `tabs` (073, `lastSequence`).
- **RN-4:** solo productos vendibles y activos con existencia (las reglas de la venta suelta, 065);
  el producto sale del inventario al anotar, a su precio de venta leído de la fila bloqueada, que
  queda congelado en la línea. Sin precio manual. Queda quién anotó.
- **RN-5:** quitar una línea pide motivo (3–500), la devuelve al inventario y queda tachada con quién,
  cuándo y por qué. Una sola vez, no en una cuenta cerrada, y no si el saldo quedaría bajo cero.
- **RN-6:** saldo = anotado (líneas no quitadas) − abonado; nunca negativo
  (`tabs_balance_consistent`).
- **RN-7:** un abono es un monto > 0 y ≤ saldo con un método (`CASH`/`CARD`/`TRANSFER`/`OTHER`) y las
  reglas de la 069 (transferencia con cuenta activa y referencia; «Otro» con descripción). Necesita
  el turno de caja abierto y cae en él (038). No se anula en esta spec.
- **RN-8:** cuando el saldo llega a cero —por un abono o por quitar una línea— la cuenta se cierra
  sola (`closedAt`). No se reabre: lo siguiente que se le anote abre otra.
- **RN-9:** solo sesión de oficina (usuario); la tablet de pista no tiene acceso.
- **RN-10:** los consumos de la 070 ya no se crean; los `CONSUMPTION`/`CONSUMPTION_RETURN` que existen
  siguen en el kardex como historia. Un producto no se entrega por `/inventory/deliveries`.

## Permisos

Sin claves nuevas: es la misma caja vendiendo a crédito.

| Clave            | Para qué en esta spec                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| `carwash.read`   | Ver la lista y el detalle de cuentas y «Ventas del día» (`/sales/feed`)       |
| `carwash.charge` | Anotar, quitar una línea, cobrar un abono y el selector de titular (`holders`) |

## Datos

Migración `20261005120000_open_tabs` (aditiva):

- `tabs`: `id`, `number` (único, `C-0001`), `employeeId?`, `customerId?`, `total`, `paid`, `balance`
  (`Decimal(12,2)`, las escribe solo el módulo `tabs` con la fila bloqueada), `openedByUserId`,
  `openedAt`, `lastActivityAt`, `closedAt?`. CHECKs `tabs_one_holder` y `tabs_balance_consistent`
  (`paid >= 0`, `balance >= 0`, `balance = total - paid`); únicos parciales
  `tabs_one_open_per_employee` y `tabs_one_open_per_customer` (`WHERE "closedAt" IS NULL`).
- `tab_lines`: `tabId`, `inventoryItemId`, snapshot `code`/`name`, `unitPrice`, `quantity`, `total`,
  `createdByUserId`, `createdAt`, `voidedAt?`, `voidedByUserId?`, `voidReason?`.
- `payments.tabId?` (FK), y `payments_one_owner` pasa a
  `num_nonnulls("workOrderId", "counterSaleId", "tabId") = 1`.
- `inventory_movements.tabLineId?` (FK).
- El enum `InventoryMovementType` no cambia (se conservan `CONSUMPTION`/`CONSUMPTION_RETURN`).

## API

Contrato en `@elite/shared` (`tabs/`): `TabList`, `TabsSummary`, `TabListItem`, `TabDetail`,
`TabLine`, `TabPayment`, `TabHolderOptions`, `TabHolderOption`, `TabPaymentEntry`, y en `sales/`
`SalesFeedEntry`. Schemas: `tabsQuerySchema`, `tabHoldersQuerySchema`, `addTabLinesSchema`,
`voidTabLineSchema`, `payTabSchema`, `salesFeedQuerySchema`. `CashSessionPayment` suma
`tabId`/`tabNumber` e `InventoryMovement` suma `tabId`/`tabNumber`/`tabHolderName`.

| Método | Ruta                               | Permiso          | Request                                                     | Response                 | Errores                                                                                                    |
| ------ | ---------------------------------- | ---------------- | ----------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/tabs`                            | `carwash.read`   | `?status=OPEN\|CLOSED` (def. `OPEN`), `holder=EMPLOYEE\|CUSTOMER`, `search`, `page`, `pageSize` | `TabList` (`summary` de todas + `tabs: Page<TabListItem>` por saldo desc, última actividad desc) | 422                                                          |
| GET    | `/tabs/holders`                    | `carwash.charge` | `?search` (nombre; en cliente también teléfono y placa)     | `TabHolderOptions`: empleados activos + hasta 20 clientes (con cuenta abierta primero), cada uno con `openTab` | 422                                    |
| GET    | `/tabs/:id`                        | `carwash.read`   | —                                                           | `TabDetail` (líneas y abonos, lo más nuevo primero; `isVoidable` por línea) | 404                                                                     |
| POST   | `/tabs/lines`                      | `carwash.charge` | `AddTabLinesInput { holder: { kind, id }, items: [{ inventoryItemId, quantity }] }` (1–50, sin repetir) | `201 TabDetail` | 404 `EMPLOYEE_NOT_FOUND`/`NOT_FOUND`, 409 `ITEM_NOT_SELLABLE`/`ITEM_INACTIVE`/`INSUFFICIENT_STOCK`, 422 |
| POST   | `/tabs/:id/lines/:lineId/void`     | `carwash.charge` | `VoidTabLineInput { reason }`                               | `200 TabDetail`          | 404, 409 `TAB_CLOSED`/`TAB_LINE_ALREADY_VOIDED`/`TAB_LINE_NOT_VOIDABLE`, 422                                 |
| POST   | `/tabs/:id/payments`               | `carwash.charge` | `PayTabInput { method, amount, bankAccountId?, reference?, description? }` | `201 TabDetail` | 404, 409 `TAB_CLOSED`/`CASH_NOT_OPEN`, 422 `PAYMENT_EXCEEDS_BALANCE`/`BANK_ACCOUNT_UNAVAILABLE`/`VALIDATION_ERROR` |
| GET    | `/sales/feed`                      | `carwash.read`   | `?date&status&page&pageSize` (igual que `/sales`)           | `Page<SalesFeedEntry>`   | 422                                                                                                        |

Retiradas (070): `POST /inventory/items/:id/consumptions`, `POST /inventory/consumptions/:movementId/reverse`,
`GET /inventory/consumptions`, `GET /inventory/consumptions/:employeeId`. `GET /sales` sigue igual.

## UI (fase 2)

Todo con los tokens de `apps/web/DESIGN.md` y las dos densidades: en `bahia` sube la altura de fila,
de control y el tamaño de cifras (como en el prototipo); bajo 600 px los diálogos son hoja inferior.
Los botones de escritura se ven solo con `carwash.charge`.

1. **Ventas con dos pestañas** (`/sales`): cabecera «Ventas» con «Nueva venta»; pestañas «Ventas del
   día» (`/sales`) y «Cuentas abiertas» (`/sales/tabs`) con el contador `summary.openCount`, en un
   marco montado una vez por un grupo de rutas (como `inventory/(tabs)`, 092).
2. **Ventas del día** lee `GET /sales/feed`: un abono es una fila con ref. `C-0012`, hora, detalle
   «Cuenta de {titular}», método y chip «De cuenta» (`tint-consume`) en lugar de «Cobrada»; tocarla
   lleva a `/sales/tabs/[id]`.
3. **Cuentas abiertas** (`/sales/tabs`): tres cifras (Por cobrar, Trabajadores, Clientes) de
   `summary`; buscador con 250 ms de espera; chips Todas / Trabajadores / Clientes / Cerradas con sus
   conteos (`openCount`, `employeeCount`, `customerCount`, `closedCount`); botón «Abrir cuenta». Cada
   fila: iniciales, nombre, chip «Trabajador» (`tint-consume`) o «Cliente» (`tint-info`), número y
   «N productos», y el saldo; una cerrada muestra chip «Pagada» si `paid > 0` o «Cerrada» si no.
   Vacíos: «Nadie debe nada», «Ninguna cerrada», «Sin resultados». Paginado con `Page<T>`.
4. **Abrir cuenta** (diálogo): buscador + lista de `GET /tabs/holders`; quien ya tiene cuenta muestra
   su número; el botón dice «Ir a C-0012» (navega al detalle) o «Abrir y anotar» (navega a
   `/sales/new?holderKind=…&holderId=…` en modo «Anotar a cuenta»).
5. **Detalle** (`/sales/tabs/[id]`): regreso «Cuentas abiertas»; chips de tipo y número (y
   «Pagada»/«Cerrada»); nombre como título; «Anotar productos» (→ `/sales/new?tab={id}`) y «Cobrar»
   (deshabilitado con saldo 0), ocultos si está cerrada; tarjeta Debe (en `--flame-text`) /
   Anotado / Abonado; línea de tiempo agrupada por día (Hoy, Ayer, «Lunes 29 sept») con el total
   anotado del día; cada línea con hora, producto ×cantidad, valor y «Quitar» solo si `isVoidable`;
   una quitada va tachada con su motivo y chip «Quitado»; un abono va en verde, «Abono · {método}» y
   «−$X».
6. **Cobrar** (diálogo): «Cobrar a {nombre}», «Debe $X»; monto prellenado con el saldo; chips «Todo ·
   $X», «$5.00» (si debe más de 5) y «$10.00» (si debe más de 10); los cuatro métodos con los campos
   de la 069 (cuenta + referencia en transferencia, descripción en «Otro»); en efectivo «Recibido» y
   «Vuelto» calculados en pantalla (no se guardan); «Queda debiendo» si es parcial; botón «Abonar $X»
   o «Cobrar $X y cerrar», deshabilitado si el monto es 0 o pasa del saldo.
7. **Quitar** (diálogo): producto ×cantidad · valor, «Motivo» obligatorio; botón rojo deshabilitado
   sin motivo.
8. **Nueva venta** (`/sales/new`): selector «Cobrar ahora» / «Anotar a cuenta». En «Anotar a cuenta»
   no hay métodos ni precio editable; el campo «¿A quién se le anota?» es un combobox (flechas, Enter,
   Escape) con «Trabajadores» y luego «Clientes» de `GET /tabs/holders`, cada uno con su saldo
   abierto; elegido, se ve la persona con «Cambiar», la línea «Queda debiendo» y el botón «Anotar $X
   a {primer nombre}» (`POST /tabs/lines`), que vuelve a Cuentas abiertas con la cuenta resaltada.
   Con `?tab={id}` el titular viene fijo: regreso con su nombre, título «Anotar a {primer nombre}» y
   al terminar vuelve al detalle. El stepper no deja pasar la existencia.
9. **Inventario**: sin pestaña «Consumos del personal» y la entrega solo ofrece insumos (hecho en la
   fase 1). El kardex muestra un `SALE`/`SALE_RETURN` de cuenta como «Venta»/«Devolución» con la
   referencia `tabNumber` y «A quién» = `tabHolderName`; los `CONSUMPTION` viejos siguen como
   «Consumo».
10. **Turno de caja** (`/carwash/cash/[id]`): un pago con `tabNumber` muestra esa referencia.

## Fuera de alcance

- Anular o editar un abono, reabrir una cuenta, límite de crédito por persona.
- Guardar el efectivo recibido y el vuelto de un abono (la pantalla los calcula).
- Descontar de la planilla del empleado.
- Migrar los consumos viejos de la 070 a cuentas.

## Ask first

- El prefijo `C-` es el mismo que el de la cuenta de cobro de la 059 (`Cuenta C-0007 cobrada` en Nueva
  venta y en el detalle de un lavado o venta). Son series distintas, así que pueden convivir un cobro
  `C-0012` y una cuenta abierta `C-0012`. Cambiarlo es una línea (`TAB_NUMBER_PREFIX` en shared) antes
  de que haya datos.

## Tareas

Fase 1 (este PR):

- [x] Migración `20261005120000_open_tabs` y `schema.prisma` (`Tab`, `TabLine`, `payments.tabId`,
      `inventory_movements.tabLineId`, CHECKs e índices).
- [x] Shared: carpeta `tabs/` (contratos, schemas, `TAB_NUMBER_PREFIX`), `SalesFeedEntry` y
      `salesFeedQuerySchema`, campos `tab*` en `CashSessionPayment` e `InventoryMovement`, códigos
      `TAB_CLOSED`, `TAB_LINE_ALREADY_VOIDED`, `TAB_LINE_NOT_VOIDABLE`.
- [x] Módulo `tabs`: `domain/tab.ts`, `TabUseCases`, puertos, repositorio Prisma, lecturas previas,
      lector de abonos, controlador y cableado; `tabs` en `SEQUENCE_COLUMNS`; `tabLineId` en
      `recordStockMovement`.
- [x] «Ventas del día»: `GET /sales/feed` (`SalesFeedUseCases`, `listDay` del repositorio).
- [x] Turno de caja: `tabId`/`tabNumber` en sus pagos; kardex con `tab*`.
- [x] Tests en memoria: reglas del dominio, casos de uso de cuentas y feed.
- [x] Retirar la 070 del API y de shared; entrega de productos → `409 ITEM_NOT_DISPATCHABLE`; web:
      borrar las pantallas de consumo y la pestaña, entrega solo de insumos (arreglo mínimo).
- [x] `scripts/verify-105.sh`; `verify-065.sh` sección 11 actualizada; `verify-070.sh` borrado;
      `specs/070` marcada «Reemplazada por 105».
- [x] `apps/api/AGENTS.md`, `packages/shared/AGENTS.md`, `apps/web/AGENTS.md`.
- [ ] Correr `bash scripts/verify-105.sh` con el stack levantado.

Fase 2 (web):

- [x] Puntos 1 a 8 y 10 de **UI**, con tests de la lógica nueva (agrupado por día, «Queda debiendo»,
      validación del monto, filtros) y las dos densidades.
- [x] Punto 9: etiqueta y referencia de cuenta en el kardex; `apps/web/DESIGN.md` sin la mención a
      filas de entrega «Consumo».

## Verificación

`pnpm build && pnpm lint && pnpm test` y, con el stack levantado, `bash scripts/verify-105.sh`
(y `bash scripts/verify-065.sh`, que cambió su sección 11).
