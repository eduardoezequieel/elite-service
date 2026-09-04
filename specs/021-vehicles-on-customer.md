# 021 — Crear y corregir un vehículo en la ficha del cliente

**Estado:** Terminada
**Módulo:** vehicles | **Depende de:** 004-customers

## Task

En la lámina Carros de `/customers/[id]` se puede crear y editar un vehículo.
`POST /vehicles` y `PATCH /vehicles/:id` ya existen. Hallazgo 22.

## Done

- [x] Con `vehicles.manage`: `Nuevo carro` en la lámina (o en el vacío).
- [x] Editar en cada fila: placa, tipo, marca, color.
- [x] Alta manda `customerId` de la ficha.
- [x] Sin `vehicles.manage` no hay botones; la lista de solo lectura sigue.

## Always

- Placa normalizada a mayúsculas, sin `text-transform`.
- Errores en el diálogo, `role="alert"`.

## Never

- Nunca un CRUD de vehículos fuera de la ficha del cliente en esta spec.

## Verify

`pnpm lint && pnpm test && pnpm build`
