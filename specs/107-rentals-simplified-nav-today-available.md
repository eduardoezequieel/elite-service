# 107 — Renta simplificada: cinco pestañas, Hoy y Libre

**Estado:** Aprobada (por chat, 5 oct 2026: «apruebalas y despliega agentes grok que se encarguen»)
**Módulo:** app-shell (web) · rental-reports (api) · `features/rentals`, `features/rental-reports` (web) |
**Depende de:** 094–100, 103. **Base de la épica 107–110**: la 108 (Rentas), la 109 (Caja) y la
110 (Carros) corren en paralelo después de esta, sobre archivos disjuntos (ver «Convivencia»).

## Contexto

La auditoría de usabilidad del 5 oct 2026 (14 informes, uno por pantalla, resumidos en
`https://claude.ai/artifact/8mj6oTTsc3eBw6rxjU5iWR`) encontró once pestañas para cinco preguntas,
el mismo dato pintado en tres o cuatro lugares con nombres distintos («Disponible», «Libre»,
«Rentado», «En curso») y las tareas del día escondidas detrás de tableros del mes. El prototipo
`docs/prototype/rentals-simplified.html` lo resuelve con cinco pestañas y es el diseño aprobado
(«lo veo todo bien», 5 oct 2026). Esta spec pone la navegación nueva y las dos pantallas que no
tienen dueño en las otras: **Hoy** y **Libre**.

Decisiones del dueño que valen para toda la épica: la renta la usa **solo él** (nada de vistas por
rol, nada de «por usuario»); **mínimo texto** (sin subtítulos, ayudas, leyendas ni párrafos:
botones de un verbo, rótulos de una o dos palabras, filas con tres datos como máximo, vacíos de
una línea).

## Historias

- Como dueño, quiero abrir la renta y ver a quién entrego y a quién recibo hoy, con el botón al
  lado, para no buscarlo en una lista.
- Como dueño, quiero poner dos fechas y ver qué carros están libres con el precio escrito, para
  cotizar por teléfono y reservar ahí mismo.

## Criterios de aceptación

### Navegación

- **Dado** el espacio «Renta de carros», **entonces** el riel y la barra inferior muestran
  exactamente cinco pestañas, en este orden: **Hoy** `/rentals` (`rentals.read`), **Libre**
  `/rentals/available` (`rentals.read`), **Rentas** `/rentals/agreements` (`rentals.read`),
  **Caja** `/rentals/cash` (`rentals.charge`), **Carros** `/rentals/fleet` (`fleet.read`). Un solo
  grupo en `NAV_SECTIONS`; el riel no dibuja rótulo de grupo cuando el espacio activo tiene uno
  solo.
- **Dado** `/rentals/calendar` o `/rentals/availability`, **entonces** redirigen (`redirect()` de
  Next en el `page.tsx`) a `/rentals/available`. `/rentals/customers`, `/rentals/customers/[id]`
  y `/rentals/settings` siguen existiendo pero **fuera del riel**: el menú de la persona
  (`user-menu.tsx`) muestra «Clientes» (`renters.read`) y «Ajustes de renta»
  (`rentals.settings`) solo cuando el espacio activo es la renta. El enlace de regreso de esas
  pantallas vuelve a Hoy. `/rentals/maintenance`, `/rentals/expenses` y `/rentals/profitability`
  no se tocan acá (los redirige la 110).
- La barra inferior en `bahia` muestra las cinco con icono y rótulo, sin «Más».

### Hoy (`/rentals`)

- **Dado** `GET /rentals/reports/today`, **entonces** responde `RentalToday`:
  `{ date, departures: TodayRow[], returns: TodayRow[], overdue: TodayRow[], collected: { total,
  byMethod }, fleet: TodayVehicle[] }`. `TodayRow = { agreementId, contractNumber, vehicleId,
  plate, vehicleName, customerName, customerPhone, at, kind: 'DEPARTURE' | 'RETURN' | 'OVERDUE' }`.
  `TodayVehicle = { vehicleId, plate, vehicleName, availability: 'FREE' | 'RENTED' | 'OVERDUE' |
  'RESERVED' | 'WORKSHOP', agreementId? }`. `date` es el día civil en `America/El_Salvador`;
  `departures` y `returns` son solo los de **ese** día; `overdue` lista una sola vez cada renta
  atrasada o reserva no retirada, con su fecha real en `at`. `collected` es la suma de
  `rental_payments` no anulados con `paidAt` de hoy. Permiso `rentals.read`; 403 sin él.
- **Dado** la pantalla, **entonces** muestra: título «Hoy, {d de mmm}», botón primario «Nueva
  renta», una cifra «Cobrado hoy» (`StatCard`, enlace a Caja si hay `rentals.charge`), y tres
  bloques «Salen hoy», «Vuelven hoy», «Atrasados». Cada fila: `PlateChip` + nombre del carro,
  cliente, hora, y **un** botón: «Entregar» (va a `/rentals/agreements/:id?action=deliver`),
  «Recibir» (`?action=return`) o «Llamar» (enlace `tel:` al celular; en atrasados). Vacío de un
  bloque: «Nada por hoy». Abajo, una tira de `PlateChip` por carro con el color de su
  `availability` y la palabra del estado en `sr-only` y en `title`; tocar un carro con renta abre
  esa renta, uno libre abre `/rentals/agreements/new?vehicleId=`, uno en taller abre su ficha.
- Nada del mes, ni barras de ocupación, ni documentos por vencer: eso vive en Carros (110).
  `rentals-home.tsx`, `occupancy-bars.tsx` y `GET /rentals/reports/dashboard` se borran; lo que
  `report-view.ts` calculaba solo para el tablero también.

### Libre (`/rentals/available`)

- **Dado** la pantalla, **entonces** arriba hay dos campos «Sale» y «Regresa» (por defecto
  mañana 09:00 y pasado mañana 09:00) y tres atajos: «Mañana», «Fin de semana» (sábado 09:00 a
  lunes 09:00) y «Una semana». Debajo, una tarjeta por carro **libre** en ese rango (los ocupados no
  se listan), con placa, nombre, «$35 por día × 2 días = $70» y un botón «Reservar» que abre
  `/rentals/agreements/new?vehicleId&from&to`. Usa `GET /rentals/availability` tal como está.
- **Dado** el enlace «Ver la semana», **entonces** se despliega una grilla de 7 días × carros a
  partir de «Sale» (datos de `GET /rentals/calendar`): celda ocupada con el nombre del cliente,
  celda libre con «Libre»; tocar una celda libre pone ese día en «Sale» y vuelve a las tarjetas.
  Sin leyenda de colores: la palabra va en la celda.
- Sin carros libres: «Nada libre». `calendar-screen.tsx` y `availability-screen.tsx` se borran;
  nace `available-screen.tsx`.

### Texto y densidad

- Ningún subtítulo bajo los títulos, ninguna frase de ayuda. Los `PermissionDenied` dicen «la
  renta», «lo libre».
- `bahia`: listas a una columna, botones de fila a `--touch-min`, la tira de placas envuelve.

## Reglas de negocio

- **RN-1:** «Hoy» es el día civil del taller, nunca «últimas 24 horas». Un atraso de ayer no
  aparece en «Vuelven hoy»: aparece en «Atrasados», con la fecha de ayer.
- **RN-2:** `availability` de un carro se deriva en un solo lugar del API (`domain/` de rentals o
  fleet) y es la misma función que usará la 110 para la lista de Carros: `RETIRED` nunca sale en
  Hoy; `IN_SHOP` → `WORKSHOP`; renta `LATE` → `OVERDUE`; `IN_PROGRESS` → `RENTED`; reserva que
  empieza hoy → `RESERVED`; si no, `FREE`.
- **RN-3:** Libre solo promete carros `ACTIVE` sin solapamiento con rentas que ocupan
  (`OCCUPYING_STATUSES`), lo que ya calcula `/rentals/availability`.

## Permisos

Sin claves nuevas.

## Datos

Sin cambios en `schema.prisma`.

## API

| Método | Ruta                      | Permiso        | Response      | Errores |
| ------ | ------------------------- | -------------- | ------------- | ------- |
| GET    | `/rentals/reports/today`  | `rentals.read` | `RentalToday` | 403     |

Se elimina `GET /rentals/reports/dashboard` y su contrato (`RentalDashboard`, `FleetBoardTile`,
`DashboardDay`, etc.). `GET /rentals/reports/profitability` no cambia.

## Contrato compartido

`rentals/reports.ts`: `RentalToday`, `TodayRow`, `TodayVehicle`, `VehicleAvailability` (el enum
de RN-2, con `VEHICLE_AVAILABILITY_LABELS`: Libre, En renta, Atrasado, Reservado, Taller). Se
borra lo del dashboard.

## UI

`features/rental-reports/components/today-screen.tsx` (Hoy),
`features/rentals/components/available-screen.tsx` (Libre), `nav-items.ts`, `nav-rail.tsx`
(grupo único sin rótulo), `user-menu.tsx`, `back-link.ts`, los `page.tsx` nuevos y los redirects.

## Convivencia con 108, 109 y 110

Esta spec es la única que toca `nav-items.ts`, `nav-rail.tsx`, `nav-bottom-bar.tsx`,
`user-menu.tsx`, `back-link.ts` y `rentals/reports.ts` (salvo lo de rentabilidad, que es de la
110). No toca `features/rentals/components/agreement-*`, `features/rental-billing`,
`features/fleet*`, `features/renters` ni `schema.prisma`. Los botones «Entregar»/«Recibir» de Hoy
abren la ficha con `?action=`; la 108 hace que ese parámetro abra el asistente, hasta entonces la
ficha lo ignora.

## Fuera de alcance

- El asistente de entrega/recepción (108), la caja por turnos (109), el estado único en la lista
  de Carros y los redirects de mantenimiento/gastos/rentabilidad (110).
- Mandar WhatsApp: «Llamar» es un `tel:`.

## Tareas

- [ ] `rentals/reports.ts`: tipos `RentalToday`, `TodayRow`, `TodayVehicle`,
      `VehicleAvailability` + labels; borrar el contrato del dashboard.
- [ ] API: `GET /rentals/reports/today` (application + infrastructure + presentation), la función
      `vehicleAvailability()` en `domain/`, tests; borrar `dashboard`.
- [ ] `nav-items.ts` + spec: cinco pestañas, un grupo; `nav-rail.tsx` sin rótulo de grupo único;
      `user-menu.tsx` con Clientes y Ajustes de renta en el espacio renta; `back-link.ts`.
- [ ] `today-screen.tsx` + `use-rental-reports.ts`; borrar `rentals-home.tsx`,
      `occupancy-bars.tsx` y sus helpers; `page.tsx` de `/rentals`.
- [ ] `available-screen.tsx` (tarjetas + «Ver la semana»); borrar `calendar-screen.tsx` y
      `availability-screen.tsx`; `page.tsx` de `/rentals/available`; redirects de `calendar` y
      `availability`.
- [ ] `scripts/verify-107.sh`: renta que sale hoy aparece en `departures`; renta vencida ayer
      aparece una vez en `overdue` con la fecha de ayer y no en `returns`; pago de hoy suma en
      `collected`; 403 sin `rentals.read`; `/rentals/reports/dashboard` responde 404.
- [ ] `scripts/verify-100.sh`: quitar lo del dashboard, dejar rentabilidad.
- [ ] `apps/web/AGENTS.md`: anotar que la renta tiene cinco pestañas y un solo grupo.

## Verificación

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-107.sh && bash scripts/verify-100.sh`
