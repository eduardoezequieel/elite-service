# 122 — Servicio y gastos del carro: el tablero

**Estado:** Aprobada — 19 oct 2026, en el chat: «me gusta la de tablero del carro, implementemosla»
y, sobre fusionar Gastos, «A me parece, hazlo, adelante» (prototipo
`docs/prototype/fleet-care-views.html`, vista «Tablero»)
**Módulo:** `features/fleet-maintenance`, `features/fleet` (web) | **Depende de:** 110, 115, 121

## Task

Las pestañas «Servicio» y «Gastos» de la ficha de un carro pasan a ser una sola, «Servicio y
gastos» (`/rentals/fleet/[id]/maintenance`), con la vista «Tablero» del prototipo. Solo web: el API
y `@elite/shared` no cambian.

## Done

- [x] `frame-section.ts`: se va la pestaña Gastos; Servicio pasa a llamarse «Servicio y gastos».
      `/rentals/fleet/[id]/expenses` redirige a `/maintenance` (los enlaces viejos no se rompen).
- [x] Barra de la pestaña: «Anotar un gasto» (`fleet.manage`, abre el diálogo de gasto de hoy),
      «Historial · $X este mes» y «Plan de servicio» (`fleet.manage`, `MaintenancePlanDialog`).
- [x] Tablero (como `dashView` del prototipo): a la izquierda, el medidor con la aguja según lo
      más urgente, el odómetro en dígitos y una línea («Lo más urgente: … » / «Todo bien. Lo
      próximo es …» / «Todavía no hay nada anotado.»). A la derecha, un testigo por cada tarea
      activa del plan (`status.tasks`) y dos de papeles: Seguro y Tarjeta de circulación, con la
      fecha de `insuranceExpiresAt`/`registrationExpiresAt` y el helper `documentStatus` de
      `@elite/shared` (sin fecha = «Sin fecha»). Tonos: rojo `DUE`, ámbar `SOON`, apagado `OK`,
      gris `NO_DATA`. Leyenda debajo.
- [x] Ícono del testigo por `task.key` conocido (aceite, frenos, llantas, batería…) y llave
      inglesa por defecto. Lógica de tono/medidor/línea en un archivo puro con tests.
- [x] Tocar un testigo de servicio (`fleet.manage`) abre `ServiceEntryDialog` con esa tarea ya
      elegida. Sin el permiso, el testigo no es botón.
- [x] Tocar Seguro o Tarjeta (`fleet.manage`) abre «Ya se renovó»: costo (opcional), cuándo se
      pagó, nueva fecha de vencimiento (obligatoria, ≥ hoy). Guarda con `useUpdateFleetVehicle`
      y, si hay costo, después crea el gasto (`INSURANCE` para el seguro, `OTHER` con descripción
      «Tarjeta de circulación»). Si falla el gasto, el aviso dice que la fecha sí quedó.
- [x] Historial en un panel lateral (`Sheet`/drawer): servicios y gastos juntos, del más nuevo al
      más viejo, sin repetir el servicio que ya tiene su gasto (`maintenanceLogId`). Filtro «Este
      mes» / «Todo» y el total gastado. Corregir/borrar como hoy (gastos editables con su diálogo,
      servicios con borrar). Lavados y multas automáticas se ven sin editar. La fusión de las dos
      listas es una función pura con tests. Si hay más filas que las cargadas, «Cargar más».
- [x] Densidad `bahia` y < 920 px: el medidor arriba y los testigos debajo, en grilla
      `auto-fill` de ≥ 136 px. Testigos y botones con `--touch-min`.
- [x] Se borra lo que quede sin uso (`vehicle-expenses-tab.tsx`, las dos tablas viejas, helpers,
      tests de lo borrado). En la raíz, `AGENTS.md` pierde la sección «Pendiente de la sesión
      anterior».

## Always

- Tokens de `apps/web/DESIGN.md`, componentes de `components/ui`. Nada de colores fijos salvo los
  del odómetro si `DESIGN.md` no trae uno.
- Textos en usted, sin voseo («Toque uno», no «Tocá uno»). Mínimo texto: sin ayudas ni
  subtítulos.
- Reusar `ServiceEntryDialog`, `ExpenseEntryDialog`, `MaintenancePlanDialog` y los hooks
  existentes.

## Ask first

- Cambiar el API o `@elite/shared`.
- Tocar `features/rental-settings` (spec 120).

## Never

- Navegador, Playwright o `pnpm dev` para revisar.
- Inventar tareas del plan fijas en el código: los testigos salen del plan del API.

## Verify

`pnpm build && pnpm lint && pnpm test`
