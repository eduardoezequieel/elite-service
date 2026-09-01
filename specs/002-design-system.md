# 002 — Sistema de diseño (tokens, tipografía y densidad)

**Estado:** Terminada
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
  regla de anulación sobre el dato anulado y un texto que explica el motivo, y **no** se comunica con opacidad reducida.
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
- **RN-5:** Ningún estado se comunica solo con color: siempre acompaña palabra, regla de anulación o peso.
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
   - Escala de radio suave: `--radius: 8px`, con `sm 6px`, `md 8px`, `lg 12px` y `xl 16px`.
   - Tokens del relleno suave (`--tint-fill`, `--tint-line`) y la utilidad `.tint`.
   - Un único token de sombra `--shadow-pop`.
   - Tokens de movimiento (`--ease-standard`, `--duration-state`, `--duration-enter`) y bloque
     `@media (prefers-reduced-motion: reduce)`.
   - Tokens de densidad (`--row-h`, `--control-h`, `--plate-pad`, `--balloon-size`, `--icon-size`)
     con sus dos juegos de valores bajo `[data-density="mostrador"]` y `[data-density="bahia"]`.
   - Utilidad de regla de anulación (`.is-ruled-out`).
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
6. **`src/components/ui/reference.tsx`** — el número de referencia, componente firma del
   sistema. No lo provee shadcn. *(Se construyó primero como `balloon.tsx`, un globo numerado;
   ver «Segunda ronda de ajuste», punto 3.)*
7. **`src/components/ui/stamp.tsx`** — el sello de estado: pill de relleno suave, con el propio
   tono al 10% de fondo, al 25% en el filete y el tono pleno como texto.
8. **`src/app/page.tsx`** — se reemplaza el contenido actual por una **página de referencia del
   sistema** (no de negocio): la paleta en ambos temas, la escala tipográfica, las dos densidades y
   las primitivas anteriores, para poder verificar el sistema a ojo. Vive en `/` mientras no exista
   la primera pantalla real; cuando exista, se mueve a `/design` o se elimina.

**El logo queda pendiente.** No existe archivo original. Se deja un espacio reservado del tamaño
correcto en la cabecera del riel, marcado como provisional en el código. Pedir el SVG al taller es
un pendiente bloqueante para producción, y se resuelve fuera de esta spec.

## Ajuste posterior a la primera entrega

Con el sistema ya construido, el usuario lo revisó y pidió tres cambios. Se aplicaron sobre el
mismo alcance de esta spec, y `DESIGN.md` quedó actualizado en el mismo commit:

1. **Menos mayúsculas.** El rol Label dejó de ser 11px con tracking y MAYÚSCULAS; ahora es 12px,
   peso 600 y caja normal. Ningún componente fuerza mayúsculas: ni etiquetas, ni cabeceras de
   columna, ni botones, ni sellos.
2. **Esquinas suaves.** El radio pasó de «casi recto» (2/3/4px) a 6/8/12/16px, con los sellos y
   badges en pill. La tarjeta sigue siendo plana: lo que el sistema rechaza es la sombra, no el
   radio.
3. **Relleno suave en los sellos, badges y el botón de eliminar.** En vez de filete sobre fondo
   transparente, ahora llevan el propio tono al 10% de fondo y al 25% en el filete, con el texto en
   el tono pleno. Los cinco tonos del tema claro se oscurecieron para que el texto siga dando
   ≥4.5:1 **sobre su propio tinte**: el peor caso quedó en 4.62:1 en claro y 4.68:1 en oscuro.

De paso, el botón primario bajó de un rojo oscuro (`oklch(0.52 0.19 32)`) a un naranja de marca
menos pesado (`oklch(0.57 0.185 36)`, blanco encima a 4.87:1), y el secundario dejó de ser
contorno vacío para pasar a relleno neutro suave.

## Segunda ronda de ajuste

El usuario volvió a revisar el sistema y rechazó tres cosas más. Igual que la primera vez, se
aplicaron sobre el mismo alcance de esta spec y `DESIGN.md` y su sidecar quedaron actualizados en el
mismo commit.

1. **El tema claro dejó de ser papel cálido.** El usuario dijo que el modo claro «hace que parezca un
   diseño hecho por Claude», y tenía razón: fondo crema más acento rojo-anaranjado es justo el
   cliché que la propia guía de diseño marca como estética por defecto de la IA. Los neutros del
   tema claro pasaron del matiz 85 (cálido) al **matiz 250**, el mismo del tema oscuro: Papel
   `oklch(0.955 0.006 250)`, Lámina y Popover `oklch(0.99 0.003 250)`, Lavado / Muted / Accent
   `oklch(0.925 0.006 250)`, `--sidebar` `oklch(0.955 0.006 250)` y `--sidebar-accent`
   `oklch(0.925 0.006 250)`. Claro y oscuro dejaron de ser dos paletas y pasaron a ser el mismo
   documento con dos luces. El resto del tema claro no cambió y el tema oscuro no cambió en nada.

   **Efecto colateral medido y corregido.** Con el fondo más oscuro (L 0.977 → 0.955), el texto de
   los sellos sobre su propio tinte al 10% caía a 4.35:1 sobre papel, bajo el mínimo de 4.5. Los
   cinco tonos del tema claro se bajaron al punto más claro que vuelve a pasar:
   `--stamp-amber: oklch(0.505 0.125 68)`, `--stamp-green: oklch(0.485 0.125 150)`,
   `--stamp-red: oklch(0.52 0.19 25)`, `--stamp-blue: oklch(0.495 0.13 245)`
   (`--stamp-neutral` no cambió). Con ellos se movieron `--destructive` —que sigue valiendo lo mismo
   que el sello rojo— y `--chart-2/3/4`. Peor caso resultante: **4.56:1 sobre papel** y **5.03:1
   sobre lámina** en claro; en oscuro sigue en 4.68:1 sobre plancha.

2. **Cambió la tipografía.** Salieron **Archivo** y **JetBrains Mono**; entraron **Atkinson
   Hyperlegible Next** (cuerpo e interfaz, variable 200–800) y **Atkinson Hyperlegible Mono** (solo
   cadenas de máquina: VIN, número de parte, folio, código de error). La razón es de producto, no
   estética: la dibujó el Braille Institute para que las letras que se confunden entre sí no se
   confundan, y el contexto de uso es una bahía de taller con mala luz, mirada de reojo y pantalla
   sucia. La mono es de la misma familia, así que el VIN y el folio hablan con la misma voz. Las dos
   se cargan con `next/font/google` y llevan `adjustFontFallback: false` con una pila de respaldo
   declarada a mano, porque Next no trae métricas de respaldo para esta familia.

3. **Se fue el globo de referencia.** El usuario no quiso los números encerrados en círculo.
   `ui/balloon.tsx` **se eliminó** y lo reemplaza `ui/reference.tsx`: el número con almohadilla
   (`#14`), en la mono del sistema, `text-dense` (13px) con `tabular-nums`, en `--muted-foreground`
   en reposo y `--brand` cuando está activo. Sin círculo, sin filete, sin pulso y sin tamaño por
   densidad; los tokens `--balloon-size` y `--spacing-balloon` se eliminaron de `globals.css`. Lo
   que sobrevive es **La Regla del Mismo Número**, que es lo valioso; lo que se fue es el adorno, y
   con él el único componente decorativo que tenía el sistema.

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
- [x] Añadir la utilidad de regla de anulación (`.is-ruled-out`). Reemplazó a la trama diagonal de
      45° original: tapaba el dato que hay que leer para resolver el bloqueo (ver `DESIGN.md` →
      Shapes y spec 001 → Verificación).
- [x] Cargar Archivo y JetBrains Mono con `next/font/google` y enlazarlas en `@theme inline`.
- [x] Instalar `next-themes` y crear `theme-provider.tsx`; montarlo en `layout.tsx` junto a
      `Providers`, sin parpadeo de tema.
- [x] Crear `density-provider.tsx` y aplicar `data-density` en el contenedor raíz.
- [x] Agregar las primitivas de shadcn/ui listadas y ajustarlas al sistema (altura por densidad,
      radio 3px, sin sombra, anillo de foco en Naranja Elite).
- [x] Crear `ui/reference.tsx` con sus dos estados: reposo y activo.
- [x] Crear `ui/stamp.tsx` con los cinco sellos.
- [x] Reemplazar `src/app/page.tsx` por la página de referencia del sistema.
- [x] Verificar contrastes: texto principal ≥ 7:1 y secundario/sellos ≥ 4.5:1 en ambos temas.
- [x] Verificar objetivos táctiles ≥ 44×44 en densidad `bahia`. Verificado sobre el CSS generado: `[data-density=bahia]` fija `--control-h: 48px` y `.h-control`/`.size-control` lo consumen, así que todo botón, campo y control de icono mide 48px de alto en bahía.
- [x] Correr `node <skill>/scripts/detect.mjs --json apps/web/src` y resolver lo mecánico.
- [x] `pnpm build`, `pnpm lint` y `pnpm test` limpios.
- [x] Actualizar `apps/web/AGENTS.md` con la convención de tokens y densidad en el mismo commit.
