---
name: Elite Service
description: Azul marino de taller y la llama del logo — la marca del carwash, no un panel genérico.
colors:
  bg: '#070E1C'
  surface: '#0B1730'
  surface-2: '#101E3C'
  surface-3: '#152747'
  line: '#1E3358'
  line-soft: '#182B4C'
  rail: '#050A15'
  plate-bg: '#0E1B33'
  text: '#EAF0FA'
  text-dim: '#8FA4C6'
  text-faint: '#7387AC'
  flame: '#F04E23'
  flame-hot: '#F58220'
  flame-deep: '#C4161C'
  flame-text: '#F58220'
  go: '#2FBF7C'
  go-text: '#2FBF7C'
  danger: '#A8232B'
  danger-text: '#F08089'
  warn: '#E5A64B'
  warn-text: '#E5A64B'
  rail-text: '#E6EDF9'
  rail-dim: '#A8B6CE'
  rail-faint: '#7C8CAB'
  light-bg: '#EEF1F6'
  light-surface: '#FFFFFF'
  light-surface-2: '#F6F8FC'
  light-surface-3: '#E6EBF3'
  light-line: '#D9E0EC'
  light-line-soft: '#E6EBF3'
  light-rail: '#0B1730'
  light-plate-bg: '#F1F4FA'
  light-text: '#0B1730'
  light-text-dim: '#4E5D77'
  light-text-faint: '#626C80'
  light-flame-text: '#A8480C'
  light-go-text: '#0F6B41'
  light-danger-text: '#A8232B'
  light-warn-text: '#8A5510'
gradients:
  action: 'linear-gradient(100deg, #F58220, #F04E23 55%, #C4161C)'
  rail-active: 'linear-gradient(180deg, #F58220, #C4161C)'
tint:
  fill: '12%'
  line: '40%'
shadow:
  elite-dark: '0 18px 40px -24px rgba(0,0,0,.9)'
  elite-light: '0 14px 30px -22px rgba(11,23,48,.5)'
  flame: '0 8px 22px -12px rgba(240,78,35,.9)'
typography:
  display:
    fontFamily: 'Saira, Arial Narrow, system-ui, sans-serif'
    fontStyle: 'italic'
    fontSize: '38px'
    fontSizeCompact: '30px'
    fontWeight: 800
    lineHeight: '0.95'
    letterSpacing: '-0.01em'
  figure:
    fontFamily: 'Saira, Arial Narrow, system-ui, sans-serif'
    fontStyle: 'italic'
    fontSize: '30px'
    fontWeight: 700
    lineHeight: '1.1'
    letterSpacing: '-0.01em'
  headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '21px'
    fontWeight: 600
    lineHeight: '27px'
    letterSpacing: '-0.01em'
  title:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '17px'
    fontWeight: 600
    lineHeight: '23px'
    letterSpacing: '-0.005em'
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '14.5px'
    fontWeight: 400
    lineHeight: '21px'
  dense:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '12.5px'
    fontWeight: 400
    lineHeight: '18px'
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '12px'
    fontWeight: 600
    lineHeight: '16px'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: '13.5px'
    fontWeight: 700
    letterSpacing: '0.06em'
rounded:
  sm: '6px'
  control: '10px'
  row: '12px'
  card: '14px'
  pill: '999px'
breakpoints:
  compact: '900px'
  wide: '1180px'
density:
  mostrador:
    row: '36px'
    control: '40px'
    touch: '36px'
    plate: '16px'
    icon: '16px'
  bahia:
    row: '56px'
    control: '48px'
    touch: '44px'
    plate: '20px'
    icon: '20px'
---

# Sistema de diseño: Elite Service

> **`src/app/globals.css` es la implementación y gana siempre.** Este documento describe el
> sistema; el CSS lo baja a código. Si los dos discrepan, se corrige el documento en el mismo
> commit. La fuente de verdad visual de la que salen los dos es el prototipo aprobado en
> `docs/prototype/elite-service-prototipo.html`. La spec que lo bajó es `specs/005-visual-redesign.md`.
>
> **Ningún componente escribe un color, un radio, una sombra ni una duración.** Todo sale de un
> token. Un hex fuera de `globals.css` es un defecto.

## North star: la marca del taller

Elite Service es un carwash, y su marca ya existe: **azul marino** profundo, una **llama** de
naranja a rojo, el **arco segmentado** de un medidor y una **itálica ancha** en el wordmark. El
sistema no inventa una estética: la toma de ahí y la extiende a cada pantalla.

Las cuatro cosas que hacen que una pantalla se reconozca como de Elite Service:

1. **El azul marino.** No es un gris azulado: es marino de verdad, oscuro y saturado. El fondo de la
   app, las tarjetas y los campos son tres escalones del mismo azul.
2. **La llama, y solo donde manda.** El degradado naranja-rojo aparece en el botón primario, en la
   pestaña activa, en el ítem activo del menú y en el arco del medidor. Nada más. Es señal, no
   relleno.
3. **La itálica ancha.** Saira en itálica es la voz de la marca. Se usa en el título de cada
   pantalla, en las cifras del día, en el total grande y en el wordmark. En ningún otro sitio.
4. **El arco del medidor.** El gesto que el sistema anterior prohibía y que acá es la firma: un arco
   partido en tirones cortos, con el tramo recorrido en la llama. Solo para «X de Y», nunca de
   adorno.

**Los dos temas son de primera clase.** Oscuro es el que trae el sistema al abrirse —el mostrador
suele estar bajo techo y el marino descansa la vista—; claro existe entero, con los mismos tokens
redefinidos, y está pensado para la bahía a plena luz. **El riel es azul marino en los dos**: es la
pieza que dice de quién es el sistema, y esa no cambia con la luz.

**Lo que este sistema rechaza:** el panel de administración genérico —fondo gris, acento azul,
tarjetas blandas con sombra suave por todos lados—, el neón, el glassmorphism, la fibra de carbono y
los degradados como superficie. El único degradado que existe es el de la llama, y ocupa franjas de
tres píxeles y botones, no fondos.

## Colores

### Superficies

| Token         | Oscuro    | Claro     | Para qué                                      |
| ------------- | --------- | --------- | --------------------------------------------- |
| `--bg`        | `#070E1C` | `#EEF1F6` | El fondo de la aplicación                     |
| `--surface`   | `#0B1730` | `#FFFFFF` | Tarjetas y filas: lo que se apoya en el fondo |
| `--surface-2` | `#101E3C` | `#F6F8FC` | Campos, hover de fila, seleccionables         |
| `--surface-3` | `#152747` | `#E6EBF3` | Superficie elevada extra                      |
| `--line`      | `#1E3358` | `#D9E0EC` | Filete visible: campos, chips, separaciones   |
| `--line-soft` | `#182B4C` | `#E6EBF3` | Filete suave: el borde de una tarjeta         |
| `--rail`      | `#050A15` | `#0B1730` | El menú lateral. **Marino en los dos temas**  |
| `--plate-bg`  | `#0E1B33` | `#F1F4FA` | El fondo del chip de placa                    |

### Texto

| Token          | Oscuro    | Claro     | Contraste sobre `--surface` | Para qué                       |
| -------------- | --------- | --------- | --------------------------- | ------------------------------ |
| `--text`       | `#EAF0FA` | `#0B1730` | 15.55:1 · 17.80:1           | Todo el texto principal        |
| `--text-dim`   | `#8FA4C6` | `#4E5D77` | 7.03:1 · 6.65:1             | Texto secundario, subtítulos   |
| `--text-faint` | `#7387AC` | `#626C80` | **4.91:1 · 5.28:1**         | Rótulos, referencias, unidades |

`--text-faint` **no** es el valor del prototipo. Ahí era `#63779A` en oscuro y `#7E8BA3` en claro, y
daban 3.93:1 y 3.44:1 sobre su superficie: por debajo del mínimo AA para texto normal. Los dos se
subieron hasta pasar 4.5:1 y no más arriba, para que sigan leyéndose como tenues. El mínimo manda
sobre el prototipo.

En el riel, que es marino en los dos temas, el texto tiene sus propios tres tonos y no cambia:
`--rail-text` `#E6EDF9` (16.8:1 / 15.1:1), `--rail-dim` `#A8B6CE` (9.7:1 / 8.7:1) y `--rail-faint`
`#7C8CAB` (5.8:1 / 5.3:1), medidos sobre el riel oscuro y sobre el claro.

### La llama

| Token          | Valor                              | Para qué                                                   |
| -------------- | ---------------------------------- | ---------------------------------------------------------- |
| `--flame`      | `#F04E23`                          | El naranja de la marca: acción, ítem activo, borde elegido |
| `--flame-hot`  | `#F58220`                          | El extremo claro del degradado, y el **anillo de foco**    |
| `--flame-deep` | `#C4161C`                          | El extremo oscuro del degradado                            |
| `--flame-text` | `#F58220` oscuro · `#A8480C` claro | La llama **cuando es texto**                               |

`--gradient-action` es `linear-gradient(100deg, --flame-hot, --flame 55%, --flame-deep)`. Aparece
en: el botón primario, el subrayado de la pestaña activa, la barra de 3px del ítem activo del riel y
el arco del medidor. En ningún otro lado.

**La llama no es color de texto por defecto.** Cuando hace falta que lo sea —el chip «Abierto», un
precio que se sale del base— se usa `--flame-text`, que en tema claro baja a `#A8480C` (5.84:1 sobre
blanco) porque `#F58220` sobre blanco da 2.2:1 y no se puede leer.

### El semáforo

| Token           | Oscuro    | Claro     | Contraste (surface / su tinte) | Para qué                      |
| --------------- | --------- | --------- | ------------------------------ | ----------------------------- |
| `--go`          | `#2FBF7C` | `#2FBF7C` | relleno y filete               | **Solo** «Listo» y «Cobrado»  |
| `--go-text`     | `#2FBF7C` | `#0F6B41` | 7.52 / 6.22 · 6.56 / 5.47      | El verde cuando es texto      |
| `--danger`      | `#A8232B` | `#A8232B` | blanco encima: **7.14:1**      | Error, destructivo, «Anulado» |
| `--danger-text` | `#F08089` | `#A8232B` | 6.91 / 5.83 · 7.14 / 5.86      | El rojo cuando es texto       |
| `--warn`        | `#E5A64B` | `#E5A64B` | relleno y filete               | Advertencia                   |
| `--warn-text`   | `#E5A64B` | `#8A5510` | 8.38 / 6.91 · 6.20 / 5.23      | El ámbar cuando es texto      |

**Cómo se derivó `--danger`.** Parte de `--flame-deep` `#C4161C` y se baja en luminosidad y en
saturación hasta `#A8232B`. Las dos cosas hacen falta: más oscuro para que el blanco encima pase
holgado (7.14:1), y menos saturado para que **no se confunda a ojo con el naranja de acción**. Un
error y un botón «Guardar» no pueden parecerse; con `#C4161C` puesto al lado de `#F04E23` se
parecían. El mismo valor sirve en los dos temas porque es relleno, no texto: el texto lo pone
`--danger-text`, que en oscuro sube a un rojo claro `#F08089` y en claro se queda en el propio
`#A8232B`.

**Cómo se derivó `--warn`.** Es `--flame-hot` `#F58220` desaturado y aclarado hasta `#E5A64B`, para
que se lea como ámbar de advertencia y no como una segunda llama. En claro, el texto baja a
`#8A5510`.

Las cifras de «su tinte» son el texto del chip medido sobre el chip ya compuesto —el propio tono al
12% sobre la superficie—, que es el fondo contra el que se lee de verdad, no la superficie desnuda.
El peor caso del sistema es 4.51:1 (`--text-faint` claro sobre su tinte); todos los demás pasan con
margen.

**La excepción declarada.** El texto blanco sobre el degradado de acción da **5.33:1** en el extremo
`--flame-deep`, **3.61:1** en el punto medio `--flame` y 2.6:1 en `--flame-hot`. Está por debajo de
AA para texto normal en la mitad clara del botón. Es la dirección aprobada del prototipo y se
mantiene, con dos mitigaciones: el texto del botón va en **peso 600** y el botón nunca lleva texto
de menos de 13px. Si algún día se revisa, la salida es girar el degradado para que el arranque sea
`--flame` y no `--flame-hot`.

### Reglas de uso

**La regla de la llama que no rellena.** El naranja-rojo marca acción, no zona. Nada de cabeceras
naranjas, bandas de color ni fondos de marca. Su rareza es lo que lo vuelve legible como señal.

**La regla del verde reservado.** `--go` significa **listo o cobrado**, nada más. No es «correcto»,
no es «activo», no es «guardado».

**La regla del rojo que no es la llama.** El rojo de error **no** es el naranja de acción. Son dos
tokens distintos a propósito.

**La regla del color que no basta.** Ningún estado se comunica solo con color: el chip lleva
siempre la palabra escrita, lo anulado lleva su regla, lo urgente lleva peso. El sistema tiene que
poder operarse en escala de grises.

**La regla del token único.** Todo color existe en `:root` (oscuro) y se redefine en `.light`.
Ninguno vive en un solo tema.

## Tipografía

Tres voces, ni una más:

- **Display — Saira, itálica.** `--font-display`. Títulos de pantalla (38px, 30px bajo 900px,
  `line-height` .95), cifras de estadística, total grande, valor del medidor y wordmark. Es el gesto
  del logo: **siempre en itálica**, nunca en redonda.
- **Interfaz — Inter.** `--font-sans`, pesos 400/500/600/700. Cuerpo 14.5px. Todo lo demás.
- **Datos — la mono del sistema.** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
  Placas, referencias `#14`, códigos `SRV-0001` y montos en listas. **No se descarga**: es la del
  sistema operativo.

Las dos primeras se cargan con `next/font/google` desde `src/app/layout.tsx`, con `display: 'swap'`.
Next las autoaloja en el build, así que en producción no hay ninguna petición a una CDN externa.
El porqué del cambio está en el **ADR-011** de `docs/ARCHITECTURE.md`.

### Escala

| Utilidad        | Familia           | Tamaño / interlínea      | Para qué                        |
| --------------- | ----------------- | ------------------------ | ------------------------------- |
| `text-display`  | Saira itálica 800 | 38px / .95 (30px <900px) | El título de la pantalla        |
| `text-figure`   | Saira itálica 700 | 30px / 1.1               | Cifras del día, total grande    |
| `text-headline` | Inter 600         | 21px / 27px              | Título de diálogo               |
| `text-title`    | Inter 600         | 17px / 23px              | Título de una sección o tarjeta |
| `text-body`     | Inter 400         | 14.5px / 21px            | El texto por defecto            |
| `text-dense`    | Inter 400         | 12.5px / 18px            | Segunda línea, notas, chips     |
| `text-label`    | Inter 600         | 12px / 16px              | Cabeceras de columna, rótulos   |
| `font-mono`     | mono del sistema  | 13.5px, `.06em`          | Placas, referencias, montos     |

**La regla de la caja normal.** No hay mayúsculas forzadas en ninguna parte: ni etiquetas, ni
cabeceras, ni pestañas, ni botones, ni chips. Nada de `text-transform: uppercase`. **La única
excepción es el wordmark del logo**, donde «ELITE / SERVICE» va escrito en mayúsculas en el propio
texto, no transformado.

**La regla de la cifra tabular.** `tabular-nums` en toda columna de números: placas, cantidades,
dinero, folios, contadores. Una columna que no alinea es un defecto.

## Forma, espacio y sombra

**Radios.** Tres escalones y una píldora:

- `rounded-control` **10px** — botones, campos, elementos de menú.
- `rounded-row` **12px** — filas-tarjeta, avisos, estados vacíos.
- `rounded-card` **14px** — tarjetas grandes, diálogos, menús desplegables.
- `rounded-full` — chips de estado, badges, el punto del chip.
- `rounded-[6px]` — el chip de placa, que es más chico que todo lo demás.

`rounded-md` / `rounded-lg` / `rounded-xl` apuntan a los mismos 10 / 12 / 14, así que lo escrito
antes cae bien sin tocarlo.

**Bordes.** 1px `--line-soft` en reposo, 1px `--line` en lo que se puede tocar, **1.5px** en los
seleccionables (tarjeta de tipo de vehículo, servicio), y `--flame` cuando están elegidos. La barra
del ítem activo del riel es de 3px; el subrayado de la pestaña activa, 2.5px.

**Espacio.** Padding de tarjeta **22px** (`p-card`). Padding de fila 14px × 18px. Separación entre
filas **10px**. Margen bajo la cabecera de pantalla 24px. El `main` respira 30px × 34px en
escritorio y 22px × 16px en táctil, con 110px al pie para que la barra inferior no tape nada.

**Sombra: una sola.** `shadow-elite` — `0 18px 40px -24px rgba(0,0,0,.9)` en oscuro y
`0 14px 30px -22px rgba(11,23,48,.5)` en claro. La llevan las filas-tarjeta, las tarjetas, los
diálogos, los menús y los avisos. `shadow-pop` es su alias viejo y vale lo mismo. La única sombra
que no es esa es `shadow-flame`, el resplandor bajo del botón primario, que es parte del botón.

**Foco.** Siempre visible: `outline: 2px solid var(--flame-hot); outline-offset: 2px`, puesto una
vez en `:focus-visible` de `globals.css`. **Nunca `outline: none` sin reemplazo.** Ningún componente
escribe clases de anillo.

## Movimiento

Movimiento **solo como respuesta a una acción**: abrir, cerrar, seleccionar, confirmar. Sin
animaciones de entrada por sección, sin transiciones al pasar el mouse por todo, sin parallax.

- Estado (color, borde): `--duration-state` **140ms**.
- Entrada de una capa flotante: `--duration-enter` **180ms**.
- Curva única: `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`.
- El botón primario baja 1px al pulsarse (`active:translate-y-px`). Es la única traslación.
- **La única animación en bucle** es el punto del chip «Abierto»: `elite-pulse`, 1.6s.

`prefers-reduced-motion: reduce` apaga las transiciones, las entradas **y el latido del chip**.

## Cortes y densidades

Dos cortes propios, además de los de Tailwind:

- **1180px** (`xl`) — el resumen del alta deja de ser fijo, la franja de estadísticas pasa a dos
  columnas.
- **900px** (`md`) — el riel se muda al pie como barra fija, las listas se apilan en tarjetas, el
  título baja de 38px a 30px y los diálogos suben desde abajo.
- Se prueba a **390px**. Ahí todo lo tocable mide ≥44px y el botón principal de cada tarjeta va a
  todo el ancho.

Las **dos densidades siguen vigentes y son obligatorias**. Un atributo `data-density` en el `<html>`
conmuta cinco tokens; una pantalla que se ve igual en las dos está incompleta.

| Token         | `mostrador` (escritorio) | `bahia` (táctil) |
| ------------- | ------------------------ | ---------------- |
| `--row-h`     | 36px                     | 56px             |
| `--control-h` | 40px                     | 48px             |
| `--touch-min` | 36px                     | 44px             |
| `--plate-pad` | 16px                     | 20px             |
| `--icon-size` | 16px                     | 20px             |

`bahia` se activa sola bajo **900px** de ancho o con puntero grueso (`pointer: coarse`), y el
usuario puede fijarla a mano. La pista (`/floor`) la fuerza siempre.

## Componentes

### Botón

Radio 10px, alto `--control-h`, texto en caja normal peso 600.

- **`default`** — el degradado de llama con texto blanco y `shadow-flame`. Hover: `brightness(1.1)`.
  Es el único primario, y hay **uno por pantalla**.
- **`outline` / `secondary`** — el fantasma: `--surface-2` con filete `--line`, que pasa a `--flame`
  al pasar el mouse. Son la misma piel a propósito: dos nombres que ya existían para un solo gesto.
- **`destructive`** — peligro en relleno suave (`.tint` sobre `--danger-text`). Es el de la fila.
- **`destructiveSolid`** — `--danger` lleno con texto blanco. **Solo dentro del diálogo de
  confirmación**, nunca en una fila.
- **`ghost`** — sin fondo ni filete, texto `--text-dim`. Barras de herramientas e iconos.
- **`link`** — texto con subrayado al pasar.

Estados: reposo · hover · activo (baja 1px) · foco (el anillo global) · deshabilitado (opacidad,
sin puntero) · **cargando** (`loading`: spinner centrado, botón deshabilitado y **el ancho no
cambia**, porque el texto sigue ahí ocupando su sitio).

### Campo de texto

`--surface-2` de fondo, filete `--line`, radio 10px, alto `--control-h`, padding lateral 14px. La
etiqueta va encima, 13px peso 600 en el color del texto principal. En foco el filete pasa a
`--flame`. Con `aria-invalid` pasa a `--danger` y el mensaje va debajo en `--danger-text`, 12.5px.
Lo que se puede ver pero no editar se muestra como **texto plano sin caja**, nunca como un control
muerto.

### Chip de estado (`Stamp`)

Píldora con **punto de color + palabra**, relleno suave derivado de `currentColor` con `.tint`: el
tono al 12% de fondo, al 40% en el filete y pleno como texto. `label` es obligatorio: es imposible
renderizar un chip mudo.

| Tono               | Color           | Cuándo                                     |
| ------------------ | --------------- | ------------------------------------------ |
| `queue`            | `--text-dim`    | En cola                                    |
| `washing`          | `--flame-text`  | Lavando — **el punto late**                |
| `ready`            | `--go-text`     | Listo para cobrar                          |
| `paid`             | `--text-faint`  | Cobrado: cerrado en bien, así que se apaga |
| `void`             | `--danger-text` | Anulado                                    |
| `neutral` / `blue` | `--text-dim`    | Activo / Inactivo y los informativos       |
| `amber`            | `--warn-text`   | Requiere atención                          |
| `green`            | `--go-text`     | Aprobado                                   |
| `red`              | `--danger-text` | Rechazado, detenido                        |

El mapa de un lavado: `OPEN` → «Abierto» (`washing`), `READY` → «Listo» (`ready`), `PAID` →
«Cobrado» (`paid`), `VOID` → «Anulado» (`void`). Las palabras no cambian nunca.

### Chip de placa

Mono, peso 700, `letter-spacing: .06em`, fondo `--plate-bg`, filete `--line`, radio 6px. Tres
tamaños: `sm` en un sitio apretado, `md` en una fila, `lg` en el título de un detalle. Se usa **en
todos** los sitios donde aparece una placa.

### Fila de lista (`DataTable`)

**Una sola lista para todas las pantallas**, y ya no es una `<table>`.

- **≥900px:** una cabecera de columnas tenue (12px, peso 600, `--text-faint`) y debajo cada fila
  como una tarjeta propia en rejilla CSS: fondo `--surface`, filete `--line-soft`, radio 12,
  padding 14×18, la sombra única, 10px entre filas. Hover: filete `--line` y fondo `--surface-2`.
- **<900px:** la cabecera se oculta y la misma tarjeta se apila — la referencia y el chip arriba, el
  dato que nombra la fila debajo, el resto rotulado y las acciones al pie **a todo el ancho**.
- La **primera columna es siempre el número de referencia**; no se declara.
- El **estado de la lista** es una sola línea en el mismo sitio: `Cargando…`, el estado vacío, o el
  `message` del error en `--danger-text`.
- Las **acciones van visibles**, con su columna rotulada «Acciones». Nunca detrás del `hover`.

**La excepción es la pista (`/floor`)**, que nunca ve una lista: se usa de pie y con guantes, así
que su fila del día son láminas grandes (`FloorQueue`).

### Pestañas

`role=tablist` de verdad, navegable con flechas. Texto `--text-faint` en reposo, `--text` elegida, y
un subrayado de 2.5px con el degradado de acción. Contador tenue al lado del nombre. Alto mínimo
`--touch-min`.

### Tarjeta de estadística y medidor

La tarjeta lleva el rótulo tenue arriba y la cifra en Saira itálica debajo, con la unidad chica al
lado. `tone="go"` pinta la cifra en verde, y se reserva para «listos» y «cobrado».

El **medidor de segmentos** es el arco del logo: `M10 50a38 38 0 0 1 76 0`, pista en `--line` con
`stroke-dasharray: 5 4.5`, tramo recorrido con el degradado y `pathLength=100`, valor encima en
Saira. Lleva su lectura en el `aria-label` («Cobrados: 11 de 18»). **Solo para «X de Y»**, nunca
para tiempo ni para adornar. Sin animación de entrada.

### Estado vacío

Borde punteado `--line`, radio 12, fondo `--surface`. Un título que nombra el vacío, una frase que
dice **qué va a aparecer acá**, y el botón que lo llena si el usuario puede. Nunca «No hay datos» a
secas y nunca una ilustración.

### Aviso flotante (toast)

**Aditivo y solo para el bien**: confirma una mutación que salió bien —cobrado, guardado, creado,
marcado listo, reabierto, anulado— cuando la pantalla no puede mostrarlo sola. Verde `--go` con
icono para éxito, `--danger` con icono para error; **siempre con la palabra**, nunca solo el color.

**Los errores siguen imprimiéndose donde ocurren**, con `role=alert`, al pie del formulario o de la
acción. No se duplican en un aviso.

Abajo a la derecha en escritorio; arriba y centrado en móvil, por encima de la barra inferior. Se va
solo a los 5 segundos y respeta `prefers-reduced-motion`.

### Diálogo

Radio 14, filete `--line-soft`, fondo `--surface`, la sombra única. Cabecera y pie separados por
filete; el cuerpo hace scroll solo. **Bajo 900px sube desde abajo** como una hoja pegada al pie, sin
redondear las esquinas inferiores.

### Menú lateral y barra inferior

**Azul marino en los dos temas.** Arriba el logo, en medio los grupos con su rótulo tenue, al pie el
usuario y el cambio de tema.

- **Ítem activo:** tres señales a la vez — barra de llama de 3px pegada al borde izquierdo (degradado
  vertical), fondo `--flame` al 14% y texto blanco. Nunca solo el color.
- **Contador** a la derecha del nombre, y **solo si es mayor que cero**: un cero en un globo decora,
  no informa. Hoy solo «Lavados» tiene uno, y la consulta ni siquiera sale sin `carwash.read`.
- **Por permiso:** una pestaña para la que el usuario no tiene el permiso **no se renderiza**.
  Oculta no es lo mismo que deshabilitada: deshabilitado dice «no ahora», ausente dice «esto no es
  tuyo».
- **Plegado** a 68px: quedan los iconos, con el nombre en `title` y para el lector de pantalla.
- **Bajo 900px** se convierte en barra inferior fija con icono + etiqueta corta, la barra de llama
  arriba y `env(safe-area-inset-bottom)` respetado.

### Enlace de regreso

Dentro de la cabecera de pantalla, pegado **encima** del título: flecha a la izquierda (`ChevronLeft`)
y el nombre de la pantalla padre. En `text-dense` sobre `--text-dim`, a `--text` al apuntarlo, con
área tocable de `--touch-min`. Una pantalla de primer nivel no dibuja nada: el riel ya dice dónde
estás.

**Nombra solo al padre, no la cadena.** El árbol del sistema tiene un nivel de hondura —las cuatro
pantallas de `Configuración` cuelgan de un rótulo, no de una pantalla—, así que un rastro de migas
prometía una jerarquía que no existe y se reducía siempre a una miga de 12px que nadie veía.

**Va al padre, no atrás.** Nunca `router.back()`: el historial miente cuando se llega por enlace
directo, tras una recarga o después de un `router.replace`. La ruta no.

Se deriva de las raíces conocidas, no de un mapa aparte: las pestañas del riel más la pista, que se
declara a mano porque no tiene riel del que derivarla.

### El número de referencia — componente firma

`#14`, en la mono del sistema, con almohadilla y `tabular-nums`. Sin círculo, sin filete, sin fondo.
En reposo va en `--text-faint`; activo, en `--flame-text`.

**La regla del mismo número.** Un objeto tiene un número y solo uno, igual en todas las pantallas
donde aparezca. Si dos pantallas numeran lo mismo distinto, una de las dos está mal.

### Logo

`components/brand/logo.tsx`, con dos variantes: `mark` (el arco con la aguja) y `full` (el arco más
el wordmark «ELITE / SERVICE» en Saira itálica 800, con «SERVICE» abierto a `.22em`). El degradado
del arco se define con `<linearGradient>` sobre `var(--flame-*)`: respeta el tema y no escribe
ningún color propio.

> **Sigue pendiente el vectorial original del taller.** Lo que hay es una reconstrucción a partir
> del prototipo aprobado. Cuando llegue el archivo se reemplaza en **ese solo componente** y ninguna
> pantalla se toca. Pedirlo sigue siendo un pendiente bloqueante para lanzar.

## Accesibilidad

- **Contraste AA (4.5:1)** en texto normal, verificado token por token en los dos temas, y medido
  para el texto de cada chip **sobre su propio tinte**. La única excepción declarada es el texto del
  botón primario sobre la mitad clara del degradado (ver arriba).
- **El estado nunca se comunica solo con color.** El chip lleva la palabra; el ítem activo del riel
  lleva barra, fondo y peso; lo anulado lleva su regla.
- **Regla de anulación (`.is-ruled-out`).** Lo bloqueado o dado de baja se marca **en positivo**: una
  línea de 1px en `--line` sobre **el dato que dejó de valer**, con `skip-ink: none`, más el texto
  que dice por qué, al lado y sin raya. Nunca sobre la fila entera y **nunca bajando la opacidad**:
  un gris apagado es indistinguible de un fallo de carga.
- **Oculto ≠ deshabilitado.** Lo que el usuario no puede ver, no se renderiza. Lo que puede ver pero
  no editar se muestra como texto plano sin caja.
- **Nada depende de `hover`.** En la bahía no hay puntero: el hover refina, nunca revela.
- Todo lo interactivo se alcanza con Tab y se activa con Enter o Espacio. Los grupos de opciones
  —tipo de vehículo, método de pago— son `role=radiogroup` de verdad, navegables con flechas.
- `prefers-reduced-motion: reduce` apaga el latido y las transiciones.

## Do's and Don'ts

### Do

- **Do** sacar todo color, radio, sombra y duración de un token de `globals.css`.
- **Do** reservar la llama para la acción principal, la pestaña activa, el ítem activo del riel y el
  dato que se sale del valor base.
- **Do** poner el número de referencia en todo objeto listable, y el mismo en todas las pantallas.
- **Do** usar `tabular-nums` en toda columna de números y la mono en toda placa, código y monto.
- **Do** escribir el estado con palabra **y** color.
- **Do** entregar cada pantalla verificada en escritorio, en tablet, a 390px y en densidad `bahia`.
- **Do** marcar lo anulado con la regla sobre el dato, y decir por qué al lado, sin raya.
- **Do** definir cada color en `:root` y redefinir solo los valores en `.light`.
- **Do** dejar que `DataTable`, `ScreenHeader` y `EmptyState` pongan la piel: la pantalla declara
  datos, no marcado.

### Don't

- **Don't** escribir un hex, un `rgb()` ni un `oklch()` fuera de `globals.css`.
- **Don't** usar el degradado de acción como superficie: son franjas y botones, no fondos.
- **Don't** poner más de un botón primario por pantalla.
- **Don't** usar `--go` para nada que no sea «listo» o «cobrado», ni pintar un error con el naranja
  de acción.
- **Don't** poner texto en mayúsculas forzadas en ningún lugar. La única excepción es el wordmark.
- **Don't** esconder una acción, un dato o una pista detrás del `hover`.
- **Don't** deshabilitar bajando la opacidad de un dato, ni tapar con una marca de estado un dato
  que hay que leer para resolver ese estado.
- **Don't** comunicar un estado solo con color.
- **Don't** animar por gusto: ninguna entrada por sección, ninguna animación en bucle salvo el
  latido del chip.
- **Don't** condicionar nada por nombre de rol. Toda variación de UI se decide contra una clave
  `module.action`.
- **Don't** usar emoji como iconografía: los iconos son de `lucide-react`, trazo 1.5px, tamaño
  `--icon-size`.
- **Don't** escribir una lista a mano: si `DataTable` no hace algo, se le agrega **al componente**.
