# Shared Contract Compliance Review

**Date:** 2026-08-31
**Repository:** `/home/elopez/Documentos/projects/elite-service`
**Scope:** `packages/shared`, `apps/api`, `apps/web`, `specs/001-auth.md`, `specs/003-carwash.md`

---

## Verdict

### **PASS**

The shared contract between `packages/shared`, `apps/api`, and `apps/web` is strictly respected across all layers. All request/response types, Zod schemas, permission keys, and session/cookie rules are unified under `@elite/shared`, with zero parallel model drift.

One minor legacy artifact (`apps/api/src/common/errors/api-error.ts`) from Phase 0 was noted and documented below for future cleanup, but does not break runtime contract compatibility.

---

## Contract Drift Table

| Area / Feature | Spec 001 (`specs/001-auth.md`) | Shared (`packages/shared`) | API (`apps/api`) | Web (`apps/web`) | Drift / Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Permission Keys** | `users.read`, `users.manage`, `roles.read`, `roles.manage` (lines 59-64) | `PERMISSIONS` catalog (`permissions.ts:12-35`) | Used in `@RequirePermissions()` decorators in controllers (`users.controller.ts:50,56,64`, `roles.controller.ts:55,61,69,80`, `permissions.controller.ts:17`) | Evaluated via `usePermissions()`, `can()`, and `NAV_ITEMS` (`nav-items.ts:41-48`, `users-screen.tsx:34-35`, `roles-screen.tsx:24-25`) | **IN SYNC** |
| **Permission Seeding** | Seed synchronizes catalog to DB (`RN-2`, `RN-9`, lines 42, 51, 80) | `PERMISSIONS` (`permissions.ts:12-35`) | `prisma/seed.ts:46-59` syncs all entries dynamically from `@elite/shared` | N/A (Server-side seed) | **IN SYNC** |
| **User Models** | `PublicUser` without `passwordHash`, with `roles: RoleSummary[]` (lines 73, 91-93) | `PublicUser`, `RoleSummary` (`contracts.ts:9-26`) | Domain `User` (`domain/user.ts:24-32`) mapped to `PublicUser` via `toPublicUser` (`public-user.mapper.ts:13-23`) | Consumed directly as `PublicUser` in `features/users/api.ts:13-31` and components | **IN SYNC** |
| **Role Models** | `RoleDetail` with `permissionKeys: string[]`, `userCount: number` (lines 74, 94-96) | `RoleDetail` (`contracts.ts:29-37`) | Domain `Role` (`domain/role.ts:17-24`) mapped to `RoleDetail` via `toRoleDetail` (`role-detail.mapper.ts:9-19`) | Consumed directly as `RoleDetail` in `features/roles/api.ts:15-38` and components | **IN SYNC** |
| **Auth Responses** | `LoginResponse` (`{ user, permissions }`), `SessionResponse` (`{ user, roles, permissions }`) (lines 88-90) | `LoginResponse`, `SessionResponse` (`contracts.ts:40-54`) | `AuthController` returns `LoginResponse` and `SessionResponse` (`auth.controller.ts:31,48`) | `features/auth/api.ts:12,30` returns `LoginResponse` and `SessionResponse` | **IN SYNC** |
| **Validation Schemas** | Shared Zod schemas for input validation (lines 88-96, 203) | `loginSchema`, `createUserSchema`, `updateUserSchema`, `createRoleSchema`, `updateRoleSchema` (`schemas.ts:43-108`) | Validated at controllers via `ZodValidationPipe` (`auth.controller.ts:29`, `users.controller.ts:58,67`, `roles.controller.ts:63,72`) | Validated at forms via `zodResolver` (`login-form.tsx:58`, `user-form.tsx:61-69`, `role-form-dialog.tsx:98`) | **IN SYNC** |
| **Session Cookie & JWT** | `httpOnly`, `SameSite=Lax`, 8h TTL, no frozen permissions in JWT (`RN-6b`, `RN-8`, lines 47-50) | `contracts.ts` (transport contracts) | `SessionCookieService` (`session-cookie.service.ts:20-43`), JWT payload contains only `sub`, `iat`, `exp` (`jwt-token-issuer.ts:16-23`), permissions re-evaluated per-request in `JwtAuthGuard` (`jwt-auth.guard.ts:53-69`) | Cookie handled automatically by browser; `apiFetch` uses `credentials: 'include'` (`lib/api.ts:67`) | **IN SYNC** |
| **Error Handling** | `{ code, message, details? }` format (`RN-6`, `RN-10`, lines 84, 88-97) | `API_ERROR_CODES`, `ApiErrorResponse` (`errors.ts:5-42`) | Emitted by all controllers, use cases, guards, and `AllExceptionsFilter` | Parsed into `ApiError` class (`lib/api.ts:20-32`); details mapped to form inputs | **IN SYNC** |

---

## Detailed Check Findings

### 1. Permissions Catalog & Seed Sync
- **Catalog:** All permission keys used in application code (`users.read`, `users.manage`, `roles.read`, `roles.manage`) are declared in `packages/shared/src/permissions.ts:12-35`.
- **Backend Authorization:** `apps/api/src/modules/users/presentation/users.controller.ts:50,56,64`, `apps/api/src/modules/roles/presentation/roles.controller.ts:55,61,69,80`, and `apps/api/src/modules/roles/presentation/permissions.controller.ts:17` authorize strictly using permission keys via `@RequirePermissions()`. No role names are checked.
- **Frontend Authorization:** `apps/web/src/components/app-shell/nav-items.ts:41-48`, `apps/web/src/features/users/components/users-screen.tsx:34-35`, and `apps/web/src/features/roles/components/roles-screen.tsx:24-25` guard routes and actions using `can('permission.key')`.
- **Database Seed:** `apps/api/prisma/seed.ts:46-59` derives the seed entries directly by mapping `Object.values(PERMISSIONS)` to keep the database in sync with the shared catalog.

### 2. Request / Response Contracts & Parallel Types
- **No Duplicate Types:** Neither `apps/api` nor `apps/web` define parallel transport DTOs for User, Role, Session, or Permissions.
- **Strict Domain Isolation:** Backend domain entities (`apps/api/src/modules/users/domain/user.ts:24-32`, `apps/api/src/modules/roles/domain/role.ts:17-24`, `apps/api/src/modules/auth/domain/auth-user.ts:9-19`) maintain purity (e.g. `Date` objects, omitting sensitive fields like `passwordHash`).
- **Mappers:** Dedicated mappers (`public-user.mapper.ts:13-23`, `role-detail.mapper.ts:9-19`, `auth-user.mapper.ts:12-34`) translate domain models to `@elite/shared` contracts (`PublicUser`, `RoleDetail`, `SessionResponse`).

### 3. Error Codes & Error Flow
- **Error Code Catalog:** `packages/shared/src/errors.ts:5-29` defines the single source of truth for error codes.
- **API Exceptions:**
  - `INVALID_CREDENTIALS`: `apps/api/src/modules/auth/application/login.usecase.ts:62`
  - `UNAUTHORIZED`: `apps/api/src/modules/auth/presentation/jwt-auth.guard.ts:92`, `apps/api/src/modules/auth/application/get-session.usecase.ts:24`
  - `FORBIDDEN`: `apps/api/src/modules/auth/presentation/permissions.guard.ts:47`
  - `NOT_FOUND`: `apps/api/src/modules/users/presentation/users.controller.ts:38`, `apps/api/src/modules/users/application/update-user.usecase.ts:41`, `apps/api/src/modules/roles/presentation/roles.controller.ts:34`, `apps/api/src/modules/roles/application/update-role.usecase.ts:28`, `apps/api/src/modules/roles/application/delete-role.usecase.ts:22`
  - `EMAIL_TAKEN`: `apps/api/src/modules/users/application/create-user.usecase.ts:28`
  - `NAME_TAKEN`: `apps/api/src/modules/roles/application/create-role.usecase.ts:29`, `apps/api/src/modules/roles/application/update-role.usecase.ts:60`
  - `ROLE_IN_USE`: `apps/api/src/modules/roles/application/delete-role.usecase.ts:29`
  - `SELF_LOCKOUT`: `apps/api/src/modules/users/application/update-user.usecase.ts:82`, `apps/api/src/modules/roles/application/update-role.usecase.ts:94`
  - `INVALID_ROLE`: `apps/api/src/modules/users/application/assert-roles-exist.ts:26`
  - `VALIDATION_ERROR`: `apps/api/src/common/validation/zod-validation.pipe.ts:40`
  - `INTERNAL_ERROR`: `apps/api/src/common/filters/all-exceptions.filter.ts:50`
- **Frontend Interception:** `apps/web/src/lib/api.ts:20-32,89-101` normalizes every API error into `ApiError` (`{ code, message, details, status }`). Forms downcast errors to individual field errors using `details` (`login-form.tsx:82-86`, `user-form.tsx:96-119`, `role-form-dialog.tsx:131-140`).
- **Minor Note (Phase 0 Artifact):** `apps/api/src/common/errors/api-error.ts` was kept from Phase 0 and contains local fallback codes (`BAD_REQUEST`, `TOO_MANY_REQUESTS`). `AllExceptionsFilter` currently imports `errorCodeForStatus` from this local file. This can be cleaned up in a future refactor by importing directly from `@elite/shared`.

### 4. Zod Schema Sharing
- **Source:** `packages/shared/src/schemas.ts:43-108`.
- **Backend:** `ZodValidationPipe` (`apps/api/src/common/validation/zod-validation.pipe.ts:19-45`) validates inputs on `@Body()` controllers and formats field-level validation errors into `{ code: 'VALIDATION_ERROR', message, details }`.
- **Frontend:** Forms integrate `loginSchema`, `createUserSchema`, and `createRoleSchema` directly via `@hookform/resolvers/zod` (`login-form.tsx:58`, `user-form.tsx:61-69`, `role-form-dialog.tsx:98`).

### 5. Session & Cookie Compliance
- **Cookie Specification:** `apps/api/src/modules/auth/presentation/session-cookie.service.ts:20-43` configures:
  - Cookie name: `elite_session` (`common/auth/authenticated-user.ts:22`)
  - `httpOnly: true`
  - `sameSite: 'lax'`
  - `secure: config.get('NODE_ENV') === 'production'`
  - `maxAge: 28800000` (8 hours / `SESSION_TTL_SECONDS = 28800`)
- **Unfrozen Permissions (`RN-6b`):** `apps/api/src/modules/auth/infrastructure/jwt-token-issuer.ts:16-23` deliberately signs an empty JWT payload with `sub: userId`. `JwtAuthGuard` (`apps/api/src/modules/auth/presentation/jwt-auth.guard.ts:53-69`) and `GetSessionUseCase` (`apps/api/src/modules/auth/application/get-session.usecase.ts:19-34`) fetch current user, roles, and permissions from the database on every authenticated request.
- **Password Invalidation (`RN-10`):** `isTokenIssuedBeforePasswordChange` (`apps/api/src/modules/auth/domain/session.ts:17-22`) verifies `iat` against `passwordChangedAt` in `JwtAuthGuard`.

### 6. Working Tree Diffs Audit
All uncommitted diffs were reviewed:
- **Port defaults:** Updated to `3200` (API) and `3100` (Web) in `.env.example`, `apps/api/src/main.ts`, `apps/web/next.config.ts`, `apps/web/package.json`, `apps/web/src/lib/api.ts`, and `AGENTS.md`. No contract changes.
- **UI & Accessibility Refinements:** Table padding (`apps/web/src/components/ui/table.tsx`), delete role copy (`delete-role-dialog.tsx`), role actions layout (`roles-table.tsx`), self-exclusion in users table (`users-screen.tsx`, `users-table.tsx`), and spec 001 acceptance criteria alignment (`specs/001-auth.md`).
- **Verdict on Diffs:** 0% contract drift.

### 7. Spec 003 Compatibility (Carwash Draft)
- `specs/003-carwash.md` introduces floor sessions (`elite_floor_session`, `kind: "employee"`).
- Spec 003 explicitly designs backward compatibility with current admin tokens: tokens without `kind` default to `kind: "user"` (line 344).
- Future permissions (`carwash.*`, `services.*`, `employees.*`, `customers.*`, `vehicles.*`) and error codes (`PRICE_ABOVE_CATALOG`, `PAYMENT_AMOUNT_MISMATCH`, etc.) extend the catalog without breaking existing Phase 1 definitions.
- Current code does not contradict any future spec 003 requirement.

---

## File & Line Citations

### Shared (`packages/shared`)
- Permissions catalog: `packages/shared/src/permissions.ts:12-35`
- Permission helpers: `packages/shared/src/permissions.ts:44-80`
- API Error codes catalog: `packages/shared/src/errors.ts:5-29`
- API Error response interface: `packages/shared/src/errors.ts:38-42`
- Transport contracts (`PublicUser`, `RoleDetail`, `LoginResponse`, `SessionResponse`): `packages/shared/src/contracts.ts:9-54`
- Zod validation schemas (`loginSchema`, `createUserSchema`, `updateUserSchema`, `createRoleSchema`, `updateRoleSchema`): `packages/shared/src/schemas.ts:43-108`

### Backend (`apps/api`)
- Seed script: `apps/api/prisma/seed.ts:46-59`
- Auth Controller: `apps/api/src/modules/auth/presentation/auth.controller.ts:28-50`
- Users Controller: `apps/api/src/modules/users/presentation/users.controller.ts:49-73`
- Roles Controller: `apps/api/src/modules/roles/presentation/roles.controller.ts:53-84`
- Permissions Controller: `apps/api/src/modules/roles/presentation/permissions.controller.ts:16-21`
- JWT Guard & Per-Request Resolution: `apps/api/src/modules/auth/presentation/jwt-auth.guard.ts:35-71`
- Permissions Guard: `apps/api/src/modules/auth/presentation/permissions.guard.ts:23-53`
- Cookie Management: `apps/api/src/modules/auth/presentation/session-cookie.service.ts:20-43`
- Zod Validation Pipe: `apps/api/src/common/validation/zod-validation.pipe.ts:19-45`
- User Mapper: `apps/api/src/modules/users/application/public-user.mapper.ts:13-23`
- Role Mapper: `apps/api/src/modules/roles/application/role-detail.mapper.ts:9-19`

### Frontend (`apps/web`)
- API Fetch Client & ApiError: `apps/web/src/lib/api.ts:20-32,59-104`
- Auth API Client: `apps/web/src/features/auth/api.ts:12-32`
- Users API Client: `apps/web/src/features/users/api.ts:12-44`
- Roles API Client: `apps/web/src/features/roles/api.ts:14-48`
- Navigation Rail Permissions: `apps/web/src/components/app-shell/nav-items.ts:36-49,62-72`
- Login Form: `apps/web/src/features/auth/components/login-form.tsx:57-88`
- User Form Dialog: `apps/web/src/features/users/components/user-form.tsx:43-70,133-174`
- Role Form Dialog: `apps/web/src/features/roles/components/role-form-dialog.tsx:90-156`
