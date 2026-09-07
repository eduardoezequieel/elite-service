# 037 — Renombrar etiquetas «Pista» y «La fila» a «Lavado» y «Lavados activos»

**Estado:** Terminada
**Módulo:** web | **Depende de:** 003

## Task

1. Reemplazar los textos visibles «Pista» por «Lavado» y «La fila» por «Lavados activos» en la vista táctil de empleado (`/floor`) y navegación asociada.

## Done

- [x] `floor-shell.tsx`: cabecera con marca «Lavado», diálogo con «¿Salir de lavado?» y «Los lavados activos no se tocan.».
- [x] `floor-queue.tsx`: título de pantalla «Lavados activos» y estados vacíos con «No hay lavados activos».
- [x] `back-link.ts`: etiqueta de retorno `FLOOR_ROOT` actualizada a «Lavados activos».
- [x] `floor-login-form.tsx` y `floor/login/page.tsx`: encabezado «Lavado» y metadata «Entrar a lavado · Elite Service».
- [x] Metadata de rutas en `floor/(shell)/page.tsx`, `floor/(shell)/new/page.tsx` y `floor/(shell)/[id]/page.tsx`.
- [x] `settings/employees/page.tsx`: descripción «Quién trabaja en el lavado.».

## Always

- Mantener todas las rutas URL (`/floor/*`), identificadores y contratos en inglés.
- Consistencia estricta en las etiquetas visibles al empleado.

## Ask first

- N/A

## Never

- Nunca renombrar archivos, rutas web, endpoints del backend ni variables de código.
- Nunca modificar la lógica funcional de turnos ni autenticación.

## Verify

```bash
pnpm lint && pnpm build
```
