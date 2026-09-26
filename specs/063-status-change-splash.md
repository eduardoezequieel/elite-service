# 063 — Animación al cambiar de estado

**Estado:** Terminada (aprobada por chat, 26 sept 2026)
**Módulo:** web | **Depende de:** specs 036 y 037 terminadas

## Task

El cambio de estado ya se confirma con diálogo (pista 036, oficina 037) y deja un aviso, pero el
aviso es chico y se pierde. Al **confirmar** un cambio que sale bien, se superpone una marca grande
en el centro de la pantalla durante 1200 ms: el icono del estado nuevo se dibuja dentro de un
círculo del tono del estado y abajo va la palabra («Listo», «Lavando», «En espera») con el
`#número · placa`. Después se va sola y el aviso de siempre queda como está (con su «Deshacer»).

1. `features/carwash/components/status-splash.tsx`: `StatusSplashProvider` + `useStatusSplash()`
   con `splash({ status, caption })`. Una sola marca a la vez: la nueva reemplaza a la anterior.
   Icono y tono salen de `ticket-status-stamp.tsx` (fuente única del estado), no se redefinen.
2. Se monta en `app/(app)/layout.tsx` y en `app/floor/(shell)/layout.tsx`: vive por encima de la
   pantalla, así que sobrevive a que el diálogo o la tarjeta de la fila se desmonten.
3. La llaman `useFloorStatusConfirm` (empezar, marcar listo, reabrir) y
   `ChangeTicketStatusDialog`, en su `onSuccess`. El «Deshacer» del aviso **no** la dispara.
4. `globals.css`: `elite-splash-in` (escala 0.9 → 1 + opacidad) y el trazo del anillo con
   `stroke-dashoffset`. La salida es un fundido de `--duration-state`.
5. `DESIGN.md` → Movimiento: se agrega la marca de estado como segunda animación permitida, junto
   con su regla de movimiento reducido.

## Done

- [x] Confirmar un cambio en pista (fila y ficha) muestra la marca con el estado nuevo.
- [x] Confirmar en «Cambiar estado» de oficina muestra la marca con el estado nuevo.
- [x] Un error del API no la muestra; el error sigue en el diálogo.
- [x] `pointer-events: none` y `aria-hidden`: no bloquea la pantalla ni duplica lo que ya anuncia
      el aviso.
- [x] Densidad `bahia`: círculo 160px y palabra `text-figure`; `mostrador`: 112px y `text-title`.
- [x] `prefers-reduced-motion`: sin escala ni trazo; aparece quieta 1200 ms y se va.
- [x] Al confirmar, la página sube hasta arriba (`window.scrollTo`), sin deslizamiento con
      `prefers-reduced-motion`.
- [x] Test unitario del tiempo de vida (se muestra, se reemplaza, se va a los 1200 ms).
- [x] `DESIGN.md` actualizado.

## Always

- La palabra del estado siempre escrita: el color y el icono nunca van solos.
- Solo después de un éxito del API, nunca antes.

## Ask first

- Sonido o vibración.
- Mostrarla en cambios que llegan por el hilo en vivo (hechos por otra persona).

## Never

- Bloquear la pantalla o pedir un toque para cerrarla.
- Animación en bucle.
- Tocar el backend.

## Verify

`pnpm build && pnpm lint && pnpm test`. La revisión visual la hace el usuario.
