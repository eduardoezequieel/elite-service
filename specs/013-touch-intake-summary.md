# 013 — El total y el primario siempre visibles en táctil

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash, 005-visual-redesign

## Task

En `TicketForm`, el resumen deja de ser una columna que solo existe desde 1180px. Bajo ese
ancho se convierte en una barra fija al pie con el total y `Abrir lavado`, de modo que en una
tablet vertical no haya que hacer scroll a ciegas para guardar.

Evidencia: `docs/UX_AUDIT.md` hallazgo 01. Comportamiento propuesto:
`docs/prototype/ux-audit-2026-09.html`, pestaña «Anotar carro en tablet».

## Done

- [x] `ticket-form.tsx` mantiene el resumen lateral desde 1180px (sin cambio en
      escritorio ancho).
- [x] Bajo 1180px, `TicketSummary` se renderiza como barra fija al pie: total en
      `text-figure` a la izquierda, `Abrir lavado` a la derecha, alto `--control-h`.
      Solo el total, sin desglose de servicios.
- [x] La barra respeta `env(safe-area-inset-bottom)` y no tapa el último bloque del
      formulario: el `main` reserva su alto.
- [x] En `/floor/new` la barra convive con la cabecera fija de la pista sin solaparse.
- [x] El botón conserva su estado `loading` sin cambiar de ancho.
- [x] El texto de ayuda deja de decir que placa y cliente son los únicos obligatorios:
      nombra placa, cliente, tipo de carro y servicio (hallazgo 41).
- [x] Verificado a 1024px, 768px y 390px, y en densidad `bahia`. También a ≥1180px: el
      resumen sigue lateral.

## Always

- La barra es una sola pieza: un primario y el total. Nada más entra ahí.
- Los errores del alta siguen imprimiéndose donde ocurren, con `role="alert"`, no en la barra.

## Ask first

- (Cerrado) Resumen táctil: solo el total, sin desglose.

## Never

- Nunca dos primarios en pantalla: mientras la barra existe, `TicketSummary` no dibuja su
  propio botón en el flujo del formulario.
- Nunca `position: fixed` en el `<main>` de oficina bajo 900px sin contar la barra inferior
  del riel: se apilan.

## Verify

`pnpm dev` y revisión a 1180 / 1024 / 768 / 390px en `/carwash/new` y `/floor/new`: el total
y `Abrir lavado` visibles sin scroll con el formulario recién abierto y con todos los bloques
llenos. En ≥1180px el resumen sigue a la derecha.
