> Informe histórico del 2026-08-31, guardado como bitácora. No es una regla vigente: las reglas viven en los `AGENTS.md`. La ruta de repo que cita es de una máquina anterior.

# Informe de Revisión de Funcionalidad — Elite Service

**Fecha:** 31 de agosto de 2026  
**Veredicto:** **PARTIAL** (Spec 001 en desarrollo con todas las tareas automatizadas completas y pasando; verificación manual, E2E en navegador y entrega de asset pendientes según spec).

---

## 1. Resumen Ejecutivo

- **Spec 002 (Sistema de diseño):** **Terminada y verificada.** Los tokens OKLCH en `:root` y `.dark` coinciden con `DESIGN.md`. La tipografía (Atkinson Hyperlegible Next / Mono), densidades (`mostrador` / `bahia`), utilidades (`.tint`, `.is-blocked`) y componentes base cumplen con «El Catálogo de Piezas» sin colores ni sombras literales.
- **Spec 001 (Autenticación y RBAC dinámico):** **En desarrollo (fase final).** La lógica de negocio, arquitectura por capas, guards de permisos y sesión, anti-lockout (RN-5, compuertas A y B), roles a demanda (RN-6b), invalidación de sesiones por cambio de contraseña (RN-10) y componentes UI están implementados. Las tareas pendientes corresponden a pruebas manuales en navegador y recepción del logo oficial.
- **Cambios no commiteados:** Se revisaron todos los cambios en el árbol de trabajo (`.env.example`, `apps/api/src/main.ts`, `apps/web/src/features/...`, etc.). No rompen los criterios de las specs 001 y 002; por el contrario, alinean puertos, exclusión de usuario propio en la tabla de usuarios y estilos de celda.

---

## 2. Resultados de Comandos

| Comando      | Código de Salida | Resultado | Detalle                                                                                                                 |
| ------------ | :--------------: | :-------: | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm build` |       `0`        | **PASS**  | Compiló `@elite/shared` (tsc), `@elite/api` (nest build) y `@elite/web` (next build con 8/8 rutas estáticas generadas). |
| `pnpm test`  |       `0`        | **PASS**  | 12 suites pasadas, 56 tests unitarios ejecutados en `apps/api` (Jest con repositorios en memoria).                      |
| `pnpm lint`  |       `0`        | **PASS**  | ESLint 9 flat config limpio sin warnings ni errores.                                                                    |

---

## 3. Estado de Tareas — Spec 001 (Auth + RBAC)

### Tareas Completadas (`[x]`):

1. `packages/shared`: Registro tipado de permisos (`PERMISSIONS` por módulo) y schemas Zod (`loginSchema`, `createUserSchema`, `updateUserSchema`, `createRoleSchema`, `updateRoleSchema`) con types derivados.
2. `apps/api`: Prisma schema (`schema.prisma` con 5 tablas), migración inicial, `seed.ts` idempotente (RN-9), scripts `db:migrate` / `db:seed`.
3. `apps/api`: Módulo `auth` en 4 capas (login/logout/me, bcrypt, JWT en cookie httpOnly, guard global + `@Public()`), con chequeo por request de `isActive` y `passwordChangedAt` vs `iat` (RN-4, RN-10).
4. `apps/api`: `PermissionsGuard` + decorator `@RequirePermissions()` (evaluación por unión de permisos, RN-1/RN-3).
5. `apps/api`: Módulo `users` (list/create/update con roles, desactivación RN-4, anti-lockout RN-5 compuerta A) validado con Zod compartido.
6. `apps/api`: Módulo `roles` (CRUD + asignación de permisos, RN-2/RN-6 `ROLE_IN_USE`) con anti-lockout en `PATCH /roles/:id` (RN-5 compuerta B) y endpoint `GET /permissions`.
7. `apps/api`: Tests unitarios con repositorios en memoria (login ok/bad/inactive, guards, anti-lockout en 2 compuertas, rol en uso, actualización de passwordChangedAt).
8. `apps/web`: Componentes `form`, `checkbox`, `switch` adaptados a tokens y densidad.
9. `apps/web`: Pantalla `/login` como lámina centrada sin riel, mensajes al pie desde `ApiErrorResponse`, contexto de sesión TanStack Query.
10. `apps/web`: `usePermissions()` + `<RequirePermission>` y riel tabulado condicionado por permisos.
11. `apps/web`: Pantalla `/settings/users` (tabla del sistema con `<Reference>`, `<Stamp>`, trama de bloqueo en inactivos, diálogo crear/editar/ver, usuario actual filtrado).
12. `apps/web`: Pantalla `/settings/roles` (tabla de roles + matriz de referencias cruzadas módulo × acción en diálogo, vista solo lectura sin `roles.manage`).
13. `.env.example` y `AGENTS.md` actualizados.
14. Verificación de ausencia de valores literales de estilo (RN-11).

### Tareas Pendientes (`[ ]`):

- [ ] **Verificación visual en temas claro/oscuro y `/login` en densidad `bahía`:** Requiere navegador / dispositivo táctil.
- [ ] **Verificación end-to-end manual:** Flujo completo interactivo (seed → login admin → crear rol → crear usuario → login con nuevo usuario → verificar permisos).
- [ ] **Verificación de anti-lockout (RN-5) por las dos puertas en UI:** Probar intento de quitarse `roles.manage` desde `/settings/users` y `/settings/roles` verificando respuesta `409 SELF_LOCKOUT`.
- [ ] **Asset del logo:** Pendiente de entrega del archivo vectorial original por parte del taller (se mantiene el placeholder provisional).

---

## 4. Hallazgos y Observaciones de Flujo

1. **Redirección de la raíz `/` con permisos parciales:**  
   _Ubicación:_ `apps/web/src/app/page.tsx:20`  
   _Observación:_ Al iniciar sesión, la raíz redirige de forma fija a `/settings/users`. Si un usuario tiene permisos únicamente para roles (`roles.read` pero no `users.read`), al entrar a la aplicación es llevado a `/settings/users` donde se le muestra el aviso de falta de permisos, en lugar de ser redirigido a la primera ruta permitida (`/settings/roles`).
2. **Cobertura de tests unitarios directos para `JwtAuthGuard`:**  
   _Ubicación:_ `apps/api/src/modules/auth/presentation/jwt-auth.guard.ts:28` y `apps/api/src/modules/auth/domain/session.ts:17`  
   _Observación:_ Aunque la regla de negocio RN-10 (`passwordChangedAt`) y las llamadas de usuario se prueban en los casos de uso, `JwtAuthGuard` y la función pura `isTokenIssuedBeforePasswordChange` no cuentan con una suite unitaria `.spec.ts` dedicada en la capa de presentación.

---

## 5. Alcance Fuera de Verificación Automatizada

- **Entorno sin navegador gráfico:** No es posible validar visualmente el renderizado de fuentes Atkinson Hyperlegible, la interacción táctil en tablets físicas, la conmutación de densidad por `pointer: coarse` del dispositivo ni el comportamiento de cookies seguras en el navegador.
- **Base de datos PostgreSQL en tiempo de ejecución:** Los tests corren 100% en memoria con dobles de prueba (puertos desacoplados de Prisma). La conexión real contra PostgreSQL y la ejecución del script de seed (`pnpm db:seed`) requieren el contenedor Docker levantado con las credenciales locales.
