# 077 — CI y lint de hooks

**Estado:** Borrador
**Módulo:** raíz | **Depende de:** —

## Task

Nada corre `pnpm lint`, `pnpm build` ni `pnpm test` si alguien no se acuerda: no hay CI ni hooks.
ESLint es solo `recommended`: 143 archivos `'use client'` sin `rules-of-hooks` ni `exhaustive-deps`.
Se agrega un workflow y las reglas que faltan, sin cambiar de stack.

## Done

- [ ] `.github/workflows/ci.yml`: en `push` a `main` y en `pull_request`, Node 22 + pnpm 11 con
      cache, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `pnpm test`,
      `pnpm -r typecheck`. Un solo job. Sin base de datos: los verify-NNN no corren acá.
- [ ] `eslint-plugin-react-hooks` en la config raíz, aplicado a `apps/web/**/*.tsx` y `*.ts`:
      `rules-of-hooks: error`, `exhaustive-deps: warn`.
- [ ] `no-console: error` en `apps/**/src` con excepción de `prisma/seed.ts` y `main.ts`.
- [ ] `@typescript-eslint/consistent-type-imports` y `no-restricted-imports` que prohíbe
      `@prisma/client` fuera de `**/infrastructure/**` y `**/common/prisma/**` (la regla de capas
      que el ADR-002 dice que «se verifica en revisión»).
- [ ] `typecheck` en `packages/shared/package.json` y `pnpm -r typecheck` en la raíz.
- [ ] `pnpm lint` pasa. Los warnings de `exhaustive-deps` que aparezcan se listan en la spec al
      terminar, no se arreglan acá (van a la 082/083 si son del núcleo de carwash).
- [ ] `orca.yaml` y el `AGENTS.md` raíz mencionan `pnpm -r typecheck` y el workflow.

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
