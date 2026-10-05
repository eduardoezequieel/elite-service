# @elite/api

API REST del taller en NestJS 11, con clean architecture por módulo y Prisma 7 sobre PostgreSQL.
Módulos vivos: `health`, `auth` (login/logout/me/password, JWT en cookie httpOnly), `users` y
`roles` (RBAC dinámico) de las spec 001 y 006, `carwash`, `customers`, `employees`, `services` y
`vehicles` de la spec 003, `inventory` y `sales` de la spec 065, `banking` de la spec 069 y `tabs`
(cuentas abiertas, spec 106, que reemplazó el consumo de empleados de la 070).
`tabs` (106): cuentas abiertas `/tabs`; las cifras (`total`, `paid`, `balance`) son columnas que solo
escribe su repositorio con la fila bloqueada y las reglas puras de `domain/tab.ts`, y exporta
`TAB_PAYMENTS_READER`, que la venta suelta usa para «Ventas del día» (`GET /sales/feed`).
`combos` (104): catálogo `/combos`; el estado, el precio y el prorrateo son puros en su `domain/`, y exporta `ComboUseCases`, que carwash adapta a su puerto `ComboCatalog` para `/carwash/combos`, `/floor/combos` y la expansión en líneas.

Renta de carros (spec 095, otro negocio: ninguna tabla cruza con el lavado salvo la placa como texto):

- `fleet` — la flota (`/fleet/vehicles`); `infrastructure/fleet-vehicle-row.ts` es EL mapeo de un carro. Los costos (103) los enmascara `presentation/fleet-costs.interceptor.ts` en toda respuesta del controlador (carro, lista o página) y el 403 de escribirlos sale de `application/fleet-costs.ts`; ningún endpoint lo repite.
- `renters` — clientes de renta (`/renters`, importación CSV ya parseada); `renter-row.ts` es su mapeo.
- `rental-settings` — la fila única de ajustes (`/rental-settings`); `current()` para otro caso de uso.
- `rental-files` — logo y fotos en disco (`FILES_DIR`, ADR-014), multer en memoria con tope de 5 MB.
- `rentals` (096), `rental-billing` (098), `fleet-maintenance` (099), `rental-reports` (100) — cascarones `@Module({})` ya registrados en `app.module.ts`.
- `rental-billing` (098) — pagos, depósito, multas y caja del día (`/rentals/...`); lee `rental_agreements` directo, revalida saldo y depósito con la fila bloqueada (`FOR UPDATE`) y `infrastructure/billing-rows.ts` es EL mapeo de pago y multa.
- `fleet-maintenance` (099) — plan, servicios, estado y gastos (`/fleet/maintenance`, `/fleet/expenses`); exporta `FLEET_EXPENSES_READER` (puerto `FleetExpensesReader`, los tres orígenes) y lee lavados por placa con SQL crudo en su `infrastructure/`.
- `rental-reports` (100) — inicio (`/rentals/reports/dashboard`, `rentals.read`), rentabilidad y `/fleet/vehicles/:id/months` (`rentals.reports`): lee flota, rentas, pagos, multas y plan directo, los gastos por `FLEET_EXPENSES_READER` y toda cuenta es pura en `rentals/reports.ts` de shared.
- `rentals` (096) — rentas, `/rentals/availability` y `/rentals/calendar`: el choque de fechas (RN-2) corre adentro de la transacción con el carro bloqueado (`OccupancyCheck`), el número de contrato sale de `ContractNumberSequence` y flota, clientes y ajustes se leen con lectores Prisma propios.

## Comandos

```bash
pnpm --filter @elite/api dev        # nest start --watch -> dist-dev/ (http://localhost:3200/api)
pnpm --filter @elite/api build      # nest build -> dist/
pnpm --filter @elite/api start      # node dist/main
pnpm --filter @elite/api test       # jest (unitarios)
pnpm --filter @elite/api typecheck  # tsc --noEmit
```

Base de datos: todos estos necesitan `docker compose up -d` desde la raíz.

```bash
pnpm --filter @elite/api db:generate  # prisma generate (cliente tipado)
pnpm --filter @elite/api db:migrate   # prisma migrate dev (crea y aplica migración)
pnpm --filter @elite/api db:deploy    # prisma migrate deploy (aplica las ya creadas)
pnpm --filter @elite/api db:seed      # catálogo de permisos + rol del sistema + admin (idempotente)
pnpm --filter @elite/api db:studio    # prisma studio
```

Verificación rápida: `curl http://localhost:3200/api/health`

Tiempo real (spec 042): `GET /api/carwash/stream` y `GET /api/floor/stream` son **SSE**, no
WebSocket — el porqué está en el ADR-012. Para mirar uno a mano:
`curl -N -b cookie.jar http://localhost:3200/api/carwash/stream`.

En Render (spec 011, plan free): Nest escucha `PORT` (lo inyecta la plataforma); en local sigue
`API_PORT`. El start corre `db:deploy` + `db:seed` y después `start`. El seed en remoto es
`dist/prisma/seed.js` (ts-node se come los 512 MiB del plan free). Nunca `db:migrate` remoto.
`DATABASE_URL` es la URL **directa** de Neon (`sslmode=require`, sin `-pooler`). `PIN_PEPPER`
(spec 044) es obligatoria en los dos entornos: sin ella el módulo de empleados no arranca, y
cambiarla invalida todos los PINs de pista a la vez. `WEB_ORIGIN` es la
URL de Vercel y, con `NODE_ENV=production`, el único origen que acepta CORS (`localhost` solo fuera
de producción). Cookie igual que en local (`httpOnly` + `SameSite=Lax` + `secure` si
`NODE_ENV=production`). Secretos solo en el dashboard. Detalle en el `AGENTS.md` de la raíz.

## Estructura

```
apps/api/
├── prisma/schema.prisma            # User, Role, Permission, Employee, Customer, Vehicle,
│                                   # Service, WorkOrder, Charge, Payment y sus relaciones
├── prisma/migrations/              # migraciones versionadas (SQL)
├── prisma/seed.ts                  # sincroniza PERMISSIONS + rol del sistema (isSystem) + admin del .env
├── prisma.config.ts                # config del CLI de Prisma 7
└── src/
    ├── main.ts                     # bootstrap: prefijo `api`, CORS, cookie-parser, PORT / API_PORT
    ├── app.module.ts               # ConfigModule global + módulos + filtro y guards globales
    ├── common/
    │   ├── errors/                 # ApplicationError y subclases (404/409/422/403/401/400/413/415)
    │   ├── filters/                # filtro global; códigos solo de API_ERROR_CODES de shared
    │   ├── prisma/                 # PrismaService + PrismaModule (@Global), decimal.ts,
    │   │                           # unique-violation.ts, last-sequence.ts,
    │   │                           # date-column.ts (`@db.Date` ⇄ `YYYY-MM-DD`, spec 095)
    │   ├── pagination/             # page.ts: pageSkip (skip de Prisma) y slicePage (Page<T> en memoria, 101)
    │   ├── auth/                   # @Public, @RequirePermissions, @RequireAuthorization,
    │   │                           # @CurrentUser, @Authorizer, session-cookie.ts (guards)
    │   └── validation/             # ZodValidationPipe + helpers de query
    │                               # (flagFromQuery, optionalUuidQuery)
    └── modules/<module-name>/
        ├── domain/                 # entidades y reglas puras (sin Nest, sin ORM)
        ├── application/            # casos de uso; ports/ = interfaces de repos y servicios
        ├── infrastructure/         # implementaciones de los puertos (ORM, HTTP)
        ├── presentation/           # controllers + DTOs
        └── <module-name>.module.ts # cableado de dependencias
```

`health` es el ejemplo del módulo mínimo (solo `application/` y `presentation/`); `users`, el del
módulo completo con las cuatro capas. Creá `domain/`, `application/ports/` e `infrastructure/` solo
cuando el módulo las necesite: nada de carpetas vacías.

## Convenciones

1. Respetá la regla de capas de la regla global 4. `infrastructure` implementa los puertos de
   `application/ports/`, nunca al revés, y `domain/` no importa NestJS ni ningún ORM.
2. Declará las dependencias de un caso de uso como interfaces en `application/ports/` y recibilas
   por constructor. En los tests inyectá implementaciones en memoria
   (`InMemoryUserRepository`), nunca base de datos ni red. Viven en `application/testing/` del
   módulo.
3. Cableá las implementaciones solo en el `*.module.ts`, con providers `useClass`/`useFactory`. Los
   casos de uso no llevan decoradores de Nest.
4. Los controllers no llevan lógica: validan la entrada, llaman a un caso de uso y devuelven su
   resultado.
5. Validá con `ZodValidationPipe` y los schemas de `@elite/shared`:
   `@Body(new ZodValidationPipe(createUserSchema))`. Cuando falla responde **422**, no 400; el 400
   queda para el request malformado, no para los datos malos. Sirve igual para una query entera
   (`@Query(new ZodValidationPipe(customerMatchQuerySchema))`). Los filtros sueltos van con los
   helpers de `common/validation/`: `flagFromQuery(value, true)` para una bandera —en una URL
   `'false'` es texto, y texto es verdadero— y `optionalUuidQuery('customerId')` para un id, que
   sin él llegaría hasta Prisma y volvería como 500.
6. Lanzá `ApplicationError` (`common/errors/application-error.ts`) desde `application/`;
   `HttpException` solo en `presentation/` y guards. La respuesta la arma siempre
   `AllExceptionsFilter`.
7. Autorizá con `@RequirePermissions('users.read')` de `src/common/auth/auth.decorators.ts`
   (regla global 3). Los guards son **globales** y se registran en `app.module.ts` (`JwtAuthGuard`
   primero, `PermissionsGuard` después): un endpoint sin decoradores **ya exige sesión**. Lo
   público se marca con `@Public()`. Un guard de sesión lee su cookie con `readSessionCookie`
   (`common/auth/session-cookie.ts`), nunca `request.cookies` a mano.
8. **Una acción destructiva que el de adelante no puede hacer pero alguien más sí** se marca con
   `@RequireAuthorization('carwash.void')` además del `@RequirePermissions()` mínimo para llegar
   (spec 045). El body lleva `authorization: { email, password }` y `AuthorizationGuard` —tercer
   `APP_GUARD`, después del de permisos— verifica que esa persona esté activa y tenga la clave, sin
   abrir sesión ni tocar la cookie. El handler lo recibe con `@Authorizer()` y deja el nombre
   escrito donde se pueda leer después. Falla con `403 AUTHORIZATION_FAILED`, nunca 401: un 401 el
   frontend lo lee como sesión vencida.
9. Tomá el usuario con `@CurrentUser()`: devuelve un `AuthenticatedUser` con roles y permisos
   efectivos ya resueltos. No los vuelvas a consultar.
10. Los permisos efectivos son la unión de los de todos los roles del usuario y **se resuelven
    contra la base en cada request**: nunca salen del JWT, que solo lleva `sub`, `iat` y `exp`. Un
    cambio de rol aplica en el request siguiente, sin volver a iniciar sesión.
11. Usá Prisma **solo** desde `infrastructure/`. `PrismaService` es provider global
    (`PrismaModule` es `@Global`): se inyecta por constructor, sin importar el módulo.
    Un `Decimal` pasa a entero con `decimalToCents` / `decimalToMilli` (`common/prisma/decimal.ts`)
    y un P2002 se lee con `uniqueViolationOn(error, 'columna')`, que compara columnas, no texto.
    Un caso de uso de otro módulo se importa del módulo que lo exporta (`AuthModule` →
    `AuthorizeActionUseCase`), nunca se arma a mano con su `infrastructure/`.
12. El catálogo de permisos vive en código (`PERMISSIONS` de `@elite/shared`) y el seed lo
    sincroniza a la base. No se puede asignar una clave que no esté en el registro. El seed solo
    le agrega permisos al rol marcado `isSystem` (spec 074), que el API no deja borrar ni dejar
    sin `roles.manage` (`409 SYSTEM_ROLE_PROTECTED`); ningún otro rol, ni los del admin del `.env`.
13. Leé la configuración con `ConfigService`, nunca con `process.env` directo. Las variables viven
    en el `.env` de la raíz.
14. Archivos en kebab-case con sufijo de rol: `*.usecase.ts`, `*.controller.ts`, `*.repository.ts`,
    `*.module.ts`, `*.spec.ts`.
15. **Los efectos de segundo orden se declaran como puerto, igual que un repositorio.** Un caso de
    uso que además de mutar tiene que contarlo —hoy solo el lavado, por la spec 042— recibe un
    `TicketEventsPublisher` (`carwash/application/ports/ticket-events.ts`) por constructor y lo
    llama después de que la escritura salió bien. Quién lo hizo (`CarwashEventActor`) sale de la
    sesión que resolvió el guard, en `presentation/carwash-actor.ts`, **nunca del cuerpo del
    request**. Publicar va en `try/catch`: un oyente roto no puede tumbar un cobro ya escrito.
16. **Todo cobro pasa por `ChargeUseCases`** (spec 059, 066). Un cobro es una `Charge` que junta
    0..N lavados y 0..1 venta suelta —al menos uno— y 1..N pagos, y `payments` tiene una fila por
    metodo **y por parte** (cada lavado y la venta, con `counterSaleId`): el reparto lo calcula
    `domain/charge.ts` por resto mayor y la suma de las partes es siempre exactamente el renglon.
    `POST /carwash/tickets/:id/charge` y `POST /sales` siguen existiendo y delegan en el mismo caso
    de uso (una cuenta de un lavado, una sin lavados); no hay un segundo camino que escriba pagos.
    Lo que solo sabe la venta dentro de esa transaccion (correlativo, lineas, kardex, anulacion)
    vive en `sales/infrastructure/counter-sale-ledger.ts` y lo llama el repositorio de la cuenta:
    carwash importa esos archivos sueltos, y `SalesModule` importa `CarwashModule` por
    `ChargeUseCases`, nunca al reves. Deshacer un cobro deshace la cuenta entera —lavados a `READY`,
    venta `VOID` con `SALE_RETURN`—: un lavado suelto de una cuenta con mas lavados responde
    `409 TICKET_NOT_REVERSIBLE`. Cada renglon `TRANSFER` lleva una cuenta activa del negocio
    (spec 069): `ChargeUseCases` la valida con el puerto `BankAccountDirectory` y el repositorio
    la vuelve a mirar dentro de la transaccion (`422 BANK_ACCOUNT_UNAVAILABLE`); cuenta,
    referencia y descripcion viajan en `ChargeLine.details` y se copian a cada fila del reparto.
    Quien lee pagos arma `bankAccount` con `banking/infrastructure/bank-account-row.ts`.
    **La única otra fila de `payments` es el abono a una cuenta abierta** (spec 106): `tabId`, sin
    `chargeId`, en el turno abierto y con las reglas de método de la 069; lo escribe solo
    `tabs/infrastructure/prisma-tab.repository.ts`, con la fila de la cuenta bloqueada. No pasa por
    `ChargeUseCases` porque no reparte nada: el producto ya salió al anotarlo y el abono es solo
    dinero contra un saldo. `payments_one_owner` exige un dueño: lavado, venta o cuenta.
17. **Desde `READY` el precio se cierra** (spec 060). El alta y la edicion aceptan `unitPrice`
    mientras el lavado esta `OPEN` o `WASHING`; despues responden `422 PRICE_CHANGE_NOT_AUTHORIZED`
    y el unico camino es `PATCH /carwash/tickets/:id/items/:itemId/price`, que pide
    `carwash.charge` para llegar y `@RequireAuthorization('carwash.discount')` para aplicar. El
    cambio deja la firma en la linea y una fila `PRICE_CHANGED` en el historial de la 046, que la
    linea de tiempo devuelve en `priceChanges`.
18. **Un endpoint de stream se llama `*-stream.controller.ts`.** El test estructural
    `common/auth/floor-routes.spec.ts` recorre los `*.controller.ts` por reflexión y exige
    `@FloorSession()` en todo lo que cuelgue de `/floor`; un gateway con otro nombre se queda fuera
    de esa red. El recorte de lo que cada quien puede ver se decide en `domain/`
    (`isVisibleToEmployee`), no en el controller: la lista y el stream tienen que filtrar igual o el
    empuje delataría lo que la lista esconde.
19. **La existencia se escribe solo por `recordStockMovement`** (`inventory/infrastructure/stock-ledger.ts`,
    spec 065), dentro de la transacción de quien la llama (lavado, venta suelta, inventario): bloquea
    la fila, deja el movimiento en el kardex y devuelve el aviso de mínimo para publicar tras el commit.
    La cuenta abierta (spec 106) va por el mismo camino: un `SALE` con `tabLineId` y
    `freezeItemPrice` (copia a `unitPrice` el precio de la fila ya bloqueada), y al quitar la línea un
    `SALE_RETURN` cuyo `reversesMovementId` —único en la base— apunta a ese `SALE`. Los
    `CONSUMPTION`/`CONSUMPTION_RETURN` de la 070 ya no se crean: quedan en el kardex como historia.
    Todo lo que arma un `InventoryMovement` llena `unitPrice`, `reversesMovementId` y los `tab*`.
20. **Un correlativo `PREFIJO-NNNN` se saca con `lastSequence(tx, tabla, prefijo)`** y el alta va
    envuelta en `retryOnSequenceClash(tabla, ...)` (`common/prisma/last-sequence.ts`, spec 073):
    ordena por largo y después por texto, así que `CW-10000` sigue a `CW-9999`. Nunca
    `orderBy: { number: 'desc' }`, que ordena texto. Una tabla nueva con correlativo se agrega a la
    lista cerrada del helper.
21. **Un alta que crea filas de otro módulo las escribe en su propia transacción** (spec 079): el
    lavado recibe cliente y vehículo nuevos en `NewTicketData` y los inserta con
    `vehicles/infrastructure/vehicle-writes.ts`; nunca se crean antes y se compensan después.
22. **Lo que depende del estado de un lavado se revisa con la fila bloqueada** (spec 090). El caso
    de uso valida con lo que leyó; el repositorio lo vuelve a mirar dentro de la transacción
    (`lockWorkOrder` / `lockWorkOrders`, este último en orden de id) y, si cambió, lanza
    `TicketStatusChangedError`, que el caso de uso traduce al mismo 409 de la regla. `setStatus`
    recibe `{ from, to }`, no solo el destino. Un carro tiene un solo lavado sin cobrar: lo garantiza
    el único parcial `work_orders_one_active_per_vehicle`, que se reconoce con
    `uniqueViolationOnIndex` y sale como `VehicleBusyError` → `409 VEHICLE_HAS_ACTIVE_TICKET`.
23. **Toda lista es `Page<T>`** (spec 102): `?page&pageSize` con `pageQueryShape` de shared, repo con
    `skipTake` + `count` en una `$transaction` y `pageOf`/`slicePage` de `common/pagination/page.ts`;
    orden estable (campo + `id`) y los totales de un resumen, siempre sobre todas las filas.

## Módulo nuevo, paso a paso

1. Confirmá que hay spec aprobada.
2. Agregá las claves de permiso del módulo a `PERMISSIONS` de `@elite/shared` y corré el seed: sin
   eso no pueden asignarse a ningún rol.
3. Creá `src/modules/<name>/` con las capas que la spec pida: `domain/` (entidades y reglas puras),
   `application/ports/` (ej. `<name>.repository.ts`), `application/<action>-<name>.usecase.ts`.
4. Escribí el `.spec.ts` del caso de uso con una implementación en memoria del puerto.
5. Implementá el puerto en `infrastructure/` (ahí, y solo ahí, entra Prisma) y expone el endpoint
   en `presentation/`, protegido con `@RequirePermissions('<module>.<action>')` o `@Public()`.
6. Cableá todo en `<name>.module.ts` e importalo en `app.module.ts`.

## No hacer

- No importes ni consultes Prisma fuera de `infrastructure/`: ni en un caso de uso, ni en un
  controller, ni en un guard.
- No confíes en permisos que vengan del JWT: no viajan firmados, a propósito. Usá los de
  `@CurrentUser()`.
- No pongas lógica de negocio en controllers, guards ni módulos.
- No construyas respuestas de error a mano fuera del filtro común.
