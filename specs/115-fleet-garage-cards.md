# 115 — Carros como garaje: tarjetas con el carro en 3D y qué está pasando

**Estado:** Terminada (aprobada por chat, 11 oct 2026)
**Módulo:** fleet (api) · `features/fleet` (web) · `@elite/shared` rentals/fleet.ts | **Depende de:**
107, 110, 113

## Contexto

La lista de Carros es una tabla de cuatro columnas: no se ve de un vistazo qué carro está en la
calle, cuál vuelve hoy ni cuál se atrasó. El usuario aprobó por chat el prototipo
`docs/prototype/fleet-garage.html` (11 oct 2026): tarjetas con el carro en 3D en diagonal,
pintado de su color, el estado, una línea de qué está pasando y filtros por estado arriba.

## Historias

- Como quien ve la flota (`fleet.read`), quiero ver mis carros como tarjetas con su dibujo, su
  estado y qué está pasando con cada uno, para saber de un vistazo cuál está libre, cuál vuelve y
  cuál se atrasó.

## Criterios de aceptación

### API

- **Dado** `GET /fleet/vehicles`, **entonces** cada ítem trae además
  `activity: { kind: 'RETURN' | 'PICKUP'; at: string; customerName: string | null } | null`
  según RN-1. El resto de la respuesta no cambia.
- **Dado** un usuario sin `rentals.read`, **entonces** `activity.customerName` viene `null`
  (RN-2); `kind` y `at` sí vienen.

### Pantalla (`/rentals/fleet`)

- **Dado** la pantalla, **entonces** la vista por defecto son **tarjetas** en una grilla
  `repeat(auto-fill, minmax(var(--card-min), 1fr))`, agrupadas por estado en este orden:
  Atrasado, En renta, Reservado, Libre, Taller. Cada grupo lleva su título con la cantidad.
- **Dado** una tarjeta, **entonces** muestra: el carro en 3D (RN-3) en un escenario de
  `--stage-h`, el sello del estado (punto + palabra) arriba a la derecha, nombre en Saira itálica,
  año · tipo, `PlateChip` (o «Sin placa»), la línea de actividad (RN-4), los avisos como texto
  (ámbar `WARN`, rojo `DUE`), la tarifa por día y la referencia `#N` al pie. Tocarla abre
  `/rentals/fleet/[id]`.
- **Dado** la cabecera de la pantalla, **entonces** arriba de la grilla va una fila con el medidor
  «Ocupación de la flota» (arco segmentado, «X de Y», X = En renta + Atrasado, Y = todos menos
  Taller), el monto **«Ingreso diario en renta»** (suma de `dailyRate` de En renta + Atrasado) y
  cinco filtros píldora por estado con su cantidad; tocar uno filtra, tocarlo otra vez lo quita.
- **Dado** la barra de filtros, **entonces** hay buscador (placa, marca, modelo), chips de tipo
  (Todos, Sedán, Camioneta, Pick up) y un conmutador **Tarjetas / Lista**; «Lista» es la
  `DataTable` actual. La vista elegida va en la URL (`?view=list`).
- **Dado** «Retirados», **entonces** sigue funcionando como hoy (`?status=RETIRED`); en esa vista
  no se muestran el medidor ni los filtros por estado.
- **Dado** la densidad `bahia`, **entonces** `--card-min` pasa de 270px a 330px, `--stage-h` de
  150px a 190px y crecen nombre, tarifa y sellos. **Dado** 390px de ancho, una tarjeta por fila.
- **Dado** que el 3D no carga (sin WebGL o mientras baja la librería), **entonces** el escenario
  muestra el ícono `Car` de lucide y la tarjeta funciona igual.

## Reglas de negocio

- **RN-1 (actividad):** sale de la misma renta que decide `availability` (107 RN-2):
  - Renta `IN_PROGRESS` (En renta o Atrasado) → `RETURN` con `plannedReturnAt`.
  - Reserva (Reservado, o Atrasado porque no salió) → `PICKUP` con `plannedPickupAt`.
  - Libre con una reserva futura → `PICKUP` de la más próxima.
  - Libre sin reserva, Taller y Retirado → `null`. El taller no guarda motivo ni fecha: no se
    inventa.
- **RN-2:** el nombre del cliente es dato de la rentadora: solo con `rentals.read`.
- **RN-3 (dibujo):** la silueta sale de `category` (sedán, camioneta, pick up) y el color de
  `color` normalizado (minúsculas, sin tildes) contra una paleta fija: blanco, negro, gris, plata,
  rojo, azul, vino, verde, amarillo, naranja, café, beige, dorado. Lo que no coincide sale gris.
  Los colores de pintura son tokens `--car-paint-*` en `globals.css`.
- **RN-4 (texto de la línea):** la web arma la frase, no la deriva del estado:
  - `RETURN` futuro «Vuelve hoy 5:00 pm», «Vuelve mañana», «Vuelve el jueves» (≤ 6 días),
    «Vuelve el 24 oct»; pasado «Debió volver hace 2 días».
  - `PICKUP` futuro «Sale mañana 8:00 am»; pasado «Debió salir ayer».
  - Con cliente se agrega « · Nombre». Sin actividad: Libre «Listo para rentar», Taller
    «En taller».
- **RN-5:** los conteos, el medidor y los filtros se calculan sobre los carros cargados. La vista
  pide `pageSize=100` (`MAX_PAGE_SIZE`); si hubiera más, el `Pager` sigue abajo.

## Permisos

Ninguno nuevo. `fleet.read` para la pantalla; `rentals.read` para ver el nombre del cliente.

## Datos

Sin cambios al schema. El API agrega `customer.fullName` al `select` de rentas abiertas en
`prisma-fleet-day.source.ts`.

## API

| Método | Ruta                  | Request    | Response                                  | Errores    |
| ------ | --------------------- | ---------- | ----------------------------------------- | ---------- |
| GET    | `/fleet/vehicles`     | sin cambio | ítems con `activity` (RN-1, RN-2) añadido | sin cambio |
| GET    | `/fleet/vehicles/:id` | sin cambio | ídem                                      | sin cambio |

## UI

- `fleet-screen.tsx`: cabecera igual + fila de pulso + barra de filtros + tarjetas o lista.
- Nuevo `fleet-vehicle-card.tsx` (tarjeta), `car-render.ts` (three.js cargado con
  `import()` solo en el cliente; un renderer, una imagen por tipo + color en caché, recortada al
  borde del carro), `car-paint.ts` (RN-3), `fleet-activity.ts` (RN-4, con tests).
- Dependencia nueva `three` + `@types/three` en `apps/web`, con **ADR-015** en
  `docs/ARCHITECTURE.md`.
- `DESIGN.md`: la tarjeta del garaje en Componentes.

## Fuera de alcance

- El panel lateral del prototipo: la tarjeta abre la ficha que ya existe.
- Motivo y fecha de entrada al taller, y «Libre desde hace N días».
- Cambiar el campo color a una lista fija.
- La ficha del carro (`/rentals/fleet/[id]`).

## Tareas

- [x] Shared: `FleetVehicleActivity` y `activity` en `FleetVehicle`.
- [x] API: `customerName` en `OpenAgreement` y en el `select`; `attachFleetDay` arma `activity`
      (RN-1) y la oculta según RN-2. Tests de dominio de cada caso de RN-1 y RN-2.
- [x] Web: `car-paint.ts` + tokens; `fleet-activity.ts` + tests de RN-4; `car-render.ts`;
      `fleet-vehicle-card.tsx`; `fleet-screen.tsx` con pulso, filtros, grupos y `?view`.
- [x] `three` + `@types/three`, ADR-015, `DESIGN.md`.
- [x] Verificación: `pnpm build && pnpm lint && pnpm test`.
- [ ] `bash scripts/verify-110.sh` contra un stack de verificación (no corrido: no había API en 3210).
