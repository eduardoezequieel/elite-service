# 010 — Caja del lavado

**Estado:** Terminada
**Módulo:** `carwash` | **Depende de:** spec 003 terminada

## Contexto

Hoy se cobra un lavado y el efectivo no tiene dueño: no hay turno, no hay
fondo, no hay arqueo. El prototipo HTML tenía un «cierre» que no persistía
nada y mezclaba efectivo con tarjeta. El taller legado sí: una sesión abierta,
cobros atados, cierre con contado vs esperado.

Esta spec trae **una caja física, un turno a la vez**, solo para el lavado.
Supersede la frase de 003 RN-10 «No hay saldo, crédito, caja ni DTE»: siguen
sin existir saldo, crédito ni DTE; **sí hay caja**.

## Historias

- Como usuario con `carwash.cash`, quiero abrir la caja con un fondo, para que
  el turno tenga un efectivo esperado.
- Como usuario con `carwash.charge`, quiero que el cobro falle si la caja
  está cerrada, para no mezclar dinero de dos turnos.
- Como usuario con `carwash.cash`, quiero cerrar el turno contando el
  efectivo y ver la diferencia, para entregar la caja.

## Criterios de aceptación

- **Dado** que no hay sesión `OPEN`, **cuando** se cobra un ticket `READY`,
  **entonces** `409 CASH_NOT_OPEN` y el ticket sigue `READY`.
- **Dado** un usuario con `carwash.cash`, **cuando** abre con fondo `"20.00"`,
  **entonces** nace una sesión `OPEN` con ese `openingFloat` y `openedByUserId`
  = él.
- **Dado** una sesión `OPEN`, **cuando** otro usuario intenta abrir, **entonces**
  `409 CASH_ALREADY_OPEN` y el cuerpo dice quién tiene el turno abierto.
- **Dado** sesión abierta y un cobro `CASH` de $14, **cuando** se cobra,
  **entonces** el `Payment` lleva `cashSessionId` de esa sesión.
- **Dado** fondo $20 y un cobro efectivo $14 (y otro `CARD` $10), **cuando**
  cierra con `countedCash: "34.00"`, **entonces** `expectedCash = 34.00`,
  `differenceCash = 0`, `cardTotal = 10.00`, `transferTotal = 0`, estado
  `CLOSED`.
- **Dado** el mismo turno, **cuando** cierra con `countedCash: "33.00"`,
  **entonces** `differenceCash = -1.00` (faltante) y igual queda `CLOSED`.
- **Dado** una sesión `CLOSED`, **cuando** se cobra, **entonces** otra vez
  `409 CASH_NOT_OPEN` hasta abrir un turno nuevo.
- **Dado** un usuario sin `carwash.cash`, **cuando** pide abrir, cerrar o ver
  la sesión, **entonces** `403`. Puede cobrar si tiene `carwash.charge` **y**
  alguien ya abrió.
- **Dado** una sesión de pista, **cuando** pide rutas de caja, **entonces**
  `401`. La pista no abre ni cierra.
- **Dado** `scripts/verify-003.sh` después de esta spec, **cuando** corre,
  **entonces** sigue verde: el script abre caja antes de cobrar.

## Reglas de negocio

- **RN-1 (un turno).** Existe como máximo una `CashSession` en `OPEN`. No hay
  CRUD de cajas físicas: hay una sola, implícita.
- **RN-2 (cobrar exige abierta).** `POST .../charge` (oficina) busca la
  sesión `OPEN`. Si no hay, no cobra. El pago nuevo **siempre** lleva
  `cashSessionId`. Los `Payment` anteriores a esta spec quedan con
  `cashSessionId` null y no entran a ningún turno.
- **RN-3 (fondo).** `openingFloat ≥ 0`. Default 0. Es efectivo que ya estaba
  en el cajón, no un cobro.
- **RN-4 (esperado).** Al cerrar se congela:

  ```
  cashTotal      = Σ Payment.amount de esta sesión con method CASH
  cardTotal      = Σ CARD
  transferTotal  = Σ TRANSFER
  expectedCash   = openingFloat + cashTotal
  differenceCash = countedCash − expectedCash
  ```

  Tarjeta y transferencia se **informan**, no se cuentan a mano. El arqueo
  es del cajón. No se copia el HTML que sumaba los tres métodos en «a
  entregar».
- **RN-5 (quién).** Abrir y cerrar: `carwash.cash`. Quien cierra no tiene que
  ser quien abrió. Cobrar: `carwash.charge` (003), sin este permiso.
- **RN-6 (cierre).** `countedCash ≥ 0` obligatorio. `notes` opcional. No hay
  reapertura: un `CLOSED` no vuelve a `OPEN`. El siguiente turno es otra
  fila. Sin límite de horario: un turno puede cruzar medianoche; no es un
  «día» en UTC.
- **RN-7 (gastos).** No hay. Un faltante se ve en `differenceCash`, no se
  registra un gasto.
- **RN-8 (anular).** 003 no anula `PAID`. Esta spec no introduce devoluciones
  ni movimientos negativos.
- **RN-9 (zona).** `openedAt` / `closedAt` / `paidAt` se muestran en
  `America/El_Salvador`. El turno no se recorta a medianoche.
- **RN-10 (003).** Se actualiza `scripts/verify-003.sh` para abrir caja con
  el admin sembrado antes del primer cobro y cerrarla al limpiar. La RN-10
  de 003 queda: un pago, total exacto, sin crédito ni DTE; **con** caja
  (esta spec). No se reescribe el resto de 003.

## Permisos

| Clave           | Descripción                                                |
| --------------- | ---------------------------------------------------------- |
| `carwash.cash`  | Ver el turno, abrirlo y cerrarlo                           |

Seed a `Administrator`. Etiqueta de matriz: `cash` → «Caja». No se siembra un
rol Cajero; quien arme ese rol le pone `carwash.read`, `carwash.charge` y,
si abre/cierra, `carwash.cash`.

## Datos

```
enum CashSessionStatus  OPEN | CLOSED

CashSession   id,
              status,
              openedByUserId, openedAt,
              openingFloat Decimal(12,2),
              closedByUserId?, closedAt?,
              countedCash Decimal(12,2)?,
              cashTotal Decimal(12,2)?,
              cardTotal Decimal(12,2)?,
              transferTotal Decimal(12,2)?,
              expectedCash Decimal(12,2)?,
              differenceCash Decimal(12,2)?,
              notes?,
              createdAt, updatedAt

Payment       + cashSessionId?   // FK real a CashSession, ON DELETE RESTRICT
                                 // null = cobro anterior a esta spec
```

Los totales del cierre son snapshot: no se recalculan si alguien mira la
fila después. (No hay forma de agregar pagos a una sesión cerrada.)

## API

Oficina. Montos string decimal.

| Método | Ruta | Request | Response | Errores |
| ------ | ---- | ------- | -------- | ------- |
| GET    | `/carwash/cash/current` | — | sesión `OPEN` o `null` | 403 `carwash.cash` |
| GET    | `/carwash/cash/sessions` | — | lista, más reciente primero (máx. 50) | 403 |
| GET    | `/carwash/cash/sessions/:id` | — | sesión + pagos del turno | 403, 404 |
| POST   | `/carwash/cash/open` | `{ openingFloat: string }` default `"0.00"` | sesión `OPEN` | 403, 409 `CASH_ALREADY_OPEN`, 422 si float < 0 |
| POST   | `/carwash/cash/close` | `{ countedCash: string, notes? }` | sesión `CLOSED` | 403, 409 `CASH_NOT_OPEN`, 422 |

`POST /carwash/tickets/:id/charge` (003) agrega el error `409 CASH_NOT_OPEN`
mensaje «Abrí la caja para cobrar.». No cambia el body del cobro.

Códigos nuevos: `CASH_NOT_OPEN`, `CASH_ALREADY_OPEN`.

Respuesta de sesión:

```
{
  id, status,
  openingFloat, openedAt, openedBy: { id, fullName },
  closedAt, closedBy, countedCash, cashTotal, cardTotal,
  transferTotal, expectedCash, differenceCash, notes,
  paymentCount
}
```

En `OPEN`, los totales `cashTotal` / `cardTotal` / `transferTotal` /
`expectedCash` van **en vivo** (suma actual). `countedCash` y
`differenceCash` van null hasta cerrar.

## UI

Hija de Lavados: `/carwash/cash`. Acción en el `ScreenHeader` de `/carwash`
si hay `carwash.cash` («Caja»). Regreso a `/carwash` (008). No es pestaña
nueva del riel. Pista: nada.

**Sin turno abierto.** Primario «Abrir caja». Campo fondo (FieldBox), default
$0.00. Texto: «Sin caja abierta no se cobra.»

**Turno abierto.** Stat cards: fondo, efectivo cobrado, esperado, tarjeta,
transferencia, tickets cobrados. Primario «Cerrar caja». El diálogo de cierre
muestra esperado en Figure, campo «Contado» (≥ 44px en `bahía`), diferencia
en vivo (go si 0, warn si sobrante, danger si faltante), notas opcionales.
Confirmar cierra.

**Historial.** Debajo, `DataTable` de turnos `CLOSED`: abierto → cerrado,
quién, esperado, contado, diferencia con Stamp. «Abrir» al detalle
`/carwash/cash/:id` (solo lectura).

**Cobro (003).** Si `GET /carwash/cash/current` es `null` y el usuario va a
cobrar, el diálogo de cobro no llama a charge: muestra «Abrí la caja para
cobrar.» y, si tiene `carwash.cash`, enlace a `/carwash/cash`. Si cobra y el
API responde `CASH_NOT_OPEN` (carrera: cerraron en otra pantalla), el mismo
mensaje.

Densidad `mostrador` y `bahía`. Un primario. Sin `<select>`.

## Fuera de alcance

- Reabrir un turno cerrado.
- Contar tarjeta/transferencia a mano.
- Gastos, retiros, depósitos, varias cajas, sucursales.
- DTE / factura externa (los tres métodos entran al turno).
- Caja del taller (cuando exista, reutilizará `CashSession` o nacerá otra
  spec).
- Que la pista cobre o vea la caja.
- Anular un `PAID` ni devolver efectivo.

## Always

- Sin sesión `OPEN` no hay cobro. Un turno a la vez. Cierre persistido.
- Se cuenta solo el efectivo. Esperado = fondo + cobros `CASH` del turno.
- `verify-003.sh` se actualiza en el mismo cambio. Pagos viejos no se
  reescriben.
- Autorización por `carwash.cash` / `carwash.charge`, nunca por nombre de rol.

## Ask first

- ¿El cobro sigue pasando con la caja cerrada y el cierre solo resume el
  día? Esta spec dice **no**: sin turno abierto no se cobra. Es el cambio
  visible sobre 003.

## Never

- Cierre que no escribe fila (el HTML).
- Sumar tarjeta y transferencia al efectivo esperado.
- Fechas de turno con `toISOString().slice(0,10)` (UTC).
- Reabrir. Gastos. Devoluciones.
- Mostrar caja en la pista.
- Dejar `verify-003.sh` rojo.

## Verify

```bash
docker compose up -d
pnpm build && pnpm --filter @elite/api db:seed
pnpm dev
bash scripts/verify-003.sh
bash scripts/verify-010.sh
```

`verify-010.sh` cubre: cobro sin turno → 409, abrir, segundo abrir → 409,
cobro CASH+CARD atados al turno, cierre diferencia 0 y diferencia −1,
cobro tras cierre → 409, 403 sin permiso, 401 desde pista. Limpia el turno
y tickets `VIS`.

## Tareas

- [x] `carwash.cash` + códigos `CASH_NOT_OPEN`, `CASH_ALREADY_OPEN` en
      `@elite/shared`. `ACTION_LABELS`: `cash` → «Caja». Seed a
      `Administrator`.
- [x] Migración `CashSession` + `Payment.cashSessionId`.
- [x] Dominio del arqueo (esperado, diferencia) + tests en centavos.
- [x] Use cases abrir / cerrar / current / listar. `charge` de 003 exige
      sesión `OPEN` y guarda el FK.
- [x] UI `/carwash/cash` y el bloqueo en el diálogo de cobro. Header de
      Lavados.
- [x] Actualizar `scripts/verify-003.sh` (abrir antes de cobrar, cerrar al
      limpiar).
- [x] `scripts/verify-010.sh`.
- [x] Anotar §2 de `docs/LEGACY_BUSINESS_LOGIC.md` y, al terminar, una línea
      en 003 RN-10: «caja: spec 010».
