# Elite Service — Propuesta de proyecto

> Sistema de gestión para taller mecánico. Documento de propuesta para revisión:
> análisis del stack, alcance inicial, arquitectura y reglas para los archivos de
> instrucciones de agentes de código.
>
> **Estado:** borrador pendiente de aprobación · **Fecha:** 2026-08-30 (rev. 2)

---

## 0. Reglas de oro del proyecto

1. **Todo el código en inglés.** Variables, funciones, enums, tablas, columnas, endpoints, nombres de archivo: inglés, sin excepción. El español se usa solo en la UI visible al usuario, commits y documentación.
2. **Roles dinámicos, no roles fijos.** No existen roles predefinidos en el código (nada de `admin`/`recepcion`/`mecanico` hardcodeados). Los roles se **crean a demanda** desde la administración, y cada rol define **permisos por módulo/pantalla**. Lo único sembrado es un usuario administrador inicial con todos los permisos.
3. **No adelantarse.** No se modela data ni se implementa ningún módulo de negocio hasta que su spec esté aprobada. El alcance inmediato es únicamente dejar los proyectos de frontend y backend en estado limpio.

---

## 1. Análisis del stack

El stack de la imagen es sólido para este caso de uso:

| Capa | Tecnología | Veredicto | Notas |
|------|-----------|-----------|-------|
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui | ✅ | App interna de formularios y tablas. App Router. |
| Backend | NestJS + TypeScript | ✅ | Módulos por dominio, inyección de dependencias nativa → facilita mocks y clean architecture. |
| Base de datos | PostgreSQL | ✅ | Relacional, transacciones. Se integra cuando toque modelar data, no antes. |
| ORM | Prisma | ✅ | Schema legible, migraciones versionadas, tipos TS. Se agrega junto con el primer modelo de datos. |
| Auth | JWT + **RBAC dinámico** | ✅ ajustado | Roles creados a demanda con permisos por módulo/pantalla (ver sección 3). Sin OAuth público. |
| Infra | Docker Compose | ✅ | Docker instalado y verificado (Docker 29.7.2 con Docker Desktop, Compose v5.4.0). El `docker-compose.yml` levanta `elite-service-postgres` sano en el puerto 5432; los servicios `api` y `web` se agregan cuando existan sus Dockerfiles. |

**Decisión adicional propuesta:** monorepo con `pnpm workspaces` — `apps/web`, `apps/api`, `packages/shared` — para compartir tipos, schemas de validación (Zod) y constantes entre front y back.

---

## 2. Alcance

### 2.1 Alcance inmediato (Fase 0 — lo único que se ejecuta al aprobar esto)

Dejar el entorno en **estado limpio**, sin lógica de negocio y sin modelo de datos:

- Monorepo configurado (pnpm workspaces, TypeScript estricto, ESLint + Prettier compartidos).
- `apps/web`: Next.js + Tailwind + shadcn/ui instalado, layout base vacío, sin pantallas de negocio.
- `apps/api`: NestJS con estructura de clean architecture preparada (carpetas y ejemplo mínimo), health check, sin entidades.
- `packages/shared`: paquete vacío pero cableado (importable desde web y api).
- `AGENTS.md` raíz + uno por app/paquete, `CLAUDE.md` apuntando al raíz.
- `specs/` con su plantilla (`_TEMPLATE.md`).
- `docker-compose.yml` y `.env.example` listos para el futuro.

**Explícitamente fuera de la Fase 0:** Prisma/schema, base de datos, auth, cualquier pantalla o endpoint de negocio.

### 2.2 Después de la Fase 0 (solo vía specs, una a la vez)

El primer candidato natural es **auth + roles dinámicos** (spec 001), porque todo lo demás depende de él. Los módulos de negocio del taller (clientes, vehículos, órdenes de trabajo, inventario, facturación) **no se diseñan todavía**: se levantará una spec por módulo cuando llegue su turno, y ahí se definirán datos, endpoints y pantallas.

---

## 3. Modelo de permisos (concepto, no diseño de datos)

Cuando se escriba la spec 001, el modelo a seguir es:

- **Rol:** entidad creada a demanda desde la administración (nombre + descripción). Ningún rol viene fijo en el código.
- **Permiso:** la unidad es la acción sobre un módulo/pantalla, con clave en inglés tipo `module.action` (ej. `users.read`, `users.create`, `roles.manage`). El catálogo de permisos crece a medida que se agregan módulos.
- **Asignación:** un rol agrupa permisos; un usuario tiene uno o más roles. El backend valida por permiso (guards), nunca por nombre de rol; el frontend oculta/muestra pantallas y acciones según los permisos del usuario.
- **Seed mínimo:** un usuario administrador inicial con un rol que agrupa todos los permisos existentes — creado por seed, no hardcodeado en la lógica.

Los detalles (schema, endpoints, pantallas de gestión de roles) se definen en la spec 001, no aquí.

---

## 4. Arquitectura propuesta

### 4.1 Estructura del monorepo

```
elite-service/
├── AGENTS.md                  # Instrucciones raíz para agentes (cualquier LLM)
├── CLAUDE.md                  # → apunta a AGENTS.md (1 línea)
├── docs/
│   ├── PROPUESTA.md           # este documento
│   └── ARCHITECTURE.md        # decisiones de arquitectura (ADRs ligeros)
├── specs/                     # SDD: una spec por funcionalidad
│   └── _TEMPLATE.md
├── apps/
│   ├── web/                   # Next.js (App Router)
│   │   └── AGENTS.md          # convenciones del frontend
│   └── api/                   # NestJS
│       └── AGENTS.md          # convenciones del backend
├── packages/
│   └── shared/                # tipos, schemas Zod, constantes
│       └── AGENTS.md
├── docker-compose.yml         # PostgreSQL local (Docker ya instalado)
├── .env.example
└── pnpm-workspace.yaml
```

### 4.2 Clean architecture en el backend (pragmática)

Cada módulo de NestJS seguirá esta estructura de capas (en Fase 0 solo se deja la convención documentada y un módulo de ejemplo mínimo, p. ej. `health`):

```
apps/api/src/modules/<module-name>/
├── domain/            # Entidades y reglas de negocio puras (sin NestJS, sin ORM)
├── application/       # Casos de uso + puertos (interfaces de repositorios)
│   └── ports/
├── infrastructure/    # Implementaciones concretas (ORM, servicios externos)
└── presentation/      # Controllers + DTOs (validados con Zod desde shared)
```

**Regla de dependencia:** `presentation → application → domain`; `infrastructure` implementa los puertos de `application`; el dominio no importa nada de fuera.

**Amigable a mocks:** los casos de uso reciben repositorios por interfaz → en tests se inyecta una implementación en memoria (`InMemoryUserRepository`), sin base de datos.

### 4.3 Frontend por features

```
apps/web/src/
├── app/               # rutas (App Router)
├── features/          # una carpeta por módulo (vacío en Fase 0)
├── components/ui/     # shadcn/ui
└── lib/
```

Estado del servidor con **TanStack Query**; formularios con **react-hook-form + Zod** (los mismos schemas de `packages/shared` que valida el backend — validación escrita una sola vez). MSW opcional (`NEXT_PUBLIC_API_MOCK=true`) para desarrollar pantallas sin backend levantado.

### 4.4 Reutilización de código

- `packages/shared`: schemas Zod, tipos de DTOs, constantes, claves de permisos.
- Componentes de UI genéricos (`DataTable`, `FormField`, `StatusBadge`) una sola vez en `apps/web/src/components`.
- Errores del API con formato único (`{ code, message, details }`) manejados por un solo interceptor.

---

## 5. SDD — Spec-Driven Development (flujo)

Ninguna funcionalidad se implementa sin spec aprobada. Flujo:

```
1. Spec        → se escribe specs/NNN-name.md desde _TEMPLATE.md
2. Aprobación  → vos la revisás y marcás "Aprobada"
3. Tareas      → la spec lista tareas verificables (checkboxes)
4. Implementar → agente implementa siguiendo AGENTS.md, marca tareas
5. Verificar   → tests pasan + criterios de aceptación cumplidos
```

### Plantilla de spec (`specs/_TEMPLATE.md`)

```markdown
# NNN — Nombre de la funcionalidad
**Estado:** Borrador | Aprobada | En desarrollo | Terminada
**Módulo:** | **Depende de:**

## Contexto        (por qué existe esto, en 2-3 líneas)
## Historias       (Como <usuario con permiso X>, quiero <acción>, para <beneficio>)
## Criterios de aceptación   (Dado / Cuando / Entonces — verificables)
## Reglas de negocio         (numeradas: RN-1, RN-2...)
## Permisos        (claves de permiso que introduce: module.action)
## Datos           (cambios al schema — solo si la spec los requiere)
## API             (endpoints: método, ruta, request, response, errores)
## UI              (pantallas y componentes)
## Fuera de alcance
## Tareas          (- [ ] checkboxes, cada una verificable)
```

---

## 6. Reglas para los archivos de instrucciones de agentes

### 6.1 Principios

1. **Estándar abierto:** el archivo canónico es `AGENTS.md` (estándar que ya leen Codex, Cursor, Gemini CLI, etc.). Para Claude Code, `CLAUDE.md` contiene una sola línea: `Lee y sigue AGENTS.md`. Cualquier LLM entra al proyecto y encuentra las mismas reglas.
2. **Jerarquía por cercanía:** un `AGENTS.md` raíz (reglas globales) y uno por app/paquete (reglas locales). El más cercano al archivo editado manda; nunca se duplica contenido entre niveles.
3. **Corto y verificable:** cada regla es una instrucción imperativa comprobable ("Usa Zod de `@elite/shared` para validar DTOs"), no filosofía ("el código debe ser limpio"). Máximo ~100 líneas por archivo; si crece, se extrae a `docs/` y se enlaza.
4. **Comandos exactos:** todo comando que un agente necesite (instalar, correr, testear, lint) aparece literal y copiable. Un agente nuevo debe poder levantar el entorno sin preguntar.
5. **Vivo:** si una convención cambia, cambiar el AGENTS.md **en el mismo commit**. Un AGENTS.md desactualizado es peor que ninguno.
6. **Sin secretos:** nunca credenciales reales; siempre referirse a `.env.example`.

### 6.2 Estructura estándar de cada AGENTS.md

```markdown
# <Nombre del paquete/app>
## Qué es esto            (1-2 líneas de propósito)
## Comandos               (dev, build, test, lint — literales)
## Estructura             (árbol comentado de carpetas)
## Convenciones           (reglas numeradas, imperativas)
## Flujo de trabajo       (SDD: spec primero, tests, definición de terminado)
## No hacer               (anti-patrones explícitos, qué no tocar)
```

### 6.3 Contenido previsto del `AGENTS.md` raíz

- Descripción del proyecto y mapa del monorepo (a qué AGENTS.md ir según dónde trabajás).
- **Regla de idioma: código 100% en inglés** (identificadores, enums, tablas, endpoints, archivos); español solo en UI, commits y docs.
- Flujo SDD obligatorio: no implementar sin spec aprobada en `specs/`.
- **Autorización por permiso, nunca por nombre de rol** (los roles son dinámicos).
- Comandos globales (`pnpm dev`, `pnpm test`, `pnpm lint`).
- Definición de terminado: compila + lint limpio + tests pasan + criterios de la spec cumplidos + AGENTS.md/spec actualizados si algo cambió.
- Regla de dependencias entre capas (sección 4.2).

### 6.4 Contenido previsto de los AGENTS.md locales

- **`apps/api/AGENTS.md`:** estructura de capas por módulo, cómo crear un módulo nuevo (paso a paso), regla de puertos/repositorios, tests con repositorios en memoria.
- **`apps/web/AGENTS.md`:** estructura por features, usar shadcn/ui (no inventar componentes si ya existe uno), TanStack Query para datos, formularios con react-hook-form + Zod compartido, cómo activar mocks con MSW, renderizado condicionado por permisos.
- **`packages/shared/AGENTS.md`:** aquí viven schemas/tipos/constantes; regla de oro: si front y back necesitan lo mismo, va aquí; sin dependencias de Next ni Nest.

---

## 7. Plan de fases

| Fase | Contenido | Resultado |
|------|-----------|-----------|
| **0. Fundación** | Monorepo limpio: web + api + shared en estado inicial, AGENTS.md (raíz + 3 locales), plantilla de specs, docker-compose y .env.example. **Sin data, sin auth, sin negocio.** | Entorno donde cualquier agente puede contribuir |
| **1. Auth + RBAC dinámico** | Spec 001: login JWT, usuarios, creación de roles a demanda, permisos por módulo/pantalla, seed del admin inicial | Control de acceso |
| **2+** | Por definir: una spec por módulo de negocio, cuando lo decidas | — |

---

## 8. Qué sigue

1. Aprobás (o corregís) esta propuesta.
2. Ejecuto la **Fase 0**: scaffolding limpio de frontend, backend y shared, con sus AGENTS.md — nada más.
3. La spec 001 (auth + roles dinámicos) se escribe después, para tu revisión, antes de implementarla.
