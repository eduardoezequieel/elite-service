# @elite/api — Backend (NestJS)

## Qué es esto

API REST del taller, en NestJS 11 con clean architecture por módulo. Sobre el esqueleto y
el módulo `health` de la Fase 0 ya viven la persistencia (Prisma 7 + PostgreSQL) y los
módulos de la spec 001: `auth` (login/logout/me, JWT en cookie httpOnly), `users` y
`roles` (RBAC dinámico por permisos). El resto del negocio todavía no existe.

## Comandos

```bash
pnpm --filter @elite/api dev        # nest start --watch (http://localhost:3001/api)
pnpm --filter @elite/api build      # nest build -> dist/
pnpm --filter @elite/api start      # node dist/main
pnpm --filter @elite/api test       # jest (unitarios)
pnpm --filter @elite/api typecheck  # tsc --noEmit
pnpm lint                           # eslint (config única en la raíz)
```

Base de datos. Todos necesitan el contenedor de Postgres arriba: `docker compose up -d`
desde la raíz del monorepo.

```bash
pnpm --filter @elite/api db:generate  # prisma generate (cliente tipado)
pnpm --filter @elite/api db:migrate   # prisma migrate dev (crea y aplica migración)
pnpm --filter @elite/api db:deploy    # prisma migrate deploy (aplica las ya creadas)
pnpm --filter @elite/api db:seed      # prisma db seed (catálogo + rol + admin; idempotente)
pnpm --filter @elite/api db:studio    # prisma studio (inspección de datos)
```

Verificación rápida: `curl http://localhost:3001/api/health`

## Estructura

```
apps/api/
├── prisma/
│   ├── schema.prisma               # User, Role, Permission, UserRole, RolePermission
│   ├── migrations/                 # migraciones versionadas (SQL)
│   └── seed.ts                     # catálogo de permisos + rol Administrator + admin del .env
├── prisma.config.ts                # config del CLI de Prisma 7 (URL de la base, seed)
├── src/
│   ├── main.ts                     # bootstrap: prefijo `api`, CORS, cookie-parser, API_PORT
│   ├── app.module.ts               # ConfigModule global + módulos + filtro y guards globales
│   ├── common/
│   │   ├── errors/api-error.ts     # contrato { code, message, details? }
│   │   ├── filters/                # filtro global de excepciones
│   │   ├── prisma/                 # PrismaService + PrismaModule (@Global)
│   │   ├── auth/                   # @Public, @RequirePermissions, @CurrentUser, AuthenticatedUser
│   │   └── validation/             # ZodValidationPipe
│   └── modules/<module-name>/      # un módulo por dominio
│       ├── domain/                 # entidades y reglas puras (sin Nest, sin ORM)
│       ├── application/            # casos de uso
│       │   └── ports/              # interfaces de repositorios/servicios
│       ├── infrastructure/         # implementaciones de los puertos (ORM, HTTP)
│       ├── presentation/           # controllers + DTOs
│       └── <module-name>.module.ts # cableado de dependencias
├── tsconfig.json / tsconfig.build.json / nest-cli.json
└── package.json                    # deps + config de jest
```

`health` es el ejemplo canónico del módulo mínimo: sólo usa `application/` y
`presentation/` porque no tiene entidades ni persistencia. `users` es el ejemplo del
módulo completo con las cuatro capas. Crea `domain/`, `application/ports/` e
`infrastructure/` únicamente cuando el módulo las necesite; no dejes carpetas vacías.

## Convenciones

1. Escribe todo el código en inglés (identificadores, rutas, archivos). El español va
   sólo en comentarios de documentación y en este AGENTS.md.
2. Respeta la regla de capas: `presentation → application → domain`. `infrastructure`
   implementa los puertos declarados en `application/ports/`. Nunca al revés.
3. No importes NADA de NestJS ni de ningún ORM dentro de `domain/`; mantenlo TypeScript puro.
4. Declara las dependencias de un caso de uso como interfaces en `application/ports/` y
   recíbelas por constructor. En los tests inyecta implementaciones en memoria
   (`InMemoryUserRepository`), nunca base de datos ni red.
5. Cablea las implementaciones sólo en el `*.module.ts`, con providers `useClass`/
   `useFactory`. Los casos de uso no llevan decoradores de Nest.
6. Deja los controllers sin lógica: validan la entrada, llaman a un caso de uso y
   devuelven su resultado.
7. Valida la entrada con `ZodValidationPipe` (`src/common/validation/`) y los schemas Zod
   de `@elite/shared`: `@Body(new ZodValidationPipe(createUserSchema))`. No dupliques la
   validación que ya vive en el paquete compartido. Cuando falla responde **422**, no 400;
   el 400 queda para el request malformado, no para los datos malos.
8. Lanza `HttpException` (o subclases) con payload `{ code, message, details? }`; el
   formato de respuesta lo produce siempre `AllExceptionsFilter`, nunca el controller.
9. Autoriza por permiso `module.action` (`users.read`, `roles.manage`) con
   `@RequirePermissions('users.read')` de `src/common/auth/auth.decorators.ts`. Jamás por
   nombre de rol: los roles son dinámicos y su nombre es dato, no lógica.
10. Los guards son **globales** y se registran en `app.module.ts` (`JwtAuthGuard` primero,
    `PermissionsGuard` después), así que un endpoint sin decoradores **ya exige sesión**.
    Lo público se marca explícitamente con `@Public()`; sin ese decorador nada entra sin
    una cookie de sesión válida.
11. Toma el usuario del request con `@CurrentUser()`: devuelve un `AuthenticatedUser` con
    sus roles y sus permisos efectivos ya resueltos. No vuelvas a consultarlos.
12. Los permisos efectivos son la unión de los permisos de todos los roles del usuario y
    **se resuelven contra la base en cada request**: nunca salen del JWT, que sólo lleva
    `sub`, `iat` y `exp`. Un cambio de rol o de permisos aplica en el request siguiente,
    sin volver a iniciar sesión.
13. Usa Prisma **sólo** desde la capa `infrastructure/` de cada módulo, nunca desde
    `application/` ni `domain/`, que hablan con los puertos. `PrismaService` es un provider
    global (`PrismaModule` es `@Global`): se inyecta por constructor, sin importar el módulo.
14. El catálogo de permisos vive en código (`PERMISSIONS` de `@elite/shared`) y el seed lo
    sincroniza a la base. No se puede asignar una clave que no esté en el registro.
15. Lee la configuración con `ConfigService`, nunca con `process.env` directo. Las
    variables viven en el `.env` de la raíz del monorepo.
16. Nombra los archivos en kebab-case con sufijo de rol: `*.usecase.ts`,
    `*.controller.ts`, `*.repository.ts`, `*.module.ts`, `*.spec.ts`.

## Paso a paso: crear un módulo nuevo

1. Confirma que existe una spec aprobada en `specs/` para ese módulo.
2. Agrega las claves de permiso del módulo al catálogo de `@elite/shared` y corre el seed
   para sincronizarlas a la base: sin eso no pueden asignarse a ningún rol.
3. Crea `src/modules/<name>/` con las capas que la spec realmente requiera.
4. Modela en `domain/` las entidades y reglas de negocio puras.
5. Declara los puertos en `application/ports/` (ej. `<name>.repository.ts`).
6. Escribe el caso de uso en `application/<action>-<name>.usecase.ts`, recibiendo los
   puertos por constructor.
7. Escribe el `.spec.ts` del caso de uso con una implementación en memoria del puerto.
8. Implementa el puerto en `infrastructure/` (ahí, y sólo ahí, entra Prisma) y expón el
   endpoint en `presentation/`.
9. Protege cada endpoint con `@RequirePermissions('<module>.<action>')`. Si alguno debe
   responder sin sesión, márcalo con `@Public()`; si no lleva ninguno de los dos, exige
   sesión pero ningún permiso.
10. Cablea todo en `<name>.module.ts` e impórtalo en `app.module.ts`.
11. Marca las tareas de la spec y actualiza este AGENTS.md si cambió alguna convención.

## Flujo de trabajo

SDD: spec aprobada primero, luego implementación. Terminado = compila + `pnpm lint`
limpio + `pnpm --filter @elite/api test` en verde + criterios de aceptación de la spec
cumplidos + spec y AGENTS.md actualizados en el mismo commit.

## No hacer

- No importes ni consultes Prisma fuera de `infrastructure/`: ni en un caso de uso, ni en
  un controller, ni en un guard.
- No autorices por nombre de rol (`user.roles.includes('Administrator')`): es un bug, no
  un atajo. Siempre por clave `module.action`.
- No confíes en permisos que vengan del JWT: no viajan firmados, a propósito. Usa los de
  `@CurrentUser()`, que el guard resolvió contra la base en este mismo request.
- No pongas lógica de negocio en controllers, guards ni módulos.
- No crees módulos, entidades ni endpoints sin spec aprobada.
- No crees aquí configuración de ESLint, Prettier ni .gitignore: viven en la raíz.
- No construyas respuestas de error a mano fuera del filtro común.
