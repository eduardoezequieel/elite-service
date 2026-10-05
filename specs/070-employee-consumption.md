# 070 — Consumo de empleados: lo que toman de la refrigeradora

**Estado:** Reemplazada por 105 (cuentas abiertas). Los consumos ya anotados siguen en el kardex como historia.
**Módulo:** inventory + shared + web | **Depende de:** 065 (inventario), 033 (fecha), 034 (combobox),
056 (regreso)

## Contexto

El taller tiene refrigeradoras con bebidas para los clientes. Las bebidas son **productos** de la
065 (categoría «Bebidas», que la oficina crea como cualquier otra): al cliente se le venden con la
venta suelta o dentro del lavado. A veces un trabajador toma una. No se le cobra, pero tiene que
quedar anotado: qué tomó, cuándo y quién lo anotó, y al final del mes cuánto suma por trabajador.

## Decisiones del usuario

- 2026-09-26: el consumo **no se cobra** y no pasa por caja; se anota y se ve por mes.
- 2026-09-26: lo anota **solo la oficina**, nunca la tablet de pista, y queda **quién lo anotó**.

## Historias

- Como oficina con `inventory.move`, quiero anotar que un trabajador tomó un producto, para que
  salga del inventario y quede a su nombre.
- Como quien tiene `inventory.read`, quiero ver por mes cuánto consumió cada trabajador, en unidades
  y en dinero a precio de venta, para hablarlo con él o descontarlo por fuera del sistema.
- Como oficina con `inventory.move`, quiero anular un consumo mal anotado dejando el motivo, para
  que no le cuente al trabajador y el kardex lo explique.

## Criterios de aceptación

- **Dado** una bebida con existencia 10 y precio $1.25, **cuando** anoto 2 a Juan, **entonces** el
  kardex tiene `CONSUMPTION` −2 con `employeeId` de Juan, `createdByUserId` de quien anotó y
  `unitPrice = 1.25`, la existencia queda 8 y **no** se crea cobro ni pago.
- **Dado** esa bebida con existencia 1, **cuando** anoto 2, **entonces** `409 INSUFFICIENT_STOCK`
  con `details.available = 1` y nada cambia.
- **Dado** un artículo `SUPPLY`, **cuando** intento anotarlo como consumo, **entonces** `409
  ITEM_NOT_SELLABLE`; **y dado** un producto inactivo, `409 ITEM_INACTIVE`.
- **Dado** un empleado inactivo o inexistente, **cuando** anoto, **entonces** `404
  EMPLOYEE_NOT_FOUND`.
- **Dado** una sesión de pista (PIN), **cuando** llama a cualquier ruta de esta spec, **entonces**
  `401`/`403`: la pista no anota consumos.
- **Dado** que el precio de la bebida sube a $1.50 después de anotar, **cuando** abro el reporte,
  **entonces** ese consumo sigue valiendo $2.50 (2 × $1.25).
- **Dado** consumos de Juan el 30 sept y el 1 oct (hora de El Salvador), **cuando** pido
  `month=2026-09`, **entonces** solo cuenta el del 30 sept.
- **Dado** en septiembre Juan con 2 bebidas a $1.25 y 1 a $0.75, y Ana con 1 a $1.25, **cuando**
  pido el reporte de septiembre, **entonces** vienen dos filas: Juan `units 3.000`, `total 3.25`;
  Ana `units 1.000`, `total 1.25`, ordenadas por total de mayor a menor; y un total general `4.50`.
- **Dado** un consumo de 2, **cuando** lo anulo con motivo, **entonces** el kardex agrega
  `CONSUMPTION_RETURN` +2 que apunta al original, la existencia sube 2 y el reporte de ese mes ya
  no lo suma; anularlo otra vez → `409 CONSUMPTION_ALREADY_REVERSED`; sin motivo → `422
  VALIDATION_ERROR`.
- **Dado** un consumo de un mes anterior, **cuando** lo anulo hoy, **entonces** la devolución cuenta
  en el mes del consumo original (RN-5), no en el de hoy.
- **Dado** el detalle de Juan en septiembre, **cuando** lo abro, **entonces** cada fila muestra
  fecha y hora, artículo, cantidad, precio unitario, valor, quién anotó, nota y, si se anuló, quién,
  cuándo y por qué.

## Reglas de negocio

- **RN-1: es un movimiento del kardex.** `CONSUMPTION` sigue las reglas de la 065: append-only,
  cantidad negativa, `balanceAfter`, nunca negativo (RN-3), aviso de mínimo al cruzar (RN-13).
- **RN-2: solo productos activos.** Lo que se consume es algo que también se vende (bebidas,
  snacks). Un insumo se sigue entregando con el **despacho** de la 065 (RN-10), que no cambia.
- **RN-3: solo oficina, con dos nombres.** Sesión de usuario y `inventory.move`. Guarda
  `createdByUserId` (quien anotó) y `employeeId` (quien tomó, empleado activo).
- **RN-4: vale a precio de venta, congelado.** El movimiento copia `unitPrice` = precio del
  artículo al anotarlo. El valor es `unitPrice × cantidad`. No se cobra, no genera `Charge` ni
  `Payment` y no toca el turno de caja.
- **RN-5: el mes es el del consumo.** El reporte agrupa por mes civil de `America/El_Salvador` según
  `createdAt` del `CONSUMPTION`. Un consumo anulado no cuenta en su mes, se haya anulado cuando se
  haya anulado.
- **RN-6: se anula, no se borra.** Anular crea `CONSUMPTION_RETURN` por la misma cantidad (positiva),
  mismo artículo y empleado, `reversesMovementId` al original, `reason` obligatorio y
  `createdByUserId`. Un consumo se anula una sola vez y entero. Se puede anular aunque el artículo o
  el empleado ya estén inactivos.
- **RN-7: el reporte es informativo.** No descuenta nada del salario ni de comisiones; el total es
  para que el dueño lo use por fuera.

## Permisos

Sin claves nuevas. Anotar y anular: `inventory.move`. Ver el reporte: `inventory.read`.

## Datos

```prisma
enum InventoryMovementType {
  // … lo de la 065
  CONSUMPTION
  CONSUMPTION_RETURN
}

model InventoryMovement {
  // nuevo
  /// CONSUMPTION: precio de venta al anotar (RN-4). CONSUMPTION_RETURN: copia del original.
  unitPrice          Decimal? @db.Decimal(12, 2)
  /// CONSUMPTION_RETURN: el consumo que anula (RN-6). Único: se anula una vez.
  reversesMovementId String?  @unique @db.Uuid
  reverses           InventoryMovement?  @relation("MovementReversal", fields: [reversesMovementId], references: [id], onDelete: Restrict)
  reversedBy         InventoryMovement?  @relation("MovementReversal")
}
```

Migración: `ALTER TYPE … ADD VALUE` para los dos tipos y las dos columnas nullable. Nada se
rellena hacia atrás.

## API

Bajo `/api/inventory`, sesión de usuario.

| Método | Ruta                                 | Permiso          | Request                             | Response                          | Errores                                                                                                |
| ------ | ------------------------------------ | ---------------- | ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | `/items/:id/consumptions`            | `inventory.move` | `{ quantity, employeeId, note? }`   | `201 InventoryMovementResult`     | `400`, `404`, `404 EMPLOYEE_NOT_FOUND`, `409 INSUFFICIENT_STOCK`, `409 ITEM_INACTIVE`, `409 ITEM_NOT_SELLABLE` |
| POST   | `/consumptions/:movementId/reverse`  | `inventory.move` | `{ reason }`                        | `201 InventoryMovementResult`     | `404` (no existe o no es `CONSUMPTION`), `409 CONSUMPTION_ALREADY_REVERSED`, `422 VALIDATION_ERROR`     |
| GET    | `/consumptions`                      | `inventory.read` | `?month=YYYY-MM`                    | `EmployeeConsumptionReport`       | `422` mes inválido                                                                                     |
| GET    | `/consumptions/:employeeId`          | `inventory.read` | `?month=YYYY-MM`                    | `EmployeeConsumptionDetail`       | `404` empleado inexistente o id no-UUID; sin consumos → `200` vacío                                    |

Contrato en `@elite/shared`:

- `EmployeeConsumptionReport = { month, total, rows: { employee: { id, fullName, isActive }, units,
  total }[] }` — solo consumos no anulados; empleados sin consumos no salen.
- `EmployeeConsumptionDetail = { month, employee, units, total, entries: EmployeeConsumptionEntry[] }`
  con `EmployeeConsumptionEntry = { movementId, createdAt, item: { id, code, name, unit }, quantity
  (positiva), unitPrice, total, createdBy, note, reversal: { createdAt, createdBy, reason } | null }`
  — incluye los anulados (marcados), más reciente arriba; `units` y `total` sin los anulados.
- `InventoryMovement` gana `unitPrice` y `reversesMovementId`; `INVENTORY_MOVEMENT_TYPES` suma los
  dos tipos, así que el reporte plano de movimientos (065) los filtra sin cambios de ruta.
- Error nuevo: `CONSUMPTION_ALREADY_REVERSED`.

## UI

Sin prototipo aparte: reusa diálogo, combobox, tabla y stat cards del inventario (065).

- **Diálogo «Consumo de empleado»** (031), en la cabecera de `/inventory` y en el detalle de un
  producto (`inventory.move`; en un insumo el botón no sale): producto (combobox 034, solo productos
  activos, con «Hay N»; fijo si se abre desde el detalle), cantidad, empleado (combobox 034),
  nota opcional. Muestra el valor `2 × $1.25 = $2.50` y la leyenda «No se cobra; queda anotado a
  su nombre».
- **`/inventory/consumption`** («Consumo de empleados», enlace desde `/inventory` junto a
  Movimientos): selector de mes (anterior / siguiente, arranca en el mes actual, viaja en la URL
  `?month=`), stat card con el total del mes y tabla por empleado: nombre (+ «Inactivo»), unidades,
  valor. Fila clickeable (032).
- **`/inventory/consumption/[employeeId]?month=`**: nombre, mes, dos cifras (unidades, valor) y la
  tabla de consumos de la historia anterior. Un anulado se ve tachado con sello «Anulado» y su
  motivo. Acción `Anular` por fila (`inventory.move`) → diálogo con motivo obligatorio. Regreso
  (056) «Consumo de empleados» con el mismo mes.
- **Kardex y reporte de movimientos:** sellos nuevos `Consumo` (rosa/morado, distinto del ámbar del
  despacho) y `Consumo anulado` (gris claro); en «a quién» va el empleado.
- **Densidades:** en `bahia` filas, botones y selector de mes a `--touch-min`; bajo 900px la tabla
  del detalle pasa «anotó» y «nota» a una segunda línea.

## Fuera de alcance

- Que la pista o el propio trabajador anote.
- Cobrar o descontar el consumo de la planilla o de la comisión.
- Límite o cupo de consumo por trabajador.
- Exportar el reporte a Excel o PDF.

## Tareas

- [x] Shared: tipos de movimiento, schemas (`createInventoryConsumptionSchema`,
      `reverseInventoryConsumptionSchema`, `consumptionMonthQuerySchema`), contratos y error nuevo.
- [x] API: migración, `recordMovement` con `unitPrice` / `reversesMovementId`, casos de uso de
      anotar, anular y los dos reportes, rutas; tests de dominio y casos de uso (in-memory).
- [x] Web: diálogo, las dos pantallas, sellos del kardex, enlace desde `/inventory`, back-link.
- [x] `scripts/verify-070.sh`: migración, 201 / 409 / 404, pista rechazada, anulación única y reporte
      del mes contra la base.
- [x] `pnpm build`, `pnpm lint`, `pnpm test`.

## Verificación

`pnpm build && pnpm lint && pnpm test` y, con el stack levantado, `bash scripts/verify-070.sh`.
