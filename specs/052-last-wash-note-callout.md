# 052 — La nota del último lavado, a la vista de quien lava

**Estado:** Terminada
**Módulo:** carwash (api + web) | **Depende de:** 041, 036

## Task

La nota del último lavado (041) hoy es un campo chico dentro de la ficha «Ya lo conocemos», y solo
ahí: cuando el lavador abre el ticket en pista para empezar, no la ve, porque el ticket trae como
`lastWash` a sí mismo. Pasa a ser un **aviso ámbar** de ancho completo, con la nota en letra de
cuerpo, arriba de la ficha de alta y arriba de los botones del detalle del ticket (pista y oficina).
Para eso el API devuelve como `vehicle.lastWash` de un ticket el lavado **anterior** a ese ticket.

## Done

- [x] API: en `prisma-ticket.repository.ts`, `vehicle.lastWash` de un `Ticket` es el último no
      anulado **distinto del propio ticket** (`take: 2` en el include y se descarta `row.id` al
      mapear). El lookup de placa (`prisma-vehicle.repository.ts`) no cambia. Sin migración.
- [x] Tests (`vehicles/domain/last-wash.spec.ts`, regla pura `lastWashBefore`): un ticket recién
      abierto de un carro con un `PAID` anterior trae la nota de ese `PAID`; el primer ticket de un
      carro trae `lastWash: null`; el anterior `VOID` se salta.
- [x] `apps/web/src/features/carwash/components/last-wash-note.tsx`: `<LastWashNote lastWash />`.
      Aviso con fondo `--warn` al 12 % (`.tint`), filete al 40 %, icono `StickyNote` de lucide,
      rótulo «Nota del último lavado · 12 ago» en `text-label` y la nota en `text-body`
      (`text-title` en `bahia`), `whitespace-pre-wrap`. Si `lastWash` es null o la nota está en
      blanco, no renderiza nada.
- [x] `known-vehicle-card.tsx`: el aviso va **arriba** de la grilla de datos, ancho completo; el
      campo «Nota» de la grilla desaparece. «Último lavado» queda como está.
- [x] `floor-ticket-detail.tsx`: el aviso va antes de la tarjeta «Responsable», solo cuando hay nota.
- [x] `ticket-detail-screen.tsx` (oficina): mismo aviso, mismo lugar, con la misma pieza.
- [x] `DESIGN.md`: «Aviso de nota» bajo los chips: único uso del ámbar como relleno de bloque.
- [x] `scripts/verify-052.sh`: carro con un `PAID` con nota → abrir ticket nuevo → `GET` del ticket
      (oficina y pista) trae `vehicle.lastWash.notes` con esa nota; el lookup de placa la sigue
      trayendo; primer ticket de un carro nuevo → `lastWash: null`.

Lógica pura de la web en `features/carwash/last-wash.ts` (`lastWashDateLabel`, `lastWashNote`) con
su spec. El lookup de placa no cambia: consultado con un ticket abierto, ese abierto es el último.

## Always

- Una sola pieza para las tres pantallas. Tokens; ningún hex.
- Autorización por permiso; el recorte de pista (036) sigue igual: el aviso viaja dentro del ticket
  que la pista ya podía ver.
- Densidad `bahia`: el aviso se lee de pie, letra `text-title`.

## Ask first

- Copiar la nota vieja al ticket nuevo (041 lo cerró: no).
- Un marcador «tiene nota» en las láminas de la fila de pista.

## Never

- Nunca mostrar la nota de un ticket `VOID`.
- Nunca inventar texto: sin nota, sin aviso.
- Nunca Playwright, Chromium ni el MCP de navegador.

## Verify

```bash
pnpm build && pnpm lint && pnpm test && bash scripts/verify-052.sh
```
