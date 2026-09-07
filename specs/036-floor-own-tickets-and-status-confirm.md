# 036 — Pista: solo mis lavados y confirmar estado

**Estado:** Terminada
**Módulo:** carwash (web + api)
**Depende de:** 003, 020, 035

## Task

En `/floor` el empleado ve y mueve solo los lavados asignados a él. Un lavado
sin asignar no aparece hasta que oficina se lo asigne. Antes de Tomar, Marcar
listo o Reabrir, un diálogo nombra placa y número.

Esto pisa, en pista, el «cualquier empleado ve y mueve la fila» de 003 RN-9 y
el «start de vacío asigna a quien toma» de 035.

## Done

- [x] `GET /floor/tickets` recorta a tickets cuyo único asignado es el empleado
      de la sesión.
- [x] `GET` / `PATCH` `/floor/tickets/:id` y `start` / `ready` / `reopen` /
      `PUT washers` de pista: si no es suyo o no tiene asignado, 404
      `NOT_FOUND` con «Ese lavado no existe.»
- [x] Oficina (`/carwash/tickets`) sigue viendo todos, con y sin asignado.
- [x] `/floor`: sin Combobox Empleado. Estado y Carrocería se quedan.
- [x] Vacío propio: «No tenés carros en la fila.»
- [x] Tomar, Marcar listo y Reabrir (fila y detalle) abren diálogo con `#N` y
      placa. Cancelar no llama al API. Confirmar sí.
- [x] El toast Deshacer de Marcar listo se queda.
- [x] Tests de usecase + `scripts/verify-036.sh`. `verify-035.sh` deja de
      esperar start de vacío o de un lavado ajeno.

## Always

- Recorte en el API, no solo en la UI.
- 404, no 403: no se filtra que el lavado de otro existe.
- Diálogo del sistema (031), densidad `bahia`, objetivos ≥ 44px.
- Código en inglés; UI en español.

## Ask first

Cerrado: sin asignar no aparece (B).

## Never

- Nunca el filtro Empleado en `/floor`.
- Nunca listar o mutar en pista un lavado de otro o sin asignar.
- Nunca cambiar estado de pista con un solo tap.
- Nunca tocar la lista ni las acciones de oficina.
- Nunca Playwright / Chromium.
- Nunca prototipo HTML nuevo.

## Verify

```bash
pnpm --filter @elite/api test && pnpm --filter @elite/web test && pnpm lint && pnpm build && bash scripts/verify-036.sh
```
