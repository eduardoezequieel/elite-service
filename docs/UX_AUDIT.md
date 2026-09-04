# Auditoría de UI/UX — septiembre 2026

**Qué es esto:** el resultado de recorrer las 17 pantallas en `localhost:3100` (sesión de
Administrador, a 1280 / 768 / 390 px) y leer `apps/web/src` y los controladores de `apps/api`.
Contrasta lo implementado contra `PRODUCT.md`, `apps/web/DESIGN.md` y el uso real de las tres
audiencias.

**No es una spec y no autoriza implementar.** Es la evidencia de la que salen las specs
`012`+. Cada hallazgo trae archivo y línea aproximada para que se pueda verificar antes de
tocar nada. Las líneas son del estado del repo al 4 de septiembre de 2026.

**Prototipo de la propuesta:** `docs/prototype/ux-audit-2026-09.html` — auditoría filtrable
más tres pantallas rehechas y clickeables (alta en tablet, fila de la pista, lista del
mostrador). Ahí se ve el comportamiento propuesto, no solo la descripción.

La pista (`/floor`) se auditó por código: entrar pide usuario y PIN de empleado.

---

## 1. Bloqueantes — rompen el trabajo diario

| #   | Pantalla         | Problema                                                                      | Dónde                                                                     | Arreglo                                                                        |
| --- | ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 01  | `/floor/new`     | El total y `Abrir lavado` caen fuera de pantalla en tablet vertical           | `ticket-form.tsx:184` — grid `xl:grid-cols-[1fr_340px]`, `xl` = 1180px    | Barra fija al pie desde 900px con total y primario                             |
| 02  | `/floor`         | La fila no tiene buscador ni filtro                                            | `floor-queue.tsx:50` — `tickets.data.map()` completo                      | Buscar por placa, número y cliente + chips de estado                           |
| 03  | Todas            | La tablet abierta nunca se actualiza sola                                      | `lib/query-client.tsx:11` — `staleTime` 60s, sin `refetchInterval`        | `refetchInterval` en la fila y en Lavados + renglón de frescura                |
| 04  | Todo el módulo   | No existe el estado «Lavando»: quien espera y quien se está lavando son iguales | `ticket-status-stamp.tsx:17` — `OPEN \| READY \| PAID \| VOID`            | `WASHING` entre `OPEN` y `READY`, con quién lo tomó y desde cuándo             |
| 05  | `/carwash/[id]`  | `Anular` no pide confirmación y no se puede deshacer                           | `ticket-detail-screen.tsx:187`                                            | Diálogo de confirmación; el patrón ya está en `delete-role-dialog.tsx`         |
| 06  | Cobro            | Un cobro equivocado es irreversible                                            | `carwash-tickets.controller.ts:148` — `void` solo desde `OPEN`/`READY`    | Reversión con permiso propio y motivo, que reste del turno de caja abierto     |
| 07  | `/settings/catalog` | No se puede crear un servicio ni una categoría                              | `use-catalog.ts:48` `useCreateService`, `catalog/api.ts:19-26` — nunca importados | `Nuevo servicio` en cabecera y vacío + pantalla mínima de categorías   |
| 08  | `/carwash/[id]`  | No se puede editar un lavado abierto                                           | `carwash/api.ts:55` `updateTicket` + `PATCH /carwash/tickets/:id` sin UI  | Editar servicios, tipo de carro y nota mientras esté `OPEN`                    |

**Sobre el #08:** el formulario de la pista dice literalmente «Elige el más parecido, en caja
lo confirmamos» (`ticket-form.tsx:250`). En caja no hay dónde confirmarlo. Es una promesa
escrita en la UI que el sistema no cumple.

---

## 2. Altas

| #   | Pantalla             | Problema                                                                | Dónde                                                                    | Arreglo                                                              |
| --- | -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 09  | Alta de lavado       | La placa no busca el vehículo que ya vino                                | `GET /vehicles?q=` existe; `TicketFormValues` no tiene `vehicleId` (`ticket-form.tsx:35`) | Autollenar tipo, marca, color y dueño; mandar `vehicleId`     |
| 10  | Alta de lavado       | Repetir una placa sobrescribe la ficha del carro y reasigna el dueño     | `ticket.usecases.ts:324-335`                                             | Proponer lo guardado y pedir confirmación explícita para cambiarlo   |
| 11  | `/carwash`           | Sin búsqueda por placa, cliente ni número                                | `tickets-screen.tsx:26` — solo tres pestañas de estado                   | Campo de búsqueda como el de `/customers`                            |
| 12  | `/carwash`           | No hay forma de ver los lavados de ayer                                  | `listTickets` acepta `date` (`carwash/api.ts:40`), sin exponer            | Selector de día en la cabecera                                       |
| 13  | Cobro                | El método de pago no viene preseleccionado                               | `charge-dialog.tsx:66`, `:152`                                           | Efectivo por defecto                                                 |
| 14  | Cobro                | Si la caja está cerrada, el cobro pierde el contexto (~4 taps)            | `charge-dialog.tsx:101-111`                                              | Abrir caja desde el mismo diálogo y seguir cobrando                  |
| 15  | `/carwash`, `/floor` | `Reabrir` solo vive en el detalle: deshacer cuesta 2 taps + navegación    | `tickets-screen.tsx:438`                                                 | `Reabrir` en la fila, o «Deshacer» 5s en el aviso                    |
| 16  | `/floor`             | La fila no muestra quién está lavando cada carro                          | `floor-queue.tsx:60-104` — `QueueCard` no pinta `washers`                | Nombres en la tarjeta, equipo completo (no «Carlos +1»)              |
| 17  | Todo el módulo       | No hay tiempos: ni hora de entrada, ni espera                             | El ticket solo trae `createdAt`/`updatedAt`, sin usar en ninguna pantalla | `startedAt` / `readyAt` / `paidAt` + espera visible en la fila       |
| 18  | Nav < 900px          | 8 objetivos en el ancho: ~40px a 390px, contra tu mínimo de 44            | `nav-bottom-bar.tsx:69` — 6 ítems `flex-1` + tema + usuario             | Cuatro destinos fijos + «Más»; tema y usuario dentro del menú        |
| 19  | Todas las tablas     | En tablet horizontal la tabla se arrastra de lado                         | `data-table.tsx:142` `overflow-x-auto`; corte a tarjetas en `md` = 900px  | Subir el corte a ~1100px; el Catálogo suma una columna por tipo      |
| 20  | `/carwash`           | Los botones de fila miden menos que el mínimo táctil propio               | `tickets-screen.tsx:416,440,452` — `size="sm"` = 42px en bahía          | Tamaño normal (48px) en acciones de fila                             |
| 21  | `/floor`             | `Salir` sin confirmación, en la esquina donde se agarra la tablet          | `floor-shell.tsx:66-75` (+ `queryClient.clear()`)                        | Confirmación de un tap, o dentro de un menú                          |
| 22  | Vehículos            | No se puede crear ni corregir un vehículo en ningún lado                  | `POST /vehicles`, `PATCH /vehicles/:id` sin ninguna llamada en `apps/web` | Acciones en la tarjeta «Carros» + búsqueda por placa con historial   |
| 23  | Cobro                | `Ver recibo` no muestra ningún recibo (regresión vs el legado)             | `tickets-screen.tsx:419`; cero `window.print` en `apps/web`              | Vista imprimible del cobro, o renombrar el botón                     |
| 24  | Alta de lavado       | La placa abre el teclado alfabético completo, sin máscara                  | `ticket-form.tsx:203` — sin `inputMode`                                  | Máscara de placa y teclado adecuado, con validación en vivo          |
| 25  | Todas                | La densidad no se puede fijar desde la app                                | `useDensity`/`setDensity` solo se consumen en `design-reference.tsx`     | Ítem de densidad al pie del riel; la lógica ya está escrita          |
| 26  | Catálogo, Empleados  | Sin permiso de edición desaparece la columna Acciones entera               | `catalog-screen.tsx:175`, `employees-screen.tsx:104`                     | Variante de solo lectura, como ya la tienen Usuarios y Roles         |

**Sobre el #25:** `DESIGN.md` → Cortes y densidades dice «y el usuario puede fijarla a mano».
La app no lo entrega. Además, un portátil táctil dispara `pointer: coarse` y queda en `bahia`
para siempre, sin forma de corregirlo desde la interfaz.

---

## 3. Medias

| #   | Pantalla                       | Problema                                                            | Dónde                                                                    |
| --- | ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 27  | Clientes, Empleados, Usuarios, Roles | Dos primarios a la vez con la lista vacía (cabecera + `emptyAction`) | El mismo `variant="default"` en las cuatro                       |
| 28  | 6 pantallas                    | `--go` (verde de «listo») usado para «Activo»                        | `Stamp tone="green"` en `customers-screen:141`, `customer-detail:76`, `employees:99`, `catalog:170`, `users-table:100`, `user-dialog:115` |
| 29  | Catálogo                       | El estado vacío no ofrece ninguna salida                             | `catalog-screen.tsx:96` — sin `emptyAction`                              |
| 30  | Alta de lavado                 | Mayúsculas forzadas en la placa                                      | `ticket-form.tsx:207`, `ticket-summary.tsx:50`                           |
| 31  | Catálogo                       | El guion de precio se explica solo en un `title` (hover)             | `catalog-screen.tsx:145`                                                 |
| 32  | Riel plegado                   | Los nombres de los ítems viven en el `title`                         | `nav-rail.tsx:101`                                                       |
| 33  | Catálogo, Empleados            | Dos formularios sin zod ni validación de ningún tipo                 | `catalog-screen.tsx:221`, `employees-screen.tsx:148`                     |
| 34  | Todos los formularios          | Ninguno valida mientras se escribe (modo por defecto de RHF)         | —                                                                        |
| 35  | Administración                 | Dar de baja cuesta 1 clic o 3 según la pantalla                      | `customer-detail-screen.tsx:96` vs el switch dentro de cada diálogo      |
| 36  | Empleados, Usuarios, Roles, Catálogo | Sin buscador; y sin paginación ni orden en ninguna tabla       | `data-table.tsx:60` no tiene concepto de orden                           |
| 37  | Navegación                     | Caja y Comisiones no están en el riel: 2 clics con parada obligatoria | `nav-items.ts:59-106`                                                    |
| 38  | Listas y detalles              | `Cargando…` no se anuncia (sin `role="status"`)                      | `data-table.tsx:292`                                                     |
| 39  | Detalles                       | Dos salidas para el mismo destino (back link + `Volver a la fila`)   | `ticket-detail-screen.tsx:202`, `floor-ticket-detail.tsx:153`            |
| 40  | `/carwash` sin permiso         | La pantalla queda en blanco, sin mensaje ni salida                    | `require-permission.tsx:47` — `fallback` por defecto `null`              |
| 41  | Alta de lavado                 | El texto de ayuda dice algo que no es cierto                          | `ticket-form.tsx:196` — faltan tipo y servicio para habilitar el botón   |
| 42  | Caja                           | El cierre no pregunta nada cuando la diferencia es grande             | `close-cash-dialog.tsx:115-140`                                          |
| 43  | Comisiones                     | Reporte de solo lectura; rangos fijos aunque el API acepte `from`/`to` | `commissions-screen.tsx`                                                |
| 44  | Alta y detalle                 | El descuento se puede mostrar pero ningún flujo lo puede crear         | `ticket-detail-screen.tsx:119` vs `ticket-form.tsx:137`                  |

Extras verificados que **sí cumplen** y conviene no romper: cero hex fuera de `globals.css`;
foco definido una sola vez; `.is-ruled-out` aplicado al dato y no a la fila; una sola sombra;
`tabular-nums` global en `th`/`td`; `Stamp` no puede renderizarse mudo; el latido limitado a
`washing`; y toda variación de UI decidida contra claves `module.action`, nunca por nombre de
rol.

Discrepancia de documentación: el front-matter de `DESIGN.md` declara
`density.mostrador.row: '36px'` y `touch: '36px'`, contra la tabla en prosa del mismo
documento (52px) y contra `globals.css:94,192` (`--row-h: 52px`). El front-matter está
desactualizado.

---

## 4. Orden propuesto

**Ola 1 — la UI que el backend ya aguanta.** Hallazgos 01, 02, 05, 07, 08, 09, 10, 11, 12,
13, 15, 37. Casi todo es front sobre endpoints que ya funcionan.

**Ola 2 — lo que la pista necesita para no volver al cuaderno.** Hallazgos 03, 04, 16, 17, 18,
19, 20, 21, 22, 23, 24, 25.

**Ola 3 — necesita decisión de negocio.** Hallazgos 06, 42, 43, 44, más lo que no existe y
nadie pidió: fotos de inspección al recibir el carro, aviso al cliente por WhatsApp (el
teléfono ya se captura), cola priorizada.

Specs derivadas: `specs/012-vehicle-lookup-on-intake.md`,
`specs/013-touch-intake-summary.md`, `specs/014-carwash-search-and-date.md`. El resto de la
ola 1 todavía no tiene spec.
