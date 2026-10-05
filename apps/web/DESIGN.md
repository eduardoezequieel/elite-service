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
  info-text: '#7FB0FF'
  consume-text: '#D59BF6'
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
  light-info-text: '#1D4ED8'
  light-consume-text: '#8B2FA8'
gradients:
  action: 'linear-gradient(100deg, #F58220, #F04E23 55%, #C4161C)'
  rail-active: 'linear-gradient(180deg, #F58220, #C4161C)'
  bar-active: 'linear-gradient(90deg, #F58220, #C4161C)'
tint:
  fill: '12%'
  line: '40%'
shadow:
  elite-dark: 'none'
  elite-light: 'none'
  flame: 'none'
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
  table: '1100px'
  narrow: '420px'
density:
  mostrador:
    row: '52px'
    control: '40px'
    touch: '36px'
    plate: '16px'
    icon: '16px'
    field-px: '16px'
    field-pt: '8px'
    field-pb: '10px'
    stat-name: '20px'
  bahia:
    row: '56px'
    control: '48px'
    touch: '44px'
    plate: '20px'
    icon: '20px'
    field-px: '18px'
    field-pt: '10px'
    field-pb: '12px'
    stat-name: '25px'
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

| Token           | Oscuro    | Claro     | Contraste (surface / su tinte) | Para qué                               |
| --------------- | --------- | --------- | ------------------------------ | -------------------------------------- |
| `--go`          | `#2FBF7C` | `#2FBF7C` | relleno y filete               | «Listo», «Cobrado», «Activo», «Cuadra» |
| `--go-text`     | `#2FBF7C` | `#0F6B41` | 7.52 / 6.22 · 6.56 / 5.47      | El verde cuando es texto               |
| `--danger`      | `#A8232B` | `#A8232B` | blanco encima: **7.14:1**      | Error, destructivo, «Anulado»          |
| `--danger-text` | `#F08089` | `#A8232B` | 6.91 / 5.83 · 7.14 / 5.86      | El rojo cuando es texto                |
| `--warn`        | `#E5A64B` | `#E5A64B` | relleno y filete               | Advertencia                            |
| `--warn-text`   | `#E5A64B` | `#8A5510` | 8.38 / 6.91 · 6.20 / 5.23      | El ámbar cuando es texto               |
| `--info-text`   | `#7FB0FF` | `#1D4ED8` | 8.10 / 7.33 · 6.70 / 4.93      | Aviso de nota, «Cobrado»               |

`--consume-text` (`#D59BF6` oscuro, `#8B2FA8` claro; ~7.4:1 y ~6.9:1 sobre `--surface`) es el morado
de «Trabajador» y «De cuenta» en las cuentas abiertas (106) y del sello «Consumo» que los consumos
viejos de la 070 conservan en el kardex. No es semáforo; existe para que esos sellos no se confundan
con el ámbar del despacho ni con el azul de la venta. Solo texto, con `.tint` (tono `consume` de
`Stamp`).

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

**La regla del verde.** `--go` significa **listo, cobrado, activo o cuadra**. Marca que un registro está habilitado, encendido o que los números cuadran bien.

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

**Tamaños sueltos (081).** Lo que no es un escalón de arriba es un token de solo tamaño en
`:root` —sin interlínea ni peso— y se pide con `text-(length:--token)`. Nunca `text-[NNpx]`.

| Token                                                  | Valor            | Para qué                                                 |
| ------------------------------------------------------ | ---------------- | -------------------------------------------------------- |
| `--stat-size`                                          | 28px             | Cifra de `StatCard`                                      |
| `--stat-size-wide`                                     | 32px             | La misma cifra desde 640px (`sm`)                        |
| `--stat-size-lg`                                       | 38px             | Cifra de rendimiento en `bahia`                          |
| `--stat-name-size`                                     | 20px / 25px      | Cifra que es un nombre (rendimiento); va con la densidad |
| `--hero-size-lg`                                       | 34px             | Estado grande de la ficha en `bahia`                     |
| `--gauge-size`                                         | 19px             | Valor dentro del medidor de segmentos                    |
| `--lead-size`                                          | 16px             | Título del estado vacío; pestañas y barras en `bahia`    |
| `--group-size`                                         | 13.5px           | Título de un grupo en la bandeja de avisos               |
| `--control-text-size`                                  | 13px             | Rótulo de formulario (`Label`) y selector segmentado     |
| `--meta-size`                                          | 12px             | Fecha y contador en la bandeja de avisos                 |
| `--count-size`                                         | 11.5px           | Contador de un chip de filtro                            |
| `--nav-label-size`                                     | 11px             | Rótulo del ícono en la barra inferior                    |
| `--nav-badge-size`                                     | 10px             | Contador sobre el ícono de la barra inferior             |
| `--plate-size-sm` / `--plate-size` / `--plate-size-lg` | 12 / 13.5 / 16px | Los tres tamaños del chip de placa                       |

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
- `rounded-sm` **6px** — el chip de placa y el esqueleto, que son más chicos que todo lo demás.

Radios de una sola pieza, en `:root` y pedidos con `rounded-(--token)`: `--nav-item-radius` 9px
(ítem del riel), `--segment-radius` 7px (botón del selector segmentado: los 10px de su caja menos
3px de aire), `--check-radius` 5px (casilla), `--bar-radius` 4px (punta de una barra de
rendimiento), `--skeleton-radius` 8px (esqueleto de la cabecera de ficha) y `--active-mark` 3px
(la marca activa). Una raya de 2px de ancho usa `rounded-full`, que ahí da 1px.

`rounded-md` / `rounded-lg` / `rounded-xl` apuntan a los mismos 10 / 12 / 14, así que lo escrito
antes cae bien sin tocarlo.

**Bordes.** 1px `--line-soft` en reposo, 1px `--line` en lo que se puede tocar, **1.5px** en los
seleccionables (`border-(length:--selectable-border)`: tarjeta de tipo de vehículo, servicio,
cliente elegido), y `--flame` cuando están elegidos. La barra del ítem activo del riel y de la barra
inferior es de 3px (`--active-mark`, con el degradado `--gradient-rail-active` vertical o
`--gradient-bar-active` horizontal); el subrayado de la pestaña activa, 2.5px (`--tab-mark`, con
`--gradient-action`).

**Espacio.** Padding de tarjeta **22px** (`p-card`). Padding de fila 14px × 18px (`p-3.5` /
`px-4.5`). Separación entre filas **10px**. Margen bajo la cabecera de pantalla 24px.

**Medidas con nombre (081).** Ningún componente escribe `-[NNpx]`. Una medida con papel propio es
un token de `:root` y se pide con `w-(--token)`, `px-(--token)`, `gap-(--token)`…; una medida de
una sola pieza se escribe con la escala de espaciado de Tailwind (`--spacing` = 4px, en pasos de
0.25, o sea de 1px: `p-3.5` = 14px, `min-w-37.5` = 150px), que da el mismo píxel.

| Token                 | Valor                    | Para qué                                               |
| --------------------- | ------------------------ | ------------------------------------------------------ |
| `--page-max`          | 1440px                   | Ancho máximo del `main` y de las barras de resumen     |
| `--page-px`           | 34px · 16px bajo 900px   | Margen lateral del `main` y de las barras de resumen   |
| `--page-pt`           | 30px · 22px bajo 900px   | Aire arriba del `main`                                 |
| `--page-pb`           | 60px · 110px bajo 900px  | Aire abajo: en táctil, que la barra inferior no tape   |
| `--rail-w`            | 248px                    | Riel abierto                                           |
| `--rail-w-collapsed`  | 68px                     | Riel plegado                                           |
| `--rail-width`        | `--rail-w` / plegado / 0 | Lo que el riel ocupa de verdad (0 bajo 900px)          |
| `--bottom-bar-h`      | 64px                     | Alto que reserva la barra de resumen sobre la inferior |
| `--grid-gap`          | 18px                     | Separación entre bloques de un informe (rendimiento)   |
| `--ref-col-w`         | 72px                     | Columna «Ref.» de `DataTable`                          |
| `--amount-w`          | 140px                    | Un monto en una fila de campos que se parte            |
| `--summary-action-w`  | 152px                    | Botón de la barra de resumen (alta, venta)             |
| `--login-w`           | 380px                    | Formulario de entrada, oficina y pista                 |
| `--selectable-border` | 1.5px                    | Filete de los seleccionables                           |
| `--active-mark`       | 3px                      | Grueso y radio de la marca del ítem activo             |
| `--tab-mark`          | 2.5px                    | Subrayado de la pestaña activa                         |

**Sombra: ninguna (diseño flat).** El sistema no utiliza sombras (`box-shadow: none`).
Tarjetas, filas, diálogos, menús y botones se delimitan mediante sus fondos `--surface` / `--surface-2` y
filetes `--line-soft` / `--line`.

**Foco.** Siempre visible: `outline: 2px solid var(--flame-hot); outline-offset: 2px`, puesto una
vez en `:focus-visible` de `globals.css`. **Nunca `outline: none` sin reemplazo.** Ningún componente
escribe clases de anillo.

## Movimiento

Movimiento **como respuesta a algo que pasó**: abrir, cerrar, seleccionar, confirmar, llegar,
cambiar — y la pantalla que se monta (088). Sin transiciones al pasar el mouse por todo, sin
parallax, sin animar la salida de una pantalla.

- Estado (color, borde): `--duration-state` **140ms**.
- Entrada de una capa flotante: `--duration-enter` **180ms**.
- Curva única: `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`.
- El botón primario baja 1px al pulsarse (`active:translate-y-px`).
- **Entrada en cascada (088):** al montarse, la pantalla aparece en orden de lectura. Cada pieza
  sube `--enter-rise` **8px** y aparece en `--duration-mount` **280ms** (`elite-enter-rise`), un
  paso de `--stagger-step` **35ms** tras otro, con tope de `--enter-steps-max` **16** pasos. La
  llevan solas las piezas del sistema, por su `data-slot`: `ScreenHeader` (paso 0), `StatCard`
  (1–4 por posición), `Card` (desde 2), `EmptyState` (2) y las filas de `DataTable` (desde 4).
  Solo dentro de `main` y del tablero: diálogos, menús y toast tienen su propia entrada. Ninguna
  pantalla escribe una animación suya.
- **Solo entra lo que se inserta.** React no reinserta lo que conserva su `key`, así que un
  re-render por datos no vuelve a mover lo que ya estaba. Otra página u otro filtro sí entran:
  son filas nuevas.
- **Marcas de una sola vez (088):**
  - La fila que **llega** —una o dos nuevas en una lista que sigue mostrando alguna de antes
    (`arrivedKeys`, `lib/motion.ts`)— entra sin esperar su paso y destella en el tinte de la
    llama (`elite-flash`, `--duration-flash` **1.6s**). Una página o un filtro nuevos no
    destellan.
  - El sello que **cambia** de estado a la vista salta (`elite-pop`, `--duration-pop` **420ms**)
    y suelta un anillo de su tono (`--duration-ring` **1.2s**). La cifra de un `StatCard` que
    cambia, igual pero sin anillo. Al montarse no saltan.
  - La campana, cuando **suben** los avisos sin leer, se mece (`elite-bell`, `--duration-bell`
    **700ms**) y el globo salta. Leer no mueve nada.
  - Las marcas van en `data-changed`, que alterna `odd`/`even` para que dos cambios seguidos
    reinicien la animación (`useChangeMark`, `lib/use-motion.ts`).
- **Animaciones en bucle, solo cuatro:** el icono del chip «Lavando» (`elite-pulse`,
  `--duration-pulse` 1.6s), el anillo del punto «en vivo» del cajón de avisos (`elite-ring`, al
  mismo compás, solo con el hilo abierto) y, mientras algo carga (067), la aguja del medidor
  (`elite-sweep`, 1.4s) y el brillo de los esqueletos (`elite-shimmer`, 1.4s).
- La densidad no cambia el movimiento: `mostrador` y `bahia` usan las mismas duraciones.
- **Carga (067):** `GaugeLoader` —el isotipo con la aguja barriendo el arco— donde no hay forma que
  anticipar: pantalla completa (`md`, con la palabra abajo) y campos, diálogos o listas chicas
  (`sm`, en línea). `DetailSkeleton` / `ListSkeleton` donde la forma se conoce: fichas, listas y la
  línea de tiempo; las filas miden `--row-h`, así la pantalla no salta al llegar los datos. Nunca
  «Cargando…» solo en texto, nunca bloquean la pantalla ni esperan un mínimo artificial.
- **La marca de estado** (063) es la única animación grande: al confirmar un cambio de estado que
  salió bien, el estado nuevo aparece en el centro 1200 ms —el anillo del tono se dibuja, el icono
  entra— con la palabra y `#número · placa`, y se va con un fundido. La página sube hasta arriba al mismo tiempo. No bloquea
  (`pointer-events: none`), no se anuncia (el toast ya lo hace) y no se usa para nada más.
  Círculo de 112px y palabra `text-title` en `mostrador`; 160px y `text-figure` en `bahia`.

`prefers-reduced-motion: reduce` apaga las transiciones, las entradas, **la cascada, las marcas
de cambio, el anillo de «en vivo» y el latido del chip**: todo aparece quieto y entero en el
primer cuadro, sin esperar su paso. La aguja del medidor queda quieta a media escala y los
esqueletos, sin brillo. La marca de estado aparece quieta y completa, y se va igual a los 1200 ms.

## Cortes y densidades

Dos cortes propios, además de los de Tailwind:

- **1180px** (`xl`) — el resumen del alta deja de ser fijo, la franja de estadísticas pasa a dos
  columnas.
- **1100px** (`table`, `min-table:` / `max-table:`) — `DataTable` pasa de láminas a tabla; las
  rejillas de rendimiento y las acciones de roles se abren con ella.
- **900px** (`md`) — el riel se muda al pie como barra fija, las listas se apilan en tarjetas, el
  título baja de 38px a 30px y los diálogos suben desde abajo.
- Se prueba a **390px**. Ahí todo lo tocable mide ≥44px y el botón principal de cada tarjeta va a
  todo el ancho.
- **420px** (`narrow`, `max-narrow:`) — la ficha de pista baja sus datos a una columna.

Las **dos densidades siguen vigentes y son obligatorias**. Un atributo `data-density` en el `<html>`
conmuta los tokens de densidad; una pantalla que se ve igual en las dos está incompleta.

| Token              | `mostrador` (escritorio) | `bahia` (táctil) |
| ------------------ | ------------------------ | ---------------- |
| `--row-h`          | 52px                     | 56px             |
| `--control-h`      | 40px                     | 48px             |
| `--touch-min`      | 36px                     | 44px             |
| `--plate-pad`      | 16px                     | 20px             |
| `--icon-size`      | 16px                     | 20px             |
| `--field-px`       | 16px                     | 18px             |
| `--field-pt`       | 8px                      | 10px             |
| `--field-pb`       | 10px                     | 12px             |
| `--stat-name-size` | 20px                     | 25px             |

`bahia` se activa sola bajo **900px** de ancho o con puntero grueso (`pointer: coarse`), y el
usuario puede fijarla a mano. La pista (`/floor`) la fuerza siempre.

## Componentes

### Botón

Radio 10px, alto `--control-h`, padding lateral 20px, texto en caja normal peso 600.

- **`default`** — el degradado de llama con texto blanco. Hover: `brightness(1.1)`.
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

La etiqueta vive **dentro** de la caja, arriba del valor: el aire del campo es el padding, no un
rótulo aparte. Se arma con `<FieldBox>`: fondo `--surface-2`, filete `--line`, radio 10px, padding
`--field-pt` / `--field-px` / `--field-pb`. La etiqueta va en 12.5px peso 500, `--text-dim`. El
valor, en `text-body`. En foco el filete pasa a `--flame` y el anillo de 2px rodea **la caja**. Con
`aria-invalid` el filete pasa a `--danger` y el mensaje va debajo en `--danger-text`, 12.5px, fuera
de la caja. Lo que se puede ver pero no editar se muestra como **texto plano sin caja**, nunca como
un control muerto. Los interruptores y las listas de casillas no usan esta caja.

### Combobox

Lista para elegir. Cerrado es **la misma caja de campo** que un Input: etiqueta adentro, valor y
cheurón a la derecha. El listado es un panel plano (`--surface`, filete `--line-soft`, **sin
sombra**), del mismo ancho que la caja, anclado con 8px de gap; si no cabe abajo se da vuelta, y
si no cabe de ningún lado scrollea adentro. Vive en un portal, para que un diálogo no lo recorte;
dentro de un diálogo ese portal es el contenido del diálogo y el panel se ubica y se da vuelta contra
su marco, porque el bloqueo de scroll del modal no deja desplazar nada que quede afuera (spec 072).
Con `panelAnchor` el ancho y el borde izquierdo los manda **otro elemento** —el bloque entero de
campos— para cuando la caja es una columna demasiado angosta como para leer la opción; a lo ancho
el panel se recorta contra los bordes de la pantalla y nunca se sale (spec 047).

La opción elegida lleva **tilde + peso 700 + `--surface-2`**. La activa de teclado es el mismo
fondo, sin barra. Una opción con `hint` es una **fila alta de dos líneas** —etiqueta entera sin
cortar arriba, el dato de apoyo en `--text-faint` abajo— y una con `kind: 'action'` es una **fila
de acción** («Crear nuevo: «…»»): icono `Plus`, filete arriba que la separa de las opciones, sin
tilde, y el foco lo lleva quien la puso, no vuelve a la caja. Dos modos: lista corta (typeahead al
teclear) y búsqueda (se escribe; Enter sin elegir deja el texto). Prohibido el `<select>` nativo.
Pieza: `components/ui/combobox.tsx`. Maqueta: `docs/prototype/combobox.html`. «A cargo de» en
oficina es este Combobox (un empleado o «Sin asignar»). En pista no se elige: queda quien registra
(spec 035).

**Inventario: entrar y entregar** (091, reemplaza el selector en línea de la 072). Prototipo:
`docs/prototype/inventory-redesign.html`.

- **Registrar entrada** es un **asistente de pasos**: una pregunta por pantalla en `text-headline`,
  con una barra de cinco tramos de 4px arriba (`--flame` lo hecho y el actual, `--line` lo que
  falta; en el teléfono solo se rotula el actual). Tipo (dos tarjetas seleccionables grandes) →
  artículo (buscador + lista flotante agrupada por categoría) → cantidad (el número en
  `text-figure` itálica, 64px de alto, 72px en `bahia`, con `−` `+` y atajos +6 +12 +24) → «¿Cuánto
  te costó?» (opcional) → Revisar. «Atrás» va a la izquierda del pie, en `ghost`.
- **Entrada rápida**: el «+» de la celda Existencia abre debajo de la fila (`renderExpanded`) una
  caja con filete de llama al 45%: cantidad, «Te costó c/u», referencia y «Pasa de A a B».
- **Entregar a empleado**: primero «¿A quién?», un buscador con la **lista flotante de la placa**
  (`--surface-2`, cabecera «N coincidencias» en `--surface-3`, filas `--touch-min` con las iniciales
  en círculo); elegido, se pliega en una línea con «Cambiar». Después el **selector del lavado**
  (085) sobre los insumos, con los chips en dos renglones y cada fila rotulada «Despacho»
  (`--warn-text`) con `.tint`. Un producto no se entrega: se anota a una cuenta abierta (106).
- Un campo que usa Escape para sí (búsqueda escrita, lista abierta) lleva `data-keeps-escape` y el
  diálogo no se cierra (`keepLocalEscape`).

Piezas: `features/inventory/components/entry-wizard.tsx`, `quick-entry-row.tsx`,
`delivery-dialog.tsx`, `delivery-picker.tsx` y `employee-search-field.tsx`.

### Filtros de lista

En las listas, a la derecha del buscador, un botón **Filtros** de la **misma altura** que la
`FieldBox` (se estira en la fila). Abre una tarjeta plana (`--surface`, filete `--line`, radio
`--radius-card`, sin sombra) con Combobox apilados y **Restablecer**. El badge cuenta cuántos no
están en «Todos». El recorte es de las filas ya cargadas: búsqueda, día y pestañas no se tocan.
Pieza: `components/ui/filters-popover.tsx`. Maqueta: `docs/prototype/filters-and-search.html`.

### Chip de estado (`Stamp`)

Píldora con **punto de color + palabra**, relleno suave derivado de `currentColor` con `.tint`: el
tono al 12% de fondo, al 40% en el filete y pleno como texto. `label` es obligatorio: es imposible
renderizar un chip mudo. El punto se reemplaza por un icono de `lucide-react` de 14px cuando el chip
nombra un estado del ciclo de un lavado.

| Tono               | Color            | Cuándo                      |
| ------------------ | ---------------- | --------------------------- |
| `queue`            | `--text-dim`     | En espera                   |
| `washing`          | `--flame-text`   | Lavando — **el icono late** |
| `ready`            | `--go-text`      | Listo para cobrar           |
| `paid`             | `--info-text`    | Cobrado                     |
| `void`             | `--danger-text`  | Anulado                     |
| `neutral` / `blue` | `--text-dim`     | Inactivo y los informativos |
| `amber`            | `--warn-text`    | Requiere atención           |
| `green`            | `--go-text`      | Activo, Cuadra, Aprobado    |
| `red`              | `--danger-text`  | Rechazado, detenido         |
| `consume`          | `--consume-text` | Trabajador, De cuenta (106) |
| `info`             | `--info-text`    | Cliente (106)               |

El mapa de un lavado, con su icono (053). Las palabras no cambian nunca:

| Estado    | Palabra   | Tono      | Icono         | Por qué                     |
| --------- | --------- | --------- | ------------- | --------------------------- |
| `OPEN`    | En espera | `queue`   | `Clock`       | Está en la cola             |
| `WASHING` | Lavando   | `washing` | `Droplets`    | El agua corriendo; **late** |
| `READY`   | Listo     | `ready`   | `CircleCheck` | Terminado, esperando cobro  |
| `PAID`    | Cobrado   | `paid`    | `Banknote`    | El dinero entró             |
| `VOID`    | Anulado   | `void`    | `Ban`         | Cancelado, no cuenta        |

**Los cinco llevan icono, o no lo lleva ninguno (053).** Un chip de estado con punto al lado de uno
con icono se lee como dos componentes distintos. Por eso el mapa vive entero en
`TicketStatusStamp` —única fuente del estado de un lavado— y ninguna pantalla arma el suyo con
`Stamp` crudo. «Libre» del tablero no es un estado del lavado pero comparte fila con uno, así que
también lleva icono (`CircleDashed`).

**Por qué `paid` es azul (064).** «Listo» es el verde de «cobrable»; «Cobrado» es el dinero ya
adentro, y compartiendo el verde solo los separaba el icono. En azul se distinguen de lejos sin caer
en `--text-faint`, que lo confundía con «En espera».

Un tono **no** implica un icono: `washing` también rotula «Carro nuevo» y un descuento, y `queue`
el nombre de un rubro del catálogo. Esos siguen con punto, porque no nombran un estado.

### Chip de placa

Mono, peso 700, `letter-spacing: .06em`, fondo `--plate-bg`, filete `--line`, radio 6px (`rounded-sm`). Tres
tamaños (`--plate-size-sm` 12px, `--plate-size` 13.5px, `--plate-size-lg` 16px): `sm` en un sitio apretado, `md` en una fila, `lg` en el título de un detalle. Se usa **en
todos** los sitios donde aparece una placa.

### Ficha «Ya lo conocemos» (`KnownVehicleCard`)

**El carro que el sistema ya tiene**, en el alta de oficina y de pista. Lámina verde (`--go` al 8%
de fondo, filete de 1.5px al 40%) con la placa y el sello arriba, el aviso de nota debajo, los datos
del carro en dos columnas y, al pie y **a todo el ancho**, «Último lavado».

**El último lavado es un desglose, no un rótulo** (057). Sin lavado previo, una sola línea: «Primer
lavado registrado». Con lavado previo, tres partes:

- **La primera línea** —«20 sept · #48 · Carlos»— en `text-dense` tenue: la fecha corta
  (`lastWashDateLabel`, la misma del aviso de nota), la referencia `#48` y quiénes lo lavaron,
  separados por «, ». Sin lavador dice **«Oficina»**, que no es un hueco sino quién lo despachó.
- **Una fila por servicio**, nombre a la izquierda y precio a la derecha en la mono con
  `tabular-nums`. Van en `text-body` —no en `text-dense`— porque se leen de pie; **no** miden
  `--touch-min`, que se reserva para lo que se toca.
- **El pie**, separado por filete `--line-soft`: «Total» en `text-label` tenue a la izquierda y
  «$22.00 · Efectivo» a la derecha, con el monto en mono y el método en `--text-dim`. Sin cobrar
  todavía, el método es **«Sin cobrar»**.

Los precios y el total **salen del ticket cobrado**; la ficha no suma ni recalcula nada.

**El `#48` es un enlace solo en oficina**, y solo con `carwash.read`: lleva a `/carwash/:id` con el
origen puesto (`OriginLink`), para que volver caiga en el alta a medio escribir. En la pista no hay
enlace —no se navega a lavados ajenos (036)— y el número se queda como texto. Quién monta el
formulario lo decide con una prop; la ficha no mira la URL. Cuando hay enlace, su área tocable es
`--touch-min`.

### Aviso de nota (`LastWashNote`)

**La nota que dejó el lavado anterior**, en las tres pantallas donde aparece un carro conocido: la
ficha «Ya lo conocemos» del alta, el detalle del lavado en pista y el mismo detalle en oficina. Va
**arriba** de los datos y de los botones, a todo el ancho, porque quien va a lavar el carro tiene
que leerla antes de empezar (052). Una sola pieza para las tres.

Aparece **solo si hay nota**: sin lavado anterior, sin `notes` o con la nota en blanco no se dibuja
nada. Nunca se inventa texto y nunca se muestra la de un lavado anulado.

- **Azul informativo con `.tint`**, igual que el chip: `--info-text` como `currentColor`, al 12% de
  fondo y al 40% en el filete. Es un dato para tener en cuenta, no una alerta: no compite con el
  ámbar, el rojo ni la llama. Antes era ámbar, y sobre el fondo claro salía café apagado. Radio
  `rounded-row`, icono `StickyNote` de `lucide-react` a `--icon-size`.
- El **rótulo** —«Nota del último lavado · 12 ago»— va en `text-label` sobre el azul; **la nota** va
  en `--text` con `whitespace-pre-wrap`, que es el texto que hay que leer y no la señal.
- **Por densidad:** la nota es `text-body` en `mostrador` y sube a `text-title` en `bahia`, donde se
  lee de pie y a un brazo de distancia. Es lo único que cambia entre las dos.

**Es el único bloque azul que no es un estado** (el otro es el estado grande de un lavado cobrado,
abajo). El relleno ámbar queda para el aviso de posible cliente repetido del alta
(`customer-field`), que sí es una advertencia; cualquier bloque relleno nuevo tiene que
justificarse contra estos.

### Detalle del lavado en oficina (064)

- **Cabecera:** `#N` con `TicketStatusStamp size="lg"` al lado; debajo, folio y hora de entrada.
  Sin botones.
- **Desde `xl`, dos columnas:** a la izquierda vehículo y cliente, servicios y línea de tiempo; a la
  derecha un panel `sticky` de 340px. **Por debajo de `xl`**, una columna con el panel primero y los
  botones de a dos por fila.
- **Tarjeta del vehículo:** placa `lg`, icono y tipo de carro, marca · color; debajo, rejilla con el
  rótulo **arriba** del valor. Las filas «rótulo … valor» de ancho completo no se usan en fichas
  anchas: a 1900px el valor queda a media pantalla de su rótulo.
- **Panel:** estado grande (`TicketStatusHero`: `.tint` del tono, icono de 30px, palabra en
  `text-figure`, «desde las h:mm · N min»), los cuatro pasos del ciclo, total, cobro, «A cargo de» y
  botones. Lo que deshace (`Anular`, `Deshacer cobro`) va aparte, al pie, tras un filete.
- **Por densidad:** en `bahia` la palabra del estado sube a 34px y las barras de los pasos de 6 a
  8px.

### Pista en tablet y celular (066)

- **El siguiente paso nunca queda al fondo.** En la ficha, por debajo de `lg`, «Empezar lavado» /
  «Marcar listo» / «Reabrir» van en una barra `sticky bottom-0` pegada al borde, con
  `env(safe-area-inset-bottom)`: a todo el ancho en celular y a la derecha, con placa y estado, desde
  `md`. Desde `lg`, dos columnas (panel de 360px `sticky`) y el botón dentro del panel, sin barra.
- **Ficha:** placa `lg` de título con el chip `lg`; el mismo `TicketStatusHero` de oficina con los
  tres pasos de pista (la pista no cobra); servicios como «Qué hacerle»; Responsable, Teléfono
  (`tel:`), A cargo de y Entró en rejilla de dos. Productos va plegado mientras esté vacío.
- **Fila:** chips de estado con conteo a la vista, en vez de esconder el estado en el popover (la
  carrocería sigue ahí). Tarjetas con franja de 4px del tono del estado y el botón `lg` a todo el
  ancho; 1 / 2 (`md`) / 3 (`lg`) columnas. En celular, «Anotar carro» baja a una barra fija.
- **Encabezado:** bajo `sm` el nombre del empleado se vuelve iniciales en un círculo de
  `--touch-min`.

### Fila de lista (`DataTable`)

**Una sola lista para todas las pantallas**.

- **≥900px:** una lámina contenedora única con fondo `--surface`, filete `--line-soft`, radio 12
  (`rounded-row`), diseño plano sin sombras y tabla HTML nativa adentro: cabecera `thead` con
  fondo `--surface-2`, filete inferior `--line` y rótulos tenues (12px, peso 600, `--text-faint`). Las
  filas van en `tbody` con separadores `--line-soft` y hover de fila completa a `--surface-2`. Garantiza
  alineación vertical estricta entre cabeceras y celdas en todas las columnas.
- **<900px:** la cabecera se oculta y la misma fila se apila en tarjeta táctil — la referencia y el chip arriba, el
  dato que nombra la fila debajo, el resto rotulado y las acciones al pie **a todo el ancho**.
- La **primera columna es siempre el número de referencia**; no se declara.
- **Fila resaltada** (`highlightKey`, 106): la fila que se acaba de tocar en otra pantalla —la cuenta
  a la que se le anotó, al volver a la lista— destella una vez, con la misma marca que una fila que
  llegó por el hilo (088).
- El **estado de la lista** es una sola línea en el mismo sitio: `Cargando…`, el estado vacío, o el
  `message` del error en `--danger-text`.
- Las **acciones van visibles**, con su columna rotulada «Acciones». Nunca detrás del `hover`.
- **Columna explicada** (`help` en la columna, 067): el `HelpTip` va al lado de la cabecera en
  escritorio y al lado del rótulo en la tarjeta apilada. Solo para columnas cuyo número necesita
  explicación («Tiempo vs promedio», «Clientes fieles»), no para «Placa».
- **Paginado en cliente** (`pageSize`, 067): con más filas que `pageSize`, un pie «Anterior ·
  1–10 de 69 · Siguiente». En la tabla cuelga dentro de la lámina tras un filete `--line-soft`;
  apilada es una tarjeta propia con la cuenta arriba, centrada, y los dos botones a todo el ancho,
  de 44px. Cambiar `rows` —otro empleado, otro rango— vuelve a la primera página, y la referencia
  sigue siendo la posición en la lista entera. Las listas de lavados de Rendimiento van de a 10.
- **Fila desplegable** (`renderExpanded`, 091): lo que la fila abre debajo —el detalle de un
  consumo, la entrada rápida—. En la tabla, la fila y su detalle comparten fondo `--surface-2` y el
  detalle ocupa todo el ancho a partir de la referencia; apilada, cuelga al pie de la tarjeta tras un
  filete `--line-soft`, y tocar adentro no abre ni cierra la tarjeta. Una fila que se despliega con
  `onRowClick` lleva un cheurón que gira: no hace falta un botón «Ver».

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

Dos agregados opcionales (067), y sin ellos la tarjeta es la de siempre: `help` pone el `HelpTip`
al lado del rótulo y `detail`, una línea de apoyo bajo la cifra en `text-dense` tenue (`text-body`
en `bahia`): con qué se compara o de dónde sale («sobre $420.00 en ventas», «equipo 40% · 5
puntos más»). Una comparación en `detail` va **siempre en palabras**; el color la acompaña.

### Icono de ayuda (`HelpTip`)

**Qué significa una cifra** (067). Un `CircleHelp` de `lucide-react` a `--icon-size`, en
`--text-faint` que pasa a `--text`, con un área tocable de `--touch-min` que desborda el icono sin
moverle el sitio. El `aria-label` es «Qué es: …» con la explicación entera.

Se abre de tres maneras, porque en la bahía no hay puntero: **al pasar el mouse**, **al llegar con
el teclado** (foco visible) y **al tocarlo**, que lo deja fijo hasta otro toque, un toque afuera o
Escape. El globo (`FloatingTip`, en el mismo archivo) es plano: `--surface-3`, filete `--line`,
radio 6px, `text-dense`, 260px de ancho máximo. Vive en un portal con posición fija, así que ninguna
tarjeta ni tabla con `overflow` lo recorta; va arriba y centrado, abajo si no cabe, y nunca se sale
por los costados. No recibe foco ni clics. Tocar el icono dentro de una fila clickeable no abre la
fila.

### Rendimiento: barras horizontales (067)

`/carwash/performance`. Prototipo aprobado: `docs/prototype/performance.html`. La única pantalla con
gráfico, y el gráfico es uno solo: **barras horizontales de una serie**
(`performance-bars.tsx`), para cuánto tarda cada empleado y qué extras se venden.

- **Fila:** rótulo a la izquierda (180px como mucho, se corta con puntos), barra en el medio y el
  **valor escrito** a la derecha en cifras tabulares: el número nunca depende de medir la barra.
  Bajo 640px el rótulo y el valor suben a un renglón y la barra baja entera al siguiente.
- **Barra:** `--flame` lleno —sin degradado, que es de acción—, **14px en `mostrador` y 22px en
  `bahia`**, con la punta redondeada a 4px y el arranque recto. Escala del 0 al valor más alto más
  un 8% de aire; nunca un eje recortado.
- **Promedio del equipo:** una raya vertical de 2px en `--text` que cruza todas las filas, con su
  clave arriba («Promedio del equipo: 34 min»). Sin paleta nueva: llama para el dato, tokens de
  texto para todo lo demás.
- **Lectura:** pasar el mouse o llegar con el teclado abre el mismo `FloatingTip` con la frase
  entera. Si la fila lleva a un empleado es un botón de alto `--touch-min` y tocarla cambia el
  alcance; si no, se enfoca igual para leerla.

La pantalla: selector «Ver» (Combobox con «Todo el equipo» y los activos, y «‹ Todo el equipo» al
lado cuando hay un empleado), el `DateRangeField` y «Editar empleado» solo con `employees.manage`;
debajo, rango y lavados cobrados en una línea; después las pestañas. Resumen abre con **tres cifras
arriba y dos medidores abajo** en una rejilla de seis columnas (dos y dos con la tercera a lo ancho
bajo 1100px, una en teléfono). En `bahia` las cifras suben a 38px y las tarjetas piden 260px.
Pestaña, empleado y rango viven en la URL; un lavado abierto desde ahí vuelve con «Rendimiento».

### Encabezado de sección en tarjeta (`CardSectionHeading`)

Cuando una tarjeta agrupa filas etiqueta/valor, su título va en `text-title` sobre `--text`, con
filete `--line-soft` debajo. Nunca en `text-label` tenue, que es la clase de las etiquetas de la
izquierda: con esa, el título se lee como una fila a la que le falta el valor de la derecha (053).
El `aside` opcional cuelga a la derecha, en `text-dense` tenue, para el dato que resume la tarjeta
(«Total 1 h 15 min»).

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

**La única excepción a «solo lo tuyo» es la pista** (spec 042): en `/floor`, cuando entra un carro a
la fila del empleado, el aviso lo dice aunque lo haya hecho otra persona. En la tablet no hay campana
donde ir a mirarlo, se trabaja de pie y la pantalla no siempre está a la vista. Fuera de ese caso, lo
ajeno va al centro de notificaciones.

### Centro de notificaciones

**Lo que pasó mientras no mirabas.** La fila de lavados se mueve sola (spec 042) y la campana es
donde queda constancia de lo que **no hiciste vos**: un carro que entró, uno que quedó listo, uno que
se cobró, uno que se anuló.

Vive **al pie del riel**, junto al usuario, y en la barra inferior bajo 900px. El sistema no tiene
barra superior global y no se le agrega una para esto. La ve quien tiene **`notifications.read`**
—clave propia desde la 058, no la de la fila— y quien no, no la ve: oculta, no deshabilitada.

- **La campana** es un botón fantasma con el icono de `lucide-react`, área tocable `--touch-min`
  (44px en `bahia`). El contador de no leídos es un globo `--flame` con el **número escrito**, a
  `9+` cuando se pasa: el color nunca es la única señal, igual que en el riel. Con cero no leídos no
  hay globo — un cero en un globo decora, no informa.
- **El cajón** (spec 058) es el `Dialog` del sistema en su variante `drawer`: **pegado al pie en
  todos los anchos**, no una ventana centrada. Ancho `min(1100px, 100%)`, alto `min(72vh, 680px)` y
  86svh bajo 900px, esquinas de arriba redondeadas. Detrás se sigue viendo la fila, que es contra lo
  que se lee un aviso. Dejó de ser un menú desplegable de 320px: ahí no entraba medio aviso y no
  había forma de buscar nada.
- **La cabecera** lleva el título de diálogo «Avisos» y, en el renglón de abajo, el chip **en vivo /
  sin conexión** y el contador «N sin leer de M». El estado del hilo va con el contador y no arriba
  a la derecha: es un dato de la bandeja, no una acción. Una bandeja vacía tiene dos causas muy
  distintas y hay que poder distinguirlas.
- **Los días** son una columna de 210px a la izquierda —«Todos los días», «Hoy», «Ayer», «vie 18»—
  con la fecha corta siempre y la cuenta a la derecha, en `--flame-text` cuando quedan sin leer. El
  rótulo relativo solo no ubica; por eso los dos. Bajo 900px la columna se va y los días pasan a un
  carril de píldoras arriba.
- **Los filtros** son dos renglones, del alto de `--control-h`: arriba el buscador, que ocupa lo que
  sobra, y el interruptor «Solo sin leer»; abajo, en su renglón entero, el carril de tipos (Todos,
  Entradas, Avances, Cobros, Anulados, Inventario), que **scrollea en horizontal antes que
  partirse**. En todos los anchos igual: metidos en la misma fila que el buscador no entraban, y un
  carril cortado con la barra oculta no se mueve con la rueda del mouse. Todos llevan su cuenta,
  también el interruptor: el único chip sin número se lee como un botón suelto.
- **Cada aviso** es una fila-tarjeta (`--surface-2`, radio `--radius-row`; transparente si ya se
  leyó, nunca apagada con opacidad): la hora a la izquierda en tabulares, el icono del tipo en un
  círculo con el relleno suave de su tono, y los tres renglones de siempre — el titular con el
  número de referencia (`#142`) en `--go-text` si algo avanzó, `--danger-text` si algo se cayó y
  `--text-dim` si es neutro; el chip de placa y el dato que da contexto; y **quién lo movió, con de
  dónde** —«Carlos · pista», «Ana · oficina»—, los dos últimos en `--text-faint`.

  El autor va **en renglón propio y nunca pegado a la placa**. Oficina y pista pueden mover el mismo
  lavado (037), así que sin el «de dónde» hay que adivinar; y un nombre al lado de una placa se lee
  como _quien lo lava_, que es otra persona. Si el evento no se pudo atribuir, ese renglón no
  aparece: no se inventa un autor.

  El punto `--flame` a la derecha marca lo no leído. Tocar un aviso lleva al lavado, lo marca leído
  y cierra el cajón.

- **Agrupado por día siempre**, con cabecera pegajosa que dice el día, la fecha y cuántos: al
  scrollear hay que saber de cuándo es lo que se está leyendo.
- **El pie** lleva el conteo de lo mostrado, «Marcar todo como leído» y «Ir a la fila».
- **Vacío:** el texto dice **por qué** está vacío —una búsqueda sin resultados, nada sin leer, o la
  bandeja de verdad vacía («Acá van a aparecer los cambios que haga otra persona en la fila de
  lavados»)—. Nunca «No hay notificaciones» a secas.
- **El dinero es aparte.** Los avisos de cobro y de cobro deshecho solo llegan a quien tiene
  `carwash.cash`, y se decide **al recibir el evento**: lo que no se puede ver no se guarda. Sin ese
  permiso el filtro «Cobros» tampoco se dibuja — un chip que siempre dice 0 es una puerta cerrada
  con cartel.
- **El inventario, también aparte** (065). El aviso de mínimo (`stock`, icono `Package`, rojo) dice
  «Cera en pasta se está acabando» y abajo «quedan 4 unidades (mínimo 5)», sin chip de placa; tocarlo
  lleva a `/inventory/<id>`. Solo se guarda con `inventory.read`, decidido al recibirlo, y el chip
  «Inventario» solo se dibuja con ese permiso. Llega aunque el movimiento sea tuyo: lo que avisa no
  es tu acción, es la existencia en que quedó el artículo.
- **Nunca** avisa de una acción propia (salvo el mínimo de inventario, arriba), y **nunca** lleva un
  error: los errores se imprimen donde ocurren, como en todo el sistema.

La bandeja es de este navegador y guarda **7 días** y hasta 200 avisos (058): se poda sola al leer y
no viaja a otra máquina. Maqueta: `docs/prototype/notifications-drawer.html`.

### Diálogo

Radio 14, filete `--line-soft`, fondo `--surface`, sombra de elevación (`shadow-dialog`) y backdrop atenuado. Cabecera y pie separados por
filete; el cuerpo hace scroll solo. **Bajo 900px sube desde abajo** como una hoja pegada al pie, sin
redondear las esquinas inferiores.

**La variante `drawer`** (058) es el mismo diálogo que **no se centra al pasar los 900px**: se queda
pegado al pie, con ancho `min(1100px, 100%)` y alto propio. Es para la capa que se consulta contra
lo que hay detrás —hoy, el centro de avisos—, no para confirmar ni para editar. Un formulario sigue
siendo un diálogo.

### Cuentas abiertas (106)

Lo que alguien se lleva y paga después. Prototipo aprobado: `docs/prototype/open-tabs.html`.
**Mínimo texto**: sin subtítulos, notas ni párrafos de ayuda; solo datos y acciones. La única fila
informativa es «Queda debiendo $X», al anotar y al abonar. Los toasts son de una o dos palabras
(«Cobrada», «Pagada», «Quitado», «Anotado a Juan», «Abono de $5.00»).

- **Ventas** lleva dos pestañas bajo la misma cabecera (`SalesFrame`, montado por el grupo
  `sales/(tabs)`): «Ventas del día» y «Cuentas abiertas» con su contador. En «Ventas del día» un
  abono es una fila con el número de su cuenta y el sello «De cuenta».
- **Chip de filtro** (`components/ui/filter-chip.tsx`): píldora de `--touch-min` con la palabra y su
  conteo tenue; el elegido lleva `aria-pressed` y filete de llama. «Todas · Trabajadores · Clientes ·
  Cerradas», «Todas · Pagadas · Anuladas», las categorías de Nueva venta y los atajos del monto.
- **La lista** es `DataTable`: iniciales en círculo, nombre (`text-title` en `bahia`), «C-0012 · N
  productos» debajo, sello «Trabajador» (`consume`) o «Cliente» (`info`) y el saldo en mono a la
  derecha. Arriba tres `StatCard`: Por cobrar (`flame`), Trabajadores, Clientes.
- **El detalle** es una cabecera con el nombre y los sellos, la tarjeta Debe / Anotado / Abonado
  (Debe en `--flame-text`, en `bahia` a `--stat-size-lg`) y la **línea de tiempo por día**: no es
  una lista de registros sino la historia de una cuenta, así que no usa `DataTable`. Cada fila es
  una lámina `--row-h`: hora (nunca se parte), producto `×cant`, valor y «Quitar». Lo quitado va
  con `.is-ruled-out` sobre el nombre y el valor, el motivo debajo y el sello «Quitado»; un abono
  va sobre un tinte de `--go` al 6% con «−$X» en `--go-text`. Bajo 640px la hora sube a su renglón.
- **Nueva venta**: los productos son **filas** (nombre, «Hay N», precio y un `+` que se vuelve el
  `− N +`); un agotado queda en `--text-faint` con «Agotado» y sin botón. A la derecha el resumen
  **de solo lectura**, el total y el selector «Cobrar ahora | Anotar a cuenta». El de persona es un
  **flotante**: la lista (`--surface`, `rounded-card`, `shadow-dialog`) flota sobre el resumen sin
  empujarlo, con flechas, Enter, Escape y cierre al tocar afuera; elegida, la persona ocupa el campo
  con «Cambiar».

### Cobro: la cuenta, el pago partido y el precio bajo llave

El diálogo de cobro (`charge-dialog.tsx`, specs 059 y 060). Prototipo aprobado:
`docs/prototype/joint-charge.html`. **Una sola forma para los tres casos**, porque para el cajero
son el mismo gesto: un lavado y un método, varios lavados en una cuenta, o el pago partido.

- **La cuenta.** Una fila-lámina por lavado (`--surface-2`, `rounded-row`): placa, responsable,
  «#14 · Sedán · 2 servicios» y el total. Con **un** lavado la fila viene abierta y no hay nada
  nuevo en pantalla; con varios cada una se pliega y lleva su ✕ para quitarla. Debajo, «Sumar otro
  ticket al cobro», que abre un selector de listos sin cobrar con casillas de verdad.
- **Mezclar responsables avisa, no bloquea** (059 RN-6): una línea en `--warn-text` con su icono, no
  un bloque ámbar — el relleno ámbar sigue siendo del aviso de cliente repetido.
- **El pago** es el radiogroup de tres métodos con el total. «Partir el pago en varios métodos» lo
  cambia por renglones método + monto, con el marcador **Falta / Cuadra / Se pasó** —verde, ámbar y
  rojo, siempre con la palabra— y el primario deshabilitado mientras no cuadre. Se vuelve a un solo
  pago con un enlace.
- **El efectivo** aparece solo si algo del cobro lo es: «Con cuánto paga» (vacío = pagó justo) y el
  **cambio en `text-figure`**. Si no alcanza, el primario dice «Falta efectivo» y no llama al API.
  **Sin botones de billete**: se teclea la cifra.
- **El pie es el total y el verbo.** El primario nunca dice «Cobrar» apagado sin explicación: dice
  qué falta.
- **Cómo se registra por ticket**: con más de un lavado, un desplegable con el reparto proporcional
  (059 RN-5), el mismo que aplica el API.
- **El precio no se edita en la caja** (060). Desde `READY` la línea de servicio es **texto** más un
  candado «Cambiar precio»; el diálogo pide precio nuevo, motivo y el bloque de autorización de la
  045, y el error del API sale adentro con `role="alert"`. Aplicado, la línea muestra el catálogo
  tachado con la regla de anulación y la firma «Autorizó \<nombre\>» en `--warn-text`, y el lavado
  lleva la insignia «Precio autorizado». Mientras está `OPEN` o `WASHING` el campo sigue como
  siempre, sin candado.
- **Deshacer un cobro deshace la cuenta entera** (059 RN-8), y el diálogo lo dice antes de pulsar.
- **Productos** (065). En el alta, la edición y la pista, debajo del selector de servicios, el bloque
  «Productos»: buscador y una fila por producto (`--row-h`) con nombre, «Hay N» con su unidad, precio
  y el `− 1 +` (botones de `--touch-min`, 44px en `bahia`, donde el número además sube a
  `text-title`). Lo elegido queda arriba con su fórmula. En toda lista de líneas —detalle, pista,
  cuenta— el producto va bajo el rótulo «Productos» y se escribe `2 × $3.00` con el total de la línea
  a la derecha; el candado cambia el precio **por unidad**. Un `409 INSUFFICIENT_STOCK` marca esa
  fila en `--danger` con «Hay N» y el formulario no se pierde. La pista nunca ve costos.
  **Por categoría (085):** sin escribir no hay filas, solo chips de categoría (`rounded-full`,
  `--touch-min`, nombre y cuántos productos tiene) en orden alfabético con «Sin categoría» al final.
  Un toque abre esa categoría y otro la cierra; una sola abierta. El chip abierto lleva
  `aria-pressed` y filete de llama; si llevás algo de esa categoría, un contador `gradient-action`
  con la cantidad. Al escribir se busca en todas, agrupado bajo el título de cada categoría, y los
  chips no presionados bajan a 55% de opacidad; tocar un chip borra la búsqueda. En `bahia` el
  nombre de la fila sube a `text-title`. Prototipo: `docs/prototype/product-picker-browse.html`
  (propuesta B).

### Menú lateral y barra inferior

**Azul marino en los dos temas.** Arriba el logo, en medio los grupos con su rótulo tenue, al pie el
usuario (con nombre legible, y dentro sus preferencias de tema y densidad) y la campana de avisos.

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
- **Selector de espacio de trabajo** (094) entre el logo y los grupos: rótulo «Espacio de trabajo»
  en `text-label` tenue y un botón (`bg-white/5`, borde `white/8`, alto de pestaña) con el icono del
  espacio en llama, el nombre y `ChevronsUpDown`. El menú lista un ítem por espacio —icono, nombre,
  subtítulo de una línea y `Check` en el activo— y elegir uno lleva a su primera pestaña. El riel
  solo muestra los grupos del espacio activo, que se deduce de la ruta. **Con un solo espacio no se
  dibuja**: el riel queda como siempre. Plegado, solo el icono, con el nombre en `aria-label`. Bajo
  900px los espacios van como grupo «Espacio de trabajo» dentro de «Más», antes de densidad y tema.

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

**Salvo que se sepa de dónde viniste.** Una ficha con varias puertas de entrada —el lavado se abre
desde la lista, desde la caja, desde la ficha de su cliente y desde la campana— vuelve a la pantalla
por la que se entró, con sus filtros puestos, y la nombra: «Caja», «Turno», «Cliente». El origen
viaja en la URL (`?from=`), no en el historial: aguanta la recarga y se puede compartir el enlace.
Si no viene, o viene manipulado, manda la estructura.

### El número de referencia — componente firma

`#14`, en la mono del sistema, con almohadilla y `tabular-nums`. Sin círculo, sin filete, sin fondo.
En reposo va en `--text-faint`; activo, en `--flame-text`.

**La regla del mismo número.** Un objeto tiene un número y solo uno, igual en todas las pantallas
donde aparezca. Si dos pantallas numeran lo mismo distinto, una de las dos está mal.

### Logo

`components/brand/logo.tsx`: el archivo original del taller (medidor cromado + «ELITE / SERVICE»),
recortado a su contorno con fondo transparente en `logo-elite-service.png` y servido con
`next/image`. Un solo prop, `height`; el ancho sale de la proporción (1.7 : 1). Va igual sobre el
riel azul marino y sobre el tema claro.

| Dónde                       | Alto      |
| --------------------------- | --------- |
| Login de oficina y de pista | 96px      |
| Riel desplegado / plegado   | 60 / 24px |
| Encabezado de la pista      | 36px      |
| Aviso de sesión (error)     | 72px      |

Es una imagen y no se anima: el medidor de carga (`GaugeLoader`, 067) conserva el isotipo dibujado
en vectorial porque la aguja tiene que moverse. Si la marca cambia, cambia en ese solo componente.

### Tablero de pista

`/carwash/board` (spec 049, kanban desde la 089). Es la fila del día **mirada de lejos**: cuelga de
una TV en la pista y también se abre en el monitor del dueño. No hay un solo botón que mueva un
lavado —eso es de `/carwash` y de `/floor`—; lo único que se toca es la pantalla completa. Vive
fuera del `AppShell`: un riel de 248px al costado le comería ancho a las columnas para no decir nada.

**La escala, `--board-scale`.** Todo lo que hay que leer a tres metros se mide contra esa variable:
**1** en el monitor y **1.5** bajo `:fullscreen`, con la Fullscreen API sobre el documento entero. Si
el navegador no la soporta, el botón no se dibuja. La variable vive en `globals.css` (`.board-screen`,
capa de componentes) y los tamaños que pisa —chip de placa, cronómetro, cifras— van en la capa
`utilities`, porque una regla de componentes pierde contra la utilidad que la propia pieza se
escribe. Es la única escala del sistema que no sale de la densidad: **densidad es dedo, esto es
distancia**, y las dos conviven (en `bahia` la placa crece otro escalón y las tarjetas miden
`--row-h`).

**Kanban de tres columnas por estado**, iguales de ancho:

- **En cola** (`OPEN`): todos, con o sin lavador, del más viejo al más nuevo. Tarjeta con placa,
  «espera X», vehículo y nombre de pila de quien lo va a lavar; sin nadie dice «Sin asignar» en
  `--warn-text`.
- **Lavando** (`WASHING`): el que más lleva primero. Tarjeta grande: placa `lg`, lavador, vehículo,
  servicios, cronómetro en Saira y «desde HH:MM».
- **Listos para cobrar** (`READY`): el más viejo primero. Placa, «listo hace X», vehículo y quien lo
  lavó.

Cada cabecera lleva el chip del estado, el título y la **cantidad en Saira**: por eso no hay fila de
`StatCard`. El filete de «Lavando» se tiñe de `--flame` y el de «Listos» de `--go` (al 40%) cuando
tienen algo; el color acompaña, la palabra manda. Vacías: una caja punteada con «Nadie en espera»,
«Nadie lavando» o «Nada por cobrar». Las tarjetas se escriben en `--surface-2` sobre la columna.

**Franja «Lavadores hoy»** abajo: por quien tocó un lavado hoy, terminados en Saira, promedio («20
min promedio», o «sin promedio aún») y el chip «Lavando» o «Libre».

**Lo cobrado no está.** Los `PAID` no se dibujan (solo suman en terminados) y el tablero no muestra
dinero con ningún permiso: lo cobrado se mira en otro lado. La pantalla pide `carwash.read`.

El cronómetro avanza **cada segundo en el cliente**, sin pedir nada: la novedad la trae el hilo de la 042. Se dibuja como reloj (`27:14`, `1:05:20`) y no con el vocabulario de la 046 («27 min 14 s»),
que no entra en el ancho de una tarjeta. Pasados 45 minutos encima el número se va a `--warn-text`;
en la cola, pasada la media hora, la espera también.

**Bajo 900px** las tres columnas pasan a un carril horizontal con `scroll-snap`, una por pantalla, y
la franja de lavadores se apila. El reloj de la cabecera desaparece: lo tiene el sistema operativo.
Nada depende de `hover`.

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
- `prefers-reduced-motion: reduce` apaga el latido, la cascada, las marcas y las transiciones.

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
- **Don't** animar por gusto: ninguna entrada fuera de la cascada de las piezas del sistema,
  ningún bucle fuera de los cuatro de Movimiento, ninguna marca grande salvo la del cambio de
  estado. Una pantalla no escribe su propia animación.
- **Don't** condicionar nada por nombre de rol. Toda variación de UI se decide contra una clave
  `module.action`.
- **Don't** usar emoji como iconografía: los iconos son de `lucide-react`, trazo 1.5px, tamaño
  `--icon-size`.
- **Don't** escribir una lista a mano: si `DataTable` no hace algo, se le agrega **al componente**.
