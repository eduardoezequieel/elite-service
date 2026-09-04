# 023 — Cierre del audit UX (lo que no cubrieron 012–022)

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 012–022

## Task

Cerrar los hallazgos numerados que siguen abiertos (14, 26–28, 30, 32–36,
38–40) y los extras de `docs/UX_AUDIT_VERIFIED.md` que son el mismo trabajo.
Fuera: spec 011, fotos, WhatsApp, cola priorizada.

## Done

- [x] Cobro con caja cerrada: abrirla en el mismo diálogo y seguir cobrando (14).
- [x] Catálogo y empleados: columna Acciones de solo lectura sin `*.manage` (26).
- [x] Listas vacías: un solo primario (cabecera o vacío, no los dos) (27).
- [x] `Activo` no usa el verde de Listo/Cobrado (28). `Cuadra` de caja tampoco.
- [x] Placa: valor en mayúsculas, sin `text-transform` (30). Se guarda normalizada.
- [x] Riel plegado: el ítem tiene nombre accesible, no solo `title` (32).
- [x] Alta/edición de catálogo y empleados con schemas de `@elite/shared` (33).
- [x] Formularios de esas pantallas validan al escribir (`onChange`) (34).
- [x] Dar de baja pide confirmación en cliente, empleado y usuario (35).
- [x] Buscador en empleados, usuarios, roles y catálogo (36). Sin paginar.
- [x] `Cargando…` con `role="status"` (38).
- [x] Detalle de lavado: una sola salida; se quita `Volver a la fila` (39).
- [x] Sin permiso, `/carwash` (y catálogo/empleados) muestran mensaje, no blanco (40).
- [x] Fila con `rowHref` abre con Enter/Espacio, no solo clic.
- [x] `findByPlate` no reusa un vehículo desactivado.
- [x] Alta con `vehicleId` alinea el `customerId` del ticket al dueño, o 422.
- [x] `refetchOnWindowFocus` en el QueryClient. Catálogo de pista y oficina
      `staleTime` 30s, no 5 min.
- [x] Link de placa con anillo de foco. `--touch-min` en Button.
- [x] PIN 4–8 validado en el cliente. Ojito a tamaño táctil.
- [x] Login de pista en densidad `bahia`.
- [x] Categoría se puede editar/desactivar. Crear empleado dice qué falta.
- [x] Front-matter de `DESIGN.md` alineado al CSS (fila 52px).
- [x] Anular pide motivo (como el reverso).

## Always

- Autorización por `module.action`.
- Errores `{ code, message }` en el diálogo donde ocurren.

## Never

- Nunca fotos, WhatsApp ni cola priorizada.
- Nunca la spec 011.

## Verify

`pnpm lint && pnpm test && pnpm build`
