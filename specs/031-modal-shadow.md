# 031 — Sombreado y backdrop en diálogos modales

**Estado:** Terminada
**Módulo:** web (ui) | **Depende de:** 005

## Task

1. Incorporar elevación mediante sombra (`box-shadow`) a los modales (`DialogContent`) para separarlos claramente del fondo.
2. Mejorar el oscurecimiento del backdrop (`DialogOverlay`) en modo claro para que no se lave con blanco/gris claro y proporcione contraste.

## Done

- [x] Definir el token `--shadow-dialog` en `:root` y `.light` en `globals.css`.
- [x] Aplicar `shadow-dialog` a `DialogContent` en `dialog.tsx`.
- [x] Ajustar `DialogOverlay` a `bg-black/45 backdrop-blur-xs dark:bg-bg/80` en `dialog.tsx`.
- [x] Actualizar la sección de diálogos en `DESIGN.md`.

## Always

- Mantener consistencia en ambos temas (oscuro y claro).
- El diálogo bajo 900px (modo hoja inferior) mantiene su comportamiento táctil.

## Ask first

- Ninguno pendiente.

## Never

- Nunca dejar el fondo sin contraste en modo claro donde el modal se confunda con la tabla inferior.

## Verify

`pnpm lint && pnpm --filter @elite/web build`
