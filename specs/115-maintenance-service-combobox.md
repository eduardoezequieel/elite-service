# 115 — Qué se hizo, como el buscador de categorías

**Estado:** Terminada
**Módulo:** fleet-maintenance (shared + web) | **Depende de:** 086, 099, 110

## Task

En «Anotar lo que se hizo», «Qué se hizo» es el mismo buscador que la categoría de un
servicio del lavado: se escribe, filtra, y si el nombre no está aparece
«Crear servicio: «nombre»». Al crearlo queda elegido y entra a la lista para la próxima.
No pide km ni días en ese paso.

## Done

- [x] El `<select>` nativo y el campo «Otro» salen del diálogo.
- [x] Crear manda `POST /fleet/maintenance/plan` solo con el nombre.
- [x] `createPlanTaskSchema` acepta una tarea sin intervalo. Un cambio que deje la tarea
      sin km y sin días sigue rechazado.
- [x] Sin intervalo, el aviso de esa tarea queda en `NO_DATA` hasta cargarlo en el plan.
- [x] Test: el schema acepta el nombre solo, y la fila del buscador dice «Crear servicio».

## Always

- El texto de crear una categoría del lavado no cambia.
- Mostrador, bahía y tablet: el buscador es el mismo componente.

## Ask first

- Pedir km o días en el mismo diálogo, antes de crear el servicio.

## Never

- Abrir el navegador o levantar servidores.

## Verify

```sh
pnpm build && pnpm lint && pnpm test
```
