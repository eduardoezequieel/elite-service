---
name: Elite Service
description: El taller leído como un catálogo de piezas — todo lleva número, y el número es el vínculo.
colors:
  brand-elite: "oklch(0.615 0.2 36)"
  fill-action: "oklch(0.57 0.185 36)"
  paper: "oklch(0.955 0.006 250)"
  plate: "oklch(0.99 0.003 250)"
  wash: "oklch(0.925 0.006 250)"
  ink: "oklch(0.205 0.008 250)"
  graphite: "oklch(0.5 0.012 250)"
  hairline: "oklch(0.885 0.006 250)"
  rule: "oklch(0.795 0.008 250)"
  stamp-amber: "oklch(0.505 0.125 68)"
  stamp-green: "oklch(0.485 0.125 150)"
  stamp-red: "oklch(0.52 0.19 25)"
  stamp-blue: "oklch(0.495 0.13 245)"
  brand-elite-lit: "oklch(0.7 0.18 40)"
  fill-action-lit: "oklch(0.68 0.185 38)"
  fiche-ground: "oklch(0.19 0.012 250)"
  fiche-plate: "oklch(0.238 0.013 250)"
  fiche-wash: "oklch(0.285 0.013 250)"
  fiche-ink: "oklch(0.94 0.005 250)"
  fiche-graphite: "oklch(0.68 0.01 250)"
  fiche-hairline: "oklch(0.34 0.012 250)"
  fiche-rule: "oklch(0.43 0.014 250)"
  stamp-amber-lit: "oklch(0.78 0.13 75)"
  stamp-green-lit: "oklch(0.72 0.13 152)"
  stamp-red-lit: "oklch(0.68 0.17 25)"
  stamp-blue-lit: "oklch(0.7 0.115 245)"
tint:
  fill: "10%"
  line: "25%"
typography:
  figure:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.02em"
    fontVariant: "tabular-nums"
  display:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "38px"
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0"
  body-dense:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"
    fontVariant: "tabular-nums"
  label:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0"
  mono:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"
rounded:
  none: "0px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  "3xs": "2px"
  "2xs": "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
  "3xl": "32px"
  "4xl": "40px"
  "5xl": "56px"
  "6xl": "72px"
components:
  button-primary:
    backgroundColor: "{colors.fill-action}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    fontWeight: 500
    textTransform: "none"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "oklch(0.52 0.185 36)"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    fontWeight: 500
    textTransform: "none"
    borderWidth: "0"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "32px"
  reference:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.mono}"
    textTransform: "none"
    borderWidth: "0"
    rounded: "{rounded.none}"
    padding: "0"
  reference-active:
    backgroundColor: "transparent"
    textColor: "{colors.brand-elite}"
    typography: "{typography.mono}"
  stamp:
    backgroundColor: "color-mix(in oklab, currentColor {tint.fill}, transparent)"
    borderColor: "color-mix(in oklab, currentColor {tint.line}, transparent)"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    textTransform: "none"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    textTransform: "none"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "34px"
---

# Design System: Elite Service

> Los valores en `oklch()` del frontmatter son **la fuente de verdad**: el proyecto usa Tailwind v4
> con tokens OKLCH en `globals.css`. Los hex que aparecen abajo son el renderizado sRGB de
> referencia para poder verificarlos a ojo, no una segunda definición.
>
> Este documento define el sistema; `src/app/globals.css` lo implementa. La spec que lo baja a
> código es `specs/002-design-system.md`. Si el documento y `globals.css` discrepan, **gana
> `globals.css`** y el documento se corrige en el mismo commit.

## Overview

**Creative North Star: "El Catálogo de Piezas"**

Elite Service se lee como el catálogo de repuestos que está detrás del mostrador: tinta sobre ficha,
un solo color de imprenta, filetes de un pelo, cifras tabulares y **números de referencia** que atan
un dibujo a una fila de tabla. Ese número es la firma del sistema. Cada objeto del taller —una orden,
un vehículo, una línea de trabajo, un repuesto— lleva un número, y ese número es lo mismo en todas
las pantallas donde aparece. Buscar deja de ser buscar: es seguir una referencia.

**Los dos temas son la misma ficha con dos luces.** No hay una paleta clara y otra oscura: hay un
documento y un lector. En claro el lector está encendido y la ficha se lee en positivo; en oscuro se
lee como negativo. Por eso **todos los neutros de los dos temas comparten el matiz 250** —el mismo
gris azulado frío—, y ninguno de los dos es "el otro invertido con más contraste". Recepción trabaja
en interior, la bahía a veces bajo luz directa: los dos temas existen porque los dos contextos
físicos existen, y ninguno es secundario.

**Por qué el claro no es papel cálido.** En su primera versión el tema claro era crema —fondo tibio,
matiz 85, acento terracota— y se abandonó a propósito. Fondo cálido más acento rojo-anaranjado es
**la estética por defecto de la interfaz generada**: el aspecto que aparece cuando nadie eligió nada.
El naranja Elite se gana su lugar porque sale del logo y porque es raro; un fondo que lo acompaña en
temperatura lo diluye en decoración. El gris azulado frío es una decisión, y además es la que hace
que claro y oscuro se reconozcan como el mismo documento.

La densidad aquí es una virtud, no una concesión. El mostrador quiere ver quince órdenes de un
vistazo, no cinco tarjetas con aire. Lo que se rechaza explícitamente: el tablero automotriz
—velocímetros, agujas, medidores, brillo neón, fibra de carbono— que fue la referencia de partida y
que el usuario descartó por no corresponder a órdenes de trabajo, inventario y facturación; y su
opuesto predecible, el panel de administración genérico de tarjetas redondeadas con sombra suave y
acento azul.

**Key Characteristics:**

- Todo objeto lleva número; el número es el vínculo entre pantallas.
- Un solo acento (el naranja Elite), presente en ≤5% de cualquier pantalla.
- Esquinas suaves (8px por defecto), filetes de 1px, **cero sombras** salvo en capas flotantes.
- Texto en caja normal: **no hay mayúsculas forzadas en ninguna parte del sistema**.
- Cifras tabulares por defecto: las columnas de números alinean siempre.
- Dos densidades, un solo vocabulario: `mostrador` (fila 36px) y `bahía` (fila 56px).
- Táctil de primera clase: toda pantalla se entrega responsive y usable con el dedo en tablet.
- Claro y oscuro son la misma ficha con dos luces: **un solo matiz neutro (250) en los dos temas**.
  Ambos de primera clase. Nada de papel cálido ni de crema con acento terracota.

## Colors

Estrategia: **Restringida** — neutros más un acento. Es la estrategia que corresponde a una
superficie donde el usuario vino a trabajar, no a ser convencido.

### Primary

- **Naranja Elite** `oklch(0.615 0.2 36)` / `#E34716`: el color de la marca, tomado del arco del
  velocímetro del logo. Es **marca**, no texto: aparece en el número de referencia activo, en la
  muesca de la pestaña activa, en el anillo de foco y en los filetes que señalan la fila viva.
  Contra la lámina da 3.95:1, insuficiente para texto corrido; por eso nunca se usa para texto.
- **Rojo de Acción** `oklch(0.57 0.185 36)` / `#CD3F13`: el relleno accionable. Es el mismo tono de
  marca bajado en luminosidad **solo hasta que el blanco encima alcanza 4.87:1**, no más: bajarlo
  hasta el granate del catálogo antiguo volvía el botón primario más pesado que la pantalla que
  encabeza. Solo el botón primario, y solo uno por pantalla. En oscuro sube a
  `oklch(0.68 0.185 38)` / `#F36537` con texto casi negro encima (5.94:1).
- **Rojo Destructivo** `oklch(0.52 0.19 25)` / `#BE222A`: el mismo valor que el Sello Rojo, para
  que borrar y «vencido» hablen con una sola tinta. Blanco encima, 6.08:1. En oscuro,
  `oklch(0.68 0.17 25)`.

### Neutral — Claro (la ficha con el lector encendido)

Los siete neutros del tema claro comparten el **matiz 250**, el mismo del tema oscuro. No es un
detalle de afinado: es lo que convierte a los dos temas en el mismo documento con dos luces en vez
de en dos paletas. Un neutro cálido aquí rompería el sistema entero, no solo esta pantalla.

- **Papel** `oklch(0.955 0.006 250)` / `#EDF0F4`: el fondo de la aplicación. Gris azulado frío y muy
  poco croma, nunca `#FFFFFF` —el blanco puro deslumbra bajo la luz de una bahía— y **nunca crema**.
- **Lámina** `oklch(0.99 0.003 250)` / `#FAFCFE`: la superficie de contenido (tablas, formularios,
  paneles). Más clara que el papel: la hoja se apoya sobre la mesa.
- **Lavado** `oklch(0.925 0.006 250)` / `#E3E7EA`: el neutro suave de relleno. Es el fondo del botón
  secundario, del hover de fila y de las zonas apagadas. Un tono más bajo que el papel, sin filete:
  llena sin dibujar una caja más.
- **Tinta** `oklch(0.205 0.008 250)` / `#14171B`: todo el texto principal. 17.40:1 sobre lámina.
- **Grafito** `oklch(0.5 0.012 250)` / `#5E646A`: etiquetas, unidades, texto secundario. 5.82:1
  sobre lámina y 5.26:1 sobre papel. También es el sello neutro.
- **Filete** `oklch(0.885 0.006 250)` / `#D6D9DD`: la línea de un pelo entre celdas y campos.
- **Regla** `oklch(0.795 0.008 250)` / `#B8BDC1`: la separación entre secciones y el borde exterior
  de una lámina.

**Por qué frío y no cálido.** La primera versión de este tema era papel tibio (matiz 85: Papel
`#F9F7F4`, Lámina `#FEFDFC`, Lavado `#ECEBE8`) con el mismo acento naranja encima. Es exactamente la
combinación que el sistema declara como estética por defecto de la IA —crema más terracota— y se
descartó por eso, no por contraste. El costo del cambio está medido: el fondo bajó de L 0.977 a
0.955, así que todos los contrastes contra papel bajaron un escalón y los cinco tonos de sello
tuvieron que volver a oscurecerse (ver abajo). El beneficio es que ya no hay dos paletas.

### Neutral — Oscuro (la microficha)

- **Fondo de ficha** `oklch(0.19 0.012 250)` / `#101419`: el entorno del lector. Azulado, no negro
  puro: el negro absoluto convierte el sistema en el tablero neón que rechazamos.
- **Plancha** `oklch(0.238 0.013 250)` / `#1A1F25`: la película iluminada; equivale a Lámina.
- **Lavado de ficha** `oklch(0.285 0.013 250)` / `#252B30`: el neutro suave de relleno; equivale a
  Lavado.
- **Tinta de ficha** `oklch(0.94 0.005 250)` / `#E9EBEE`: 13.87:1 sobre plancha. No blanco puro.
- **Grafito de ficha** `oklch(0.68 0.01 250)` / `#94999E`: 5.74:1.
- **Filete de ficha** `oklch(0.34 0.012 250)` / `#33393E` · **Regla de ficha**
  `oklch(0.43 0.014 250)` / `#4A5157`.

### Tertiary — Sellos de estado

Colores de sello de goma, no de píldora pastel. Se usan como **relleno suave**: el propio tono al
**10%** de fondo, al **25%** en el filete de 1px, y el tono pleno como texto. Nunca relleno saturado,
nunca texto blanco sobre color.

| Sello | Claro | Oscuro | Uso |
|---|---|---|---|
| Ámbar | `oklch(0.505 0.125 68)` / `#925400` | `oklch(0.78 0.13 75)` / `#E8AA4E` | En proceso, requiere atención |
| Verde | `oklch(0.485 0.125 150)` / `#147236` | `oklch(0.72 0.13 152)` / `#5EBC7B` | Listo, aprobado, pagado |
| Rojo | `oklch(0.52 0.19 25)` / `#BE222A` | `oklch(0.68 0.17 25)` / `#EF6661` | Vencido, rechazado, detenido; también `destructive` |
| Azul | `oklch(0.495 0.13 245)` / `#0067A6` | `oklch(0.7 0.115 245)` / `#5CA5E1` | Informativo, programado |
| Grafito | `oklch(0.5 0.012 250)` / `#5E646A` | `oklch(0.68 0.01 250)` / `#94999E` | Recibido, en espera, neutro |

**Por qué esos cinco valores y no otros.** Los tonos del tema claro se bajaron en luminosidad hasta
que el texto del sello sigue siendo legible **sobre su propio tinte**, que es el fondo real contra el
que se lee, no contra la lámina desnuda. Se bajaron **dos veces**: la segunda, cuando el Papel pasó
de crema `L 0.977` a gris azulado `L 0.955` y el peor caso cayó a 4.35:1. Cada tono está en el punto
más claro que vuelve a pasar el mínimo, no más abajo. Medido con el pill ya compuesto, tanto sobre
lámina como sobre papel, el peor caso es **4.56:1 en claro** (rojo sobre papel; sobre lámina, 5.03:1)
y **4.68:1 en oscuro** (rojo sobre plancha). Los tonos del tema oscuro no necesitaron ajuste ninguna
de las dos veces, porque el fondo oscuro no cambió. Ese margen es la razón de los valores: subir
cualquiera de los cinco rompe el mínimo.

**Cómo se implementa.** `globals.css` define la utilidad `.tint`, que deriva fondo y filete de
`currentColor` mezclando con transparente:

```css
.tint {
  background-color: color-mix(in oklab, currentColor var(--tint-fill), transparent);
  border-color: color-mix(in oklab, currentColor var(--tint-line), transparent);
}
```

`--tint-fill` (10%) y `--tint-line` (25%) son tokens del sistema y valen lo mismo en los dos temas:
como la mezcla es contra transparente y no contra el fondo, **un solo token por tono** resuelve claro
y oscuro. El mismo lenguaje se aplica al `badge` y al botón de eliminar.

### Named Rules

**La Regla del Acento Único.** El Naranja Elite ocupa como máximo el **5%** de los píxeles de
cualquier pantalla. No hay fondos de marca, ni cabeceras naranjas, ni bandas de color. Su rareza es
lo que lo hace funcionar como señal.

**La Regla del Acento Que No Habla.** El Naranja Elite nunca es color de texto. Para texto se usa
Tinta, Grafito o un sello. El acento marca, no dice.

**La Regla del Color Que No Basta.** Ningún estado se comunica solo con color. Un sello lleva
siempre etiqueta escrita; un bloqueo lleva siempre su regla de anulación; una fila urgente lleva peso
tipográfico. Un usuario daltónico debe poder operar el sistema en escala de grises.

**La Regla de la Tinta Continua** *(donada por la dirección declinada «Cola Cracktro»)*. La urgencia
no es un chip: es una escala continua. La antigüedad de una orden se codifica en cuatro pasos de
densidad de tinta sobre la barra de 2px del borde izquierdo de la fila y sobre el peso de la columna
de placa — Grafito 400 → Grafito 500 → Ámbar 600 → Rojo 700. La cola se lee sin leerla.

## Typography

**Familia principal:** **Atkinson Hyperlegible Next** (variable, pesos 200–800) con
`ui-sans-serif, system-ui, sans-serif` de respaldo.
**Familia mono:** **Atkinson Hyperlegible Mono** con `ui-monospace, monospace` de respaldo.

**Por qué esta familia.** La elección no es estética, es de producto. Atkinson Hyperlegible la dibujó
el Braille Institute con un solo objetivo: que las letras que se confunden entre sí no se confundan.
Cada par ambiguo está resuelto a propósito —`I` / `l` / `1`, `O` / `0`, `rn` / `m`, `5` / `S`,
`8` / `B`— y esa es la lista exacta de errores que arruina un VIN, un número de parte o una placa. El
contexto de uso justifica el resto: una bahía de taller con mala luz, la mirada de reojo entre dos
tareas y la pantalla sucia. Una grotesca de catálogo se ve mejor en una lámina de presentación; esta
se lee mejor de pie y con guantes, y eso es lo que compra el sistema.

**La mono es de la misma familia**, no una prestada. Así el VIN, el folio y el número de referencia
hablan con la misma voz que el resto de la interfaz en vez de sonar a terminal pegada. Aparece
**solo** para cadenas que son literalmente de máquina: VIN, número de parte, código de error, folio
de factura y el número de referencia.

**Cómo se cargan.** Las dos con `next/font/google` desde `src/app/layout.tsx`, expuestas como
`--font-atkinson` y `--font-atkinson-mono` y enlazadas en `@theme inline`. Ambas llevan
`adjustFontFallback: false` con una pila de respaldo declarada a mano, porque Next no trae métricas
de respaldo para esta familia y el ajuste automático desplazaría el texto al cargar.

### Hierarchy

- **Figure** (700, 44px/44, `tabular-nums`, tracking −0.02em): las cuentas del taller —vehículos en
  bahía, órdenes abiertas, vencidas—. *(Disciplina donada por la dirección competitiva «Banco de
  Nixies»: las cifras del taller tienen presencia física, no son texto de 12px en gris.)*
- **Display** (600, 34px/38): título de una pantalla completa. Uno por vista, como máximo.
- **Headline** (600, 26px/32): cabecera de una lámina grande o de un diálogo.
- **Title** (600, 20px/26): título de sección dentro de una lámina.
- **Body** (400, 14px/22): texto por defecto, formularios, prosa. Máximo 75ch de ancho de línea. Es
  también el rol del texto de los botones, ahí con peso 500.
- **Body dense** (400, 13px/20, `tabular-nums`): filas de tabla en densidad `mostrador`.
- **Label** (600, 12px/16, sin letter-spacing, **caja normal**): etiquetas de campo, cabeceras de
  columna, pestañas de sección, sellos de estado.
- **Mono** (400, 13px/20): VIN, número de parte, folio, código de error y el número de referencia.

### Named Rules

**La Regla de la Caja Normal.** **No hay mayúsculas forzadas en ninguna parte del sistema**: ni en
etiquetas de campo, ni en cabeceras de columna, ni en pestañas, ni en botones, ni en sellos. Nada de
`text-transform: uppercase` ni de tracking abierto para compensarlo. Un catálogo se lee en caja
normal; las mayúsculas seguidas se leen más lento y en español se comen los acentos. Si un texto
necesita destacar, se destaca con peso o con color, nunca gritando.

**La Regla de la Cifra Tabular.** `font-variant-numeric: tabular-nums` es obligatorio en toda
columna de números: placas, cantidades, dinero, folios, fechas. Una columna de números que no alinea
es un defecto, no una preferencia.

**La Regla del Aire Superior.** Sobre un encabezado va siempre más espacio que debajo, en proporción
2:1 (por ejemplo `32px` arriba y `16px` abajo). Un solo ritmo vertical en todo el sistema.

**La Regla de la Fuente Prohibida.** No se introduce Inter, DM Sans, Space Grotesk, IBM Plex,
Poppins, Outfit ni Plus Jakarta Sans. Si Atkinson Hyperlegible Next no resuelve un caso, el caso se
rediseña. Tampoco se trae una tercera familia: el sistema entero es Atkinson, sans y mono.

## Layout

**Unidad base:** 4px. Toda medida del sistema es múltiplo de 4, salvo el filete de 1px.

**Escala de espaciado:** 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72.

**Estructura general.** Riel de pestañas tabuladas a la izquierda (200px desplegado, 52px
plegado) + área de contenido. La cabecera de lámina es una franja de 48px con el nombre de la
pantalla a la izquierda y las acciones a la derecha. No hay barra superior global: el riel ya
identifica dónde estás.

**Contenedor:** el contenido crece hasta 1440px y se centra por encima. Las tablas no tienen ancho
máximo: una tabla ancha es una tabla útil.

### Las dos densidades

Un atributo `data-density` en el contenedor de la aplicación conmuta el sistema completo. Es la
forma mecánica del principio "dos contextos físicos, un solo sistema": cambia la densidad, nunca el
vocabulario.

| Token | `mostrador` (escritorio) | `bahía` (táctil) |
|---|---|---|
| Alto de fila de tabla | 36px | 56px |
| Alto de control (botón, input, select) | 32px | 48px |
| Objetivo táctil mínimo | 32×32 | 44×44 |
| Cuerpo de tabla | Body dense (13px) | Body (14px) |
| Padding interno de lámina | 16px | 20px |
| Icono | 16px | 20px |

`bahía` se activa por defecto bajo 768px de ancho y en dispositivos con puntero grueso
(`pointer: coarse`); el usuario puede fijarlo manualmente.

**Puntos de corte:** 640 · 768 · 1024 · 1280 · 1536px. Bajo 768px el riel de pestañas se convierte
en una barra inferior de iconos y la tabla se convierte en una pila de láminas numeradas — mismas
columnas, apiladas, con el número de referencia arriba a la izquierda.

### La superficie táctil es un destino, no una degradación

La tablet de la bahía no es «el escritorio en chico»: es el segundo lugar donde el sistema se usa de
verdad, de pie, con una mano y a veces con guantes. Toda pantalla se diseña y se entrega para las
dos superficies a la vez.

- **Responsive obligatorio.** Ninguna pantalla se da por terminada probada solo en escritorio. Se
  verifica en ancho de tablet y en ancho de teléfono, y en densidad `bahía`.
- **Objetivo táctil de 44×44 en `bahía`.** Todo lo que se toca —botón, fila accionable, icono de
  acción, casilla, pestaña— llega a ese tamaño. Un icono de 20px vive dentro de un área de 44px.
- **Nada depende de `hover`.** En la bahía no hay puntero: si una acción, un dato o una pista solo
  aparece al pasar el mouse, en tablet no existe. El `hover` refina; nunca revela.
- **La tabla colapsa, no se arrastra.** Bajo 768px la tabla se vuelve la pila de láminas numeradas
  descrita arriba. El scroll horizontal a ciegas —columnas escondidas fuera de pantalla, sin señal de
  que están ahí— no es una solución aceptable.
- **La diferencia de densidad es obligatoria.** `mostrador` y `bahía` no son un lujo opcional: una
  pantalla que se ve igual en las dos densidades está incompleta.

### Named Rules

**La Regla de la Escala Fija** *(disciplina donada por la dirección competitiva «Folio de
Láminas»)*. Cuando se muestran varios estados del mismo objeto —las etapas de una orden, el antes y
el después de un presupuesto—, todas las láminas se presentan a **escala y fondo idénticos**. Lo
único que puede cambiar entre ellas es el contenido. Escalas distintas convierten una comparación en
una ilusión.

## Elevation & Depth

**Este sistema es plano.** La profundidad se comunica por **cambio de fondo y filete**, nunca por
desenfoque. Una lámina se distingue del papel porque es más clara y tiene un borde de 1px, igual que
una hoja sobre una mesa. No hay sombras de reposo, no hay `hover` que levante, no hay
glassmorphism, no hay resplandor.

### Shadow Vocabulary

Existe **un solo** token de sombra, y solo para capas que flotan de verdad sobre el documento:

- **pop** (`box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.28)`): menús desplegables, popovers,
  tooltips, diálogos modales. En oscuro, `rgb(0 0 0 / 0.55)`.

### Named Rules

**La Regla del Papel Plano.** Si un elemento no flota literalmente por encima del documento, no
lleva sombra. Una tarjeta con sombra suave es la marca del panel genérico que este sistema rechaza.

## Shapes

**Radio:** las esquinas son **suaves**. El catálogo se lee, no corta: la esquina casi recta hacía que
cada control pareciera una celda de hoja de cálculo. Lo que distingue a este sistema del panel
genérico no es el radio, es la ausencia de sombra y de aire sobrante.

- `0px` — filetes, reglas, celdas de tabla, franjas.
- `6px` (`sm`) — chips.
- `8px` (`md`) — botones, inputs, selects, pestañas. **Es el radio por defecto del sistema**
  (`--radius: 8px`), no los `0.625rem` que trae shadcn/ui de fábrica.
- `12px` (`lg`) — láminas, tarjetas, diálogos, menús.
- `16px` (`xl`) — el escalón mayor, para superficies grandes.
- `999px` (pill) — sellos de estado, badges y el avatar.

**Bordes:** 1px es el peso normal. 1.5px solo en el anillo de foco. Nunca 2px o más, salvo la muesca
de 3px de la pestaña activa.

**Sin adornos.** El sistema no tiene ninguna forma decorativa: nada que encierre, enmarque o
condecore un dato. El número de referencia se dibujaba antes dentro de un círculo y el círculo se
eliminó — un objeto listado no necesita una insignia para tener un número. Si una forma no separa,
contiene o marca foco, no existe.

**Regla de anulación** *(disciplina donada por la dirección competitiva «Gramática de Almacén»)*:
lo que está bloqueado o fuera de servicio se marca **en positivo**, no apagándolo. Se traza una
regla de 1px en color de Regla sobre **el dato que dejó de valer** —`text-decoration: line-through`
con `skip-ink: none`, la utilidad `.is-ruled-out`— más el texto que dice por qué, al lado y sin
raya. Un gris apagado es indistinguible de un fallo de carga; una regla trazada es una decisión
visible, la misma que se hace a mano sobre el renglón dado de baja en un catálogo impreso.

**La regla se aplica al dato, nunca al contenedor.** En una fila de usuario desactivado se raya el
nombre, no la fila: el correo y los roles hacen falta justo para decidir si se lo reactiva, y una
trama sobre toda la fila los volvía difíciles de leer. En una acción bloqueada se raya el verbo
—«~~Eliminar~~ lo tienen 2 usuarios»— porque lo anulado es la acción, no la razón. Una marca que
tapa el dato que hay que leer para resolver el bloqueo trabaja en contra de Atkinson Hyperlegible,
que es la razón por la que esta familia está elegida.

## Components

### Buttons

- **Forma:** radio 8px, alto 32px (`mostrador`) / 48px (`bahía`), padding lateral 16px. El texto es
  **Body de 14px con peso 500, en caja normal**: «Abrir orden», no «ABRIR ORDEN».
- **Primario:** relleno Rojo de Acción `#CD3F13`, texto blanco (4.87:1). **Uno por pantalla.** En
  oscuro, relleno `#F36537` con texto Fondo de ficha.
- **Secundario:** relleno neutro suave en Lavado, texto Tinta, **sin borde**. Dejó de ser un
  contorno: dos rectángulos delineados uno al lado del otro competían por la misma atención, y el
  primario dejaba de mandar.
- **Fantasma:** sin fondo ni borde, texto Grafito; solo dentro de filas de tabla y barras de
  herramientas.
- **Destructivo:** relleno suave en Sello Rojo —el tono al 10% de fondo, al 25% en el filete y pleno
  como texto, la misma utilidad `.tint` del sello—. Se rellena en rojo pleno con texto blanco
  **solo** dentro del diálogo de confirmación, nunca en la fila.
- **Hover:** el fondo baja 0.05 de luminosidad OKLCH en 120ms. No hay desplazamiento, ni escala, ni
  sombra. **El hover nunca revela información**: en la bahía no hay puntero.
- **Foco:** anillo de 1.5px en Naranja Elite con 2px de separación en el color de fondo.

### El número de referencia — *componente firma*

El número del objeto escrito con almohadilla —`#14`— en la mono del sistema, Mono de 13px con
`tabular-nums`. Nada más: sin círculo, sin filete, sin fondo y sin tamaño propio por densidad.
Aparece en la fila de la orden, junto a cada línea de trabajo, en la línea de repuesto y en el
tablero de bahías.

- **Reposo:** Grafito (`--muted-foreground`). Está para ser encontrado, no para llamar la atención.
- **Activo / seleccionado:** Naranja Elite (`--brand`).

La almohadilla no es decoración: es lo que hace que `#14` se lea como folio y no como cantidad, en
una interfaz donde casi toda cifra es dinero, horas o unidades. Y va en mono porque el número de
referencia pertenece a la misma clase de dato que el VIN y el folio de factura.

**Este componente reemplazó al globo de referencia**, que encerraba el mismo número en un círculo de
20/26px con filete de 1.5px y un pulso al llegar por referencia cruzada. Lo valioso era la regla, no
el círculo: el adorno se fue y la regla se quedó entera. Con él desaparecieron los tokens
`--balloon-size` y `--spacing-balloon`, que ya no existen en `globals.css`.

**La Regla del Mismo Número.** Un objeto tiene un número y solo uno, igual en todas las pantallas
donde aparezca. Si dos pantallas numeran lo mismo distinto, una de las dos está mal. Es la regla que
sostiene el north star; el componente que la muestra es intercambiable, ella no.

### Stamps (estados)

Pill de 22px de alto (`rounded-full`), padding lateral 8px, filete de 1px, texto en Label de 12px
**en caja normal**. Relleno suave: el propio tono al 10% de fondo, al 25% en el filete y pleno como
texto, todo derivado de `currentColor` por la utilidad `.tint`. El color sale de la tabla de sellos.
**Siempre llevan la palabra**: «En diagnóstico», no un punto ámbar.

El `badge` usa el mismo lenguaje. La diferencia es de rol, no de forma: el estado de un objeto se
comunica con un sello; el badge es auxiliar (un contador, una etiqueta libre).

### Plates (láminas / contenedores)

Fondo Lámina sobre Papel, filete 1px Regla, radio 12px, padding interno 16px (`mostrador`) / 20px
(`bahía`), sin sombra. La cabecera de una lámina es una franja de 40px separada del cuerpo por un
filete, con el título en Title y las acciones a la derecha.

### Tables

La tabla es el componente central del sistema, no un caso más.

- Cabecera: Label de 12px en caja normal, Grafito, con un filete Regla debajo. Fija al hacer scroll.
- Filas separadas por filete de 1px. Sin cebra: el filete basta y la cebra pelea con los sellos.
- Alineación: texto a la izquierda, números y dinero a la derecha, siempre `tabular-nums`.
- Primera columna: el número de referencia.
- Borde izquierdo de la fila: barra de 2px que codifica la urgencia en la escala de tinta continua.
- Hover de fila: el fondo pasa a Papel. Sin sombra, sin desplazamiento.
- Fila seleccionada: barra izquierda de 2px en Naranja Elite y fondo Papel.
- Vacío: la tabla conserva su cabecera y muestra una línea en Grafito que dice qué falta y qué
  acción la llenaría. Nunca una ilustración.
- En pantalla chica colapsa a la pila de láminas numeradas, no a scroll horizontal a ciegas. Ninguna
  acción de fila puede quedar escondida detrás del `hover`: en `bahía` está siempre visible y con
  área de 44×44.

### Inputs / Fields

- Fondo Lámina, filete 1px Filete, radio 8px, alto 32px / 48px, padding lateral 10px.
- Etiqueta encima en Label de 12px, caja normal, Grafito, con 6px de separación.
- **Foco:** el filete pasa a Naranja Elite y aparece un anillo de 1.5px con 2px de separación.
- **Error:** filete en Sello Rojo y mensaje debajo en Sello Rojo, 12px. El mensaje viene del
  `message` de `ApiErrorResponse`, y el campo se marca a partir de `details`.
- **Deshabilitado:** regla de anulación sobre la etiqueta del campo, no opacidad.
- **Solo lectura por permiso:** el campo se muestra como texto plano sin caja. Un usuario sin
  permiso de escritura no ve un control muerto.

### Navigation — el riel tabulado

Riel izquierdo de 200px / 52px plegado. Cada módulo es una pestaña con etiqueta en Label de 12px en
caja normal, alto 34px, separadas por filete.

- **Reposo:** texto Grafito, sin fondo.
- **Hover:** texto Tinta, fondo Papel.
- **Activa:** muesca de 3px en Naranja Elite pegada al borde izquierdo, texto Tinta, peso 600.
  Nunca un bloque de fondo relleno.
- **Por permiso:** una pestaña para la que el usuario no tiene ningún permiso `module.*`
  **no se renderiza**. Oculta no es lo mismo que deshabilitada: deshabilitado dice "no ahora",
  ausente dice "esto no es tuyo".
- Bajo 768px el riel se vuelve una barra inferior de iconos con etiqueta de 12px y área táctil de
  44×44 por destino.

### Breadcrumb — la ruta de ficha

Sobre el título de la pantalla, **no** en una barra global. El riel dice el módulo; este rastro
dice la ficha, como el número de catálogo de una pieza.

- Label de 12px, caja normal. Tramos anteriores en Grafito; el actual en Tinta, peso 600.
- Separador: chevron de `lucide-react` (`size-icon`, trazo 1.5), Grafito. No es un control.
- El último tramo no es un enlace (`aria-current="page"`). Un tramo con destino sí lo es, con
  área táctil `--touch-min`.
- Nada de fondo, sombra, píldora ni mayúsculas. Si la ruta no tiene rastro, no se dibuja nada.

### Logo

El wordmark de Elite Service vive en la cabecera del riel, alto mínimo 24px, con espacio libre
alrededor igual a la altura de la mayúscula. No se recolorea, no se pone sobre un campo naranja, no
se deforma.

> **Falta el archivo original.** No existe SVG ni PNG en alta: solo referencias generadas. Lo que se
> use antes de producción es una reconstrucción provisional y debe quedar marcada como tal. Pedir el
> vectorial al taller es un pendiente bloqueante para lanzar.

## Do's and Don'ts

### Do:

- **Do** poner el número de referencia en todo objeto listable —`#14`, en mono y con almohadilla— y
  usar el mismo número en todas las pantallas donde aparezca.
- **Do** usar `tabular-nums` en toda columna de números, sin excepción.
- **Do** dar profundidad con fondo y filete de 1px; reservar la única sombra (`pop`) para lo que
  flota de verdad.
- **Do** escribir el estado con palabra **y** color: «Vencida» en Sello Rojo, nunca un punto rojo.
- **Do** entregar cada pantalla responsive y usable con el dedo: verificada en ancho de tablet y de
  teléfono, en densidad `bahía`, con objetivos táctiles de 44×44 y sin nada que dependa de `hover`.
- **Do** marcar lo anulado con la regla de 1px sobre el dato que dejó de valer, y decir por qué al
  lado, sin raya.
- **Do** ocultar por completo lo que el usuario no tiene permiso de ver, y mostrar como texto plano
  lo que puede ver pero no editar.
- **Do** declarar el vencimiento de lo transitorio a la vista *(disciplina donada por la dirección
  declinada «Cantera de Nubes»)*: un bloqueo de edición, un borrador o un cambio sin guardar dicen
  cuánto les queda en lugar de desaparecer en silencio.
- **Do** definir cada color en `:root` y **redefinir solo los tokens** bajo `.dark`. Ningún color
  puede existir únicamente en el bloque oscuro.
- **Do** mantener toda animación en 120ms (estado) / 180ms (entrada) / 240ms (máximo) con
  `cubic-bezier(0.2, 0, 0, 1)`, y respetar `prefers-reduced-motion`.

### Don't:

- **Don't** dibujar velocímetros, agujas, tacómetros ni medidores tipo tablero. Fue la referencia de
  partida y quedó descartada por el usuario.
- **Don't** usar resplandor neón, `box-shadow` luminoso, glassmorphism ni fibra de carbono.
- **Don't** usar degradados como superficie. El único degradado permitido en todo el sistema vive
  dentro del logo.
- **Don't** usar el Naranja Elite como color de texto ni como fondo de una región grande (techo: 5%
  de la pantalla).
- **Don't** poner **sombra** en una tarjeta. Lo que este sistema rechaza del panel genérico es la
  sombra de reposo, no el radio: la lámina es de esquina suave (12px) **y** plana. Profundidad con
  fondo y filete, siempre.
- **Don't** poner texto en mayúsculas forzadas —`text-transform: uppercase`— en ningún lugar:
  etiquetas, cabeceras de columna, pestañas, botones ni sellos.
- **Don't** esconder una acción, un dato o una pista detrás del `hover`, ni entregar una pantalla
  probada solo en escritorio.
- **Don't** usar `#FFFFFF` puro como fondo ni `#000000` puro como fondo de ficha.
- **Don't** volver al papel cálido: **ningún neutro del tema claro lleva matiz cálido**. El fondo
  crema con acento terracota es la estética por defecto de la interfaz generada, y es de la que este
  sistema se aparta a propósito. Los neutros de los dos temas comparten el matiz 250.
- **Don't** encerrar el número de referencia en un círculo, una píldora, un cuadro ni ninguna otra
  insignia, ni darle un tamaño propio por densidad. Va suelto, en mono y con almohadilla. El sistema
  no tiene adornos circulares.
- **Don't** rayar las tablas en cebra ni ensanchar las filas para que "respiren": la densidad es el
  producto.
- **Don't** comunicar un estado solo con color, ni deshabilitar bajando la opacidad, ni tapar con
  una marca de estado un dato que hay que leer para resolver ese estado.
- **Don't** introducir Inter, DM Sans, Space Grotesk, IBM Plex, Poppins, Outfit ni Plus Jakarta
  Sans.
- **Don't** condicionar nada por nombre de rol. Toda variación de UI se decide contra una clave
  `module.action`.
- **Don't** usar emoji como iconografía: los iconos son de `lucide-react`, trazo 1.5px, 16px
  (`mostrador`) / 20px (`bahía`).
