# 119 — Selector de hora propio

**Estado:** Terminada — aprobada 19 oct 2026, en el chat: «me parece bien, implementalo» (tras el prototipo `docs/prototype/time-picker.html`)
**Módulo:** `components/ui` (web) · `features/rentals` (web) | **Depende de:** 118

## Contexto

Las horas de la renta usan el selector nativo del navegador (`type="time"` y `datetime-local`). En
el escritorio se abre una lista gris que no respeta el tema, ignora el paso de 15 min (muestra 01,
02, 03…) y se toca mal en la tablet. Se reemplaza por un `TimePickerField` propio, hermano de
`DatePickerField`, y `DateTimeField` pasa a ser fecha + hora con los dos selectores propios.

## Historias

- Como dueño, quiero elegir la hora con pocos toques y en los colores del sistema, sin la lista
  nativa.

## Criterios de aceptación

- **Dado** un `TimePickerField`, **entonces** se ve como la caja de campo de siempre (etiqueta
  adentro, ícono de reloj, hora en `font-mono` como «11:00 AM») y al tocarla abre un popover de
  Radix (`surface-2`, igual que `DatePickerField`; en el teléfono, hoja al pie).
- **Dado** el popover, **entonces** tiene tres bloques: horas 1–12 en grilla de 4 × 3, minutos
  `:00 :15 :30 :45` y `AM`/`PM`. Lo elegido va con `gradient-action`. Cada toque cambia el valor al
  momento; tocar un minuto cierra el popover. Escape y tocar afuera lo cierran.
- **Dado** un valor que no cae en un cuarto de hora (p. ej. `10:07`), **entonces** se muestra tal
  cual y ningún minuto queda marcado; elegir uno lo reemplaza.
- **Dado** el popover abierto, **entonces** se maneja con teclado: Tab entre bloques, flechas dentro
  de cada bloque, Enter/Espacio elige.
- **Dado** el paso «Carro» de la nueva renta, **entonces** «Hora de salida» y «Hora de regreso» usan
  `TimePickerField` (se borra el `TimeField` local).
- **Dado** `DateTimeField`, **entonces** dibuja un `DatePickerField` y un `TimePickerField` lado a
  lado (una columna en el teléfono angosto), con el error debajo de los dos. Es controlado:
  `value`/`onChange` con `YYYY-MM-DDTHH:MM`, el mismo formato de hoy.
- **Dado** la entrega (`handover-wizard`), editar renta (`agreement-edit-dialog`), extender y cambiar
  de carro (`agreement-action-dialogs`), **entonces** usan el `DateTimeField` nuevo; donde hoy va
  con `register`, pasa a `Controller`. Los valores enviados al API no cambian.
- **Dado** densidad `bahia` o ancho de tablet, **entonces** cada botón del popover mide al menos
  `--touch-min`.

## Reglas de negocio

- **RN-1:** el valor interno es `HH:MM` en 24 h; el 12 AM es `00:MM` y el 12 PM es `12:MM`.
- **RN-2:** en `DateTimeField` vacío, elegir solo la fecha deja la hora en `09:00`; elegir solo la
  hora no emite nada hasta que haya fecha.

## Permisos

Sin cambios.

## Datos

Sin cambios.

## API

Sin cambios.

## UI

- Nuevo `apps/web/src/components/ui/time-picker-field.tsx`.
- Nuevo `apps/web/src/lib/clock-time.ts` (+ `.spec.ts`): pasar entre `HH:MM` y hora/minuto/AM-PM,
  y la etiqueta «11:00 AM».
- `features/rentals/components/rental-fields.tsx` (`DateTimeField`), `new-rental-car-step.tsx`,
  `handover-wizard.tsx`, `agreement-edit-dialog.tsx`, `agreement-action-dialogs.tsx`.

## Fuera de alcance

- Cambiar `DatePickerField`, `DateField` o los filtros de fecha.
- Horas fuera de la renta.

## Tareas

- [x] `clock-time.ts` con tests de RN-1 y de la etiqueta.
- [x] `TimePickerField` según los criterios.
- [x] `TimeField` local reemplazado en `new-rental-car-step.tsx`.
- [x] `DateTimeField` controlado con fecha + hora propias (RN-2).
- [x] Los cuatro formularios de rentas migrados.
- [x] Verify: `pnpm build && pnpm lint && pnpm test`.
