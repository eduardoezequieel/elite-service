# 047 — Elegir al responsable desde la lista, sin cartel encima

**Estado:** Terminada
**Módulo:** web (carwash/ui) | **Depende de:** 004, 030, 034, 040

## Task

1. El panel de sugerencias del campo «Nombre» del responsable se ancla al **bloque entero**
   (nombre + teléfono), no a la caja del nombre: el nombre completo y el teléfono entran sin
   truncarse.
2. Cada sugerencia es una fila de dos líneas —nombre y teléfono arriba, «Ya registrado» abajo— con
   objetivo táctil de 44px en `bahia`.
3. Última fila de la lista, separada por un filete: **«+ Crear nuevo: «<lo escrito>»»**. Elegirla
   deja el texto tal cual, no marca cliente existente y pasa el foco al teléfono.
4. El cartel «¿Es el mismo?» solo aparece si el cliente que coincide **no** estaba entre las
   sugerencias que se acababan de mostrar (típico: coincide el teléfono, no el nombre), y se borra
   al volver a enfocar el nombre, para que la lista nunca se dibuje sobre él.
5. `placeComboboxPanel` recorta el panel a los bordes de la pantalla cuando el ancla es más ancha
   que el viewport.

## Done

- [x] `lib/combobox.ts`: `placeComboboxPanel` acepta un rectángulo de ancla opcional y recorta
      izquierda y ancho a `COMBOBOX_EDGE`; `filterOptions` nunca descarta una opción `kind: 'action'`.
- [x] `lib/combobox.spec.ts`: casos de ancla más ancha que la caja, recorte contra el borde y
      acción siempre visible.
- [x] `ui/combobox.tsx`: props `panelAnchor` y `onFocus`; `ComboboxOption` admite `hint` (segunda
      línea) y `kind: 'action'` (sin tilde, con filete arriba).
- [x] `carwash/components/customer-field.tsx`: ancla del panel, filas con `hint`, fila «Crear
      nuevo», y el cartel de coincidencia acotado por la regla 4.
- [x] `DESIGN.md`: el panel es del ancho de la caja **o del bloque que se le indique**; fila de
      acción y fila de dos líneas documentadas.

## Always

- Los otros tres usos de `OwnerField` (alta de ficha ×2, cambio de vehículo) y el `IntakeField`
  siguen funcionando: sin `panelAnchor` el panel conserva el ancho de la caja.
- Teclado completo: ↑ ↓ recorren la fila de acción como una más, Enter la elige, Escape cierra.
- Filas de 44px de alto mínimo en `bahia`; nada depende de `hover`.
- Tokens de `globals.css`: ningún color ni radio literal.

## Ask first

- Cambiar el texto del cartel «¿Es el mismo?» o quitarlo del todo.
- Tocar el API de clientes (`/customers`, `/customers/match`).

## Never

- Nunca dibujar el panel de sugerencias encima del cartel de coincidencia.
- Nunca truncar el nombre del cliente en la lista de sugerencias.
- Nunca dejar «cliente nuevo» como estado implícito: crear es una fila que se elige.

## Verify

`pnpm lint && pnpm --filter @elite/web test && pnpm build`
