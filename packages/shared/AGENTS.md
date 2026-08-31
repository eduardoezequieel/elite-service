# @elite/shared

## Qué es esto

Paquete con el **contrato compartido** entre el frontend (`@elite/web`) y el backend
(`@elite/api`): schemas de validación Zod, tipos de DTOs, constantes y claves de permisos.
Se compila a `dist/` con `tsc` y se consume como dependencia de workspace
(`"@elite/shared": "workspace:*"`).

## Comandos

```bash
pnpm --filter @elite/shared build   # compila a dist/ (necesario antes de usarlo)
pnpm --filter @elite/shared dev     # tsc --watch
pnpm lint                           # ESLint desde la raíz
```

Las apps importan de `dist/`, así que **si cambiás algo aquí hay que recompilar**
(`pnpm build` en la raíz o dejar corriendo `pnpm dev`, que incluye el watch).

## Estructura

```
packages/shared/
├── src/
│   └── index.ts     # único punto de entrada público (todo se re-exporta aquí)
└── dist/            # generado por tsc — no se edita ni se commitea
```

## Convenciones

1. **Regla de oro:** si el front y el back necesitan lo mismo (un tipo, un schema, una
   constante, una clave de permiso), va aquí. Si lo necesita uno solo, se queda en su app.
2. **Sin dependencias de Next ni de Nest.** Nada de `next/*`, `@nestjs/*`, React, decoradores
   ni acceso a `process.env`, `window` o al DOM. Solo TypeScript, Zod y utilidades puras.
3. **Todo tipado, nada de `any`.** Usá `unknown` + validación cuando el dato venga de afuera.
4. **Zod donde aplique:** definí el schema Zod y derivá el tipo con `z.infer`, no al revés.
   La validación se escribe una sola vez y la usan el DTO del backend y el formulario del front.
5. **Todo se exporta desde `src/index.ts`.** Si agregás un archivo, re-exportalo ahí; las apps
   nunca importan rutas internas (`@elite/shared/src/...`).
6. **Código en inglés** (identificadores, claves, nombres de archivo), sin excepción.
7. **Sin lógica de negocio ni efectos secundarios.** Nada de llamadas HTTP, acceso a base de
   datos ni estado global: este paquete es solo contrato.
8. Las constantes se declaran con `as const` y su tipo se deriva del objeto
   (ver `API_ERROR_CODES` / `ApiErrorCode`).

## Flujo de trabajo

Aplica el SDD del `AGENTS.md` raíz: no se agrega un schema o tipo aquí sin una spec aprobada
en `specs/` que lo justifique. Un cambio aquí es un cambio de contrato: si rompe una app, se
arregla en el mismo commit.

## No hacer

- No agregues dependencias de runtime aparte de `zod` sin acordarlo en una spec.
- No pongas aquí tipos que solo usa una app (props de componentes, entidades de dominio del
  backend, tipos de infraestructura).
- No edites `dist/` a mano.
- No modeles entidades de negocio en Fase 0: sin spec aprobada, este paquete no crece.
