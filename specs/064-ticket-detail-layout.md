# 064 — Detalle del lavado en dos columnas

**Estado:** Aprobada (por chat, 26 sept 2026, sobre el prototipo)
**Módulo:** web | **Depende de:** 052, 053, 060, 063

## Task

El detalle de oficina (`/carwash/[id]`) apila todo en filas «rótulo … valor» de ancho completo: a
1900px el valor queda a media pantalla de su rótulo, el estado es un chip chico y «Cobrado» es el
mismo verde que «Listo». Se redistribuye según `docs/prototype/ticket-detail-layout.html`
(opción «Azul» para Cobrado).

1. **Cabecera:** `#N` con el chip de estado grande al lado; debajo, folio y «Entró a las h:mm». Sin
   botones.
2. **Dos columnas desde `xl`:** a la izquierda, vehículo y cliente, servicios y línea de tiempo; a la
   derecha, un panel fijo (`sticky`) con el estado grande, los cuatro pasos, el total, el cobro (si
   hay), «A cargo de» y los botones. `Anular` / `Deshacer cobro` van aparte, al pie del panel.
3. **Por debajo de `xl`:** una columna y el panel sube primero, debajo de la nota del último lavado;
   los botones van de a dos por fila.
4. **Tarjeta del vehículo:** placa grande + icono y tipo de carro + marca · color; debajo, una
   rejilla con rótulo arriba (Responsable, Teléfono con `tel:`); la nota del lavado en su propio
   recuadro.
5. **Estado grande** (`ticket-status-hero.tsx`): icono, palabra y «desde las h:mm · N min» del
   estado actual, con el tono de `ticket-status-stamp.tsx`. La hora sale de `statusSinceOf`
   (`status-since.ts`): `WASHING` → `washingStartedAt`, `READY` → `readyAt`, `PAID` → hora del cobro,
   `OPEN` → `createdAt` solo si nunca salió de la cola; si no se sabe, no se muestra la hora.
6. **Cobrado en azul:** el tono `paid` pasa a `--info-text` en toda la app (chip, marca de 063).

## Done

- [x] Los botones y sus condiciones por estado y permiso son los mismos de hoy; solo cambian de
      sitio.
- [x] `xl`: dos columnas con el panel `sticky`; `< xl`: una columna con el panel primero.
- [x] El estado grande y los pasos se ven en los cuatro estados del ciclo; `VOID` muestra el estado
      grande sin pasos.
- [x] `statusSinceOf` con tests para los cinco estados y el `OPEN` reabierto.
- [x] Chip `Cobrado` azul; `Listo` sigue verde.
- [x] `bahia`: la palabra del estado sube un escalón y las barras de los pasos engordan.
- [x] `DESIGN.md` actualizado (tabla de estados y el panel del detalle).

## Always

- Tono e icono del estado salen solo de `ticket-status-stamp.tsx`.
- La nota del último lavado sigue arriba de datos y botones (052).

## Ask first

- Tocar el detalle de pista o cualquier otra pantalla fuera del color de Cobrado.

## Never

- Botones, permisos o endpoints nuevos.
- Inventar la hora del estado cuando el ticket no la trae.

## Verify

`pnpm lint && pnpm test && pnpm build`
