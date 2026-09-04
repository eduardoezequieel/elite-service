# 009 — Comisiones del lavado

**Estado:** Terminada
**Módulo:** `carwash` | **Depende de:** spec 003 terminada

## Contexto

La spec 003 asienta quién lavó (`WorkOrderAssignment`) y no calcula comisión. El
prototipo HTML sí: tramos por total del ticket, partes iguales si hay varios
lavadores, pantalla de «a pagar». Sin esto el lavado se cobra y los lavadores
se pagan en un cuaderno.

El dominio trabaja en **centavos enteros**, igual que 003 (`apps/api` →
`carwash/domain/money.ts`). La fórmula se porta del legado; el eje de fecha y
el redondeo del reparto no: no se copia pagar por un ticket que nunca se cobró
ni perder centavos al dividir.

## Historias

- Como empleado de pista, quiero marcar quién más lavó este carro, para que la
  comisión no se la lleve solo quien abrió el ticket.
- Como usuario con `carwash.manage`, quiero corregir los lavadores de un ticket
  `OPEN` o `READY` desde oficina.
- Como usuario con `carwash.commissions`, quiero ver cuánto hay que pagarle a
  cada lavador en un rango de fechas, para cerrar la semana sin Excel.

## Criterios de aceptación

- **Dado** un ticket `READY` de total $14.00 con un lavador, **cuando** se
  cobra, **entonces** `commissionTotal` queda `"1.00"` y hay una
  `CommissionEntry` de $1.00 para ese empleado.
- **Dado** el mismo total con dos lavadores, **cuando** se cobra, **entonces**
  cada uno tiene una entrada de $0.50 y la suma es $1.00.
- **Dado** un ticket de $8.00, **cuando** se cobra, **entonces**
  `commissionTotal` es `"0.00"` y no se crean entradas (o quedan en 0; el
  reporte no las suma como a pagar).
- **Dado** un ticket de $40.00, **cuando** se cobra, **entonces**
  `commissionTotal` es `"4.80"` (12 %).
- **Dado** un ticket `OPEN` o `READY`, **cuando** todavía no se cobra,
  **entonces** no hay `commissionTotal` ni entradas. Marcar listo no comisiona.
- **Dado** un ticket `VOID`, **cuando** se consulta comisiones, **entonces** no
  aparece. `PAID` no se anula (003 RN-11): no hay reversión.
- **Dado** un ticket abierto desde pista por Carlos, **cuando** se agregan a
  José como lavador y se cobra, **entonces** `washer` sigue siendo Carlos
  (quien abrió, 003 RN-8) y `washers` es `[Carlos, José]`.
- **Dado** un ticket de oficina sin lavador («Oficina»), **cuando** se cobra,
  **entonces** `commissionTotal` se calcula y no hay entradas: nadie cobra esa
  comisión.
- **Dado** un empleado desactivado que lavó tickets ya `PAID`, **cuando** se
  abre el reporte, **entonces** sigue apareciendo con su nombre y su total. No
  desaparece del «a pagar».
- **Dado** un usuario sin `carwash.commissions`, **cuando** pide
  `GET /carwash/commissions`, **entonces** `403`. La pestaña/acción no se
  dibuja.
- **Dado** una sesión de pista, **cuando** pide el reporte, **entonces** `401`.
  La pista no ve dólares de comisión.
- **Dado** densidad `bahía` en `/floor/:id` y `/floor/new`, **cuando** se
  eligen lavadores extra, **entonces** son láminas/chips ≥ 44×44, sin
  `<select>`, un primario por pantalla.

## Reglas de negocio

- **RN-1 (cuándo).** La comisión se **congela al cobrar** (`READY → PAID`),
  sobre el `total` final del ticket (suma de `unitPrice`, IVA incluido). No se
  calcula al crear ni al marcar listo. Un descuento en `OPEN` cambia la base;
  después de `PAID` no se recalcula.
- **RN-2 (fórmula).** Sobre el total en centavos, idéntica al legado:

  | Total `t` (USD) | Comisión |
  | --------------- | -------- |
  | `t < 14`        | $0       |
  | `14 ≤ t < 20`   | $1       |
  | `20 ≤ t < 25`   | $2       |
  | `25 ≤ t < 35`   | $3       |
  | `35 ≤ t < 40`   | $4       |
  | `t ≥ 40`        | 12 % de `t`, redondeado al centavo más cercano |

  El salto $39.99 → $4 / $40 → $4.80 se copia a propósito. Función pura en
  `carwash/domain/commission.ts`, con tests de esa tabla. `Math.round` sobre
  centavos: `round(tCents * 12 / 100)` en el último tramo.
- **RN-3 (varios lavadores).** `WorkOrderAssignment` pasa a ser el conjunto
  de quienes lavaron, no un solo empleado. `openedByEmployeeId` **no cambia**:
  sigue siendo quien abrió (003 RN-8). `Ticket.washer` = quien abrió (o
  `null` = «Oficina»). `Ticket.washers` = assignments. En pista, quien abre
  entra siempre al conjunto; puede sumar otros activos. En oficina, el
  conjunto puede quedar vacío.
- **RN-4 (reparto).** `n = washers.length`. Si `n = 0`, no hay entradas. Si
  `n ≥ 1`, se parte `commissionTotal` en centavos: los primeros `n − 1`
  reciben `floor(total / n)` y el último el resto, para que la suma dé
  exacto. No se copia el `/ n` sin redondeo del HTML.
- **RN-5 (eje de fecha).** El reporte filtra por `chargedAt` en
  `America/El_Salvador`, no por `createdAt`. «Hoy» = tickets cobrados hoy.
  El legado mezclaba las dos fechas; acá no.
- **RN-6 (quién ve).** Solo oficina, permiso `carwash.commissions`. Un cajero
  con `carwash.charge` no ve esta pantalla salvo que también tenga esa clave.
- **RN-7 (edición de lavadores).** Se puede cambiar el conjunto en `OPEN` y
  `READY`. En `PAID` y `VOID`, `409 TICKET_NOT_OPEN` (mismo espíritu: el
  documento de dinero no se reescribe). Todos los ids tienen que ser
  empleados existentes y **activos** al momento de asignar
  (`INVALID_WASHER`). Un empleado que después se desactiva no se saca de un
  ticket ya cobrado.
- **RN-8 (persistencia).** Al cobrar se escriben `WorkOrder.commissionTotal` y
  una fila `CommissionEntry` por lavador (`amount`, `employeeId`,
  `workOrderId`). El reporte lee esas filas, no vuelve a aplicar la fórmula.
- **RN-9 (compatibilidad 003).** `POST /floor/tickets` y
  `POST /carwash/tickets` con `employeeId` siguen igual. `verify-003.sh` no se
  rompe: un ticket de pista tiene `washer` = quien abrió y `washers` de
  longitud 1.

## Permisos

Solo vista admin. El seed de 001 sincroniza la clave nueva a `Administrator`.

| Clave                  | Descripción                                              |
| ---------------------- | -------------------------------------------------------- |
| `carwash.commissions`  | Ver el reporte de comisiones y el total a pagar          |

`carwash.manage` cubre corregir lavadores desde oficina. En pista, cualquier
empleado activo puede sumar lavadores a un `OPEN`/`READY` (igual que marcar
listo). Etiqueta de matriz: `commissions` → «Comisiones».

## Datos

```
WorkOrder            + commissionTotal Decimal(12,2)?   // null hasta PAID
CommissionEntry      id, workOrderId, employeeId,
                     amount Decimal(12,2),
                     createdAt
                     @@unique([workOrderId, employeeId])
```

`WorkOrderAssignment` no cambia de forma; sí de cardinalidad de uso (0..n).
Dinero: `Decimal(12,2)`. IDs uuid.

## API

Errores `{ code, message, details? }`. Montos en string decimal (`"1.00"`),
como 003. Fechas de rango en `America/El_Salvador`.

### Pista (`kind: employee`)

| Método | Ruta | Request | Response | Errores |
| ------ | ---- | ------- | -------- | ------- |
| GET    | `/floor/employees` | — | `{ id, fullName }[]` activos, sin username ni pin | 401 |
| POST   | `/floor/tickets` | 003 + `washerIds?: string[]` extras | ticket con `washers` | `INVALID_WASHER` |
| PUT    | `/floor/tickets/:id/washers` | `{ employeeIds: string[] }` (≥1, activos) | ticket | 409 si no `OPEN`/`READY`; `INVALID_WASHER` |

Quien abre se une al conjunto en el `POST`; no hace falta mandarlo en
`washerIds`. El `PUT` **reemplaza** el conjunto (tiene que quedar ≥1).

### Oficina (`kind: user`)

| Método | Ruta | Request | Response | Errores |
| ------ | ---- | ------- | -------- | ------- |
| PUT    | `/carwash/tickets/:id/washers` | `{ employeeIds: string[] }` (0..n) | ticket | 403 `carwash.manage`; 409; `INVALID_WASHER` |
| GET    | `/carwash/commissions?from=&to=` | `YYYY-MM-DD`; default hoy–hoy | reporte | 403 `carwash.commissions` |

`POST /carwash/tickets` acepta `washerIds?: string[]` además de `employeeId`
(003). Si viene `employeeId`, entra al conjunto. Vacío = «Oficina».

Respuesta del reporte:

```
{
  from, to,                          // YYYY-MM-DD
  employees: [{
    employeeId, fullName, isActive,
    ticketCount,                     // tickets PAID en el rango donde aparece
    salesAttributed,                 // suma de total/n de esos tickets, string
    commission                       // suma de CommissionEntry.amount
  }],
  unassigned: { ticketCount, commission },  // PAID sin lavadores
  totalPayable                       // suma de employees[].commission
}
```

Empleados con `commission = 0` y `ticketCount = 0` no se listan. Orden:
comisión desc, nombre asc.

Códigos nuevos en `@elite/shared`: ninguno obligatorio si se reusa
`INVALID_WASHER` y `TICKET_NOT_OPEN`. Si el `PUT` en `READY` choca con el
mensaje de `TICKET_NOT_OPEN`, se agrega `TICKET_NOT_EDITABLE` con mensaje
«Los lavadores de un lavado cobrado o anulado no se cambian.» y se usa para
`PAID`/`VOID`. Preferir un código nuevo `WASHERS_LOCKED` para no reciclar mal
el de 003.

**`WASHERS_LOCKED`:** operación de lavadores sobre `PAID` o `VOID`.

El `GET` de ticket (pista y oficina) agrega `washers: TicketWasher[]`
(`TicketWasher` deja de ser `| null`; el singular `washer` sigue `| null`).

## UI

Tokens de 002/005. Español, caja normal. Sin `<select>`. Densidad `mostrador`
y `bahía`.

**Pista — alta y detalle (`OPEN`/`READY`).** Bloque «Lavaron»: el empleado de
la sesión ya está marcado y no se puede sacar en el alta (es quien abre). El
resto, chips tocables de empleados activos (nombres de pila). En el detalle
`PUT` reemplaza el conjunto; no se puede dejar vacío. En `PAID`/`VOID` se
muestran nombres, no se editan.

**Oficina — detalle.** Igual, permite conjunto vacío («Oficina»). Lista de
nombres en la fila de Lavados: si `washers.length = 0`, «Oficina»; si 1, el
nombre; si más, «Carlos +1».

**Oficina — `/carwash/commissions`.** Hija de Lavados (008: enlace de
regreso). No es pestaña nueva del riel: acción en el `ScreenHeader` de
`/carwash` visible con `carwash.commissions` («Comisiones»).

- Segmentos de rango: Hoy · 7 días · Este mes. Default Hoy.
- `DataTable`: Lavador · Tickets · Ventas atribuidas · Comisión. Stamp
  «Inactivo» si `isActive = false`.
- Pie: «A pagar» en tipografía Figure.
- Si `unassigned.ticketCount > 0`, una línea al pie: «N lavados de oficina
  sin lavador, comisión no asignada $X». No entra a «A pagar».
- Vacío: «En este rango no hay lavados cobrados.»

Cero comisiones en pista. Cero toasts de éxito innecesarios; error de API en
el bloque, `role=alert`.

## Fuera de alcance

- Comisiones de taller, metas, reglas versionadas del schema legado.
- Comisión al marcar listo o al crear.
- Recalcular tickets `PAID` viejos (quedan `commissionTotal` null y no
  aparecen hasta que —no se hace— se recobren; los `PAID` anteriores a esta
  spec no comisionan).
- Varios lavadores como cambio de `openedByEmployeeId`.
- Tienda, DTE, caja (caja es 010).
- Exportar Excel / PDF.
- Pagar la comisión dentro del sistema (esta spec informa; el pago al
  lavador es afuera).

## Always

- Fórmula y congelado al cobrar, en centavos, tests de dominio de la tabla.
- `washer` (003) no se redefine; `washers` es el conjunto que cobra.
- Reparto con resto al último. Fecha = `chargedAt` TZ de El Salvador.
- Pista sin reporte. Autorización por `carwash.commissions`, nunca por rol.

## Ask first

- ¿Comisión al marcar listo (`READY`) en vez de al cobrar? Esta spec dice
  **al cobrar**. Cambiarlo mueve el eje de fecha y obliga a revertir si se
  anula un `READY`.

## Never

- Aplicar la fórmula en el cliente como fuente de verdad.
- Usar `number` decimal para la comisión (003 ya lo prohibió).
- Borrar `CommissionEntry` al desactivar un empleado.
- Mostrar comisión en la pista.
- Romper `scripts/verify-003.sh` (un lavador, `employeeId`, `washer`).

## Verify

```bash
docker compose up -d
pnpm build && pnpm --filter @elite/api db:seed
pnpm dev
bash scripts/verify-009.sh
```

El script (se escribe al implementar) cubre: $8→0, $14→1, $14 con 2
lavadores→0.50/0.50, $40→4.80, $1.00 / 3 lavadores suma 1.00, `OPEN`/`READY`
sin entradas, oficina sin lavador no paga, 403 sin permiso, 401 desde pista,
`washer` de 003 intacto. Si 010 ya está viva, abre caja antes de cobrar.

Además: `pnpm --filter @elite/api test` con la tabla de RN-2 y el reparto.

## Tareas

- [x] `carwash.commissions` en `@elite/shared` + `WASHERS_LOCKED` +
      `Ticket.washers`. `ACTION_LABELS`: `commissions` → «Comisiones». Seed a
      `Administrator`.
- [x] Migración: `WorkOrder.commissionTotal`, modelo `CommissionEntry`.
- [x] Dominio `commission.ts` + tests (tramos, 12 %, resto).
- [x] `PUT` lavadores pista y oficina; `GET /floor/employees`; `washerIds` en
      el alta. Al cobrar, persistir total y entradas.
- [x] `GET /carwash/commissions`.
- [x] UI pista: chips de lavadores en alta y detalle (`bahía` y tablet).
- [x] UI oficina: detalle + `/carwash/commissions` + acción en header.
- [x] `scripts/verify-009.sh` y enlace en esta sección.
- [x] Anotar §2 de `docs/LEGACY_BUSINESS_LOGIC.md` cuando quede Terminada.
