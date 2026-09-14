# @elite/api

API REST del taller en NestJS 11, con clean architecture por módulo y Prisma 7 sobre PostgreSQL.
Módulos vivos: `health`, `auth` (login/logout/me/password, JWT en cookie httpOnly), `users` y
`roles` (RBAC dinámico) de las spec 001 y 006, y `carwash`, `customers`, `employees`, `services` y
`vehicles` de la spec 003.

## Comandos

```bash
pnpm --filter @elite/api dev        # nest start --watch (http://localhost:3200/api)
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
pnpm --filter @elite/api db:seed      # catálogo de permisos + rol Administrator + admin (idempotente)
pnpm --filter @elite/api db:studio    # prisma studio
```

Verificación rápida: `curl http://localhost:3200/api/health`

Tiempo real (spec 042): `GET /api/carwash/stream` y `GET /api/floor/stream` son **SSE**, no
WebSocket — el porqué está en el ADR-012. Para mirar uno a mano:
`curl -N -b cookie.jar http://localhost:3200/api/carwash/stream`.

En Render (spec 011, plan free): Nest escucha `PORT` (lo inyecta la plataforma); en local sigue
`API_PORT`. El start corre `db:deploy` + `db:seed` y después `start`. El seed en remoto es
`dist/prisma/seed.js` (ts-node se come los 512 MiB del plan free). Nunca `db:migrate` remoto.
`DATABASE_URL` es la URL **directa** de Neon (`sslmode=require`, sin `-pooler`). `WEB_ORIGIN` es la
URL de Vercel. Cookie igual que en local (`httpOnly` + `SameSite=Lax` + `secure` si
`NODE_ENV=production`). Secretos solo en el dashboard. Detalle en el `AGENTS.md` de la raíz.

## Estructura

```
apps/api/
├── prisma/schema.prisma            # User, Role, Permission, Employee, Customer, Vehicle,
│                                   # Service, WorkOrder, Payment y sus relaciones
├── prisma/migrations/              # migraciones versionadas (SQL)
├── prisma/seed.ts                  # sincroniza PERMISSIONS + rol Administrator + admin del .env
├── prisma.config.ts                # config del CLI de Prisma 7
└── src/
    ├── main.ts                     # bootstrap: prefijo `api`, CORS, cookie-parser, PORT / API_PORT
    ├── app.module.ts               # ConfigModule global + módulos + filtro y guards globales
    ├── common/
    │   ├── errors/ · filters/      # contrato { code, message, details? } + filtro global
    │   ├── prisma/                 # PrismaService + PrismaModule (@Global)
    │   ├── auth/                   # @Public, @RequirePermissions, @CurrentUser
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
   (`InMemoryUserRepository`), nunca base de datos ni red.
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
6. Lanzá `HttpException` con payload `{ code, message, details? }`. La respuesta la arma siempre
   `AllExceptionsFilter`, nunca el controller.
7. Autorizá con `@RequirePermissions('users.read')` de `src/common/auth/auth.decorators.ts`
   (regla global 3). Los guards son **globales** y se registran en `app.module.ts` (`JwtAuthGuard`
   primero, `PermissionsGuard` después): un endpoint sin decoradores **ya exige sesión**. Lo
   público se marca con `@Public()`.
8. Tomá el usuario con `@CurrentUser()`: devuelve un `AuthenticatedUser` con roles y permisos
   efectivos ya resueltos. No los vuelvas a consultar.
9. Los permisos efectivos son la unión de los de todos los roles del usuario y **se resuelven
   contra la base en cada request**: nunca salen del JWT, que solo lleva `sub`, `iat` y `exp`. Un
   cambio de rol aplica en el request siguiente, sin volver a iniciar sesión.
10. Usá Prisma **solo** desde `infrastructure/`. `PrismaService` es provider global
    (`PrismaModule` es `@Global`): se inyecta por constructor, sin importar el módulo.
11. El catálogo de permisos vive en código (`PERMISSIONS` de `@elite/shared`) y el seed lo
    sincroniza a la base. No se puede asignar una clave que no esté en el registro.
12. Leé la configuración con `ConfigService`, nunca con `process.env` directo. Las variables viven
    en el `.env` de la raíz.
13. Archivos en kebab-case con sufijo de rol: `*.usecase.ts`, `*.controller.ts`, `*.repository.ts`,
    `*.module.ts`, `*.spec.ts`.
14. **Los efectos de segundo orden se declaran como puerto, igual que un repositorio.** Un caso de
    uso que además de mutar tiene que contarlo —hoy solo el lavado, por la spec 042— recibe un
    `TicketEventsPublisher` (`carwash/application/ports/ticket-events.ts`) por constructor y lo
    llama después de que la escritura salió bien. Quién lo hizo (`CarwashEventActor`) sale de la
    sesión que resolvió el guard, en `presentation/carwash-actor.ts`, **nunca del cuerpo del
    request**. Publicar va en `try/catch`: un oyente roto no puede tumbar un cobro ya escrito.
15. **Un endpoint de stream se llama `*-stream.controller.ts`.** El test estructural
    `common/auth/floor-routes.spec.ts` recorre los `*.controller.ts` por reflexión y exige
    `@FloorSession()` en todo lo que cuelgue de `/floor`; un gateway con otro nombre se queda fuera
    de esa red. El recorte de lo que cada quien puede ver se decide en `domain/`
    (`isVisibleToEmployee`), no en el controller: la lista y el stream tienen que filtrar igual o el
    empuje delataría lo que la lista esconde.

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
