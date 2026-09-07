# Tarea: prototipo HTML de Caja — Elite Service

Sos Claude Opus. Escribí UN archivo y nada más:

`docs/prototype/cash.html`

No toques React, no crees spec, no edites `apps/`, no toques otros prototipos.

El archivo tiene que abrir en el navegador sin build, sin Next, sin Nest. HTML + CSS + JS nativo. Interactividad real: abrir turno, cobrar (mock), cerrar con conteo y diferencia, conmutar tema y densidad, y las vistas de «sin turno» / «turno abierto» / «historial».

## Por qué existe

El dueño recorrió Caja paso a paso. Entendió la idea (una cajita de efectivo, no el reporte del día) y rechazó la pantalla actual.

Hoy `/carwash/cash` es:

- 6 `StatCard` gemelas: Fondo, Efectivo cobrado, Esperado, Tarjeta, Transferencia, Tickets cobrados.
- Debajo, una `DataTable` «Cobros de este turno» con sello Efectivo/Tarjeta/Transferencia (spec 038, recién hecha, no le gustó).
- Debajo, historial de cierres.

El defecto: **todo pesa igual**. El cajón (cuánto efectivo debería haber) se mezcla con el mix de métodos y con el conteo de tickets. Los tres métodos se leen como tres números más. La lista de cobros es una tabla de más, no el gesto de «este billete entró, esta tarjeta no».

Rediseñá la jerarquía. No maquilles las 6 tarjetas.

## Antes de escribir, leé (completos)

1. `apps/web/DESIGN.md` — ley visual
2. `apps/web/src/app/globals.css` — tokens de hoy (plano: `--shadow: none`; `--shadow-dialog` solo en el modal)
3. `docs/prototype/combobox.html` — el chasis del prototipo (topbar, switches, tokens copiados de globals, no del date-picker)
4. `specs/010-carwash-cash.md` — reglas de negocio de la caja
5. `specs/022-wave3-cash-discount-reverse.md` — cierre con diferencia ≥ $10 pide confirmación
6. `specs/038-cash-shift-payments.md` — lo que se implementó y se rechazó (lista + sello)
7. `apps/web/src/features/carwash/components/cash-screen.tsx`
8. `apps/web/src/features/carwash/components/close-cash-dialog.tsx`
9. `apps/web/src/features/carwash/components/cash-payments-table.tsx`
10. `apps/web/src/features/carwash/components/payment-method-stamp.tsx`

## Formato del archivo

Mismo chasis que `combobox.html`:

- `<html lang="es" data-theme="dark" data-density="mostrador">`
- Fuentes Google: Saira (600/700/800 itálica) + Inter (400/500/600/700)
- Bloque de tokens **copiado de `globals.css` de hoy**, no del date-picker. En particular:
  - `--shadow: none` (diseño plano)
  - `--shadow-dialog` sí existe, **solo** para el diálogo de cerrar / abrir
  - Radios: `--radius-sm: 6px`, `--radius-control: 10px`, `--radius-row: 12px`, `--radius-card: 14px`
  - Densidades `mostrador` / `bahia` con `--row-h`, `--control-h`, `--touch-min`, `--icon-size`, `--field-px/pt/pb`
  - Tema claro via `[data-theme="light"]` redefiniendo valores, ningún color nace solo en un tema
- Topbar con título en Saira itálica, subtítulo, y dos segmentos: Oscuro/Claro y Mostrador/Bahía
- `prefers-reduced-motion` apaga animaciones
- Corte 900px (`899.98px`) como en el sistema; también usable a 390px
- Cero hex / rgb / oklch fuera del bloque de tokens
- Cero `text-transform: uppercase`
- Cero emoji como iconografía. SVG lucide, stroke 1.5, tamaño `--icon-size`
- Textos de UI en español. Identificadores JS en inglés
- Nada depende de `hover` para funcionar
- Un primario (degradado llama) por vista. El resto outline / ghost

## Qué tiene que haber en la página

Tres estados de la misma pantalla, conmutables desde el prototipo (pestañas o un selector de escena, no tres páginas):

### 1. Sin turno abierto

Fondo (FieldBox, default $0.00) + «Abrir caja». Texto: «Sin caja abierta no se cobra.» Nada de stats vacías fingiendo un turno.

### 2. Turno abierto — la escena principal, la que hay que rediseñar

Datos de demo (fijos, para que el dueño compare):

- Fondo $20.00
- Cobros:
  - #8  Lavado + aspirado · P123-123 · Efectivo $8.00 · 2:12 p.m.
  - #9  Lavado + aspirado + pasteado · P123-123 · Tarjeta $10.00 · 2:14 p.m.
  - #10 Lavado + aspirado · P123-123 · Efectivo $3.00 · 2:27 p.m.
  - #11 Lavado + pasteado a máquina · P456-789 · Transferencia $14.00 · 2:40 p.m.
- Totales: efectivo $11.00 · tarjeta $10.00 · transferencia $14.00 · esperado $31.00 · 4 tickets

Reglas de lectura (el diseño las tiene que hacer obvias, no explicarlas con un párrafo):

- **El cajón es el protagonista.** Esperado = fondo + efectivo. Tarjeta y transferencia se informan, no se suman al cajón.
- **Los tres métodos se distinguen a metro.** No tres tarjetas gemelas. El dueño tiene que ver de un vistazo cuánto efectivo hay vs cuánto se fue por tarjeta vs transferencia.
- **Cada cobro muestra el método** (palabra escrita, no solo color). Clic de fila simula ir al lavado (toast o highlight, no navegues de verdad).
- Primario: «Cerrar caja».

No copies la grilla de 6 StatCards. Inventá la jerarquía. Si hay cifra grande, es el esperado del cajón o la diferencia, no «tickets cobrados».

### 3. Cerrar caja (diálogo)

Mock de `Dialog`: overlay, `--shadow-dialog`, radio `--radius-card`. Bajo 900px: hoja desde abajo.

- Esperado en cifra grande (Saira itálica)
- Campo «Contado» (FieldBox, ≥ `--touch-min` en bahía)
- Diferencia en vivo: Cuadra (`--go-text`) / Sobra (`--warn-text`) / Falta (`--danger-text`). Palabra + monto, nunca solo color.
- Si `|contado − esperado| ≥ $10`, checkbox «Confirmo la diferencia» para habilitar el cierre (022).
- Notas opcionales
- Cancelar + Cerrar caja (primario)

Al confirmar, la escena pasa a «recién cerrado» o vuelve a sin turno y el cierre cae al historial. Elegí lo que se lea más claro.

### 4. Historial

Lista de turnos cerrados (DataTable del sistema: Ref., turno, quién, esperado, contado, diferencia con sello Cuadra / Falta / Sobra). Dos o tres filas de demo, una que cuadre y una con faltante. Clic abre un detalle de solo lectura del turno (puede ser la misma jerarquía del abierto, congelada).

## Comportamiento (ley de negocio — no se negocia)

- Una caja física, un turno a la vez.
- Esperado = fondo + Σ efectivo. Tarjeta y transferencia **no** entran al cajón.
- Sin turno abierto no se cobra.
- Un cobro = un pago = el total exacto. Sin vuelto, sin abono.
- El arqueo cuenta solo efectivo.
- No hay gastos, reapertura ni caja de taller.
- La pista no aparece acá.

## Nunca

- React, Next, Tailwind CDN, shadcn
- Hex fuera de tokens
- Sombra salvo `--shadow-dialog` en el modal
- `--gradient-action` pintando una tarjeta de estadística (es acción, no zona)
- Texto de UI en inglés
- 6 StatCards gemelas (eso es lo que se rechazó)
- Comunicar método o diferencia solo con color
- Inventar gastos, DTE, varias cajas, contar tarjeta a mano

## Listo cuando

1. `docs/prototype/cash.html` existe y abre solo.
2. Oscuro/claro y mostrador/bahía conmutan de verdad.
3. En la escena 2, a 1280px y a 390px, se lee en 3 segundos: cuánto hay que haber en el cajón, cuánto fue tarjeta, cuánto transferencia, y cuál cobro fue cuál.
4. El diálogo de cierre calcula la diferencia en vivo y pide confirmación si |diff| ≥ 10.
5. 390px y 1280px usables. En bahía los toques ≥ 44px.

Cuando termines, no expliques el oficio. Decí la ruta del archivo y tres cosas que el dueño tiene que mirar a ojo.
