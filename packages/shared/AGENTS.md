# @elite/shared

**Contrato compartido** entre `@elite/web` y `@elite/api`: schemas Zod, tipos de DTOs, constantes y
claves de permisos. Se compila a `dist/` con `tsc` y se consume como `"@elite/shared":
"workspace:*"`. Único punto de entrada público: `src/index.ts` (hoy `contracts.ts`, `errors.ts`,
`permissions.ts`, `schemas.ts`). `dist/` es generado: no se edita ni se commitea.

```bash
pnpm --filter @elite/shared build   # compila a dist/ (necesario antes de usarlo)
pnpm --filter @elite/shared dev     # tsc --watch
```

Las apps importan de `dist/`, así que **si cambiás algo acá hay que recompilar** (`pnpm build` en
la raíz, o dejar corriendo `pnpm dev`, que incluye el watch).

## Convenciones

1. **Regla de oro:** si el front y el back necesitan lo mismo —un tipo, un schema, una constante,
   una clave de permiso—, va acá. Si lo necesita uno solo, se queda en su app.
2. **Sin dependencias de Next ni de Nest.** Nada de `next/*`, `@nestjs/*`, React, decoradores ni
   acceso a `process.env`, `window` o el DOM. Solo TypeScript, Zod y utilidades puras.
3. **Todo tipado, nada de `any`.** Usá `unknown` + validación cuando el dato venga de afuera.
4. **Zod primero:** definí el schema y derivá el tipo con `z.infer`, no al revés. La validación se
   escribe una vez y la usan el DTO del backend y el formulario del front.
5. **Todo se exporta desde `src/index.ts`.** Si agregás un archivo, re-exportalo ahí; las apps
   nunca importan rutas internas.
6. **Sin lógica de negocio ni efectos secundarios:** ni HTTP, ni base, ni estado global. Esto es
   solo contrato.
7. Las constantes se declaran con `as const` y su tipo se deriva del objeto (ver `API_ERROR_CODES`
   / `ApiErrorCode`).

Un cambio acá es un cambio de contrato: si rompe una app, se arregla en el mismo commit.

## No hacer

- No agregues dependencias de runtime aparte de `zod` sin acordarlo en una spec.
- No pongas acá tipos que solo usa una app (props de componentes, entidades de dominio del backend,
  tipos de infraestructura).
