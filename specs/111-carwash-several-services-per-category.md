# 111 — Varios servicios del mismo rubro en un lavado

**Estado:** Terminada (aprobada por chat, 8 oct 2026: «aunque no tenga demasiado sentido, necesito que me
permitas escoger varios servicios del mismo tipo»)
**Módulo:** `carwash` (api + web) | **Depende de:** 039, 050 | **Reemplaza:** 039 RN-1/RN-2

## Task

Un lavado deja de estar limitado a un servicio por rubro. En el alta (oficina y pista) y en la
edición se pueden marcar varios servicios del mismo rubro; cada uno es una línea con su precio,
que se sigue tocando para subirlo o bajarlo (030, 087). El mismo servicio dos veces sigue sin
existir: marcarlo otra vez lo desmarca.

## Done

- [x] API: `buildTicketItems` ya no rechaza dos servicios del mismo rubro. Un `serviceId` repetido
      en el mismo pedido responde 422 `VALIDATION_ERROR`.
- [x] `DUPLICATE_SERVICE_CATEGORY` sale de `@elite/shared` y de todo uso.
- [x] Web: `toggleService` alterna solo ese servicio, sin soltar los del rubro. Lo que se desmarca
      pierde su precio tocado; lo demás lo conserva.
- [x] `ServicePicker`: las opciones son casillas (`role="checkbox"`, cuadro en vez de círculo), el
      rubro **no** se pliega al marcar, y la fila plegada muestra lo elegido: un nombre y su precio,
      o «N elegidos» y la suma.
- [x] Textos «Uno por rubro» quitados del alta y de la edición.
- [x] Tests: api (`build-ticket-items.spec.ts`, combos si aplica) y web (`service-groups.spec.ts`)
      cubren dos del mismo rubro y el repetido.
- [x] `scripts/verify-039.sh` y los `verify-003/009.sh` que esperaban el 422 de rubro, ajustados.

## Always

- Las densidades `mostrador` y `bahia` y el ancho de tablet siguen como hoy (tokens existentes).
- Los combos (104) no cambian.

## Ask first

- Permitir el mismo servicio dos veces (cantidad).

## Never

- Tocar migraciones o la base.
- Abrir el navegador o levantar servidores.

## Verify

```sh
pnpm build && pnpm lint && pnpm test
```
