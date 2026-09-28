# 077 — CI y lint de hooks

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «como veas que no se pateen todas, adelante»)
**Módulo:** raíz | **Depende de:** —

## Task

Nada corre `pnpm lint`, `pnpm build` ni `pnpm test` si alguien no se acuerda: no hay CI ni hooks.
ESLint es solo `recommended`: 143 archivos `'use client'` sin `rules-of-hooks` ni `exhaustive-deps`.
Se agrega un workflow y las reglas que faltan, sin cambiar de stack.

## Done

- [x] `.github/workflows/ci.yml`: en `push` a `main` y en `pull_request`, Node 22 + pnpm 11 con
      cache, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `pnpm test`,
      `pnpm -r typecheck`. Un solo job. Sin base de datos: los verify-NNN no corren acá.
      Suma `db:generate` (como `render.yaml`) con una `DATABASE_URL` de mentira que pide `prisma.config.ts`.
- [x] `eslint-plugin-react-hooks` en la config raíz, aplicado a `apps/web/**/*.tsx` y `*.ts`:
      `rules-of-hooks: error`, `exhaustive-deps: warn`. v7.1.1, solo esas dos reglas (el preset v7
      suma las del React Compiler). `rules-of-hooks` no reporta nada.
- [x] `no-console: error` en `apps/**/src` con excepción de `prisma/seed.ts` y `main.ts`.
- [ ] `@typescript-eslint/consistent-type-imports` y `no-restricted-imports` que prohíbe
      `@prisma/client` fuera de `**/infrastructure/**` y `**/common/prisma/**` (la regla de capas
      que el ADR-002 dice que «se verifica en revisión»). `no-restricted-imports` sí, en `apps/api`
      (excepción extra: `apps/api/prisma/**`), sin violaciones. `consistent-type-imports` no: da 72
      errores en ~55 archivos que hoy editan las specs 075/076; queda para después.
- [x] `typecheck` en `packages/shared/package.json` y `pnpm -r typecheck` en la raíz.
- [x] `pnpm lint` pasa. Los warnings de `exhaustive-deps` que aparezcan se listan en la spec al
      terminar, no se arreglan acá (van a la 082/083 si son del núcleo de carwash).
- [x] `orca.yaml` y el `AGENTS.md` raíz mencionan `pnpm -r typecheck` y el workflow.

## Pendientes

- `no-console`: solo `apps/api/prisma/seed.ts` usa la consola (y queda fuera por no estar en `src`);
  `apps/api/src/main.ts` va permitido aunque hoy no la usa. Ningún otro archivo.
- `consistent-type-imports`: 72 violaciones, sin activar.
- `exhaustive-deps`: 6 warnings, todos por un `data ?? []` que cambia en cada render (082/083):
  - `apps/web/src/features/carwash/components/ticket-form.tsx:177` (`customerVehicles`, useEffect de la 239)
  - `apps/web/src/features/catalog/components/catalog-screen.tsx:162` (`allServices`, useMemo de la 173)
  - `apps/web/src/features/catalog/components/catalog-screen.tsx:162` (`allServices`, useMemo de la 190)
  - `apps/web/src/features/catalog/components/categories-screen.tsx:56` (`all`, useMemo de la 59)
  - `apps/web/src/features/employees/components/employees-screen.tsx:48` (`all`, useMemo de la 60)
  - `apps/web/src/features/roles/components/roles-screen.tsx:40` (`allRoles`, useMemo de la 45)

## Always

- Un solo `eslint.config.mjs` en la raíz (regla global 10).

## Ask first

- Husky + lint-staged. Suma fricción local; el CI ya cubre lo importante.
- Reglas type-aware (`recommended-type-checked`): duplican el tiempo de lint.

## Never

- Deshabilitar reglas con `eslint-disable` para que pase: se arregla o se anota.
- Secretos en el workflow: no los necesita.

## Verify

`pnpm build && pnpm lint && pnpm test && pnpm -r typecheck`
