---
name: Elite Service
description: El taller leído como un catálogo de piezas — todo lleva número, y el número es el vínculo.
colors:
  brand-elite: "oklch(0.615 0.2 36)"
  fill-action: "oklch(0.52 0.19 32)"
  paper: "oklch(0.977 0.004 85)"
  plate: "oklch(0.995 0.002 85)"
  ink: "oklch(0.205 0.008 250)"
  graphite: "oklch(0.515 0.012 250)"
  hairline: "oklch(0.885 0.006 250)"
  rule: "oklch(0.795 0.008 250)"
  stamp-amber: "oklch(0.55 0.125 68)"
  stamp-green: "oklch(0.525 0.125 150)"
  stamp-red: "oklch(0.545 0.19 25)"
  stamp-blue: "oklch(0.54 0.13 245)"
  brand-elite-lit: "oklch(0.7 0.18 40)"
  fill-action-lit: "oklch(0.68 0.185 38)"
  fiche-ground: "oklch(0.19 0.012 250)"
  fiche-plate: "oklch(0.238 0.013 250)"
  fiche-ink: "oklch(0.94 0.005 250)"
  fiche-graphite: "oklch(0.68 0.01 250)"
  fiche-hairline: "oklch(0.34 0.012 250)"
  fiche-rule: "oklch(0.43 0.014 250)"
  stamp-amber-lit: "oklch(0.78 0.13 75)"
  stamp-green-lit: "oklch(0.72 0.13 152)"
  stamp-red-lit: "oklch(0.68 0.17 25)"
  stamp-blue-lit: "oklch(0.7 0.115 245)"
typography:
  figure:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.02em"
    fontVariant: "tabular-nums"
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "38px"
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0"
  body-dense:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"
    fontVariant: "tabular-nums"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"
rounded:
  none: "0px"
  xs: "2px"
  sm: "3px"
  md: "4px"
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
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "oklch(0.47 0.19 32)"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "32px"
  balloon:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    size: "20px"
  balloon-active:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.brand-elite}"
    rounded: "{rounded.pill}"
    size: "20px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
    height: "18px"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "34px"
---

# Design System: Elite Service

> Los valores en `oklch()` del frontmatter son **la fuente de verdad**: el proyecto usa Tailwind v4
> con tokens OKLCH en `globals.css`. Los hex que aparecen abajo son el renderizado sRGB de
> referencia para poder verificarlos a ojo, no una segunda definición.
>
> Este documento define el sistema. **No hay implementación todavía**: la spec que lo baja a
> código es `specs/002-design-system.md`, pendiente de aprobación.

## Overview

**Creative North Star: "El Catálogo de Piezas"**

Elite Service se lee como el catálogo de repuestos que está detrás del mostrador: tinta sobre papel
duro, un solo color de imprenta, filetes de un pelo, cifras tabulares y **globos de referencia
numerados** que atan un dibujo a una fila de tabla. Ese globo es la firma del sistema. Cada objeto
del taller —una orden, un vehículo, una línea de trabajo, un repuesto— lleva un número, y ese número
es lo mismo en todas las pantallas donde aparece. Buscar deja de ser buscar: es seguir una
referencia.

El modo claro es la página impresa del catálogo. **El modo oscuro es la microficha**: el mismo
documento leído como negativo en un lector iluminado. No es "el claro invertido con más contraste";
es el segundo medio de lectura real del mismo papel, y por eso ninguno de los dos es secundario.
Recepción trabaja en interior, la bahía a veces bajo luz directa: los dos temas existen porque los
dos contextos físicos existen.

La densidad aquí es una virtud, no una concesión. El mostrador quiere ver quince órdenes de un
vistazo, no cinco tarjetas con aire. Lo que se rechaza explícitamente: el tablero automotriz
—velocímetros, agujas, medidores, brillo neón, fibra de carbono— que fue la referencia de partida y
que el usuario descartó por no corresponder a órdenes de trabajo, inventario y facturación; y su
opuesto predecible, el panel de administración genérico de tarjetas redondeadas con sombra suave y
acento azul.

**Key Characteristics:**

- Todo objeto lleva número; el número es el vínculo entre pantallas.
- Un solo acento (el naranja Elite), presente en ≤5% de cualquier pantalla.
- Esquinas casi rectas (3px), filetes de 1px, **cero sombras** salvo en capas flotantes.
- Cifras tabulares por defecto: las columnas de números alinean siempre.
- Dos densidades, un solo vocabulario: `mostrador` (fila 36px) y `bahía` (fila 56px).
- Claro = papel impreso. Oscuro = microficha. Ambos de primera clase.

## Colors

Estrategia: **Restringida** — neutros más un acento. Es la estrategia que corresponde a una
superficie donde el usuario vino a trabajar, no a ser convencido.

### Primary

- **Naranja Elite** `oklch(0.615 0.2 36)` / `#E34716`: el color de la marca, tomado del arco del
  velocímetro del logo. Es **marca**, no texto: aparece en el globo activo, en la muesca de la
  pestaña activa, en el anillo de foco y en los filetes que señalan la fila viva. Contra la lámina
  da 4.01:1, insuficiente para texto corrido; por eso nunca se usa para texto.
- **Rojo de Acción** `oklch(0.52 0.19 32)` / `#BE260B`: el relleno accionable. Es el mismo tono de
  marca bajado en luminosidad hasta que el blanco encima alcanza 6.06:1. Solo el botón primario, y
  solo uno por pantalla. En oscuro sube a `oklch(0.68 0.185 38)` / `#F36537` con texto casi negro
  encima (5.94:1).

### Neutral — Claro (la página impresa)

- **Papel** `oklch(0.977 0.004 85)` / `#F9F7F4`: el fondo de la aplicación. Blanco cálido, nunca
  `#FFFFFF`: el blanco puro deslumbra bajo la luz de una bahía.
- **Lámina** `oklch(0.995 0.002 85)` / `#FEFDFC`: la superficie de contenido (tablas, formularios,
  paneles). Más clara que el papel: la hoja se apoya sobre la mesa.
- **Tinta** `oklch(0.205 0.008 250)` / `#14171B`: todo el texto principal. 17.65:1 sobre lámina.
- **Grafito** `oklch(0.515 0.012 250)` / `#62686E`: etiquetas, unidades, texto secundario. 5.54:1.
- **Filete** `oklch(0.885 0.006 250)` / `#D6D9DD`: la línea de un pelo entre celdas y campos.
- **Regla** `oklch(0.795 0.008 250)` / `#B8BDC1`: la separación entre secciones y el borde exterior
  de una lámina.

### Neutral — Oscuro (la microficha)

- **Fondo de ficha** `oklch(0.19 0.012 250)` / `#101419`: el entorno del lector. Azulado, no negro
  puro: el negro absoluto convierte el sistema en el tablero neón que rechazamos.
- **Plancha** `oklch(0.238 0.013 250)` / `#1A1F25`: la película iluminada; equivale a Lámina.
- **Tinta de ficha** `oklch(0.94 0.005 250)` / `#E9EBEE`: 13.87:1 sobre plancha. No blanco puro.
- **Grafito de ficha** `oklch(0.68 0.01 250)` / `#94999E`: 5.74:1.
- **Filete de ficha** `oklch(0.34 0.012 250)` / `#33393E` · **Regla de ficha**
  `oklch(0.43 0.014 250)` / `#4A5157`.

### Tertiary — Sellos de estado

Colores de sello de goma, no de píldora pastel. Se usan como **texto + borde de 1px sobre fondo
transparente**, nunca como relleno saturado. Todos superan 4.5:1 sobre su superficie.

| Sello | Claro | Oscuro | Uso |
|---|---|---|---|
| Ámbar | `oklch(0.55 0.125 68)` / `#A06100` | `oklch(0.78 0.13 75)` / `#E8AA4E` | En proceso, requiere atención |
| Verde | `oklch(0.525 0.125 150)` / `#257E41` | `oklch(0.72 0.13 152)` / `#5EBC7B` | Listo, aprobado, pagado |
| Rojo | `oklch(0.545 0.19 25)` / `#C72D31` | `oklch(0.68 0.17 25)` / `#EF6661` | Vencido, rechazado, detenido; también `destructive` |
| Azul | `oklch(0.54 0.13 245)` / `#1174B4` | `oklch(0.7 0.115 245)` / `#5CA5E1` | Informativo, programado |
| Grafito | Grafito | Grafito de ficha | Recibido, en espera, neutro |

### Named Rules

**La Regla del Acento Único.** El Naranja Elite ocupa como máximo el **5%** de los píxeles de
cualquier pantalla. No hay fondos de marca, ni cabeceras naranjas, ni bandas de color. Su rareza es
lo que lo hace funcionar como señal.

**La Regla del Acento Que No Habla.** El Naranja Elite nunca es color de texto. Para texto se usa
Tinta, Grafito o un sello. El acento marca, no dice.

**La Regla del Color Que No Basta.** Ningún estado se comunica solo con color. Un sello lleva
siempre etiqueta escrita; un bloqueo lleva siempre trama; una fila urgente lleva siempre peso
tipográfico. Un usuario daltónico debe poder operar el sistema en escala de grises.

**La Regla de la Tinta Continua** *(donada por la dirección declinada «Cola Cracktro»)*. La urgencia
no es un chip: es una escala continua. La antigüedad de una orden se codifica en cuatro pasos de
densidad de tinta sobre la barra de 2px del borde izquierdo de la fila y sobre el peso de la columna
de placa — Grafito 400 → Grafito 500 → Ámbar 600 → Rojo 700. La cola se lee sin leerla.

## Typography

**Familia principal:** **Archivo** (variable, pesos 400–700) con `ui-sans-serif, system-ui,
sans-serif` de respaldo.
**Familia mono:** **JetBrains Mono** con `ui-monospace, monospace` de respaldo.

**Carácter:** Archivo es una grotesca de trabajo diseñada para impresión de alta legibilidad en
cuerpos pequeños — exactamente el problema de un catálogo de repuestos y de una tabla de órdenes a
13px. Tiene eje de ancho, así que las etiquetas de sección usan la variante estrecha sin traer una
segunda familia al proyecto. JetBrains Mono aparece **solo** para cadenas que son literalmente de
máquina: VIN, número de parte, código de error, folio de factura.

### Hierarchy

- **Figure** (700, 44px/44, `tabular-nums`, tracking −0.02em): las cuentas del taller —vehículos en
  bahía, órdenes abiertas, vencidas—. *(Disciplina donada por la dirección competitiva «Banco de
  Nixies»: las cifras del taller tienen presencia física, no son texto de 12px en gris.)*
- **Display** (600, 34px/38): título de una pantalla completa. Uno por vista, como máximo.
- **Headline** (600, 26px/32): cabecera de una lámina grande o de un diálogo.
- **Title** (600, 20px/26): título de sección dentro de una lámina.
- **Body** (400, 14px/22): texto por defecto, formularios, prosa. Máximo 75ch de ancho de línea.
- **Body dense** (400, 13px/20, `tabular-nums`): filas de tabla en densidad `mostrador`.
- **Label** (600, 11px/16, tracking 0.08em, MAYÚSCULAS): etiquetas de campo, cabeceras de columna,
  pestañas de sección, sellos de estado.
- **Mono** (400, 13px/20): VIN, número de parte, folio, código de error.

### Named Rules

**La Regla de la Cifra Tabular.** `font-variant-numeric: tabular-nums` es obligatorio en toda
columna de números: placas, cantidades, dinero, folios, fechas. Una columna de números que no alinea
es un defecto, no una preferencia.

**La Regla del Aire Superior.** Sobre un encabezado va siempre más espacio que debajo, en proporción
2:1 (por ejemplo `32px` arriba y `16px` abajo). Un solo ritmo vertical en todo el sistema.

**La Regla de la Fuente Prohibida.** No se introduce Inter, DM Sans, Space Grotesk, IBM Plex,
Poppins, Outfit ni Plus Jakarta Sans. Si Archivo no resuelve un caso, el caso se rediseña.

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
| Globo de referencia | 20px | 26px |

`bahía` se activa por defecto bajo 768px de ancho y en dispositivos con puntero grueso
(`pointer: coarse`); el usuario puede fijarlo manualmente.

**Puntos de corte:** 640 · 768 · 1024 · 1280 · 1536px. Bajo 768px el riel de pestañas se convierte
en una barra inferior de iconos y la tabla se convierte en una pila de láminas numeradas — mismas
columnas, apiladas, con el globo arriba a la izquierda.

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

**Radio:** el catálogo es impreso, así que las esquinas son casi rectas.

- `0px` — filetes, reglas, celdas de tabla, franjas.
- `2px` — sellos de estado, chips.
- `3px` — botones, inputs, selects, pestañas. **Es el radio por defecto del sistema**
  (`--radius: 3px`), no los `0.625rem` que trae shadcn/ui de fábrica.
- `4px` — láminas, paneles, diálogos.
- `999px` — únicamente el globo de referencia y el avatar.

**Bordes:** 1px es el peso normal. 1.5px solo en el globo de referencia y en el anillo de foco.
Nunca 2px o más, salvo la muesca de 3px de la pestaña activa.

**Trama de bloqueo** *(disciplina donada por la dirección competitiva «Gramática de Almacén»)*: lo
que está bloqueado o fuera de servicio se marca **en positivo**, no apagándolo. Se cruza con una
trama diagonal de 45° —`repeating-linear-gradient(45deg, transparent 0 5px, var(--rule) 5px 6px)`—
más el texto que dice por qué. Un gris apagado es indistinguible de un fallo de carga; una trama
diagonal es una decisión visible.

## Components

### Buttons

- **Forma:** radio 3px, alto 32px (`mostrador`) / 48px (`bahía`), padding lateral 16px, Label en
  mayúsculas.
- **Primario:** relleno Rojo de Acción `#BE260B`, texto blanco (6.06:1). **Uno por pantalla.** En
  oscuro, relleno `#F36537` con texto Fondo de ficha.
- **Secundario:** fondo Lámina, filete 1px Regla, texto Tinta.
- **Fantasma:** sin fondo ni borde, texto Grafito; solo dentro de filas de tabla y barras de
  herramientas.
- **Destructivo:** filete y texto en Sello Rojo; se rellena en rojo **solo** dentro del diálogo de
  confirmación, nunca en la fila.
- **Hover:** el fondo baja 0.05 de luminosidad OKLCH en 120ms. No hay desplazamiento, ni escala, ni
  sombra.
- **Foco:** anillo de 1.5px en Naranja Elite con 2px de separación en el color de fondo.

### El globo de referencia — *componente firma*

Un círculo con un número dentro: 20px (`mostrador`) / 26px (`bahía`), filete 1.5px, fondo Lámina,
cifra en Label tabular centrada. Aparece en la fila de la orden, junto a cada línea de trabajo,
en la línea de repuesto y en el tablero de bahías.

- **Reposo:** filete y cifra en Tinta.
- **Activo / seleccionado:** filete y cifra en Naranja Elite.
- **Al llegar por referencia cruzada:** pulsa una sola vez, 140ms, subiendo el filete a 2px y
  volviendo.

**La Regla del Mismo Número.** Un objeto tiene un número y solo uno, igual en todas las pantallas
donde aparezca. Si dos pantallas numeran lo mismo distinto, una de las dos está mal.

### Stamps (estados)

Texto en Label mayúsculas, filete 1px, radio 2px, padding 1px 6px, alto 18px, fondo transparente.
El color sale de la tabla de sellos. **Siempre llevan la palabra**: `EN DIAGNÓSTICO`, no un punto
ámbar.

### Plates (láminas / contenedores)

Fondo Lámina sobre Papel, filete 1px Regla, radio 4px, padding interno 16px (`mostrador`) / 20px
(`bahía`), sin sombra. La cabecera de una lámina es una franja de 40px separada del cuerpo por un
filete, con el título en Title y las acciones a la derecha.

### Tables

La tabla es el componente central del sistema, no un caso más.

- Cabecera: Label en mayúsculas, Grafito, con un filete Regla debajo. Fija al hacer scroll.
- Filas separadas por filete de 1px. Sin cebra: el filete basta y la cebra pelea con los sellos.
- Alineación: texto a la izquierda, números y dinero a la derecha, siempre `tabular-nums`.
- Primera columna: el globo de referencia.
- Borde izquierdo de la fila: barra de 2px que codifica la urgencia en la escala de tinta continua.
- Hover de fila: el fondo pasa a Papel. Sin sombra, sin desplazamiento.
- Fila seleccionada: barra izquierda de 2px en Naranja Elite y fondo Papel.
- Vacío: la tabla conserva su cabecera y muestra una línea en Grafito que dice qué falta y qué
  acción la llenaría. Nunca una ilustración.

### Inputs / Fields

- Fondo Lámina, filete 1px Filete, radio 3px, alto 32px / 48px, padding lateral 10px.
- Etiqueta encima en Label mayúsculas Grafito, con 6px de separación.
- **Foco:** el filete pasa a Naranja Elite y aparece un anillo de 1.5px con 2px de separación.
- **Error:** filete en Sello Rojo y mensaje debajo en Sello Rojo, 12px. El mensaje viene del
  `message` de `ApiErrorResponse`, y el campo se marca a partir de `details`.
- **Deshabilitado:** trama de bloqueo a 45°, no opacidad.
- **Solo lectura por permiso:** el campo se muestra como texto plano sin caja. Un usuario sin
  permiso de escritura no ve un control muerto.

### Navigation — el riel tabulado

Riel izquierdo de 200px / 52px plegado. Cada módulo es una pestaña con etiqueta en Label
mayúsculas, alto 34px, separadas por filete.

- **Reposo:** texto Grafito, sin fondo.
- **Hover:** texto Tinta, fondo Papel.
- **Activa:** muesca de 3px en Naranja Elite pegada al borde izquierdo, texto Tinta, peso 600.
  Nunca un bloque de fondo relleno.
- **Por permiso:** una pestaña para la que el usuario no tiene ningún permiso `module.*`
  **no se renderiza**. Oculta no es lo mismo que deshabilitada: deshabilitado dice "no ahora",
  ausente dice "esto no es tuyo".
- Bajo 768px el riel se vuelve una barra inferior de iconos con etiqueta de 11px.

### Logo

El wordmark de Elite Service vive en la cabecera del riel, alto mínimo 24px, con espacio libre
alrededor igual a la altura de la mayúscula. No se recolorea, no se pone sobre un campo naranja, no
se deforma.

> **Falta el archivo original.** No existe SVG ni PNG en alta: solo referencias generadas. Lo que se
> use antes de producción es una reconstrucción provisional y debe quedar marcada como tal. Pedir el
> vectorial al taller es un pendiente bloqueante para lanzar.

## Do's and Don'ts

### Do:

- **Do** poner un globo de referencia numerado en todo objeto listable, y usar el mismo número en
  todas las pantallas donde aparezca.
- **Do** usar `tabular-nums` en toda columna de números, sin excepción.
- **Do** dar profundidad con fondo y filete de 1px; reservar la única sombra (`pop`) para lo que
  flota de verdad.
- **Do** escribir el estado con palabra **y** color: `VENCIDA` en Sello Rojo, nunca un punto rojo.
- **Do** marcar lo bloqueado con la trama diagonal de 45° y decir por qué está bloqueado.
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
- **Don't** poner tarjetas grandes con esquinas de 10px y sombra suave: es exactamente el panel
  genérico que este sistema rechaza.
- **Don't** usar `#FFFFFF` puro como fondo ni `#000000` puro como fondo de ficha.
- **Don't** rayar las tablas en cebra ni ensanchar las filas para que "respiren": la densidad es el
  producto.
- **Don't** comunicar un estado solo con color, ni deshabilitar bajando la opacidad.
- **Don't** introducir Inter, DM Sans, Space Grotesk, IBM Plex, Poppins, Outfit ni Plus Jakarta
  Sans.
- **Don't** condicionar nada por nombre de rol. Toda variación de UI se decide contra una clave
  `module.action`.
- **Don't** usar emoji como iconografía: los iconos son de `lucide-react`, trazo 1.5px, 16px
  (`mostrador`) / 20px (`bahía`).
