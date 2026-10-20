# 120 — Rediseño de Ajustes de la renta

**Estado:** Terminada — 19 oct 2026. Aprobada el 19 oct 2026, en el chat: «aprobado, implementalo» (tras el prototipo `docs/prototype/rental-settings.html`, v2)
**Módulo:** `features/rental-settings` (web) | **Depende de:** 095, 097

## Task

Rehacer `/rentals/settings` como el prototipo `docs/prototype/rental-settings.html` (v2), sin tocar
el API ni el contrato de `@elite/shared`: el `PUT` sigue mandando la fila entera (RN-8), con
`kmAlert`/`daysAlert` ocultos como hoy. Solo web.

- Cuatro pestañas: **Empresa**, **Cobros y reglas**, **Contrato** (con el número de cláusulas) y
  **Accesorios** (con el número de accesorios). Si una pestaña tiene cambios, lleva un punto.
- Cada sección es una lista de filas: a la izquierda, el rótulo y una ayuda de una línea; a la
  derecha, el campo. Los montos llevan `$`, los porcentajes `%` y las horas `h`. Las horas de
  gracia, el margen entre rentas y la edad mínima se cambian con −/+.
- Al lado (abajo en tablet/bahía, plegable): en Empresa, la hoja del contrato en miniatura, que
  marca la zona del campo que se está editando; en Cobros, un ejemplo de 3 días a $35 que cambia
  con CDW e IVA, más la miniatura.
- La miniatura y «Ver hoja» (frente/reverso en grande + Imprimir) usan `ContractFront` y
  `ContractBack` de `rental-documents` con un contrato en blanco, no una hoja copiada.
- Contrato (cambio del 19 oct, a pedido en el chat): en una sola página, la introducción y todas
  las cláusulas en un mismo texto, una por párrafo, separadas por una línea en blanco (se numeran
  solas). Botón para insertar `{ARRENDANTE}` en la introducción, «Volver al texto original» (con
  Deshacer) y «Ver impreso».
- Accesorios: fichas. Agregar arriba (sin repetidos), tocar el nombre para renombrar, × para
  quitar (con Deshacer), «Ordenar A–Z».
- Sin botón «Guardar ajustes» arriba: una barra fija abajo aparece solo con cambios («N cambios ·
  campos», Descartar, Guardar; con errores, «Revise N campos» y Guardar deshabilitado).
  Ctrl/Cmd+S guarda. Arriba a la derecha, «Guardado h:mm» después de guardar.
- Textos en usted, sin voseo ni tuteo (el prototipo tutea: «Pon 0 si no cobras IVA» pasa a «Ponga
  0 si no cobra IVA»).

## Done

- [x] Las 4 pestañas, con su contador y su punto de cambios.
- [x] Empresa y Cobros con filas, ayuda, unidades y −/+.
- [x] Miniatura y «Ver hoja» con `ContractFront`/`ContractBack`; la zona del campo se marca.
- [x] Ejemplo de cobro que cambia con CDW e IVA.
- [x] Editor de cláusulas y fichas de accesorios con todo lo de arriba, con Deshacer al borrar.
- [x] Barra de guardar con Descartar, errores y Ctrl/Cmd+S.
- [x] En bahía y en ancho de tablet: pestañas de 56 px, filas en una columna y vista previa abajo.
- [x] Tests de la lógica nueva (cuenta de cambios, ejemplo de cobro, renombrar/ordenar accesorios).

## Always

- Reusar `Button`, `Input`, `Textarea`, `Tabs`, `useToast` y los tokens de `DESIGN.md`.
- Mantener el `rentalSettingsFormSchema` y el `PUT` de la fila entera.

## Ask first

- Cambiar algo del API, de `@elite/shared` o de la hoja impresa (097).

## Never

- Una hoja de contrato duplicada solo para la vista previa.
- Navegador, Playwright o `pnpm dev` para revisar.

## Verify

`pnpm build && pnpm lint && pnpm test`
