# 002 — Sistema de diseño (tokens, tipografía y densidad)

**Estado:** En desarrollo
**Módulo:** web (transversal) | **Depende de:** —

## Contexto

`apps/web/DESIGN.md` define la línea de diseño de Elite Service («El Catálogo de Piezas», con modo
claro = papel impreso y modo oscuro = microficha). Hoy `globals.css` todavía trae los tokens de
fábrica de shadcn/ui (neutral, radio `0.625rem`), que contradicen ese documento. Esta spec baja el
sistema a código **sin crear ninguna pantalla de negocio**: solo tokens, fuentes, densidad,
conmutador de tema y las primitivas base de shadcn realineadas.

**La spec 001 depende de esta.** Sus pantallas (`/login`, `/settings/users`, `/settings/roles`) se
construyen sobre lo que aquí se define, así que 002 se termina primero.

## Historias

- Como cualquier usuario autenticado, quiero que el sistema se vea igual de legible en el mostrador
  y en la bahía, para no depender de la luz del lugar donde estoy.
- Como cualquier usuario, quiero elegir tema claro u oscuro y que se recuerde, para trabajar cómodo
  en mi puesto.
- Como mecánico con tablet, quiero controles grandes y filas altas, para tocar bien con guantes.
- Como desarrollador, quiero un único juego de tokens y densidades, para no inventar valores al
  construir cada módulo.

## Criterios de aceptación

- **Dado** el sistema en tema claro, **cuando** inspecciono `:root`, **entonces** cada token de
  color existe con el valor OKLCH exacto del frontmatter de `DESIGN.md`, y ningún color está
  definido únicamente dentro de `.dark`.
- **Dado** el sistema en cualquier tema, **cuando** mido el contraste de texto principal contra su
  superficie, **entonces** es ≥ 7:1; el texto secundario y los sellos de estado son ≥ 4.5:1.
- **Dado** un usuario sin preferencia guardada, **cuando** abre la aplicación, **entonces** el tema
  sigue a `prefers-color-scheme`; **cuando** elige uno explícitamente, **entonces** persiste entre
  recargas y no produce parpadeo de tema en la primera pintura.
- **Dado** un viewport ≥ 768px con puntero fino, **cuando** se renderiza la aplicación,
  **entonces** `data-density="mostrador"` y los controles miden 32px de alto.
- **Dado** un viewport < 768px o `pointer: coarse`, **cuando** se renderiza la aplicación,
  **entonces** `data-density="bahia"`, los controles miden 48px y ningún objetivo interactivo es
  menor a 44×44.
- **Dado** cualquier tabla del sistema, **cuando** contiene una columna numérica, **entonces**
  aplica `font-variant-numeric: tabular-nums` y alinea a la derecha.
- **Dado** un elemento bloqueado o fuera de servicio, **cuando** se renderiza, **entonces** lleva la
  trama diagonal de 45° y un texto que explica el motivo, y **no** se comunica con opacidad reducida.
- **Dado** cualquier elemento en reposo que no sea una capa flotante, **cuando** inspecciono su
  estilo, **entonces** su `box-shadow` es `none`.
- **Dado** un usuario que navega con teclado, **cuando** enfoca cualquier control, **entonces** ve
  el anillo de 1.5px en Naranja Elite con 2px de separación.
- **Dado** `prefers-reduced-motion: reduce`, **cuando** ocurre cualquier transición del sistema,
  **entonces** su duración es 0.
- **Dado** el sistema construido, **cuando** corro `node <skill>/scripts/detect.mjs --json
  apps/web/src`, **entonces** no reporta hallazgos mecánicos sin resolver.

## Reglas de negocio

- **RN-1:** `apps/web/DESIGN.md` es la fuente de verdad. Si el código y el documento discrepan,
  se corrige el código o se actualiza el documento en el mismo commit — nunca se dejan divergentes.
- **RN-2:** Los tokens se definen una sola vez en `globals.css`. Ningún componente escribe un color,
  radio, sombra o duración literal.
- **RN-3:** Claro y oscuro son ambos de primera clase. Todo token existe en `:root`; `.dark` solo
  redefine valores.
- **RN-4:** El Naranja Elite nunca se usa como color de texto ni como fondo de una región grande
  (techo del 5% de la pantalla).
- **RN-5:** Ningún estado se comunica solo con color: siempre acompaña palabra, trama o peso.
- **RN-6:** Esta spec no introduce permisos, endpoints ni modelo de datos.

## Permisos

Ninguno. Esta spec no introduce claves `module.action`.

## Datos

Ninguno. No hay cambios de schema.

## API

Ninguno. No hay endpoints.

## UI

Alcance exacto de lo que se construye:

1. **`src/app/globals.css`** — reemplazo del bloque de tokens de fábrica por el sistema de
   `DESIGN.md`:
   - Colores de `:root` y `.dark` mapeados a los nombres que ya consume shadcn/ui (`--background`,
     `--card`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--ring`,
     `--destructive`, `--chart-*`, `--sidebar-*`) más los propios del sistema (`--brand`,
     `--rule`, `--stamp-amber`, `--stamp-green`, `--stamp-red`, `--stamp-blue`).
   - `--radius: 3px`.
   - Un único token de sombra `--shadow-pop`.
   - Tokens de movimiento (`--ease-standard`, `--duration-state`, `--duration-enter`) y bloque
     `@media (prefers-reduced-motion: reduce)`.
   - Tokens de densidad (`--row-h`, `--control-h`, `--plate-pad`, `--balloon-size`, `--icon-size`)
     con sus dos juegos de valores bajo `[data-density="mostrador"]` y `[data-density="bahia"]`.
   - Utilidad de trama de bloqueo.
2. **Fuentes** — `Archivo` (variable) y `JetBrains Mono` cargadas con `next/font/google` desde
   `src/app/layout.tsx`, expuestas como variables CSS y enlazadas en `@theme inline`.
3. **`src/components/theme-provider.tsx` + conmutador** — tema `system | light | dark`, persistido
   en `localStorage`, aplicado antes de la primera pintura para evitar parpadeo. Se usa
   `next-themes` (dependencia nueva; ver *Tareas*).
4. **`src/components/density-provider.tsx`** — resuelve `mostrador` / `bahia` a partir de viewport y
   `pointer: coarse`, permite fijarlo manualmente y escribe `data-density` en el contenedor raíz.
5. **Primitivas base de shadcn/ui** realineadas al sistema: `button`, `input`, `label`, `table`,
   `badge`, `card`, `separator`, `dropdown-menu`, `dialog`. Se generan con
   `npx shadcn@latest add <nombre>` y se ajustan solo donde el sistema difiere del preajuste
   (alturas por densidad, radio, ausencia de sombra, anillo de foco).
6. **`src/components/ui/balloon.tsx`** — el globo de referencia numerado, componente firma del
   sistema. No lo provee shadcn.
7. **`src/components/ui/stamp.tsx`** — el sello de estado (texto + filete, sin relleno).
8. **`src/app/page.tsx`** — se reemplaza el contenido actual por una **página de referencia del
   sistema** (no de negocio): la paleta en ambos temas, la escala tipográfica, las dos densidades y
   las primitivas anteriores, para poder verificar el sistema a ojo. Vive en `/` mientras no exista
   la primera pantalla real; cuando exista, se mueve a `/design` o se elimina.

**El logo queda pendiente.** No existe archivo original. Se deja un espacio reservado del tamaño
correcto en la cabecera del riel, marcado como provisional en el código. Pedir el SVG al taller es
un pendiente bloqueante para producción, y se resuelve fuera de esta spec.

## Fuera de alcance

- El riel de pestañas tabuladas como navegación real: depende de que existan módulos y permisos
  (spec 001). Aquí solo se definen sus tokens.
- Cualquier pantalla de negocio: clientes, vehículos, órdenes de trabajo, inventario, facturación.
- Auth, sesión y el condicionado por permiso `module.action` (spec 001).
- El logo definitivo y cualquier trabajo de identidad de marca.
- Iconografía propia: se usa `lucide-react` tal cual.

## Tareas

- [x] Registrar en `docs/ARCHITECTURE.md` el ADR de la dependencia nueva `next-themes` y de la
      elección de fuentes (Archivo + JetBrains Mono).
- [x] Reescribir el bloque de tokens de `src/app/globals.css` con los valores OKLCH exactos del
      frontmatter de `DESIGN.md`, en `:root` y `.dark`.
- [x] Añadir `--radius: 3px`, `--shadow-pop`, tokens de movimiento y el bloque de
      `prefers-reduced-motion`.
- [x] Añadir los tokens de densidad y sus dos juegos de valores por `data-density`.
- [x] Añadir la utilidad de trama de bloqueo a 45°.
- [x] Cargar Archivo y JetBrains Mono con `next/font/google` y enlazarlas en `@theme inline`.
- [x] Instalar `next-themes` y crear `theme-provider.tsx`; montarlo en `layout.tsx` junto a
      `Providers`, sin parpadeo de tema.
- [x] Crear `density-provider.tsx` y aplicar `data-density` en el contenedor raíz.
- [x] Agregar las primitivas de shadcn/ui listadas y ajustarlas al sistema (altura por densidad,
      radio 3px, sin sombra, anillo de foco en Naranja Elite).
- [x] Crear `ui/balloon.tsx` con sus estados: reposo, activo y pulso de referencia cruzada.
- [x] Crear `ui/stamp.tsx` con los cinco sellos.
- [x] Reemplazar `src/app/page.tsx` por la página de referencia del sistema.
- [x] Verificar contrastes: texto principal ≥ 7:1 y secundario/sellos ≥ 4.5:1 en ambos temas.
- [x] Verificar objetivos táctiles ≥ 44×44 en densidad `bahia`. Verificado sobre el CSS generado: `[data-density=bahia]` fija `--control-h: 48px` y `.h-control`/`.size-control` lo consumen, así que todo botón, campo y control de icono mide 48px de alto en bahía.
- [x] Correr `node <skill>/scripts/detect.mjs --json apps/web/src` y resolver lo mecánico.
- [x] `pnpm build`, `pnpm lint` y `pnpm test` limpios.
- [x] Actualizar `apps/web/AGENTS.md` con la convención de tokens y densidad en el mismo commit.
