# 098 — Dinero de la rentadora: cobros, depósitos, multas, cuentas por cobrar y caja

**Estado:** Terminada (aprobada por chat, 1 oct 2026: «la caja del carwash es diferente a la de
renta de carros y asi»)
**Módulo:** rental-billing (api) · features/rental-billing (web) · `@elite/shared`
rentals/billing.ts | **Depende de:** 095 (corre en paralelo con 096 y 099)

## Contexto

La rentadora cobra por partes: anticipo al reservar, resto al entregar o recibir, a veces después.
Guarda depósitos en custodia y los devuelve (total o parcial). Registra multas de tránsito que le
llegan después y se las carga al cliente que tenía el carro. Su «Caja» es un **reporte diario**
—cobros del día por forma de pago y por usuario, depósitos en custodia, cuentas por cobrar y un
cierre imprimible—, **no** un turno con apertura y arqueo como el del lavado, y **no comparte nada**
con `cash_sessions` ni `payments` del carwash. Esta spec no toca `schema.prisma`: usa
`rental_payments` y `rental_fines` de la 095.

## Historias

- Como caja con `rentals.charge`, quiero registrar un pago sobre una renta con forma de pago y
  referencia, para que el saldo baje y quede quién lo recibió.
- Como caja, quiero devolver el depósito al recibir el carro, reteniendo una parte si hubo daños,
  para que quede escrito cuánto se devolvió y por qué.
- Como dueño, quiero ver al final del día cuánto entró, por qué medio y por quién, y qué se debe,
  para cuadrar.
- Como caja, quiero registrar una multa que llegó por correo y cargársela a quien tenía el carro
  ese día, para no perder esa plata.

## Criterios de aceptación

- **Dado** una renta con saldo 50, **cuando** registro un pago de 30 en efectivo, **entonces**
  `totals.paid` sube a 30, `balance` queda 20 y `receivedByUserId` es el usuario de la sesión. Un
  pago de 60 → 409 `PAYMENT_EXCEEDS_BALANCE`.
- **Dado** un pago registrado por error, **cuando** lo anulo con motivo, **entonces** queda
  `voidedAt` y deja de sumar; la caja del día lo muestra tachado y aparte.
- **Dado** una renta con depósito 100 no devuelto, **cuando** devuelvo 80 con nota, **entonces**
  `depositReturnedAmount = 80`; devolver 120 → 409 `DEPOSIT_EXCEEDS_HELD`; devolver dos veces → 409
  `DEPOSIT_EXCEEDS_HELD`.
- **Dado** una multa con fecha dentro de una renta en curso o finalizada de ese carro, **cuando**
  la registro con `chargeToCustomer: true`, **entonces** se liga a esa renta (`agreementId`
  resuelto por quién tenía el carro en `occurredAt`) y entra al total vía `finesCharged`. Sin
  renta en esa fecha, queda solo como multa del carro (gasto para la 099, que la lee de
  `rental_fines` cuando `chargedToCustomer = false`).
- **Dado** `GET /rentals/cash?date=2026-10-01`, **entonces** devuelve `{ date, total,
  byMethod: { CASH, CARD, TRANSFER, OTHER }, byUser: [{ userId, name, total }], payments: [...],
  voided: [...], depositsHeld: [{ agreementId, contractNumber, customer, amount }],
  receivables: [{ agreementId, contractNumber, customer, balance, status }] }`. El día va en
  `America/El_Salvador`.
- **Dado** un usuario con `rentals.read` pero sin `rentals.charge`, **cuando** pide
  `GET /rentals/cash`, **entonces** 403.

## Reglas de negocio

- **RN-1:** Un pago nunca supera el saldo vigente (`agreementTotals().balance`), ni es cero o
  negativo. Las anulaciones no se borran: `voidedAt`, `voidReason`, `voidedByUserId`.
- **RN-2:** El depósito está «en custodia» si `deposit > 0`, no fue devuelto y no fue transferido
  (`depositTransferredToId` nulo). Se devuelve una sola vez, hasta `deposit`.
- **RN-3:** Cuentas por cobrar: rentas `IN_PROGRESS` o `FINISHED` con `balance > 0.009`.
- **RN-4:** La multa se liga a la renta cuyo intervalo ocupado cubre `occurredAt` (helper de la
  096 en shared si ya existe; si no, el mismo cálculo acá en `domain/`). `chargedToCustomer` solo
  puede ser `true` si se encontró renta.
- **RN-5:** El cierre imprimible es la misma pantalla con estilos `print:`; no hay snapshot en la
  base.
- **RN-6:** Formas de pago: `PaymentMethod` (`CASH`, `CARD`, `TRANSFER`, `OTHER`) + `reference`
  libre (número de transferencia, voucher). Sin cuentas bancarias por ahora.

## Permisos

`rentals.charge` para todo lo de esta spec; `rentals.read` alcanza para **ver** pagos y multas
dentro del detalle de la renta (que ya los trae la 096). Sin claves nuevas.

## Contrato compartido (`rentals/billing.ts`)

`createPaymentSchema` (amount, method, reference?, paidAt?, note?), `voidPaymentSchema` (reason),
`depositReturnSchema` (amount, method?, note?), `createFineSchema` (vehicleId, occurredAt, amount,
description, chargeToCustomer), `cashQuerySchema` (date civil), tipos `RentalPayment`,
`RentalFine`, `RentalCashReport`, `ReceivableRow`, `DepositHeldRow`. Labels
`PAYMENT_METHOD_LABELS` si no existen ya en shared (si existen, reusar).

## API

| Método | Ruta                                           | Permiso          | Notas                                  |
| ------ | ---------------------------------------------- | ---------------- | -------------------------------------- |
| POST   | `/rentals/agreements/:id/payments`             | `rentals.charge` | 201 `RentalPayment`; 409 si excede      |
| POST   | `/rentals/payments/:paymentId/void`            | `rentals.charge` | `{ reason }`                            |
| POST   | `/rentals/agreements/:id/deposit-return`       | `rentals.charge` | 409 `DEPOSIT_EXCEEDS_HELD`              |
| GET    | `/rentals/fines`                               | `rentals.read`   | `?vehicleId&agreementId&from&to`        |
| POST   | `/rentals/fines`                               | `rentals.charge` | 201; resuelve `agreementId`             |
| GET    | `/rentals/cash`                                | `rentals.charge` | `?date` (default hoy)                   |
| GET    | `/rentals/receivables`                         | `rentals.charge` | lista RN-3                              |

Módulo `rental-billing` (cascarón de la 095): `domain/` (reglas de saldo y depósito, quién tenía
el carro), `application/` (puertos `RentalPaymentRepository`, `RentalFineRepository`,
`AgreementReader` —lee `rental_agreements` con pagos y multas para calcular totales—,
`UserDirectory` para nombres), `infrastructure/` Prisma, `presentation/`. No importa el módulo
`rentals` de la 096 (corre en paralelo): lee las tablas directo.

## UI (`features/rental-billing`)

- **`AgreementBillingPanel`** (`components/agreement-billing-panel.tsx`, **reemplaza el stub** de
  la 096): tarjeta «Cuenta» con total, pagado, saldo (`StatCard`s), depósito en custodia / devuelto,
  lista de pagos (fecha, método, referencia, quién, anulado tachado) con «Registrar pago», «Anular»
  (diálogo con motivo), «Devolver depósito» (si aplica), multas ligadas con «Agregar multa». Tras
  cada mutación invalida `['rental-agreement', id]`, `['rental-agreements']` y `['rental-cash']`.
  Solo renderiza acciones con `rentals.charge`; con `rentals.read` muestra solo lectura.
- **Caja** `/rentals/cash` (`rentals.charge`): navegación por día (Hoy · anterior · siguiente ·
  fecha), `StatCard`s: cobrado, por método (efectivo marcado «lo que debe haber en caja»), tabla de
  pagos del día (hora, contrato, cliente, método, referencia, quién, monto), tabla por usuario,
  «Depósitos en custodia» y «Cuentas por cobrar» con enlace a cada renta, botón «Imprimir cierre»
  (estilos `print:`). En `bahia`, tarjetas en vez de tablas.
- **Multas**: diálogo `FineDialog` accesible desde la caja («Registrar multa») y desde el panel de
  la renta; muestra a quién se le cargará antes de guardar (consulta `GET /rentals/agreements`
  por `vehicleId` y fecha; si la 096 no está, el API resuelve igual al guardar).

## Fuera de alcance

- Turno de caja con apertura/arqueo; cuentas bancarias de la rentadora; recibos impresos por pago.
- Gastos (099) y rentabilidad (100).

## Tareas

- [x] `rentals/billing.ts` en shared con tests de schemas.
- [x] Dominio y casos de uso con repos en memoria: pago (saldo), anulación, devolución de depósito,
      multa con resolución de renta, reporte de caja, cuentas por cobrar; tests.
- [x] Infra Prisma + controller.
- [x] `AgreementBillingPanel`, pantalla Caja, `FineDialog`.
- [x] `apps/api/AGENTS.md` y `apps/web/AGENTS.md`: una línea cada uno.
- [x] `scripts/verify-098.sh`: pago, exceso 409, anulación, depósito 409, multa ligada, caja del
      día con `byMethod`, 403 sin `rentals.charge`. El script crea su propia renta con `POST
      /rentals/agreements` si el endpoint existe; si la 096 aún no mergeó, inserta la renta con
      `psql` vía `docker compose exec` (documentarlo en el encabezado).

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-098.sh
```
