# Elite Service

## Qué es esto

Sistema de gestión para un taller mecánico. Monorepo pnpm con frontend Next.js, backend NestJS
y un paquete de contrato compartido. Estado actual: **Fase 0 (fundación)** — entorno limpio,
sin lógica de negocio, sin base de datos y sin auth. Contexto completo en `docs/PROPUESTA.md`.

## Mapa del monorepo

```
elite-service/
├── apps/web/        Next.js (App Router) → lee apps/web/AGENTS.md
├── apps/api/        NestJS               → lee apps/api/AGENTS.md
├── packages/shared/ @elite/shared        → lee packages/shared/AGENTS.md
├── specs/           una spec por funcionalidad (_TEMPLATE.md)
└── docs/            PROPUESTA.md, ARCHITECTURE.md (ADRs)
```

**Manda el `AGENTS.md` más cercano al archivo que editás**; este raíz define lo global y no se
duplica en los locales.

## Comandos

```bash
pnpm install        # instala todo el workspace
pnpm build          # compila shared + apps (orden topológico)
pnpm dev            # levanta web + api + watch de shared, en paralelo
pnpm lint           # ESLint 9 flat config, único en la raíz
pnpm test           # tests de todos los paquetes
pnpm format         # Prettier sobre todo el repo
```

En `scripts/` viven los verificadores end-to-end por spec (`verify-001.sh`): prueban el sistema
armado —base, guards, cookies, HTTP— contra un stack levantado, que es lo que `pnpm test` no puede
hacer con repositorios en memoria. Cada spec con API propio deja el suyo y lo enlaza desde su
sección **Verificación**.

Corré `pnpm build` **al menos una vez antes del primer `pnpm dev`**: las apps importan
`packages/shared/dist`, que no existe hasta la primera compilación.

**No corras `pnpm build` con `pnpm dev` andando.** `next build` y `next dev` escriben en el mismo
`apps/web/.next`, y el build de producción le pisa los chunks al servidor de desarrollo: la página
carga el HTML pero `main-app.js` empieza a dar 404, React no arranca y la pantalla queda muerta sin
un solo error en la terminal. Si te pasa, parás `pnpm dev`, borrás `apps/web/.next` y lo levantás de
nuevo. Para compilar mientras trabajás, usá `pnpm --filter @elite/shared build` o
`pnpm --filter @elite/api build`, que no tocan `.next`.

El repo trae un `orca.yaml` en la raíz: cuando Orca crea un espacio de trabajo copia el `.env`
del repo principal y abre tres pestañas — Agent, Database (`docker compose up -d`) y Dev
(`pnpm install; pnpm build; pnpm dev`). Si estos comandos cambian, actualizá `orca.yaml` en el
mismo commit.

## Cómo hablarle al usuario

Esto vale para toda respuesta en el chat, no para el código ni la documentación.

Hablá siempre en español sencillo, claro y amigable.

- Usá palabras cotidianas. Evitá la jerga, los términos técnicos y las frases largas.
- Si un término difícil hace falta, explicalo en una frase corta.
- Frases cortas. Párrafos de 1 a 3 frases.
- Tono de amigo paciente, no de profesor ni de manual.
- Andá al grano: primero la idea principal, después el detalle.
- Usá ejemplos de la vida diaria.
- Si el tema es complejo, explicalo en pasos.
- Nada de tono corporativo ni de aperturas tipo "Con gusto te ayudo".
- No rellenes con frases vacías.
- Si no entendiste algo, preguntalo en simple.

## Reglas globales

1. **Código 100% en inglés.** Identificadores, tipos, enums, tablas, columnas, endpoints,
   claves y nombres de archivo. **Los mensajes de commit también van en inglés.** El español se
   usa solo en el texto visible de la UI y en la documentación.
2. **SDD obligatorio.** No se implementa nada sin una spec **aprobada** en `specs/`. Flujo:
   escribir `specs/NNN-name.md` desde `specs/_TEMPLATE.md` → aprobación humana (`Estado:
   Aprobada`) → implementar marcando las tareas → verificar criterios de aceptación. Si te piden
   algo sin spec, escribí la spec primero y esperá aprobación.
3. **Autorización por permiso, nunca por nombre de rol.** Los roles se crean a demanda desde la
   administración; en el código no existe ningún rol fijo. Se valida siempre contra claves
   `module.action` (`users.read`, `roles.manage`). Prohibido `if (user.role === 'admin')`.
4. **Capas del backend:** `presentation → application → domain`. `infrastructure` implementa los
   puertos declarados en `application`. El dominio no importa nada de afuera (ni NestJS, ni ORM,
   ni Zod de transporte). Nunca invertir esa dirección.
5. **Contrato compartido en `@elite/shared`.** Si el front y el back necesitan el mismo tipo,
   schema o constante, va ahí — no se duplica ni se redefine en cada app.
6. **Errores del API con formato único** `{ code, message, details? }` (`ApiErrorResponse` de
   `@elite/shared`), producidos y consumidos en un solo lugar por app.
7. **Sin secretos en el repo.** Toda variable nueva se documenta en `.env.example` con un valor
   de ejemplo, nunca uno real.
8. **Documentación viva.** Si cambiás una convención, actualizá el `AGENTS.md` correspondiente
   **en el mismo commit**.
9. **Responsive y táctil, siempre.** Toda pantalla se entrega **responsive y usable con el dedo en
   tablet**, no solo en escritorio: el mostrador trabaja con teclado y monitor, pero la bahía
   trabaja de pie y con una tablet en la mano. La diferencia de densidad entre `mostrador` y
   `bahia` es **obligatoria, no opcional**: una pantalla que se ve igual en las dos densidades está
   incompleta. El detalle de cómo se aplica vive en `apps/web/AGENTS.md` y en `apps/web/DESIGN.md`.

## Definición de terminado

Una tarea está terminada solo si, todo junto:

- [ ] `pnpm build` compila sin errores (TypeScript estricto, sin `any` ni `@ts-ignore`).
- [ ] `pnpm lint` sale limpio (sin warnings nuevos).
- [ ] `pnpm test` pasa, con tests para la lógica nueva.
- [ ] Si la tarea toca UI: la pantalla se verificó **en ancho de tablet y en densidad `bahia`**,
      además de en escritorio. Sin esa verificación la tarea no está terminada.
- [ ] Se cumplen **todos** los criterios de aceptación de la spec y sus tareas quedan marcadas.
- [ ] `AGENTS.md` y/o la spec quedan actualizados en el mismo commit si algo cambió.

## No hacer

- No implementes módulos de negocio, modelo de datos, Prisma ni auth en Fase 0: no hay spec
  aprobada todavía.
- No inventes roles fijos ni chequeos por nombre de rol.
- No agregues un `eslint.config` ni un `.prettierrc` por app: la configuración es única y vive
  en la raíz.
- No fijes `module`/`moduleResolution` en `tsconfig.base.json`: cada app define el suyo.
- No escribas identificadores, endpoints ni nombres de archivo en español.
- No agregues dependencias pesadas ni cambies el stack sin dejarlo registrado como ADR en
  `docs/ARCHITECTURE.md`.
- No edites `apps/*` desde una tarea que corresponde a otra app sin necesidad: respetá los
  límites de paquete.
