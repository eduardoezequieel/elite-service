# Arreglar el botón Filtros del prototipo (no implementes la app)

El usuario hizo clic en **Filtros** en `docs/prototype/filters-and-search.html` y **no pasa nada**. Quiere el comportamiento del popover de la captura de tutoría: botón `Filtros` con chevron, y al tocarlo una tarjeta flotante con selects etiquetados y **Restablecer**.

Trabajá **solo** el prototipo HTML. No toques `apps/web`. No hagas commit. El archivo está sin trackear en este checkout (`/Users/elopez/Documents/elite-service`).

**NUNCA:** Playwright, Puppeteer, Chromium, jsdom, claude-in-chrome, `npm i` de browsers, ni ningún motor headless. No instales nada. El usuario verifica el HTML a ojo.

## Archivo
- `docs/prototype/filters-and-search.html`
- Referencia de fechas (no romperlo): `docs/prototype/date-picker.html`
- Tokens y reglas: `apps/web/DESIGN.md`, `AGENTS.md` regla 12 (prototipos HTML aislados en `docs/prototype/`)

## Comportamiento pedido
Al pulsar `#filter-btn`:
1. `#popover-panel` recibe la clase `.open` (`display: flex` ya está en el CSS).
2. El panel se ve anclado debajo/alineado al botón, no recortado, no detrás de otra capa.
3. El chevron del botón rota; `aria-expanded` pasa a `true`.
4. Adentro: 5 selects (Carrocería, Servicio, Empleado, Pago, Estado), título «Filtros avanzados», botón Restablecer.
5. Clic fuera o Escape lo cierra. Clic adentro no lo cierra.
6. El date picker (`#range-trigger`) y la búsqueda siguen funcionando.
7. Tema dark/light y densidad mostrador/bahía no se rompen.

## Causa probable
El `<script>` importa el motor de `date-picker.html` **antes** de definir `togglePopover`. El botón usa `onclick="togglePopover(event)"` (línea ~1625). `togglePopover` se declara ~línea 3106, **después** de:

- `scrim.addEventListener(...)`
- `createPicker({ anchor: rangeAnchor, ... })`
- `rangeTrigger.addEventListener(...)`
- `paintRange()`

Si cualquiera de esas líneas tira en el navegador, el script se corta y `togglePopover` nunca existe. El clic no hace nada.

## Qué hacer
1. Abrí el HTML en el navegador y mirá la consola. Confirmá el error real.
2. **Blindá el listener de `#filter-btn` para que sea autónomo**: registralo al inicio del script (o en un bloque propio, antes del date picker), con `addEventListener` además del onclick, y con guards si el nodo no está.
3. Envolvé la inicialización del date picker en try/catch para que un fallo del picker no mate los filtros.
4. No llames `closeOpenPicker()` desde el toggle si eso puede tirar cuando el picker no arrancó.
5. Cuidado con el listener de `document` click: el mismo clic que abre no tiene que cerrar en el bubble.
6. Cuidado con overflow/z-index del ancla `.popover-anchor` / `.control-bar` para que el panel no quede invisible.
7. CSS ya tiene `.filter-trigger > * { pointer-events: none }` — está bien, no lo saques salvo que estorbe.

## Verificar
- Abrí `docs/prototype/filters-and-search.html` (file:// o el browser de Orca).
- Clic en Filtros → se ve el popover.
- Clic en un select interno → abre el menú, el popover no se cierra.
- Restablecer funciona.
- Clic en el date picker sigue abriendo el calendario.
- Dark y light. Mostrador y bahía.

Cuando termines, dejá una nota corta: qué fallaba, qué cambiaste, cómo lo verificaste. No implementes Next.js. No escribas spec.
