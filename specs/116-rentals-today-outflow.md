# 116 — Hoy: flujo de rentas y carros afuera

**Estado:** En desarrollo
**Módulo:** `rental-reports` (api) · `@elite/shared` (contrato) · `features/rental-reports` (web) | **Depende de:** 107, 108

## Contexto

La pestaña Libre ya consulta disponibilidad para un rango. Hoy debe ayudar a seguir las salidas y mostrar los carros que siguen con clientes, sin repetirlos en varios bloques. Esta spec reemplaza la composición de Hoy definida en la 107.

## Historias

- Como dueño, quiero ver las salidas de hoy y todos los carros que siguen afuera con su fecha de regreso, para seguir el flujo de la flota.

## Criterios de aceptación

- **Dado** `GET /rentals/reports/today`, **entonces** devuelve el día civil, `departures`, `out` y `collected`; deja de devolver `fleet`, `returns` y `overdue`. `out` tiene una fila por renta `IN_PROGRESS`, incluida la que vuelve hoy o está atrasada, con cliente, carro, fecha/hora de regreso y estado de regreso. Permiso `rentals.read`; 403 sin él.
- **Dado** `/rentals`, **entonces** conserva «Cobrado hoy» y «Salen hoy», quita el resumen de flota, y muestra «En la calle» con cada renta activa una sola vez y su regreso previsto; los atrasos se identifican en esa lista.
- **Dado** la lista «En la calle», **entonces** tocar una fila abre su renta; las que vuelven hoy ofrecen «Recibir» y las atrasadas, «Llamar» si hay teléfono. Una renta futura no repite acción operativa.
- Las reservas vencidas que no se retiraron ya no se muestran en Hoy; siguen disponibles en Rentas → «Por salir».
- **Dado** densidad `bahia` o ancho de tablet, **entonces** las listas caben en una columna y conservan controles tocables de al menos `--touch-min`.
- Sin campos, tablas, permisos ni rutas nuevos. La pestaña Libre conserva su búsqueda por fechas.

## Reglas de negocio

- **RN-1:** «En la calle» incluye solo rentas `IN_PROGRESS`; cada renta aparece una sola vez aunque su regreso sea hoy o esté atrasado.
- **RN-2:** una reserva `RESERVED` vencida no aparece en Hoy; permanece accesible en Rentas, filtro «Por salir».
- **RN-3:** las fechas usan el día civil de `America/El_Salvador`; `returnStatus` es `OVERDUE` si el día civil de regreso ya pasó, `TODAY` si es hoy y `UPCOMING` si es posterior.

## Permisos

Sin cambios: `rentals.read`.

## Datos

Sin cambios al schema.

## API

| Método | Ruta | Request | Response | Errores |
| ------ | ---- | ------- | -------- | ------- |
| GET | `/rentals/reports/today` | sin cambio | `RentalToday` actualizado | 403 |

`RentalToday` agrega `out: TodayOutRow[]` y quita `returns`, `overdue` y `fleet`. `TodayOutRow` comparte los datos de carro, cliente y contrato de `TodayRow`; `at` es el regreso previsto y `returnStatus` es `UPCOMING | TODAY | OVERDUE`.

## Contrato compartido

Actualizar `rentals/reports.ts` y sus pruebas para reflejar la respuesta y el tipo `TodayOutRow`.

## UI

Actualizar `today-screen.tsx`: quitar la sección/filas de estado general, «Vuelven hoy» y «Atrasados»; mantener «Salen hoy» y agregar «En la calle» con carro, cliente, regreso previsto y acción según estado.

## Fuera de alcance

- Cambios en Libre, Rentas, Carros, caja, permisos, navegación o reglas de cobro.

## Tareas

- [x] Shared: actualizar el contrato de Hoy y pruebas.
- [x] API: incluir todas las rentas activas, excluir reservas no retiradas vencidas de Hoy y actualizar pruebas unitarias; adaptar el verificador 107 al contrato vigente.
- [x] Web: quitar el resumen de flota y presentar el flujo sin filas duplicadas.
- [x] Crear `scripts/verify-116.sh` para comprobar por HTTP las salidas de hoy, rentas activas (próximas, de hoy y atrasadas), reservas no retiradas y 403; adaptar `verify-107.sh` al contrato vigente.
- [x] Completar la verificación de la spec con lint limpio y un stack disponible para `verify-116.sh`.

## Verificación

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-116.sh`
