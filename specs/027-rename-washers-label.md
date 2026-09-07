# 027 — Renombrar etiqueta «Lavaron» a «A cargo de»

**Estado:** Terminada
**Módulo:** web | **Depende de:** 009

## Task

1. Reemplazar la etiqueta visual «Lavaron» por «A cargo de» en el formulario de ticket (`TicketForm`) y en los detalles de ticket de pista y oficina.

## Done

- [x] Cambiar «Lavaron» por «A cargo de» en `ticket-form.tsx`.
- [x] Cambiar «Lavaron» por «A cargo de» en `ticket-detail-screen.tsx`.
- [x] Cambiar «Lavaron» por «A cargo de» en `floor-ticket-detail.tsx`.

## Always

- Mantener intacta la lógica funcional de asignación de lavadores y contrato (`washers`, `employeeIds`).

## Never

- Nunca modificar nombres de variables, contratos compartidos ni endpoints en inglés.

## Verify

`pnpm lint && pnpm build`
