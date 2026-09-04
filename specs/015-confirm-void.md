# 015 — Confirmar antes de anular un lavado

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash

## Task

`Anular` en `/carwash/[id]` abre un diálogo de confirmación. Sin confirmar, el
lavado no cambia. Evidencia: `docs/UX_AUDIT.md` hallazgo 05. El patrón ya está
en `delete-role-dialog.tsx`.

## Done

- [x] `Anular` abre un diálogo que nombra el lavado (`#N`) y dice que no se
      puede deshacer.
- [x] Cancelar cierra el diálogo y no llama a `POST /carwash/tickets/:id/void`.
- [x] Confirmar llama al void existente, cierra el diálogo y muestra el aviso.
- [x] El destructivo del diálogo usa `destructiveSolid`. En la ficha, `Anular`
      sigue `destructive` (no relleno).
- [x] La pista no gana Anular: el empleado no anula (RN-11).

## Always

- Los errores del void se imprimen en el diálogo, con `role="alert"`.
- Autorización contra `carwash.void`, nunca por nombre de rol.

## Ask first

- (Cerrado) Sin campo de motivo en esta spec. El motivo es otra ola.

## Never

- Nunca anular con un solo tap desde la ficha.
- Nunca un segundo Anular en la fila de `/carwash`.

## Verify

`pnpm lint && pnpm test && pnpm build`
