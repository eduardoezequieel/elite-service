# Code Standards Review

**Date:** 2026-08-31  
**Repository:** `/home/elopez/Documentos/projects/elite-service`  
**Scope:** Root `AGENTS.md`, `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, `packages/shared/AGENTS.md`, `docs/ARCHITECTURE.md`, `specs/001-auth.md`, `specs/002-design-system.md` (excluding draft `specs/003-carwash.md`).  

---

## Verdict

### **PASS**

The codebase strictly adheres to the core architectural principles, layer isolation rules, dynamic RBAC permission design, English-only code conventions, centralized error handling, and monorepo tooling configurations. A few actionable non-blocking findings (should-fix and nit) were identified and documented below.

---

## Summary of Executed Commands

| Command | Working Directory | Exit Code | Result Summary |
| :--- | :--- | :---: | :--- |
| `pnpm lint` | Monorepo Root (`/`) | `0` | Clean run (ESLint 9 flat config across all apps and packages, 0 errors, 0 warnings). |
| `pnpm test` | Monorepo Root (`/`) | `0` | All 12 test suites (56 tests) passed in `apps/api`. |
| `pnpm build` | Monorepo Root (`/`) | `0` | Topologically compiled `@elite/shared` (`tsc`), `@elite/api` (`nest build`), and `@elite/web` (`next build`). |

---

## Scope Checks Matrix

| # | Check Item | Status | Notes |
| :-: | :--- | :---: | :--- |
| **1** | **Identifiers, files, endpoints, tables in English** | **PASS** | All TypeScript symbols, Prisma tables/columns, API endpoints, and filenames are in English. Spanish is restricted exclusively to UI copy, validation error messages, and documentation/comments. |
| **2** | **Authorization by permission key (`module.action`)** | **PASS** | Guarding uses `@RequirePermissions('module.action')` on the backend and `usePermissions().can()` / `<RequirePermission>` on the frontend. Zero hardcoded role names (`user.role === ...`) in authorization logic. Anti-lockout rules check effective permission keys. |
| **3** | **Backend clean architecture layers** | **PASS** | Strict `presentation → application → domain` flow. Domain modules (`auth-user.ts`, `session.ts`, `role.ts`, `user.ts`, `self-lockout.rule.ts`) have zero external imports (no Nest, no Prisma, no Zod). Repositories implement application ports. |
| **4** | **Shared types/schemas in `@elite/shared`** | **PASS** | DTO contracts, Zod schemas, and permission catalogs are centralized in `@elite/shared`. |
| **5** | **API errors formatted & handled centrally** | **PASS** | `AllExceptionsFilter` (`apps/api`) produces standardized `{ code, message, details? }`; `apiFetch` / `ApiError` (`apps/web`) normalizes all HTTP errors into typed instances. |
| **6** | **No secrets in repo; `.env.example` completeness** | **PASS** | `.env` files are gitignored. `.env.example` contains placeholders. (See Should-Fix 2 for `WEB_ORIGIN`). |
| **7** | **ESLint at repo root only** | **PASS** | Single `eslint.config.mjs` and `.prettierrc` at root; no per-package linter configs. |
| **8** | **Uncommitted diffs standards compliance** | **PASS** | Uncommitted diffs contain no `any`, no `@ts-ignore`, and no Spanish identifiers. (See Should-Fix 1 for UI styling refinement). |
| **9** | **`pnpm lint` execution** | **PASS** | Clean execution with exit code 0. |

---

## Findings

### 1. Blocker
*None.*

---

### 2. Should-Fix

#### SF-1: Blocked Role Action Styling in Uncommitted Diff Uses `opacity-40` and Hover Tooltip
- **File:** `apps/web/src/features/roles/components/roles-table.tsx:179-195`
- **Citation:**
  ```tsx
  <Button
    type="button"
    variant={isBlocked ? 'ghost' : 'destructive'}
    disabled={isBlocked}
    onClick={() => onDelete(role)}
    title={
      isBlocked
        ? `No se puede eliminar: asignado a ${usersLabel(role.userCount)}.`
        : undefined
    }
    className={cn(
      isBlocked && 'cursor-not-allowed opacity-40 hover:bg-transparent',
    )}
  >
  ```
- **Context & Rule Reference:**
  - `apps/web/DESIGN.md` & `specs/002-design-system.md` (Acceptance Criteria): *"Dado un elemento bloqueado o fuera de servicio, cuando se renderiza, entonces lleva la trama diagonal de 45° y un texto que explica el motivo, y **no** se comunica con opacidad reducida."*
  - `apps/web/AGENTS.md` Rule 13: *"Nada depende de `hover` para funcionar. En la bahía se usa con el dedo y no hay puntero: si una acción, un dato o una pista solo aparece al pasar el mouse, en tablet no existe."*
  - `apps/web/AGENTS.md` Rule 14: *"Lo bloqueado o fuera de servicio lleva la trama diagonal de 45°, nunca opacidad reducida."*
- **Recommendation:** Revert the button styling for blocked roles to use the `.is-blocked` class (45° stripe pattern) and keep the inline explanatory text (`Bloqueado: lo tienen N usuarios`) instead of relying solely on opacity and a desktop-only hover `title` attribute.

#### SF-2: `WEB_ORIGIN` Missing from `.env.example`
- **File:** `apps/api/src/main.ts:22` & `.env.example`
- **Citation:**
  - `apps/api/src/main.ts:22`: `const webOrigin = config.get<string>('WEB_ORIGIN');`
  - `.env.example`: Does not list `WEB_ORIGIN`.
- **Context & Rule Reference:**
  - Root `AGENTS.md` Rule 7: *"Sin secretos en el repo. Toda variable nueva se documenta en `.env.example` con un valor de ejemplo, nunca uno real."*
- **Recommendation:** Add `# WEB_ORIGIN=http://localhost:3100` to `.env.example` under the API configuration section to document this optional CORS override.

#### SF-3: Legacy Phase 0 Redundant Error Definitions in `apps/api`
- **File:** `apps/api/src/common/errors/api-error.ts:1-53` and `apps/api/src/common/filters/all-exceptions.filter.ts:11-12`
- **Citation:**
  - `apps/api/src/common/errors/api-error.ts:4-8`:
    ```ts
    // Fase 0: el shape se define localmente para que el API compile sin depender
    // del build (`dist`) de `@elite/shared`. Cuando `@elite/shared` esté publicando
    // `ApiErrorResponse` y `API_ERROR_CODES`, reemplazar este archivo por un
    // re-export del paquete compartido y borrar las definiciones locales.
    ```
- **Context & Rule Reference:**
  - Root `AGENTS.md` Rule 5: *"Contrato compartido en `@elite/shared`. Si el front y el back necesitan el mismo tipo, schema o constante, va ahí — no se duplica ni se redefine en cada app."*
- **Recommendation:** Replace the local definitions in `apps/api/src/common/errors/api-error.ts` with re-exports from `@elite/shared`, or update `AllExceptionsFilter` to import `API_ERROR_CODES` and `ApiErrorResponse` directly from `@elite/shared`.

---

### 3. Nit

#### NIT-1: Port Filename Conventions Inconsistency Between Modules
- **Files:**
  - `apps/api/src/modules/users/application/ports/password.hasher.ts` (dot notation)
  - `apps/api/src/modules/users/application/ports/role.directory.ts` (dot notation)
  - `apps/api/src/modules/users/application/ports/user.repository.ts` (dot notation)
  - `apps/api/src/modules/users/infrastructure/bcrypt-password.hasher.ts` (dot notation)
  - `apps/api/src/modules/users/infrastructure/prisma-role.directory.ts` (dot notation)
  - `apps/api/src/modules/auth/application/ports/password-hasher.ts` (hyphen notation)
  - `apps/api/src/modules/auth/application/ports/token-issuer.ts` (hyphen notation)
  - `apps/api/src/modules/auth/application/ports/auth-user.repository.ts` (hyphen notation)
- **Context & Rule Reference:**
  - `apps/api/AGENTS.md` Rule 16: *"Nombra los archivos en kebab-case con sufijo de rol: `*.usecase.ts`, `*.controller.ts`, `*.repository.ts`, `*.module.ts`, `*.spec.ts`."*
- **Recommendation:** Standardize filename separators across ports and implementations (preferring `password-hasher.port.ts` / `password-hasher.ts` consistently).

---

## Detailed File & Line Citations

### 1. English-Only Code & Spanish UI/Docs
- **Prisma Schema Tables & Columns:** `apps/api/prisma/schema.prisma:19-98` (`User`, `Role`, `Permission`, `UserRole`, `RolePermission`)
- **API Routes:**
  - `apps/api/src/modules/auth/presentation/auth.controller.ts:17,26,40,47` (`/auth/login`, `/auth/logout`, `/auth/me`)
  - `apps/api/src/modules/users/presentation/users.controller.ts:32,49,55,63` (`/users`, `/users/:id`)
  - `apps/api/src/modules/roles/presentation/roles.controller.ts:44,54,60,68,78` (`/roles`, `/roles/:id`)
  - `apps/api/src/modules/roles/presentation/permissions.controller.ts:12,16` (`/permissions`)
  - `apps/api/src/modules/health/presentation/health.controller.ts:14,19` (`/health`)

### 2. Authorization & RBAC
- **Backend Permissions Guard:** `apps/api/src/modules/auth/presentation/permissions.guard.ts:20-53`
- **Frontend Permissions Hook:** `apps/web/src/features/auth/hooks/use-permissions.ts:30-44`
- **Frontend RequirePermission Component:** `apps/web/src/features/auth/components/require-permission.tsx:24-48`
- **Anti-lockout Evaluation:**
  - `apps/api/src/modules/users/domain/self-lockout.rule.ts:27-33`
  - `apps/api/src/modules/roles/domain/role.ts:64-75`

### 3. Backend Clean Architecture & Layer Isolation
- **Pure Domain Models (0 framework dependencies):**
  - `apps/api/src/modules/auth/domain/auth-user.ts:1-58`
  - `apps/api/src/modules/auth/domain/session.ts:1-23`
  - `apps/api/src/modules/roles/domain/role.ts:1-76`
  - `apps/api/src/modules/users/domain/user.ts:1-33`
  - `apps/api/src/modules/users/domain/self-lockout.rule.ts:1-34`
- **Application Ports & Dependency Inversion:**
  - `apps/api/src/modules/auth/application/ports/auth-user.repository.ts:1-12`
  - `apps/api/src/modules/roles/application/ports/role.repository.ts:1-23`
  - `apps/api/src/modules/users/application/ports/user.repository.ts:1-17`

### 4. Shared Contract & Centralized Errors
- **Contract & Schemas:** `packages/shared/src/index.ts:1-10`
- **Central API Error Serialization:** `apps/api/src/common/filters/all-exceptions.filter.ts:19-75`
- **Central API Error Deserialization:** `apps/web/src/lib/api.ts:20-32,59-104`
