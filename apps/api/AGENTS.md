# @elite/api — Backend (NestJS)

## Qué es esto

API REST del taller, en NestJS 11 con clean architecture por módulo. Fase 0: sólo el
esqueleto y el módulo `health`. Sin Prisma, sin base de datos, sin auth, sin negocio.

## Comandos

```bash
pnpm --filter @elite/api dev        # nest start --watch (http://localhost:3001/api)
pnpm --filter @elite/api build      # nest build -> dist/
pnpm --filter @elite/api start      # node dist/main
pnpm --filter @elite/api test       # jest (unitarios)
pnpm --filter @elite/api typecheck  # tsc --noEmit
pnpm lint                           # eslint (config única en la raíz)
```

Verificación rápida: `curl http://localhost:3001/api/health`

## Estructura

```
apps/api/
├── src/
│   ├── main.ts                     # bootstrap: prefijo `api`, CORS, API_PORT
│   ├── app.module.ts               # ConfigModule global + módulos + filtro global
│   ├── common/
│   │   ├── errors/api-error.ts     # contrato { code, message, details? }
│   │   └── filters/                # filtro global de excepciones
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

`health` es el ejemplo canónico: sólo usa `application/` y `presentation/` porque no
tiene entidades ni persistencia. Crea `domain/`, `application/ports/` e
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
7. Valida los DTOs con los schemas Zod de `@elite/shared` en cuanto existan; no
   dupliques la validación que ya vive en el paquete compartido.
8. Lanza `HttpException` (o subclases) con payload `{ code, message, details? }`; el
   formato de respuesta lo produce siempre `AllExceptionsFilter`, nunca el controller.
9. Autoriza por permiso `module.action` (`users.read`, `roles.manage`). Jamás por
   nombre de rol: los roles son dinámicos.
10. Lee la configuración con `ConfigService`, nunca con `process.env` directo. Las
    variables viven en el `.env` de la raíz del monorepo.
11. Nombra los archivos en kebab-case con sufijo de rol: `*.usecase.ts`,
    `*.controller.ts`, `*.repository.ts`, `*.module.ts`, `*.spec.ts`.

## Paso a paso: crear un módulo nuevo

1. Confirma que existe una spec aprobada en `specs/` para ese módulo.
2. Crea `src/modules/<name>/` con las capas que la spec realmente requiera.
3. Modela en `domain/` las entidades y reglas de negocio puras.
4. Declara los puertos en `application/ports/` (ej. `<name>.repository.ts`).
5. Escribe el caso de uso en `application/<action>-<name>.usecase.ts`, recibiendo los
   puertos por constructor.
6. Escribe el `.spec.ts` del caso de uso con una implementación en memoria del puerto.
7. Implementa el puerto en `infrastructure/` y expón el endpoint en `presentation/`.
8. Cablea todo en `<name>.module.ts` e impórtalo en `app.module.ts`.
9. Marca las tareas de la spec y actualiza este AGENTS.md si cambió alguna convención.

## Flujo de trabajo

SDD: spec aprobada primero, luego implementación. Terminado = compila + `pnpm lint`
limpio + `pnpm --filter @elite/api test` en verde + criterios de aceptación de la spec
cumplidos + spec y AGENTS.md actualizados en el mismo commit.

## No hacer

- No importes el ORM (Prisma) fuera de `infrastructure/`.
- No pongas lógica de negocio en controllers, guards ni módulos.
- No crees módulos, entidades ni endpoints sin spec aprobada.
- No agregues Prisma, base de datos ni auth mientras la Fase 0 siga vigente.
- No crees aquí configuración de ESLint, Prettier ni .gitignore: viven en la raíz.
- No construyas respuestas de error a mano fuera del filtro común.
