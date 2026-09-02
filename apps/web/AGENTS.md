# @elite/web

Frontend de Elite Service: Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui. Consume
`@elite/api` y comparte tipos y schemas Zod con `@elite/shared`. El `dev` corre con **Turbopack**;
el `build`, con webpack.

`DESIGN.md` (esta misma carpeta) es la **fuente de verdad visual**. Si el código y ese documento
discrepan, se arregla en el mismo commit: o se corrige el código o se actualiza el documento.

## Comandos

Desde la raíz del monorepo (o dentro de `apps/web/` sin el `--filter`):

```bash
pnpm --filter @elite/shared build     # requerido antes del primer dev/build
pnpm --filter @elite/web dev          # http://localhost:3100
pnpm --filter @elite/web build
pnpm --filter @elite/web start
npx shadcn@latest add <componente>    # ejecutar dentro de apps/web/
```

El `dev` escribe en `.next-dev` y el `build` en `.next` (`distDir` por fase en `next.config.ts`), así
que pueden correr a la vez sin pisarse. Para resetear el dev, la carpeta que se borra es `.next-dev`.
`next-env.d.ts` no se versiona: Next lo regenera en cada arranque apuntando a la carpeta de turno.

El `.env` canónico vive en la **raíz** del monorepo (plantilla `.env.example`); `next.config.ts` lo
carga solo. Si falta, `src/lib/api.ts` cae a `http://localhost:3200/api`. Nunca pongas secretos en
variables `NEXT_PUBLIC_*`: se exponen al navegador.

## Estructura

```
apps/web/
├── DESIGN.md                # sistema de diseño
├── components.json          # shadcn/ui (new-york, neutral)
└── src/
    ├── app/                 # SOLO rutas, layouts y páginas
    │   ├── globals.css      # @import tailwindcss + TODOS los tokens del sistema
    │   └── layout.tsx       # layout raíz (lang="es") + Providers
    ├── features/<module>/   # un módulo de negocio por carpeta
    │   ├── components/      # UI propia del módulo
    │   ├── hooks/           # useXxxQuery / useXxxMutation (TanStack Query)
    │   └── api.ts           # llamadas al API del módulo, sobre apiFetch
    ├── components/
    │   ├── app-shell/       # riel agrupado (nav-items), ScreenHeader (rastro + título +
    │   │                    # acciones), PageBreadcrumb, guard, use-nav-counts
    │   ├── brand/           # logo.tsx — la marca, en un solo archivo
    │   ├── toast-provider.tsx  # useToast(), montado en app/layout.tsx
    │   └── ui/              # shadcn + piezas propias: data-table (LA lista),
    │                        # reference (#14), stamp (el chip), plate-chip, tabs,
    │                        # stat-card, segment-gauge, empty-state, toast,
    │                        # table (pieza cruda, solo la referencia de diseño)
    └── lib/                 # api.ts (apiFetch + ApiError), query-client.tsx, utils.ts (cn)
```

## Convenciones

1. Textos visibles de la UI en español; todo lo demás en inglés (regla global 1). Archivos en
   kebab-case (`work-order-form.tsx`), componentes en PascalCase.
2. Antes de crear un componente, buscá si shadcn/ui ya lo tiene y agregalo con
   `npx shadcn@latest add <nombre>`. No reescribas a mano lo que genera el CLI.
3. Pedí datos del servidor SIEMPRE con TanStack Query desde un hook en `features/<module>/hooks/`,
   nunca con `fetch` suelto dentro de un componente.
4. Toda petición pasa por `apiFetch` de `@/lib/api`, para que los errores lleguen normalizados como
   `ApiError { code, message, details? }`.
5. Formularios con `react-hook-form` + `zodResolver`, sobre los schemas Zod de `@elite/shared`.
6. `src/app/` es capa de rutas: la página importa de `features/` y no lleva lógica de negocio. Si
   agregás un **módulo**, registralo en `components/app-shell/nav-items.ts`, dentro del grupo que
   le toca: de ahí salen el riel y el rastro de ficha, que se deriva solo (los ancestros de la ruta
   que son destinos del riel). Una **subpantalla** de un módulo —`/carwash/new`, `/carwash/[id]`—
   no se registra en ningún lado: hereda el rastro de su padre.
7. Estilos con utilidades de Tailwind y `cn()`, siempre sobre los tokens del sistema
   (`bg-surface`, `bg-surface-2`, `text-text-dim`, `text-text-faint`, `border-line`,
   `shadow-elite`, `rounded-card`, …). Los tokens se definen **una sola vez** en
   `src/app/globals.css`: ningún componente escribe un color, radio, sombra ni duración literal.
   Un hex, un `rgb()` o un `oklch()` fuera de `globals.css` es un defecto — los SVG usan
   `currentColor` o `var(--token)`.
8. Claro y oscuro son **ambos de primera clase**, y el sistema arranca en **oscuro**: todo token
   existe en `:root` (que es el tema oscuro) y `.light` solo redefine valores. Ningún color puede
   existir únicamente en uno de los dos. El riel es azul marino en los dos temas.
9. Las densidades se manejan con `data-density` (`mostrador` escritorio, `bahia` táctil) y sus
   tokens (`--row-h`, `--control-h`, `--plate-pad`, `--icon-size`). Nunca escribas alturas ni
   tamaños fijos a mano.
10. Toda pantalla es responsive y usable con el dedo:
    - Probala en teléfono y tablet además de escritorio, y en densidad `bahia`. Los dos cortes
      propios del sistema son **900px** (`md`: el riel se muda al pie, las listas se apilan, el
      título baja a 30px, los diálogos suben desde abajo) y **1180px** (`xl`: las rejillas anchas se
      aflojan). Se prueba además a 390px. Los demás cortes de Tailwind quedan en su valor por
      defecto.
    - **Objetivo táctil mínimo 44×44** en `bahia` (`--touch-min`): botones, filas accionables,
      iconos, casillas y pestañas. Un icono de 20px vive dentro de un área de 44px.
    - **Nada depende de `hover` para funcionar.** En la bahía no hay puntero: el `hover` refina,
      nunca revela.
    - Las tablas colapsan a la pila de láminas numeradas de `DESIGN.md`, nunca a scroll horizontal
      con columnas escondidas. Eso lo hace `<DataTable>` (convención 13), no cada pantalla.
11. Ningún estado se comunica solo con color: siempre lo acompaña una palabra, un peso tipográfico
    o la regla de anulación (`.is-ruled-out`), que va sobre el dato que dejó de valer — nunca sobre
    la fila entera, nunca opacidad reducida.
12. **Nada de mayúsculas forzadas** en ningún lugar: ni etiquetas, ni cabeceras, ni pestañas, ni
    botones, ni sellos. Lo que destaca, destaca con peso o con color. Iconos de `lucide-react`,
    trazo 1.5px y tamaño de `--icon-size`; nada de emoji como iconografía.
13. **Una sola tabla para todas las pantallas.** Toda lista de filas se arma con `<DataTable>`
    (`components/ui/data-table.tsx`) y toda pantalla abre con `<ScreenHeader title="…">`, que es la
    cabecera **entera**: rastro de ficha, título, `subtitle` opcional y las acciones como
    `children`. Ninguna pantalla escribe un `<h1 className="text-display">` a mano ni monta su
    propio `<header>` —tampoco en el respaldo de «sin permiso»—, o la cabecera salta de sitio al
    cambiar de pestaña. Nunca una
    tabla a mano con `<Table>`/`<TableRow>`: esa es la pieza cruda de debajo, y la única excepción
    es la referencia de diseño. Se declaran **columnas**, no marcado:

    ```tsx
    <DataTable
      rows={employees.data ?? []}
      rowKey={(employee) => employee.id}
      isLoading={employees.isPending}
      errorMessage={employees.error?.message ?? null}
      emptyMessage="Todavía no hay empleados. Creá el primero con «Nuevo empleado»."
      columns={[
        { key: 'name', header: 'Nombre', stack: 'title', cell: (e) => e.fullName },
        { key: 'status', header: 'Estado', stack: 'aside', cell: (e) => <Stamp … /> },
        { key: 'actions', header: 'Acciones', stack: 'actions', cell: (e) => <Button …/> },
      ]}
    />
    ```

    De ahí salen las dos formas: **filas-tarjeta** en escritorio (≥900px, con su cabecera de
    columnas encima) y la misma tarjeta apilada en táctil (<900px). **Ya no hay `<table>`**: cada
    fila es un `<article>` en rejilla CSS. `ui/table.tsx` sigue existiendo como pieza cruda, y su
    único uso legítimo es la referencia de diseño.
    Lo que pone la lista sola y ninguna pantalla repite:

    - La **tarjeta** —filete `--line-soft`, radio 12px, fondo `--surface`, la sombra única— viene
      puesta. Ninguna pantalla la envuelve a mano ni la omite.
    - La **primera columna es el número de referencia**. No se declara; se pasa `reference` solo si
      el objeto tiene folio propio (un lavado, una orden).
    - El **estado de la lista** es siempre el mismo en todas partes: `Cargando…` mientras carga, un
      `<EmptyState>` con `emptyTitle` (por defecto «Nada por aquí todavía»), `emptyMessage` y el
      `emptyAction` opcional si no hay nada, o el `message` del `ApiError` en `--danger-text` si
      falló.
    - Las **acciones van visibles**, con la columna rotulada «Acciones». Nunca `sr-only`, nunca
      detrás del `hover`.
    - `stack` dice dónde cae cada columna en la lámina táctil: `title` el dato que nombra la fila,
      `aside` el sello junto a la referencia, `actions` los verbos al pie, `field` baja rotulado.
      Ninguna columna se pierde.

    El orden es siempre **Ref. · el dato que nombra la fila · el resto · Estado · Acciones**. Si una
    pantalla necesita algo que `<DataTable>` no hace, se agrega **al componente**, no a la pantalla.

    **La única excepción es la pista (`/floor`)**, que nunca ve una tabla: se usa de pie, con
    guantes y en tablet, así que su fila del día son láminas grandes (`FloorQueue`). Está decidido
    en `DESIGN.md`, no es un atajo.

14. **Permisos por clave, nunca por nombre de rol.** La sesión y los permisos efectivos salen de
    `features/auth/hooks/use-session.ts` y `use-permissions.ts`; para mostrar u ocultar se usa
    `<RequirePermission permission="users.manage">` o `usePermissions().can()`. Ese componente
    **oculta**, no deshabilita: deshabilitado dice «no ahora», ausente dice «esto no es tuyo». Lo
    que el usuario puede ver pero no editar se muestra como **texto plano sin caja**, nunca como un
    control muerto. Los permisos se resuelven contra la base en cada request, así que una mutación
    que pueda cambiarlos invalida también `SESSION_QUERY_KEY`.
15. **Toasts solo para confirmar mutaciones que salieron bien.** `useToast()` de
    `components/toast-provider.tsx` es **aditivo**: confirma lo que salió bien —cobrado, guardado,
    creado, marcado listo, reabierto, anulado— cuando la pantalla no puede mostrarlo sola. **Los
    errores se imprimen donde ocurren**, con `role=alert`: el `message` del `ApiError` al pie del
    formulario y `details` marcando los campos uno por uno. Un error nunca se duplica en un toast.

## No hacer

- No pongas lógica de negocio ni llamadas al API dentro de `src/app/`.
- No dupliques schemas de validación: si el backend ya valida algo, el schema va en `@elite/shared`
  y se importa desde acá.
- No edites a mano los componentes de `src/components/ui/` salvo para adaptarlos al proyecto de
  forma deliberada; los genera shadcn.
- No agregues archivos CSS sueltos ni estilos en línea si Tailwind ya lo cubre.
- No cambies las tres voces tipográficas sin un ADR nuevo. Son **Saira** en itálica para la marca
  (`font-display`: título de pantalla, cifras, total grande, wordmark), **Inter** para la interfaz
  (`font-sans`, cuerpo 14.5px) y la **mono del sistema** —`ui-monospace, SFMono-Regular, Menlo,
Consolas, monospace`, sin descargar nada— para placas, referencias `#14`, códigos y montos. El
  porqué está en el ADR-011 de `docs/ARCHITECTURE.md`.
- No dibujes el logo a mano ni metas un SVG suelto: la marca vive en `components/brand/logo.tsx` y
  en ningún otro sitio. **El vectorial original del taller sigue pendiente**; lo que hay es una
  reconstrucción del prototipo, y cuando llegue el archivo se cambia solo ese componente.
