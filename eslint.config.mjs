// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.next-dev/**',
      '**/dist/**',
      '**/dist-dev/**',
      '**/coverage/**',
      '**/build/**',
      '**/*.tsbuildinfo',
      // Autogenerado por Next.js en cada dev/build; no se lintea
      '**/next-env.d.ts',
      // Worktrees de agentes dentro del repo: cada uno se lintea solo
      '.claude/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Hooks de React en la web (spec 077). Solo estas dos reglas: el preset v7 suma las del
  // React Compiler, que no usamos.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Los scripts de arranque de las apps (`apps/web/scripts/run-next.mjs`) corren en Node.
  {
    files: ['apps/*/scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  // Las apps no escriben a la consola: el API usa el Logger de Nest (spec 077).
  {
    files: ['apps/**/src/**/*.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
  {
    files: ['apps/api/src/main.ts'],
    rules: { 'no-console': 'off' },
  },
  // Capas (ADR-002): Prisma solo en infraestructura, en common/prisma y en el seed.
  {
    files: ['apps/api/**/*.ts'],
    ignores: ['**/infrastructure/**', '**/common/prisma/**', 'apps/api/prisma/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message: 'Prisma solo se importa en infrastructure/ o common/prisma/ (ADR-002).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
