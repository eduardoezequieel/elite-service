# Elite Service

Sistema de gestión para un taller mecánico. Monorepo pnpm: Next.js (web), NestJS (api) y un
paquete de contrato compartido. PostgreSQL con Prisma, sesión por cookie httpOnly.

Producto y audiencias en `PRODUCT.md`. Decisiones técnicas (ADR) en `docs/ARCHITECTURE.md`.
Fallas conocidas en `docs/TROUBLESHOOTING.md`.

## Mapa

| Ruta               | Qué es                               | Reglas propias                              |
| ------------------ | ------------------------------------ | ------------------------------------------- |
| `apps/web/`        | Next.js (App Router)                 | `apps/web/AGENTS.md` + `apps/web/DESIGN.md` |
| `apps/api/`        | NestJS                               | `apps/api/AGENTS.md`                        |
| `packages/shared/` | `@elite/shared`: contrato front/back | `packages/shared/AGENTS.md`                 |

`specs/` una spec por funcionalidad (desde `_TEMPLATE.md`) · `scripts/` un verificador end-to-end
por spec (`verify-NNN.sh`) · `docs/` ADRs, fallas y la propuesta original.

Manda el `AGENTS.md` más cercano al archivo que editás. Este raíz define lo global y no se repite
en los locales.

## Comandos

| Comando                | Qué hace                                            |
| ---------------------- | --------------------------------------------------- |
| `pnpm install`         | instala el workspace                                |
| `pnpm build`           | compila shared + apps en orden topológico           |
| `pnpm dev`             | web + api + watch de shared, en paralelo            |
| `pnpm lint`            | ESLint 9 flat config, único en la raíz              |
| `pnpm test`            | tests de cada paquete (hoy solo `@elite/api` tiene) |
| `pnpm format`          | Prettier sobre todo el repo                         |
| `docker compose up -d` | Postgres; el api no arranca sin esto                |

- Corré `pnpm build` una vez antes del primer `pnpm dev`: las apps importan
  `packages/shared/dist`, que no existe hasta la primera compilación.
- `pnpm build` y `pnpm dev` pueden correr a la vez: la web separa la salida del dev de la del
  build (`apps/web/AGENTS.md`).
- Los `scripts/verify-NNN.sh` prueban el sistema armado —base, guards, cookies, HTTP— contra un
  stack levantado, que es lo que `pnpm test` no puede hacer con repositorios en memoria. Cada spec
  con API propio deja el suyo y lo enlaza en su sección **Verificación**.
- Si estos comandos cambian, actualizá `orca.yaml` en el mismo commit: con él Orca abre las
  pestañas Agent, Database y Dev.

## Cómo hablarle al usuario

Vale para el chat, no para el código ni la documentación.

Español sencillo. Palabras cotidianas, frases cortas, párrafos de 1 a 3 frases. Primero la idea,
después el detalle; en pasos si el tema es complejo. Si hace falta un término técnico, explicalo en
una frase. Tono de amigo paciente: nada de tono corporativo, aperturas de cortesía ni relleno. Si no
entendiste algo, preguntalo en simple.

## Reglas globales

1. **Código 100% en inglés.** Identificadores, tipos, enums, tablas, columnas, endpoints, claves,
   nombres de archivo, **segmentos de ruta** (`/carwash/new`, no `/carwash/nuevo`) y mensajes de
   commit. El español va solo en el texto visible de la UI y en la documentación.
2. **SDD obligatorio.** Nada se implementa sin una spec **aprobada** en `specs/`. Flujo: escribir
   `specs/NNN-name.md` desde `_TEMPLATE.md` → aprobación humana (`Estado: Aprobada`) → implementar
   marcando las tareas → verificar criterios. Si te piden algo sin spec, escribí la spec primero y
   esperá aprobación.
3. **Autorización por permiso, nunca por nombre de rol.** Los roles se crean a demanda y en el
   código no existe ninguno fijo. Siempre contra claves `module.action` (`users.read`,
   `roles.manage`). Prohibido `if (user.role === 'admin')`.
4. **Capas del backend:** `presentation → application → domain`. `infrastructure` implementa los
   puertos declarados en `application`. El dominio no importa nada de afuera (ni NestJS, ni ORM, ni
   Zod de transporte). Nunca al revés.
5. **Contrato compartido en `@elite/shared`.** Lo que necesitan front y back —tipo, schema o
   constante— va ahí una sola vez; no se redefine en cada app.
6. **Errores del API con formato único** `{ code, message, details? }` (`ApiErrorResponse` de
   `@elite/shared`), producidos y consumidos en un solo lugar por app.
7. **Sin secretos en el repo.** Toda variable nueva se documenta en `.env.example` con un valor de
   ejemplo, nunca uno real.
8. **Documentación viva.** Si cambiás una convención, actualizá el `AGENTS.md` que corresponde en
   el mismo commit.
9. **Responsive y táctil, siempre.** El mostrador trabaja con teclado y monitor; la bahía, de pie y
   con una tablet en la mano. La diferencia entre las densidades `mostrador` y `bahia` es
   **obligatoria**: una pantalla que se ve igual en las dos está incompleta. El detalle en
   `apps/web/AGENTS.md` y `apps/web/DESIGN.md`.
10. **Configuración única en la raíz.** ESLint, Prettier y `.gitignore` no se duplican por app. En
    `tsconfig.base.json` no se fija `module`/`moduleResolution`: cada app define el suyo.
11. **Stack y dependencias pesadas** no se cambian sin un ADR nuevo en `docs/ARCHITECTURE.md`.

## Definición de terminado

- [ ] `pnpm build` compila (TypeScript estricto, sin `any` ni `@ts-ignore`).
- [ ] `pnpm lint` limpio, sin warnings nuevos.
- [ ] `pnpm test` pasa, con tests para la lógica nueva.
- [ ] Si toca UI: la pantalla se verificó **en ancho de tablet y en densidad `bahia`**, además de
      en escritorio. Sin eso no está terminada.
- [ ] Se cumplen **todos** los criterios de aceptación de la spec y sus tareas quedan marcadas.
- [ ] Spec y `AGENTS.md` actualizados en el mismo commit si algo cambió.

## No hacer

- No crees pantallas, rutas, módulos, entidades ni endpoints "por adelantado", sin spec aprobada.
- No edites `apps/*` desde una tarea que corresponde a otra app: respetá los límites de paquete.
