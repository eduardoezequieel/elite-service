# Tarea: prototipo HTML de combobox propio — Elite Service

Sos Claude Opus 5. Escribí UN archivo y nada más:

`docs/prototype/combobox.html`

No toques React, no crees spec, no edites `apps/`, no toques otros prototipos.

El archivo tiene que abrir en el navegador sin build, sin Next, sin Nest. HTML + CSS + JS nativo. Interactividad real: abrir, filtrar, elegir con mouse y teclado, cerrar, conmutar tema y densidad.

## Por qué existe

Hoy el front mete un `<select>` nativo adentro de `<FieldBox>` (la caja de campo con etiqueta adentro). Se ve en:

- `apps/web/src/features/customers/components/vehicle-dialog.tsx` — campo **Tipo**
- `apps/web/src/features/catalog/components/catalog-screen.tsx` — campo **Categoría**

El nativo queda desalineado contra el `Input` hermano: flecha del browser, padding interno, alto distinto, lista con cromo del SO. El dueño quiere **nuestro** componente, igual que el selector de fecha (`docs/prototype/date-picker.html` → `date-field.tsx`).

Hay un segundo gesto que también es combobox: el nombre del cliente en el alta de lavado (`customer-field.tsx`) — se escribe y aparecen sugerencias tocables. El prototipo cubre los dos modos con la misma pieza.

## Antes de escribir, leé (completos)

1. `apps/web/DESIGN.md` — ley visual
2. `apps/web/src/app/globals.css` — tokens actuales (NO copies sombras viejas del date-picker)
3. `docs/prototype/date-picker.html` — el formato del prototipo (topbar, switches, FieldBox, panel)
4. `apps/web/src/components/ui/field-box.tsx`
5. `apps/web/src/components/ui/input.tsx`
6. Los dos `<select>` citados arriba
7. `apps/web/src/features/carwash/components/customer-field.tsx` — el typeahead

## Formato del archivo

Mismo chasis que `date-picker.html`:

- `<html lang="es" data-theme="dark" data-density="mostrador">`
- Fuentes Google: Saira (600/700/800 itálica) + Inter (400/500/600/700)
- Bloque de tokens **copiado de `globals.css` de hoy**, no del date-picker. En particular:
  - `--shadow: none` (diseño plano)
  - `--shadow-dialog` sí existe, **solo** para el mock de diálogo modal
  - El panel del combobox es plano: `bg: var(--surface)`, `border: var(--line-soft)`, **sin sombra**
  - Radios: `--radius-sm: 6px`, `--radius-control: 10px`, `--radius-row: 12px`, `--radius-card: 14px`
  - Densidades `mostrador` / `bahia` con `--row-h`, `--control-h`, `--touch-min`, `--icon-size`, `--field-px/pt/pb`
  - Tema claro via `[data-theme="light"]` redefiniendo valores, ningún color nace solo en un tema
- Topbar con título en Saira itálica, subtítulo, y dos segmentos: Oscuro/Claro y Mostrador/Bahía
- `prefers-reduced-motion` apaga animaciones
- Corte 900px (`899.98px`) como en el sistema
- Cero hex / rgb / oklch fuera del bloque de tokens
- Cero `text-transform: uppercase`
- Cero emoji como iconografía. SVG lucide, stroke 1.5, tamaño `--icon-size`
- Textos de UI en español. Identificadores JS en inglés
- Nada depende de `hover` para funcionar

## Qué tiene que haber en la página (secciones)

### 1. Alineación — el problema y la pieza

Una grilla de 2 columnas (≥900px; apilada debajo):

- Columna A, rotulada **Hoy (nativo)**: un `FieldBox` con label «Tipo» y un `<select>` nativo, al lado de un `FieldBox` con `input` «Placa». Esto es el defecto: el select no calza con el input.
- Columna B, rotulada **El nuestro**: los mismos dos campos, pero el tipo es el combobox propio. **Cerrado, el combobox y el input tienen que medir exactamente igual**: mismo alto de caja, misma etiqueta (12.5px / 500 / `--text-dim`), mismo valor (14.5px Inter / `--text`), mismo padding `--field-*`. La única diferencia es el cheurón a la derecha (`--text-faint`, `--icon-size`).

Si en bahía o en claro se desalinean, el prototipo está mal.

### 2. Diálogo «Nuevo carro» (el uso real)

Mock de `Dialog` (usa `--shadow-dialog`, radio `--radius-card`, overlay). Adentro, el formulario real:

- Placa (input, mono, placeholder `P123-456`)
- Tipo (combobox, opciones: Sedán, Camioneta, Moto; placeholder «Elegí el tipo»)
- Marca (input)
- Color (input)

En escritorio, 2 columnas. El panel del combobox **no puede recortarse** por el `overflow` del diálogo: posicionarlo `fixed` anclado al trigger (portal). Mismo ancho que la caja. 8px de gap. Si no cabe abajo, se da vuelta arriba. Si no cabe de ningún lado, va al lado con más aire y scrollea adentro.

Bajo 900px el diálogo ya es hoja desde abajo (como `dialog.tsx`). El listado del combobox sigue anclado al campo, `max-height` acotado al viewport, scroll interno. No conviertas el combobox en otra hoja: no es un calendario.

Pie del diálogo: Cancelar (outline) + Guardar (primario, degradado llama). Guardar apagado mientras falte placa o tipo.

### 3. Combobox con búsqueda (cliente)

Campo «Nombre» que se escribe. Desde 1 carácter filtra. Sugerencias:

| Nombre | Teléfono |
| Juan Pérez | 7777-8888 |
| Juana Ramírez | 7012-3344 |
| Pedro Juanes | 6234-1100 |
| María López | 7890-1122 |
| José Martínez | 6555-0101 |

Cada fila: nombre a la izquierda (truncate), teléfono mono a la derecha en `--text-faint`. Alto mínimo `--touch-min`. Si no hay match: renglón «Sin coincidencias» (no una caja vacía). Enter con texto libre cierra y deja lo escrito (cliente nuevo). Escape cierra. Elegir una fila llena el nombre y un campo Teléfono hermano.

### 4. Estados, en una sola fila de demos

- Placeholder (nada elegido)
- Elegido (tilde en la opción, valor en la caja)
- Inválido (`aria-invalid`, filete `--danger`, mensaje debajo en `--danger-text`, 12.5px, fuera de la caja)
- Deshabilitado (opacidad de la caja, no se abre)
- Lista larga (20 categorías de lavado) con scroll interno, `max-height` ~ 240px
- Lista vacía

### 5. Notas al pie

4–6 bullets de las reglas del gesto, en `--text-dim`. Nada de prosa de diseño.

## Comportamiento (ley)

**Cerrado (select y combobox):**

- Es un `FieldBox`. Label adentro, arriba. Valor o placeholder abajo. Cheurón a la derecha.
- Clic en la caja (no solo en el cheurón) abre.
- Foco: filete `--flame` + anillo de 2px `--flame-hot` **alrededor de la caja**, no del control interno.
- Abierto: `aria-expanded="true"`, cheurón rotado 180°.

**Abierto:**

- `role="listbox"`; el trigger es `role="combobox"` con `aria-controls` + `aria-activedescendant`.
- Opciones `role="option"`, `aria-selected`.
- La elegida lleva **tilde** (svg check) a la derecha + peso 700 + fondo `--surface-2`. Nunca solo color.
- Hover/foco de opción: fondo `--surface-2`. El activo de teclado se ve igual sin mouse.
- Click afuera, Escape, o elegir: cierra y devuelve el foco al trigger.
- Flechas arriba/abajo mueven el activo; Enter elige; Home/End extremos.
- En modo búsqueda, escribir filtra (sin acento, case-insensitive). Las flechas siguen funcionando con el filtro aplicado.
- Typeahead en modo select (sin campo de filtro): teclear letras salta a la opción que matchea, como un select de verdad.

**Táctil:**

- Toda opción ≥ `--touch-min` (44px en bahía).
- Nada que solo aparezca en hover.

**A11y:**

- Un tab entra al combobox. El listado no son tabs extra: se navega con flechas.
- `aria-invalid` y el mensaje con `role="alert"`.

## Nunca

- `<select>` en la pieza nueva (sí en la columna «Hoy», para mostrar el defecto)
- shadcn, Radix, cmdk, React, Tailwind CDN
- Hex fuera de tokens
- Sombra en el panel del combobox
- `--gradient-action` pintando una opción
- Texto de UI en inglés
- Un popup más ancho o más angosto que el trigger (el listado = ancho de la caja)
- Recortar el listado contra el diálogo

## Listo cuando

1. `docs/prototype/combobox.html` existe y abre solo.
2. Oscuro/claro y mostrador/bahía conmutan de verdad.
3. En la sección 1, cerrado, combobox e input calzan a ojo (etiqueta y valor en la misma línea).
4. En el diálogo, el listado no se recorta y se alinea al borde izquierdo de la caja.
5. Teclado completo: flechas, Enter, Escape, typeahead, Tab.
6. 390px y 1280px usables.

Cuando termines, no expliques el oficio. Decí la ruta del archivo y tres cosas que el dueño tiene que mirar a ojo.
