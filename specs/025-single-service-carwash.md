# 025 — Selección única de servicio en carwash

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 003, 017

## Task

1. Cambiar la selección de servicios en el alta de lavado (`TicketForm`, tanto pista como oficina) a selección única con comportamiento estricto de radio button: al tocar un servicio se selecciona ese y se deselecciona el anterior; tocar el servicio ya seleccionado lo mantiene seleccionado.
2. Cambiar la selección de servicios en la edición de ticket abierto (`EditTicketDialog`) a comportamiento estricto de radio button (un solo servicio a la vez).

## Done

- [x] En `TicketForm`, al tocar un servicio se selecciona únicamente ese servicio y se deselecciona cualquier otro; tocar el ya seleccionado lo mantiene seleccionado.
- [x] En `EditTicketDialog`, al tocar un servicio se selecciona únicamente ese servicio y se ajusta el mapa de precios editables a esa sola opción.
- [x] El contenedor y botones usan semántica accesible de radio (`role="radiogroup"`, `role="radio"`, `aria-checked`).
- [x] `TicketSummary` y el envío del formulario continúan enviando `items` con el servicio seleccionado (`[{ serviceId }]`).

## Always

- Mantener la compatibilidad con el contrato del backend (`items: [{ serviceId, unitPrice? }]`).
- Mantener los objetivos táctiles mínimos de 44px (`min-h-touch`) para tablet.

## Never

- Nunca permitir marcar más de un servicio simultáneamente en el carwash.
- Nunca romper la creación ni la edición de tickets en pista u oficina.

## Verify

`pnpm lint && pnpm test && pnpm build`
