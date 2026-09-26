# 059 — Cobro mancomunado, pago partido y vuelto

**Estado:** Aprobada (2026-09-20, por chat)
**Módulo:** carwash (caja) | **Depende de:** 003 (lavado), 010/038 (turno de caja), 045 (anulación)

## Contexto

Hoy un cobro es un ticket y un pago: `Payment.workOrderId` es `@unique` y el monto es el total
exacto, sin campo editable. Eso deja fuera dos casos reales del mostrador: una flota que se lleva
tres carros y quiere pagar una sola vez, y un cliente que paga una parte en efectivo y el resto con
tarjeta. Esta spec introduce la **cuenta de cobro**: el cobro deja de colgar del ticket y pasa a ser
una entidad propia que junta 1..N tickets y 1..N pagos. El caso normal —un ticket, un pago— no
cambia de forma para el cajero: sigue siendo elegir método y pulsar un botón.

Prototipo: `docs/prototype/joint-charge.html`.

## Decisiones del usuario

- 2026-09-20: mancomunar es **para cobrar junto**, no para entregar junto.
- 2026-09-20: el grupo se arma **en la caja, al cobrar**; no hay cuentas guardadas por cliente.
- 2026-09-20: el pago **se puede partir** en varios métodos, y eso vale también para un ticket solo.
- 2026-09-20: en efectivo se teclea lo que entrega el cliente y la pantalla muestra el cambio, sin
  botones de billete: solo el campo y la cifra.
- 2026-09-20: anular una cuenta mancomunada **anula la cuenta completa** (RN-8).

## Historias

- Como cajero con `carwash.charge`, quiero sumar varios tickets listos a un mismo cobro, para cobrarle
  a una flota una sola vez en lugar de tres.
- Como cajero con `carwash.charge`, quiero partir el pago en varios métodos, para aceptar que el
  cliente pague una parte en efectivo y el resto con tarjeta, sea un ticket o sean cinco.
- Como dueño con `carwash.read`, quiero que cada ticket siga guardando lo que le tocó, para que
  comisiones, cierre de turno y reportes por ticket no cambien de significado.

## Criterios de aceptación

- **Dado** un ticket `READY` sin cobrar, **cuando** el cajero elige método y cobra, **entonces** se
  crea una cuenta con un pago y el ticket queda `PAID`, igual que antes de esta spec.
- **Dado** tres tickets `READY` sin cobrar, **cuando** el cajero los suma a una cuenta y cobra con un
  método, **entonces** los tres quedan `PAID` en la misma transacción y la cuenta guarda un pago por
  el total de los tres.
- **Dado** una cuenta de $60.50, **cuando** el cajero registra $40.00 con tarjeta y $20.50 en
  efectivo, **entonces** se cobra; **y cuando** los renglones suman $59.00 o $61.00, **entonces** el
  API responde `422 PAYMENT_AMOUNT_MISMATCH` y la UI no deja pulsar Cobrar.
- **Dado** una cuenta de $43.50 que se paga en efectivo, **cuando** el cajero teclea $50.00
  recibidos, **entonces** la pantalla muestra $6.50 de cambio y el cobro queda con
  `cashTendered = 50.00` y `changeGiven = 6.50`; **y cuando** teclea $40.00, **entonces** el botón
  de cobrar queda deshabilitado con «Falta efectivo» y el API rechaza con `422 CASH_TENDERED_SHORT`.
- **Dado** una cuenta con dos tickets, **cuando** se cobra, **entonces** la suma de los montos
  asignados a cada ticket es exactamente el total cobrado, sin centavos perdidos ni inventados.
- **Dado** un ticket ya `PAID`, **cuando** se intenta sumarlo a una cuenta nueva, **entonces** el API
  responde `409 TICKET_ALREADY_CHARGED` y ninguno de los tickets de esa cuenta se cobra.
- **Dado** que no hay turno de caja abierto, **cuando** se intenta cobrar una cuenta, **entonces**
  falla igual que hoy (`409 CASH_NOT_OPEN`), sea de uno o de varios tickets.
- **Dado** una cuenta cobrada de tres tickets, **cuando** se anula uno con `carwash.void`,
  **entonces** se anula la cuenta completa: los tres tickets vuelven a `READY` y todos sus pagos
  salen del turno.

## Reglas de negocio

- **RN-1: la cuenta es la unidad de cobro.** Todo cobro crea una `Charge`, tenga un ticket o cinco.
  No existe un camino que escriba un `Payment` sin cuenta.
- **RN-2: la cuenta nace y muere en el cobro.** No se guarda una cuenta abierta ni a medio pagar: o
  se cobra completa o no existe. No hay saldo pendiente, fiado ni abono.
- **RN-3: la suma de los pagos es el total.** `sum(payments) === sum(totales de los tickets)`. Ni de
  más ni de menos. Lo que el cliente entrega en efectivo es otra cosa y va aparte (RN-10).
- **RN-4: solo tickets cobrables.** Cada ticket de la cuenta debe estar `READY` y sin pago. Un
  ticket solo puede pertenecer a una cuenta.
- **RN-5: reparto automático por ticket.** Cada renglón de pago se reparte entre los tickets de la
  cuenta, proporcional al total de cada uno, con los centavos sobrantes al ticket de mayor resto
  (resto mayor). La suma de las partes es siempre exactamente el renglón. El cajero nunca reparte a
  mano.
- **RN-6: mezclar responsables se permite.** La cuenta no exige un mismo cliente; la UI avisa, no
  bloquea.
- **RN-7: la cuenta es atómica.** Los tickets pasan a `PAID`, la comisión se congela y los pagos
  entran al turno abierto en una sola transacción. Si algo falla, no se cobra nada.
- **RN-8: anular es anular la cuenta.** No se anula un ticket suelto de una cuenta mancomunada. La
  autorización de la spec 045 se pide una vez, para la cuenta.
  Desde la 066 la cuenta puede llevar también productos sueltos (una venta de la 065): deshacerla
  anula la venta con sus productos de vuelta al inventario, desde el lavado o desde la venta.
- **RN-10: efectivo recibido y vuelto.** Cuando parte del cobro es efectivo, el cajero puede teclear
  con cuánto paga el cliente y la pantalla calcula el cambio. Lo recibido nunca puede ser menor que
  el efectivo a cobrar. El **pago** registrado sigue siendo el monto cobrado, no lo entregado: en la
  caja quedan `cashTendered` y `changeGiven` como dato del cobro, y el turno cuadra contra el monto
  cobrado. Si no se teclea nada, se asume pago justo y el cambio es cero.
- **RN-9: partir el pago no cambia el turno.** Cada renglón entra al turno con su método y su monto,
  como si fueran cobros separados: el cierre de caja no necesita saber que venían juntos.

## Permisos

Ninguno nuevo. Se cobra con `carwash.charge`, el turno se ve con `carwash.cash` y se anula con
`carwash.void`, como hoy.

## Datos

Tabla nueva `charges` y `payments` deja de ser 1:1 con el ticket.

```prisma
/// Un cobro. Junta 1..N tickets y 1..N pagos: el caso normal es uno y uno.
model Charge {
  id               String   @id @default(uuid()) @db.Uuid
  number           String   @unique
  total            Decimal  @db.Decimal(12, 2)
  chargedByUserId  String   @db.Uuid
  cashSessionId    String   @db.Uuid
  chargedAt        DateTime @default(now())
  /// Efectivo que entregó el cliente y vuelto que se le dio (RN-10). Null si
  /// no hubo efectivo o si pagó justo.
  cashTendered     Decimal? @db.Decimal(12, 2)
  changeGiven      Decimal? @db.Decimal(12, 2)
  payments         Payment[]
  ...
}

model Payment {
  // chargeId nuevo. Null = cobro anterior a esta spec.
  chargeId    String? @db.Uuid
  // deja de ser @unique: un ticket puede tener varias filas (un renglón de
  // pago por método y por ticket).
  workOrderId String  @db.Uuid
  ...
}
```

Migración: los `payments` existentes quedan con `chargeId` nulo y se leen como hoy. No se rellenan
cuentas hacia atrás.

`WorkOrder.payment` (relación `Payment?`) pasa a `payments Payment[]`. Todo lo que hoy asume un
pago único por ticket —incluida la estampa de método— se adapta a mostrar varios.

## API

| Método | Ruta                            | Request                                                           | Response     | Errores                                                                                                                                                            |
| ------ | ------------------------------- | ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/api/carwash/charges`          | `{ workOrderIds, payments: [{ method, amount }], cashTendered? }` | `201` Charge | `422 VALIDATION_ERROR`, `422 PAYMENT_AMOUNT_MISMATCH`, `422 CASH_TENDERED_SHORT`, `409 TICKET_ALREADY_CHARGED`, `409 TICKET_NOT_READY`, `409 CASH_NOT_OPEN`, `403` |
| POST   | `/api/carwash/charges/:id/void` | `{ authorization }` (spec 045)                                    | `200`        | `404`, `409 CHARGE_ALREADY_VOID`, `403`                                                                                                                            |

`POST /api/carwash/tickets/:id/charge` se mantiene y pasa a delegar en el mismo caso de uso con un
ticket y un pago: el contrato viejo no se rompe.

## UI

Una sola pantalla de cobro para los tres casos (prototipo `joint-charge.html`):

- **Cuenta.** Lista de tickets con placa, responsable, servicios y total. Botón «Sumar otro ticket
  al cobro» que abre un selector de tickets `READY` sin cobrar. Con un solo ticket la lista es una
  fila y no hay nada nuevo en pantalla.
- **Pago.** Por defecto los tres métodos como radiogroup y el total, como hoy. Un enlace «Partir el
  pago en varios métodos» cambia a renglones método + monto, con «Falta $X / Cuadra / Se pasó» y el
  botón de cobrar deshabilitado mientras no cuadre. Se puede volver a un solo pago.
- **Efectivo.** Si algo del cobro es efectivo aparece el campo «Con cuánto paga» y el **cambio** en
  cifra grande. Vacío = pagó justo. Si lo recibido no alcanza, el botón de cobrar dice «Falta
  efectivo».
- **Resumen.** Totales y, cuando hay más de un ticket, un desplegable «Cómo se registra por ticket»
  con el reparto de RN-5.
- **Aviso** cuando la cuenta mezcla responsables (RN-6).
- **Densidades.** `bahia` sube alto de fila, métodos y campos de monto a objetivo táctil; el resumen
  lateral se reemplaza por la barra inferior fija con total y botón bajo 1180px.

## Fuera de alcance

- Saldo pendiente, fiado, abonos y cuentas por cobrar.
- Cuentas guardadas por cliente o por flota (armar el grupo antes del cobro).
- Facturación o recibo impreso de la cuenta.

## Verificación

`scripts/verify-059.sh` contra el stack levantado: cobra una cuenta de tres tickets con dos métodos
y verifica que los tres quedan `PAID`, que la suma de los pagos es el total, que el reparto por
ticket cuadra al centavo, que un segundo cobro del mismo ticket da `409`, que una cuenta con montos que no
suman da `400` y que un `cashTendered` menor al efectivo a cobrar da `422 CASH_TENDERED_SHORT`.

## Tareas

> Implementado el 2026-09-20. `pnpm build`, `pnpm lint` y `pnpm test` (428 api + 203 web) en
> verde. Falta correr `scripts/verify-059.sh` y aplicar las migraciones: piden el stack levantado.

- [x] `packages/shared`: tipos y schemas de `Charge`, request de cobro y códigos de error nuevos.
- [x] `apps/api`: migración `charges` + `payments.chargeId` + quitar `@unique` de `workOrderId`.
- [x] `apps/api` domain: reparto de RN-5 con su test (incluye centavos que no dividen exacto).
- [x] `apps/api` application: caso de uso `ChargeAccount` (validaciones RN-3, RN-4, RN-7) con tests.
- [x] `apps/api` presentation: `POST /api/carwash/charges`, `POST /api/carwash/charges/:id/void` y
      el endpoint viejo delegando.
- [x] `apps/web`: selector de tickets, pago partido y resumen en el diálogo de cobro.
- [x] `apps/web`: campo de efectivo recibido y cálculo del cambio, con test.
- [x] `apps/web`: estampa de método y detalle del ticket con varios pagos.
- [x] `scripts/verify-059.sh` y sección **Verificación** enlazada.
- [x] `pnpm build`, `pnpm lint`, `pnpm test`.
