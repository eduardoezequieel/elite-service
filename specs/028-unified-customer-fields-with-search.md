# 028 — Campos unificados de cliente con búsqueda en vivo y actualización

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 004, 024, 026

## Task

1. Reemplazar los múltiples estados y botones del cliente por un formulario simple y permanente con dos campos: **Nombre** y **Teléfono**.
2. El campo **Nombre** actúa como buscador en vivo:
   - Al escribir, si hay coincidencias, muestra sugerencias tocables.
   - Al seleccionar una sugerencia, rellena Nombre y Teléfono (y activa sus vehículos registrados).
   - Si no selecciona nada o no hay resultados, el usuario simplemente sigue escribiendo como cliente nuevo.
3. Si se edita el nombre o teléfono de un cliente previamente seleccionado, se actualiza su perfil en la base de datos al guardar el lavado.

## Done

- [x] `CustomerField` renderiza permanentemente los campos Nombre y Teléfono (sin botón «Buscar en los clientes» ni botón «Es alguien nuevo»).
- [x] Búsqueda integrada en el campo Nombre con debounce; muestra sugerencias tocables debajo del campo.
- [x] Tocar una sugerencia autollena Nombre y Teléfono, vinculando el cliente (`customerId`).
- [x] Si se modifican los datos de un cliente existente seleccionado, se detecta el cambio y se actualiza su perfil (`updateCustomer` / `updateFloorCustomer`) al guardar el lavado.
- [x] Si se escribe un cliente nuevo (sin seleccionar sugerencia), se envía como cliente nuevo normal.
- [x] Navegación fluida: Enter en Nombre pasa al campo Teléfono.

## Always

- Mantener objetivos táctiles de 44px para tablet en las sugerencias.
- No perder espacio vertical innecesario.
- Validación: Nombre obligatorio para abrir el lavado; teléfono opcional.

## Never

- Nunca bloquear la escritura normal de clientes nuevos.
- Nunca forzar modos alternativos de pantalla ("buscar" vs "nuevo" vs "elegido").

## Verify

`pnpm lint && pnpm test && pnpm build`
