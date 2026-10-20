# 123 — El plan de servicio pasa a Ajustes de la renta

**Estado:** Aprobada — 19 oct 2026, en el chat: «A me parece, adelante» (la misma regla para todos
los carros, el plan en Ajustes como lista simple)
**Módulo:** `features/rental-settings`, `features/fleet-maintenance` (web) | **Depende de:** 110,
120, 121, 122

## Task

El plan de servicio es uno solo para toda la flota, pero se abría desde la ficha de un carro y
confundía. Sale de la ficha y vive en una pestaña «Servicio» de Ajustes de la renta, como una
lista simple. Solo web: el API y `@elite/shared` no cambian.

## Done

- [x] Ficha del carro (`vehicle-maintenance-tab.tsx`): se va el botón «Plan de servicio».
- [x] Ajustes de la renta: quinta pestaña «Servicio» (ícono llave), después de Accesorios, con el
      número de tareas activas. Solo si la persona tiene `fleet.manage`.
- [x] Arriba, dos filas `SettingsRow`: «Avisar antes · km» (`kmAlert`) y «Avisar antes · días»
      (`daysAlert`). Se guardan con la barra de guardar de la 120, como los demás ajustes (cuentan
      en cambios y en el punto de la pestaña).
- [x] Debajo, la lista de tareas activas: una fila por tarea con el nombre y «cada 5,000 km o 90
      días» (`intervalLabel`, km con separador de miles). Tocar la fila la edita en el lugar
      (nombre, cada cuántos km, cada cuántos días). Un botón «Quitar» por fila que la desactiva
      (`isActive: false`), con Deshacer en el aviso. «Agregar tarea» al final. Cada acción se
      guarda en el momento con los hooks del plan (`usePlanTasks`, `useCreatePlanTask`,
      `useUpdatePlanTask`), no con la barra.
- [x] Sin columna Ref./#, sin columna Estado, sin sello Activa/Desactivada. Las tareas
      desactivadas no se muestran.
- [x] `MaintenancePlanDialog` se borra si queda sin uso, con lo que deje huérfano.
- [x] Bahía y tablet: filas a una columna, controles con `--touch-min`.
- [x] Tests de la lógica nueva que no sea solo JSX.

## Always

- Reusar `SettingsRow`, `Tabs`, `Button`, los hooks del plan y los tokens de `DESIGN.md`.
- Textos en usted, sin voseo. Mínimo texto: sin ayudas ni subtítulos.

## Ask first

- Cambiar el API o `@elite/shared`.
- Volver a mostrar las tareas desactivadas.

## Never

- Navegador, Playwright o `pnpm dev` para revisar.
- Un plan por carro: es uno solo para la flota.

## Verify

`pnpm build && pnpm lint && pnpm test`
