# 016 — Crear un servicio y una categoría

**Estado:** Terminada
**Módulo:** services | **Depende de:** 003-carwash

## Task

En `/settings/catalog` se puede crear un servicio. Las categorías se crean en
una subpantalla mínima. Los endpoints `POST /services` y
`POST /service-categories` ya existen. Evidencia: hallazgo 07.

## Done

- [x] Con `services.manage` y la lista con filas: `Nuevo servicio` en la cabecera.
- [x] Con la lista vacía: el mismo botón solo en el vacío, no duplicado arriba.
- [x] El diálogo de alta pide nombre, categoría, precio base y precios por tipo.
- [x] Sin categorías activas, el diálogo no manda el POST: pide ir a Categorías.
- [x] `/settings/catalog/categories`: lista + `Nueva categoría` (nombre).
- [x] `useCreateService` y `createCategory` se usan desde la UI.

## Always

- Permiso `services.manage` para crear. Sin él no hay botones.
- Una celda de precio vacía no se manda: usa el base (RN-2).
- Errores del API en el diálogo, `role="alert"`.

## Ask first

- (Cerrado) Editar/desactivar categoría queda fuera: es hallazgo de medias.

## Never

- Nunca inventar un endpoint. Nunca dos primarios con la lista vacía.

## Verify

`pnpm lint && pnpm test && pnpm build`
