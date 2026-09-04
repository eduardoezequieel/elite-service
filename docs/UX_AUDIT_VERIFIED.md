# Auditoría UX — verificada

**Insumo:** `docs/UX_AUDIT.md` (44 hallazgos, 4 sep 2026). Este archivo no lo reescribe.
**Árbol:** worktree actual de `elite-service` (incluye specs 012–014 y el audit, aún sin commitear).
**Fecha de verificación:** 4 sep 2026.
**Método:** 16 lanes de solo lectura. Orquestador Grok. Workers Grok (Gemini 3.8 Flash no está instalado en esta máquina: no hay binario `gemini` en PATH). Nada se implementó.

Hallazgos **17** y **23** no estaban en los lanes 1–14; los cubrió el lane 16 (integridad de citas).

---

## 1. Tabla resumen

Veredicto final = lane de contenido + lane 16 (citas). Si chocan, gana la cita leída por el orquestador (sección 5).

| # | Veredicto | Lane(s) | Ubicación real |
| --- | --- | --- | --- |
| 01 | CONFIRMADO | 2, 16 | `ticket-form.tsx:184` — `xl:grid-cols-[1fr_340px]` |
| 02 | CONFIRMADO | 5, 16 | `floor-queue.tsx:51` (audit citaba :50) — `tickets.data.map` sin buscador |
| 03 | CONFIRMADO | 13, 16 | `query-client.tsx:11` — `staleTime: 60 * 1000`, sin `refetchInterval` |
| 04 | CONFIRMADO | 5, 16 | `ticket-status-stamp.tsx:17` — `OPEN \| READY \| PAID \| VOID`, no hay `WASHING` |
| 05 | CONFIRMADO | 16 | `ticket-detail-screen.tsx:187` — `Anular` muta sin diálogo (lane 4: NO_VERIFICABLE, archivo fuera de glob) |
| 06 | DESPLAZADO | 4, 16 | Cierto: `PAID` no se anula. La regla no está en `carwash-tickets.controller.ts:148`; está en `work-order.ts:24` `void: { from: ['OPEN', 'READY'] }` |
| 07 | CONFIRMADO | 7, 16 | `use-catalog.ts` no importa `useCreateService`; `createCategory` no entra a la pantalla |
| 08 | CONFIRMADO | 14, 16 | `carwash/api.ts:55` `updateTicket` existe; ninguna UI lo llama |
| 09 | CONFIRMADO | 2, 16 | `TicketFormValues` (`ticket-form.tsx:32-36`) no tiene `vehicleId` |
| 10 | CONFIRMADO | 3, 16 | `ticket.usecases.ts:326-335` — placa existente pisa `bodyTypeId`, `make`, `color`, `customerId` |
| 11 | CONFIRMADO | 1, 16 | `tickets-screen.tsx:25-29` — solo tres pestañas de estado |
| 12 | CONFIRMADO | 14, 16 | `listTickets` acepta `date` (`carwash/api.ts:40`); la pantalla no lo manda |
| 13 | CONFIRMADO | 4, 16 | `charge-dialog.tsx:66` — `useState<PaymentMethod \| null>(null)` |
| 14 | CONFIRMADO | 4, 16 | `charge-dialog.tsx:101-111` — caja cerrada → link a `/carwash/cash` |
| 15 | DESPLAZADO | 1, 16 | Cierto: `Reabrir` no está en la fila. `tickets-screen.tsx:438` es **Cobrar**. Real: `ticket-detail-screen.tsx:172` y `floor-ticket-detail.tsx:138` |
| 16 | CONFIRMADO | 5, 16 | `QueueCard` (`floor-queue.tsx:60-104`) no pinta `washers` |
| 17 | REFUTADO | 16 | Ver sección 3 |
| 18 | CONFIRMADO | 9, 16 | `nav-bottom-bar.tsx` — 6 ítems `flex-1` + tema + usuario. Los ~40 px a 390 px no se midieron en runtime |
| 19 | CONFIRMADO | 10, 16 | `data-table.tsx:142` `overflow-x-auto`; corte a tarjetas en `md` = 900 px |
| 20 | CONFIRMADO | 1, 10, 16 | `size="sm"` en las acciones de fila (`tickets-screen.tsx:416+`). El 452 del audit es 453. `sm` = `--control-h - 6px` → 42 px en bahía (`button.tsx`) |
| 21 | CONFIRMADO | 5, 16 | `floor-shell.tsx:66-75` — `Salir` sin confirmación; `queryClient.clear()` en `use-floor.ts:94` |
| 22 | CONFIRMADO | 16 | `POST`/`PATCH /vehicles` existen; cero llamadas desde `apps/web` (lane 3 solo vio el API) |
| 23 | CONFIRMADO | 16 | `tickets-screen.tsx:419` — `Ver recibo` es un `Link` al detalle. Cero `window.print` en `apps/web` |
| 24 | CONFIRMADO | 2, 16 | `ticket-form.tsx:203` — placa sin `inputMode` ni máscara |
| 25 | CONFIRMADO | 16 | `useDensity`/`setDensity` de UI solo en `design-reference.tsx:295` (lane 9: NO_VERIFICABLE, ese archivo fuera de glob) |
| 26 | CONFIRMADO | 7, 8, 16 | Sin `*.manage` desaparece la columna Acciones en catálogo y empleados. Usuarios/roles dejan «Ver» |
| 27 | CONFIRMADO | 6, 11, 16 | Cabecera + `emptyAction` con el primario (Button sin `variant` → `default`) en clientes, empleados, usuarios, roles. También en lavados (hallazgo nuevo) |
| 28 | CONFIRMADO | 6, 11, 16 | `Stamp tone="green" label="Activo"` en las seis citas del audit. `green` pinta `--go-text` |
| 29 | CONFIRMADO | 7, 16 | `catalog-screen.tsx` vacío sin `emptyAction` |
| 30 | CONFIRMADO | 2, 11, 16 | `ticket-form.tsx:207` `[text-transform:uppercase]`; `ticket-summary.tsx:50` `uppercase` |
| 31 | REFUTADO | 7, 12, 16 | Ver sección 3 |
| 32 | CONFIRMADO | 9, 12, 16 | `nav-rail.tsx:101` — `title={collapsed ? label : undefined}` |
| 33 | CONFIRMADO | 7, 16 | Catálogo: formulario sin zod ni RHF (`catalog-screen.tsx:221+`). Empleados: tampoco zod, pero sí hay chequeo de vacíos (ver sección 5) |
| 34 | CONFIRMADO | 16 | Cero `mode: 'onChange'` (o similar) en `useForm` de `apps/web`. Lane 13: NO_VERIFICABLE (los `useForm` no viven en `hooks/`) |
| 35 | CONFIRMADO | 6, 16 | Ficha de cliente: 1 clic (`customer-detail-screen.tsx:96`). Diálogos: switch + Guardar |
| 36 | CONFIRMADO | 8, 10, 16 | `DataTable` no tiene orden ni página (`data-table.tsx:60`). Esas pantallas no tienen buscador |
| 37 | CONFIRMADO | 9, 16 | `nav-items.ts:59-106` — no están Caja ni Comisiones |
| 38 | CONFIRMADO | 10, 12, 16 | `data-table.tsx:292` — `Cargando…` sin `role="status"` |
| 39 | CONFIRMADO | 16 | `ticket-detail-screen.tsx:202` y `floor-ticket-detail.tsx:153` + `PageBackLink` en la cabecera (lane 9: NO_VERIFICABLE) |
| 40 | CONFIRMADO | 16 | `require-permission.tsx:27` `fallback = null`; `/carwash` no pasa fallback. Lane 1/12: NO_VERIFICABLE por glob |
| 41 | CONFIRMADO | 2, 16 | `ticket-form.tsx:196` dice placa y cliente; `canSubmit` también pide tipo y servicio |
| 42 | CONFIRMADO | 4, 16 | `close-cash-dialog.tsx:115-140` — muestra la diferencia y cierra, sin confirmación extra |
| 43 | CONFIRMADO | 14, 16 | API `from`/`to` (`carwash/api.ts:107`); UI con rangos fijos (`commissions-screen.tsx`) |
| 44 | CONFIRMADO | 16 | Detalle pinta `unitPrice !== catalogPrice` (`ticket-detail-screen.tsx:121`). El alta manda `{ serviceId }` sin `unitPrice` (`ticket-form.tsx:137`). Lane 14 REFUTADO: ver sección 5 |

Extras del audit (no numerados):

| Extra | Veredicto | Ubicación |
| --- | --- | --- |
| Cero hex fuera de `globals.css`; foco una vez; `.is-ruled-out` al dato; `tabular-nums`; Stamp no mudo; latido en `washing`; UI por `module.action` | CONFIRMADO, con matices | Hex: grep solo pegó en `globals.css`. Foco: hay un `focus-visible:outline-none` en el link de placa (`tickets-screen.tsx:323`) sin anillo propio. Hay `--shadow-flame` además de `--shadow-elite` (glow del primario) |
| Front-matter `density.mostrador.row: 36px` vs prosa/CSS 52 px | CONFIRMADO | `DESIGN.md:113` vs tabla :369 vs `globals.css:94,192` |

---

## 2. Contadores (44 hallazgos numerados)

| Veredicto | Cantidad |
| --- | ---: |
| CONFIRMADO | 39 |
| REFUTADO | 2 |
| DESPLAZADO | 2 |
| YA_ARREGLADO | 0 |
| NO_VERIFICABLE (final) | 0 |

Los NO_VERIFICABLE de lanes 1–14 por glob los cerró el lane 16 o el cruce de otro lane. Ningún hallazgo quedó sin decidir.

Cero YA_ARREGLADO: nadie corrigió estos puntos en el árbol actual.

---

## 3. Refutados

Un hallazgo falso en la auditoría es peor que uno faltante. Estos dos no entran a ninguna ola como están escritos.

### 17 — «El ticket solo trae `createdAt`/`updatedAt`, sin usar en ninguna pantalla»

**Qué decía el audit:** no hay tiempos; el ticket no usa esas fechas en ninguna pantalla.

**Qué hay hoy:**

```183:184:apps/web/src/features/customers/components/customer-detail-screen.tsx
                    {DATE_FORMAT.format(new Date(ticket.createdAt))}
```

El tipo también trae `payment.paidAt`. En `/floor` y `/carwash` no se pinta hora de entrada ni espera: ese hueco existe, pero la frase «sin usar en ninguna pantalla» es falsa.

### 31 — «El guion de precio se explica solo en un `title` (hover)»

**Qué decía el audit:** `catalog-screen.tsx:145`, solo `title`.

**Qué hay hoy:** el `title` sigue en :145, y además un párrafo visible cuando hay guion:

```200:205:apps/web/src/features/catalog/components/catalog-screen.tsx
      {hasDash ? (
        <p className="text-text-faint mt-4 text-dense">
          Una celda con guion (—) significa que ese servicio usa su precio base para ese tipo de
          carro. No es cero.
        </p>
      ) : null}
```

Tres lanes (7, 12, 16) coinciden. Lo que queda en pie: el `title` no alcanza en bahía, pero ya no es la única explicación.

---

## 4. Hallazgos nuevos

Lo que los lanes 1–14 vieron y el audit no numera. Criterio de gravedad del propio `UX_AUDIT.md`. Se excluyen los que son el mismo hecho que un hallazgo ya numerado (p. ej. «la lista no tiene día» = #12; «POST/PATCH vehículos sin cliente web» = #22).

### Alta

- **Fila con `rowHref` solo abre con clic, no con Tab+Enter.** `data-table.tsx:171-174`. En bahía y con teclado no se entra al detalle. DESIGN.md Accesibilidad. Lanes 10 y 12.
- **`Marcar listo` en la pista es un toque, sin confirmar.** `floor-queue.tsx:89`. De pie, con guantes, se marca listo el carro de al lado. PRODUCT.md Mecánico.
- **Vehículo desactivado se reutiliza y se reescribe al repetir la placa.** `prisma-vehicle.repository.ts:80` `findByPlate` sin filtrar activos; el alta (#10) lo pisa. Lane 3.
- **Alta con `vehicleId` deja el dueño del carro distinto del cliente del ticket.** `ticket.usecases.ts:316` — resuelve id/tipo y no alinea `customerId`. Lane 3.
- **Sin `services.read` / `employees.read` la pantalla usa el vacío de «no hay datos».** Catálogo `catalog-screen.tsx:73`; empleados `employees-screen.tsx:42`. Quien no tiene permiso cree que el taller no tiene lista. AGENTS.md 3. Lanes 7 y 8.
- **`QueryClient` apaga `refetchOnWindowFocus`.** `query-client.tsx:12`. Suma al #03: al volver a la tablet, la cola no se refresca. PRODUCT.md Operating Context. Lane 13.
- **Catálogo de pista (servicios/tipos) `staleTime` 5 min.** `use-floor.ts:143`. Precio viejo en la bahía. Lane 13.
- **Stamp `tone="green"` en «Cuadra» de caja; `StatCard Esperado` con `tone="go"`.** `cash-difference-stamp.tsx:19`, `cash-screen.tsx:197`. Verde reservado a Listo/Cobrado. DESIGN.md semáforo. Lane 11.
- **Link de placa con `focus-visible:outline-none` y sin anillo.** `tickets-screen.tsx:323`. DESIGN.md Foco. Lane 11.
- **PIN de empleado 4–8 dígitos no se valida en el cliente; desactivar empleado/usuario sin confirmación.** `employees-screen.tsx`. Lane 8.
- **Ningún `size` de Button declara `--touch-min`; `xs` resta 12 px a `--control-h`.** `button.tsx:39`. Lane 10.

### Media

- Placa, marca y color a tres columnas en `sm` (`ticket-form.tsx:200`).
- La placa se guarda con el casing escrito, no normalizada (`ticket-form.tsx:132`) — choca con Always de la spec 012.
- Alta de lavado crea/actualiza vehículo sin validar el tipo (`ticket.usecases.ts:337`).
- Si falla la query de caja, el cobro dice que hay que abrirla (`charge-dialog.tsx:75`).
- Anular no registra motivo (`carwash-tickets.controller.ts:151`).
- Login de pista fuera del layout que fuerza `bahia` (`floor/(shell)/layout.tsx:12`).
- Ojito del PIN `size="icon-xs"` (`floor-login-form.tsx:86`).
- Ficha de cliente: Editar y Desactivar los dos `outline` (`customer-detail-screen.tsx:85`).
- Precio distinto del base solo con naranja/negrita (`catalog-screen.tsx:155`).
- No se edita ni desactiva una categoría desde el catálogo.
- Crear empleado deshabilitado sin decir qué falta (`employees-screen.tsx:299`).
- Riel plegado: blanco interno ~40 px; botón de plegar sin `--touch-min` (`nav-rail.tsx:51,63`).
- Lavados también duplica el primario con lista vacía (`tickets-screen.tsx:185`) — el #27 no lo nombró.
- Sombra inset en fila seleccionada de `table.tsx:89` (tercera sombra).
- CSS nombra el latido «Lavando»; DESIGN.md nombra «Abierto» (`globals.css:489`).
- Alta de oficina cachea tipos/servicios/empleados 5 min (`use-tickets.ts:95`).
- `listFloorTickets()` no manda `date` aunque el API la acepta (`floor/api.ts:42`).
- El `date` de la lista de lavados no está en `@elite/shared` (sí el de comisiones). AGENTS.md 5.

Ningún nuevo se clasificó **bloqueante** aparte de los 01–08 del audit que siguen en pie.

---

## 5. Contradicciones entre agentes

### 33 — Catálogo CONFIRMADO (lane 7, 16) vs empleados REFUTADO (lane 8)

Lane 7/16: ni zod ni `useForm` en `catalog-screen.tsx` ni en `employees-screen.tsx`.
Lane 8: empleados tiene `complete = fullName.trim() !== '' && …` y deshabilita el submit.

**Decisión:** CONFIRMADO para «sin zod». El chequeo de vacíos de empleados no es validación de schema; no alcanza para tirar el hallazgo. «Ni validación de ningún tipo» está un poco pasado de rosca en empleados.

### 44 — Lane 14 REFUTADO vs lane 16 CONFIRMADO

Lane 14: el contrato tiene `unitPrice` opcional en el ítem → «se puede crear descuento».
Lane 16: el detalle muestra descuento; el alta manda `{ serviceId }` sin `unitPrice`.

**Decisión (orquestador, leí los dos archivos):** CONFIRMADO. `TicketFormValues` declara `unitPrice?` y el submit no lo llena (`ticket-form.tsx:137`). Que el API acepte `unitPrice` no es un flujo que lo cree. Lane 14 mezcló contrato con flujo.

### 06 y 15 — CONFIRMADO (contenido) vs DESPLAZADO (citas)

No son incompatibles. El hecho es cierto; la línea del audit no apunta al símbolo. Gana DESPLAZADO en la tabla.

### 20 — CONFIRMADO (lane 1, 16) vs DESPLAZADO (lane 10)

Lane 10 midió `size="sm"` en `button.tsx`, no en `tickets-screen`. El hecho (botones de fila por debajo del táctil de bahía) es cierto. Gana CONFIRMADO; la medida vive en `button.tsx`.

El resto de solapes (07, 19, 26–28, 30, 32, 35–36, 38, 40) son CONFIRMADO + NO_VERIFICABLE por glob, o dos CONFIRMADO. Sin conflicto.

---

## 6. Veredicto de las specs 012–014 (lane 15)

Ninguna se implementa: siguen en **Borrador**. El lane 15 no autoriza pasar a Aprobada sin el review de 4 bullets con el usuario.

| Spec | ¿Aprobada como está? | Por qué |
| --- | --- | --- |
| **012** buscar vehículo por placa | **No** | Sección extra `## API` (la ligera no la tiene). Toca API pública (`vehicleId`, `409 VEHICLE_PLATE_EXISTS`) → o spec larga completa o absorber contrato en Done/Always/Never. El 409 no declara `message` (AGENTS.md 6). `scripts/verify-012.sh` no existe: **tarea faltante**, no defecto. Ask first que el implementador va a adivinar: varios matches de `q`; si autollenar dueño setea `customerId`; payload al confirmar cambio de ficha; si el alta puede `GET /vehicles` sin `vehicles.read`. Rutas en inglés: sí. |
| **013** total y primario fijos en táctil | **Sí, con un matiz** | Forma ligera (Estado + las seis secciones, sin `## API`). Done binarios. Verify = `pnpm dev` + revisión 1024/768/390 (no hace falta `verify-NNN.sh`). Rutas `/carwash/new`, `/floor/new` en inglés. Ask first con default (solo el total). Matiz: Verify no incluye 1180 px, que sí está en Done. Done cita «los cuatro requisitos (hallazgo 41)» sin listarlos. |
| **014** buscar lavado y ver otro día | **No** | Misma sección extra `## API`. `q` nuevo en dos GET = API pública. EmptyState de DESIGN pide título + frase de qué va a aparecer + botón si puede; Done solo fija «Ninguna placa coincide con «X»» y no cubre número/cliente. `scripts/verify-014.sh` no existe (tarea faltante) y el texto de Verify no cubre `GET /floor/tickets?q=`. Ask first faltantes: largo mínimo de `q`; si `q` va en la URL; formato/zona de «Hoy»; match contiene vs prefijo. Rutas en inglés: sí. |

**Para la ola 1:** 013 puede ir a review de 4 bullets ya. 012 y 014 hay que recortar a ligera (meter el contrato en Done/Always/Never) o pasarlas a spec larga, y completar Ask first, **antes** de Aprobada.

---

## 7. Qué entra a la ola 1 (sin implementar)

Del orden del audit, **siguen en pie** (CONFIRMADO o DESPLAZADO, el hecho es cierto):

01, 02, 05, 07, 08, 09, 10, 11, 12, 13, 15, 37.

**No meter como están:** 17 (refutado), 31 (refutado).

Specs listas para decidir con el usuario: **013 sí** (review 4 bullets). **012 y 014 no**, hasta recortar forma / Ask first.

No se tocó código. `docs/UX_AUDIT.md` sigue siendo el insumo.
