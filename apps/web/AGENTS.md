# @elite/web

## Qué es esto

Frontend de Elite Service: Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui.
Consume el API de `@elite/api` y comparte tipos y schemas Zod con `@elite/shared`.

## Comandos

Ejecutar desde la raíz del monorepo (o dentro de `apps/web/` sin el `--filter`):

```bash
pnpm --filter @elite/shared build     # requerido antes del primer dev/build
pnpm --filter @elite/web dev          # http://localhost:3000
pnpm --filter @elite/web build
pnpm --filter @elite/web start
pnpm lint                             # ESLint vive SOLO en la raíz
pnpm format
npx shadcn@latest add <componente>    # ejecutar dentro de apps/web/
```

## Variables de entorno

El `.env` canónico vive en la **raíz** del monorepo (plantilla: `.env.example`). Next solo lee
archivos `.env` de su propio directorio, así que para que `NEXT_PUBLIC_API_URL` llegue al bundle:

1. Exportá la variable en el entorno antes de `pnpm dev`, **o**
2. Creá `apps/web/.env.local` copiando ahí las líneas `NEXT_PUBLIC_*` de la raíz
   (está ignorado por el `.gitignore` raíz; nunca lo subas).

Si falta, `src/lib/api.ts` cae al valor por defecto `http://localhost:3001/api`.
Nunca pongas secretos en variables `NEXT_PUBLIC_*`: se exponen al navegador.

## Estructura

```
apps/web/
├── DESIGN.md                # sistema de diseño: fuente de verdad visual
├── components.json          # config de shadcn/ui (new-york, neutral)
├── next.config.ts
├── postcss.config.mjs       # Tailwind v4 vía @tailwindcss/postcss
└── src/
    ├── app/                 # SOLO rutas, layouts y páginas (App Router)
    │   ├── globals.css      # @import tailwindcss + TODOS los tokens del sistema
    │   ├── layout.tsx       # layout raíz (lang="es") + Providers
    │   └── page.tsx
    ├── features/            # un módulo de negocio por carpeta
    │   └── <module>/
    │       ├── components/  # UI propia del módulo
    │       ├── hooks/       # useXxxQuery / useXxxMutation (TanStack Query)
    │       └── api.ts       # llamadas al API del módulo, sobre apiFetch
    ├── components/
    │   └── ui/              # SOLO componentes generados por shadcn
    └── lib/
        ├── api.ts           # apiFetch + ApiError { code, message, details? }
        ├── query-client.tsx # Providers (QueryClientProvider)
        └── utils.ts         # cn()
```

## Convenciones

1. Escribí todo el código en inglés (archivos, componentes, hooks, variables) y todos los
   textos visibles de la UI en español.
2. Antes de crear un componente de UI, buscá si shadcn/ui ya lo tiene y agregalo con
   `npx shadcn@latest add <nombre>`. No reescribas a mano lo que el CLI genera.
3. Pedí datos del servidor SIEMPRE con TanStack Query (`useQuery` / `useMutation`) desde un
   hook en `features/<module>/hooks/`. Nunca llames `fetch` suelto dentro de un componente.
4. Hacé todas las peticiones a través de `apiFetch` de `@/lib/api`, para que los errores
   lleguen normalizados como `ApiError { code, message, details? }`.
5. Construí los formularios con `react-hook-form` + `zodResolver` de `@hookform/resolvers/zod`,
   usando los schemas Zod que ya expone `@elite/shared`.
6. Mantené `src/app/` como capa de rutas: la página importa componentes de `features/` y no
   contiene lógica de negocio.
7. Nombrá los archivos en kebab-case (`work-order-form.tsx`) y los componentes en PascalCase.
8. Cuando exista auth, condicioná el render por permiso `module.action` del usuario (por
   ejemplo `users.create`), nunca por nombre de rol: ocultá pantallas, botones y acciones
   para los que el usuario no tenga permiso.
9. `DESIGN.md` (en esta misma carpeta) es la **fuente de verdad visual**. Si el código y ese
   documento discrepan, se arregla en el mismo commit: o se corrige el código o se actualiza el
   documento. Nunca se dejan divergentes.
10. Componé estilos con utilidades de Tailwind y `cn()`, siempre sobre los tokens del sistema
    (`bg-background`, `text-muted-foreground`, …). Los tokens se definen **una sola vez** en
    `src/app/globals.css`: ningún componente escribe un color, radio, sombra ni duración literal.
11. Claro y oscuro son **ambos de primera clase**: todo token existe en `:root` y `.dark` solo
    redefine valores. Ningún color puede existir únicamente dentro del bloque oscuro.
12. Las dos densidades se manejan con el atributo `data-density` (`mostrador` para escritorio,
    `bahia` para táctil) y sus tokens (`--row-h`, `--control-h`, `--plate-pad`,
    `--icon-size`). Nunca escribas alturas ni tamaños fijos a mano. La diferencia entre las dos
    densidades es **obligatoria**: una pantalla que se ve igual en `mostrador` y en `bahia` está
    incompleta.
13. Toda pantalla es **responsive y usable con el dedo**, no solo en escritorio. En concreto:
    - Probala en anchos de **tablet y de teléfono** además de escritorio, y en densidad `bahia`.
      Los puntos de corte son 640 · 768 · 1024 · 1280 · 1536px.
    - **Objetivo táctil mínimo de 44×44** en densidad `bahia` (`--touch-min`): botones, filas
      accionables, iconos de acción, casillas y pestañas. Un icono de 20px vive dentro de un área
      de 44px.
    - **Nada depende de `hover` para funcionar.** En la bahía se usa con el dedo y no hay puntero:
      si una acción, un dato o una pista solo aparece al pasar el mouse, en tablet no existe. El
      `hover` refina; nunca revela.
    - **Las tablas colapsan** a una forma usable en pantalla chica —la pila de láminas numeradas de
      `DESIGN.md`—, nunca a scroll horizontal a ciegas con columnas escondidas fuera de pantalla.
14. Ningún estado se comunica solo con color: siempre lo acompaña una palabra, una trama o un peso
    tipográfico. Lo bloqueado o fuera de servicio lleva la trama diagonal de 45°, nunca opacidad
    reducida.
15. **Nada de mayúsculas forzadas.** El sistema no usa `uppercase` en ningún lugar: ni etiquetas de
    campo, ni cabeceras de columna, ni pestañas, ni botones, ni sellos. El texto va en caja normal;
    lo que necesita destacar destaca con peso o con color.
16. Los iconos son de `lucide-react`, con trazo de 1.5px y tamaño tomado de `--icon-size`. Nada de
    emoji como iconografía.

## Flujo de trabajo

1. No implementes ninguna pantalla sin una spec aprobada en `specs/`.
2. Seguí las tareas de la spec en orden y marcá cada checkbox al terminarla.
3. Terminado = compila (`pnpm --filter @elite/web build`) + `pnpm lint` limpio + criterios de
   aceptación de la spec cumplidos + pantalla verificada en ancho de tablet y en densidad `bahia`.
4. Si cambiás una convención, actualizá este archivo en el mismo commit.

## No hacer

- No pongas lógica de negocio ni llamadas al API dentro de `src/app/`.
- No dupliques schemas de validación: si el backend ya valida algo, el schema va en
  `@elite/shared` y se importa desde acá.
- No edites a mano los componentes de `src/components/ui/` salvo para adaptarlos al proyecto
  de forma deliberada; los genera shadcn.
- No agregues archivos CSS sueltos ni estilos en línea si Tailwind ya lo cubre.
- No introduzcas ninguna de las fuentes prohibidas que lista `DESIGN.md` (Inter, DM Sans, Space
  Grotesk, IBM Plex, Poppins, Outfit ni Plus Jakarta Sans). La familia del sistema es **Atkinson
  Hyperlegible Next**, con **Atkinson Hyperlegible Mono** solo para cadenas de máquina (VIN,
  número de parte, folio, código de
  error).
- No crees archivos de ESLint, Prettier ni `.gitignore` dentro de `apps/web/`: viven en la raíz.
- No crees pantallas, rutas ni módulos "por adelantado", sin spec aprobada.
