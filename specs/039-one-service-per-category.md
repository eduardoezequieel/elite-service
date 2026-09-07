# 039 — Un servicio por categoría en carwash

**Estado:** Borrador
**Módulo:** web + carwash | **Depende de:** 003, 016, 017, 025
**Prototipo:** `docs/prototype/service-by-category.html`

## Task

1. En el alta (`TicketForm`, pista y oficina) y en la edición de un ticket abierto (`EditTicketDialog`), agrupar los servicios por `service.category` del catálogo (`sortOrder`). Cada categoría es un radio: a lo sumo un servicio. Las categorías se suman.
2. Tocar el servicio ya elegido de un rubro lo suelta. Hace falta al menos un servicio en total para abrir o guardar. Ningún rubro es obligatorio por nombre.
3. El API rechaza un `items` con dos servicios de la misma categoría.
4. Precio y descuento siguen siendo por línea, con tope del catálogo. El resumen suma las líneas.

## Done

- [ ] `TicketForm` pinta un `radiogroup` por categoría activa con servicios; no aplana el catálogo.
- [ ] Elegir un servicio de un rubro no suelta el de otro; elegir otro del mismo rubro reemplaza al anterior.
- [ ] Tocar el ya elegido lo deselecciona. Sin ningún servicio, no se abre el ticket.
- [ ] `EditTicketDialog` usa la misma regla.
- [ ] Una categoría sin servicios activos no se pinta. Una de un solo servicio se toca o se suelta igual.
- [ ] El resumen lista cada línea y el total es la suma. El descuento es por línea.
- [ ] `POST/PATCH` de tickets (pista y oficina) responde 422 si vienen dos `serviceId` de la misma categoría.
- [ ] Tests de la agrupación y de la validación. No hay nombres de categoría en el código.

## Always

- El agrupado sale de `service.category`. Nunca hardcodear «Lavado premium» ni ningún otro nombre.
- El contrato `items: [{ serviceId, unitPrice? }]` se mantiene.
- Objetivos táctiles `min-h-touch` en bahía.

## Ask first

- Si el taller pide un rubro obligatorio (siempre un lavado, por ejemplo): es un flag de categoría en el catálogo, no un nombre en el código.

## Never

- Nunca dos servicios de la misma categoría en un ticket.
- Nunca volver al radio único de la spec 025.
- Nunca exigir una categoría concreta por nombre.

## Verify

`pnpm lint && pnpm test && pnpm build && bash scripts/verify-039.sh`
