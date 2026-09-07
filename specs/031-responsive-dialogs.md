# 031 — Diálogos responsive a todo el ancho bajo 900px

**Estado:** Terminada
**Módulo:** web | **Depende de:** 002, 005

## Task

1. Corregir `DialogContent` en `dialog.tsx` para que bajo 900px (`< md`) sea una hoja pegada al pie que ocupe todo el ancho (`w-full max-w-none inset-x-0 bottom-0`), sin `sm:max-w-lg` ni márgenes laterales.
2. Adaptar los usos de `className` en diálogos que pasan `max-w-*` o `sm:max-w-*` para que usen el prefijo `md:max-w-*`, de modo que no limiten el ancho en pantallas táctiles bajo 900px.
3. Asegurar soporte de `env(safe-area-inset-bottom)` en `DialogFooter` bajo 900px para el área táctil inferior.
4. Ajustar `@keyframes elite-sheet-in` y `@keyframes elite-sheet-out` en `globals.css` para que la hoja deslice completamente desde y hacia el pie de la pantalla (`translateY(100%)`).

## Done

- [x] `DialogContent` en `dialog.tsx` usa `w-full max-w-none inset-x-0 bottom-0 rounded-t-card rounded-b-none border-t border-x-0 border-b-0` bajo 900px, y pasa a ventana centrada `md:max-w-lg md:rounded-b-card md:border md:top-1/2 md:left-1/2` en escritorio (≥900px).
- [x] `DialogFooter` maneja `pb-[max(var(--plate-pad),env(safe-area-inset-bottom))] md:pb-plate` para respetar la barra inferior en dispositivos táctiles.
- [x] Los diálogos que limitaban su ancho (`vehicle-change-dialog`, `role-form-dialog`, `deactivate-confirm-dialog`, `void-ticket-dialog`, `reverse-ticket-dialog`, `delete-role-dialog`, `floor-shell`, `design-reference`) usan `md:max-w-*`.
- [x] Las animaciones `elite-sheet-in` y `elite-sheet-out` en `globals.css` animan `translateY(100%)` a `translateY(0)` para deslizar la hoja suavemente desde el pie de pantalla.

## Always

- Bajo 900px (`< md`), el modal cubre todo el ancho de la pantalla de borde a borde y se pega al pie.
- En escritorio (≥900px), el modal flota centrado con esquinas redondeadas en las cuatro caras.
- Respetar safe-area y objetivos táctiles en bahía.

## Ask first

- ¿Hoja a todo el ancho bajo 900px o ventana centrada? (Aprobado por el usuario: hoja a todo el ancho bajo 900px).
- ¿Animación desde el fondo (100%)? (Aprobado por el usuario).

## Never

- Nunca dejar huecos laterales con esquinas rectas al fondo bajo 900px.
- Nunca romper el scroll interno en `DialogBody`.

## Verify

`pnpm build && pnpm lint`
