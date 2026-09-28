# 069 — Cuentas bancarias para la transferencia y método «Otro»

**Estado:** Aprobada (aprobada por chat, 26 sept 2026)
**Módulo:** banking (nuevo) + carwash (caja) + sales + shared | **Depende de:** 010/038 (turno de caja),
059 (cuenta de cobro), 066 (lavados y ventas en el mismo cobro)

## Contexto

Hoy «Transferencia» se guarda sin más dato: ni a qué cuenta del negocio entró ni con qué comprobante.
Al cerrar el turno no se puede cuadrar contra el estado de cuenta del banco. Además, lo que no es
efectivo, tarjeta ni transferencia (cheque, billetera móvil) no tiene dónde ir.

## Decisiones del usuario

- 2026-09-26: la cuenta es **del negocio**: el cajero elige a cuál entró la plata.
- 2026-09-26: la **referencia del comprobante es obligatoria** en toda transferencia.
- 2026-09-26: el banco sale de una **lista fija de bancos de El Salvador**; la cuenta lleva tipo
  (ahorro/corriente), número y titular.
- 2026-09-26: método nuevo **«Otro»** con un texto libre corto que escribe el cajero.

## Historias

- Como administrador con `banking.manage`, quiero registrar las cuentas del negocio, para que el
  cajero elija a cuál entró una transferencia.
- Como cajero con `carwash.charge`, quiero elegir la cuenta y anotar la referencia al cobrar por
  transferencia, para que el pago se pueda rastrear en el banco.
- Como cajero con `carwash.charge`, quiero cobrar con «Otro» y escribir qué fue, para no forzar un
  método que no corresponde.
- Como encargado con `carwash.cash`, quiero ver al cerrar el turno cuánto entró en cada cuenta y qué
  se cobró con «Otro», para cuadrar contra el banco.

## Criterios de aceptación

- **Dado** un usuario con `banking.manage`, **cuando** crea una cuenta con banco `AGRICOLA`, tipo
  `CHECKING`, número `0012345678` y titular «Elite Service S.A. de C.V.», **entonces** aparece activa
  en la lista; **y cuando** crea otra con el mismo banco y número, **entonces** el API responde
  `409 BANK_ACCOUNT_DUPLICATE`.
- **Dado** un usuario sin `banking.manage`, **cuando** llama a crear, editar o desactivar una cuenta,
  **entonces** recibe `403`.
- **Dado** una cuenta con pagos, **cuando** se desactiva, **entonces** deja de salir en el cobro y
  los pagos viejos la siguen mostrando. No existe borrar.
- **Dado** un cobro con un renglón `TRANSFER`, **cuando** falta `bankAccountId` o `reference`,
  **entonces** el API responde `422 VALIDATION_ERROR`; **y cuando** la cuenta está inactiva o no
  existe, **entonces** responde `422 BANK_ACCOUNT_UNAVAILABLE` y no se cobra nada.
- **Dado** un cobro con un renglón `OTHER`, **cuando** falta `description` o pasa de 60 caracteres,
  **entonces** el API responde `422 VALIDATION_ERROR`.
- **Dado** un renglón `CASH` o `CARD`, **cuando** trae `bankAccountId`, `reference` o `description`,
  **entonces** el API responde `422 VALIDATION_ERROR`.
- **Dado** que no hay ninguna cuenta activa, **cuando** el cajero abre el cobro, **entonces**
  «Transferencia» sale deshabilitada con «No hay cuentas registradas».
- **Dado** un turno con transferencias de $20.00 a Agrícola, $15.00 a BAC y $5.00 por «Otro:
  cheque», **cuando** se ve o se cierra, **entonces** muestra transferencias $35.00 desglosadas por
  cuenta, «Otro» $5.00 con su lista, y el efectivo esperado no cambia.
- **Dado** un pago `TRANSFER` anterior a esta spec, **cuando** se muestra, **entonces** sale como
  transferencia «Sin cuenta» y entra al total de transferencias igual que hoy.

## Reglas de negocio

- **RN-1: lista fija de bancos.** Los bancos viven como constante en `@elite/shared` (código + nombre
  visible). Agregar uno es cambiar la constante, no la base. Lista inicial: Banco Agrícola, Banco
  Cuscatlán, Banco Davivienda, BAC Credomatic, Banco Promerica, Banco Hipotecario, Banco Azul, Banco
  Atlántida, Banco Industrial, Abank, Banco de Fomento Agropecuario, Fedecrédito, Mi Banco, Bancovi.
- **RN-2: la cuenta.** Banco (de RN-1), tipo `SAVINGS | CHECKING`, número (solo dígitos y guiones,
  6 a 24 caracteres; se guarda sin guiones), titular (2 a 80). `(bank, number)` es único.
- **RN-3: desactivar, nunca borrar.** Una cuenta inactiva no se elige en cobros nuevos, pero los
  pagos que ya la usan la conservan. Se puede reactivar.
- **RN-4: transferencia = cuenta + referencia.** Cada renglón `TRANSFER` lleva una cuenta activa y
  una referencia de 1 a 40 caracteres. En pago partido (059) cada renglón lleva la suya.
- **RN-5: «Otro» = texto libre.** Cada renglón `OTHER` lleva una descripción de 1 a 60 caracteres.
  No entra al efectivo esperado, igual que tarjeta y transferencia.
- **RN-6: los demás métodos no llevan esos campos.** `CASH` y `CARD` no aceptan cuenta, referencia ni
  descripción.
- **RN-7: el turno desglosa.** El turno suma transferencias por cuenta y «Otro» como total propio
  (`otherTotal`). Las transferencias sin cuenta (anteriores) van en su propia fila «Sin cuenta».
- **RN-8: todo cobro, el mismo camino.** Lavados, ventas sueltas y cuentas mixtas (066) pasan por la
  misma validación: no hay un cobro que escriba una transferencia sin cuenta.

## Permisos

| Clave            | Descripción                                               |
| ---------------- | --------------------------------------------------------- |
| `banking.manage` | Registrar, editar, desactivar y reactivar cuentas del negocio |

La lista de cuentas activas para cobrar se lee con `carwash.charge`.

## Datos

```prisma
enum PaymentMethod { CASH CARD TRANSFER OTHER }

enum BankAccountType { SAVINGS CHECKING }

model BankAccount {
  id         String          @id @default(uuid()) @db.Uuid
  bank       String          // código de RN-1, validado en shared
  type       BankAccountType
  number     String
  holderName String
  active     Boolean         @default(true)
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  payments   Payment[]
  @@unique([bank, number])
}

model Payment {
  // nuevos, null salvo en TRANSFER (los dos primeros) u OTHER (el tercero)
  bankAccountId String?  @db.Uuid
  reference     String?
  description   String?
  bankAccount   BankAccount? @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)
}

model CashSession {
  otherTotal Decimal? @db.Decimal(12, 2)
}
```

Migración aditiva: nada existente se rellena.

## API

| Método | Ruta                                   | Request                                       | Response          | Errores                                           |
| ------ | -------------------------------------- | --------------------------------------------- | ----------------- | ------------------------------------------------- |
| GET    | `/api/banking/accounts`                | `?active=true` opcional                        | `BankAccount[]`   | `403`                                             |
| POST   | `/api/banking/accounts`                | `{ bank, type, number, holderName }`          | `201` BankAccount | `422 VALIDATION_ERROR`, `409 BANK_ACCOUNT_DUPLICATE`, `403` |
| PATCH  | `/api/banking/accounts/:id`            | `{ bank?, type?, number?, holderName?, active? }` | `200` BankAccount | `404`, `422`, `409 BANK_ACCOUNT_DUPLICATE`, `403` |

`GET` con `active=true` acepta `carwash.charge` o `banking.manage`; sin filtro, solo `banking.manage`.

Los cobros existentes (`POST /api/carwash/charges`, el endpoint viejo de ticket y el de venta suelta)
aceptan en cada renglón `bankAccountId?`, `reference?`, `description?` según RN-4/5/6, con
`422 BANK_ACCOUNT_UNAVAILABLE`. El turno (`CashSession`) agrega `otherTotal` y
`transferByAccount: { bankAccountId | null, label, total }[]`; `CashSessionPayment` agrega
`bankAccount`, `reference` y `description`.

## UI

- **Ajustes → Cuentas bancarias** (`/settings/bank-accounts`), visible con `banking.manage`: lista con
  banco, tipo, número, titular y estado; diálogo para crear/editar; activar/desactivar. Sigue el
  patrón de `settings/employees`.
- **Cobro:** cuatro métodos (Efectivo, Tarjeta, Transferencia, Otro). Transferencia pide un selector
  de cuenta («Agrícola · Corriente · 0012345678») y el campo «Referencia». Otro pide «¿Qué fue?».
  Con una sola cuenta activa, queda elegida sola. Vale igual en pago partido, por renglón.
- **Estampa del pago y detalle del lavado/venta:** «Transferencia · Agrícola ···5678 · Ref 998877»,
  «Otro · cheque».
- **Turno de caja:** transferencias con desglose por cuenta; fila nueva «Otro» con su lista.
- **Densidades:** en `bahia` los cuatro métodos pasan a 2×2 con objetivo táctil y los campos nuevos
  a altura táctil; en `mostrador` los métodos van en una fila.

## Fuera de alcance

- Conciliación automática con el banco o importar estados de cuenta.
- Cuentas del cliente, cuentas por cobrar, cheques con fecha diferida.
- Mostrar el número de cuenta en un recibo impreso.

## Verificación

[`scripts/verify-069.sh`](../scripts/verify-069.sh) contra el stack levantado: crea una cuenta, rechaza el duplicado (`409`) y
el crear sin permiso (`403`); cobra un lavado con transferencia sin referencia (`422`), con cuenta
inactiva (`422 BANK_ACCOUNT_UNAVAILABLE`) y bien; cobra otro con «Otro» sin descripción (`422`) y
bien; y verifica en el turno el desglose por cuenta y `otherTotal`.

## Tareas

- [x] `packages/shared`: lista de bancos, `PaymentMethod` con `OTHER`, schemas de cuenta y de renglón
      con RN-4/5/6, tipos de turno ampliados, permiso `banking.manage`, códigos de error.
- [x] `apps/api`: migración (enum, `bank_accounts`, columnas de `payments` y `cash_sessions`).
- [x] `apps/api`: módulo `banking` (domain → application → infrastructure → presentation) con tests.
- [x] `apps/api`: validación de cuenta activa en el cobro compartido (RN-8) y desglose del turno
      (RN-7), con tests.
- [x] `apps/web`: pantalla `/settings/bank-accounts` y entrada en el menú de ajustes.
- [x] `apps/web`: cuarto método, selector de cuenta, referencia y descripción en el cobro (simple y
      partido), con test.
- [x] `apps/web`: estampa, detalle y turno de caja con los datos nuevos.
- [x] `scripts/verify-069.sh` y `pnpm build`, `pnpm lint`, `pnpm test`.

> 2026-09-26: `pnpm build`, `pnpm lint` y `pnpm test` (666 api + 397 web) en verde. Falta aplicar la
> migración y correr `scripts/verify-069.sh`: piden el stack levantado.
