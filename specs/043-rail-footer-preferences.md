# 043 — Simplificación del pie del riel lateral y preferencias

**Estado:** Terminada
**Módulo:** web (ui) | **Depende de:** 002, 005, 042

## Task

1. Mover los selectores de Densidad y Tema dentro del menú desplegable del usuario (`UserMenu`) como preferencias.
2. Simplificar el pie del riel (`NavRail`) para mostrar únicamente el botón de usuario (nombre completo legible) y la campana de avisos (`NotificationBell`).
3. En riel plegado (`collapsed`), mantener ambos elementos accesibles apilados verticalmente (icono de usuario + campana de avisos).

## Done

- [x] Exportar `ThemeMenuItems` en `theme-toggle.tsx` para permitir incrustar la selección de tema en menús existentes.
- [x] Integrar `DensityMenuItems` y `ThemeMenuItems` con sus respectivos separadores en `UserMenu`.
- [x] Limpiar el pie de `NavRail` quitando los botones independientes de tema y densidad, dando el espacio completo al `UserMenu`.
- [x] Actualizar la documentación de `DESIGN.md` en la sección de menú lateral.

## Always

- El nombre del usuario debe verse legible en riel desplegado sin truncarse a dos letras.
- `NotificationBell` sigue visible para usuarios con permiso `carwash.read`.
- En modo móvil / barra inferior (`NavBottomBar`), las opciones siguen accesibles bajo "Más".

## Ask first

- Ninguno pendiente.

## Never

- Nunca truncar el nombre de usuario por saturación de botones en una sola fila.
- Nunca romper el soporte de densidad táctil (`bahia`) ni los temas claro/oscuro.

## Verify

`pnpm lint && pnpm --filter @elite/web build`
