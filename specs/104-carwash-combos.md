# 104 — Combos del lavado

**Estado:** Aprobada (aprobada por chat, 5 oct 2026: «me parece bien, implementalo en tu propio
worktree … también incluye debounce en las cosas que sean búsqueda por texto»)
**Módulo:** combos (api) · features/catalog + features/carwash + features/floor (web) ·
`@elite/shared` combos | **Depende de:** 039, 065, 079, 087, 102

Prototipo aprobado: `docs/prototype/combos.html`. Manda sobre este texto en lo visual: **mínimo
texto en la UI** (sin subtítulos explicativos, sin ayudas, errores de dos o tres palabras).

## Contexto

El lavado quiere vender paquetes: servicios del catálogo y productos del inventario juntos, a un
precio menor que por separado, por temporada. Hoy cada servicio y producto se elige suelto.

## Historias

- Como encargado, creo un combo con servicios y productos, le pongo precio por tipo de carro y
  fechas/días en que vale, y lo pauso o edito cuando quiero.
- Como cajero o lavador, al abrir un lavado veo los combos que valen hoy y agrego uno con un toque.
- Como dueño, la comisión, el inventario y el rendimiento siguen saliendo por línea.

## Criterios de aceptación

1. **Dado** `combos.manage`, **cuando** creo un combo con ≥2 cosas (≥1 servicio), precio fijo por
   cada tipo de carro activo menor que la suma por separado, fechas y días, **entonces** se guarda
   con código `CMB-0001` correlativo.
2. **Dado** un combo con descuento %, **entonces** su precio por tipo de carro es la suma por
   separado × (1 − %/100), redondeado a centavos (mitad hacia arriba).
3. **Dado** un combo pausado, fuera de fechas o cuyo día de la semana no aplica hoy (día civil de
   `America/El_Salvador`), **entonces** no aparece en `GET /carwash/combos` ni en `GET /floor/combos`
   y crear un lavado con él responde 422 `COMBO_NOT_AVAILABLE`.
4. **Dado** un lavado nuevo con `combos: [{comboId}]`, **entonces** cada servicio y producto del
   combo queda como su propia línea (`comboId` + `comboName` de snapshot) y la suma de esas líneas es
   exactamente el precio del combo para el tipo de carro del lavado.
5. **Dado** un producto del combo sin existencia suficiente, **entonces** crear el lavado responde
   409 `INSUFFICIENT_STOCK` (el flujo de stock de siempre) y en el alta el combo se ve deshabilitado
   con el chip «Sin <producto>».
6. **Dado** un lavado que solo lleva un combo, **entonces** cuenta como completo (el combo trae al
   menos un servicio).
7. **Dado** un combo cuyos servicios son de la misma categoría que un servicio suelto del lavado,
   **entonces** no hay `DUPLICATE_SERVICE_CATEGORY`: la regla 039 solo mira servicios sueltos.
   Lo mismo para «el mismo producto dos veces»: un producto del combo y el mismo suelto conviven.
8. **Dado** un lavado `OPEN` con un combo, **cuando** lo edito sin cambiar el tipo de carro,
   **entonces** las líneas del combo conservan su precio aunque el combo se haya editado, pausado o
   vencido después. **Cuando** cambio el tipo de carro, **entonces** el combo se vuelve a expandir
   con su precio actual para el nuevo tipo (aunque esté pausado o vencido: ya estaba en el lavado).
   Agregar en la edición un combo que no estaba exige que valga hoy.
9. **Dado** el detalle, el cobro o la ficha de pista de un lavado, **entonces** las líneas de un
   combo se ven agrupadas bajo el nombre del combo con su total; en la lista de lavados el combo se
   nombra una vez, no por sus líneas.
10. **Dado** `combos.read` sin `combos.manage`, **entonces** veo la pestaña Combos del catálogo en
    solo lectura (sin «Nuevo combo», sin Editar/Duplicar/Pausar).
11. **Dado** cualquier campo de búsqueda por texto de la web, **entonces** la consulta sale con
    `useDebouncedValue` (`SEARCH_DEBOUNCE_MS`), nunca en cada tecla.

## Reglas de negocio

- **RN-1:** Un combo lleva ≥2 componentes y ≥1 servicio. Un servicio o producto aparece una sola
  vez en el combo; la cantidad de un producto es entera de 1 a 10. Servicios y productos inactivos
  no se pueden agregar.
- **RN-2:** Precio `FIXED`: un precio por **cada** tipo de carro activo, > 0 y < la suma por
  separado de ese tipo (precio de matriz o base del servicio, RN-2 de 003 + precio del producto ×
  cantidad). Precio `PERCENT`: entero de 1 a 90.
- **RN-3:** Vigencia: `validFrom` (fecha civil) obligatoria, `validTo` opcional y ≥ `validFrom`,
  `weekdays` no vacío (0 = domingo … 6 = sábado). Estado derivado con el día civil de hoy:
  `PAUSED` si `isActive = false`; si no `SCHEDULED` si hoy < `validFrom`; `EXPIRED` si hoy >
  `validTo`; si no `LIVE`. «Disponible hoy» = `LIVE` y el día de la semana de hoy está en `weekdays`.
- **RN-4:** Nombre único sin distinguir mayúsculas (409 `COMBO_NAME_TAKEN`). Un combo no se borra:
  se pausa. Editarlo no toca las líneas ya guardadas en lavados (snapshot).
- **RN-5 (prorrateo):** El precio del combo se reparte entre sus líneas en proporción al precio de
  lista de cada una (precio unitario × cantidad). El precio unitario de un producto se redondea
  hacia abajo al centavo; todo el residuo de redondeo va a la **primera línea de servicio**. Así
  ninguna línea de producto supera su precio de catálogo y la suma cierra exacta.
- **RN-6:** `catalogPrice` de cada línea de combo es su precio de lista; `unitPrice`, el prorrateado.
  Desde `READY` el precio de una línea de combo se cambia con el flujo de autorización de siempre
  (060). Un mismo combo no va dos veces en un lavado (422 `DUPLICATE_COMBO`).

## Permisos

| Clave           | Para qué                                    |
| --------------- | ------------------------------------------- |
| `combos.read`   | Ver la pestaña Combos del catálogo          |
| `combos.manage` | Crear, editar, duplicar, pausar y reactivar |

Los combos de hoy en el alta se leen con `carwash.read` (oficina) y con la sesión de pista (`/floor`).
El seed sincroniza las claves y las da al rol de sistema, como siempre.

## Datos (Prisma)

- `enum ComboPricingMode { FIXED PERCENT }`
- `Combo` (`combos`): `id`, `code` único (`CMB-0001`, `lastSequence` + `retryOnSequenceClash`;
  agregar `combos` a `SEQUENCE_COLUMNS`), `name`, `pricingMode`, `discountPercent Int?`,
  `validFrom @db.Date`, `validTo @db.Date?`, `weekdays Int[]`, `isActive`, `createdAt`, `updatedAt`.
- `ComboItem` (`combo_items`): `id`, `comboId` (cascade), `kind WorkOrderItemKind`, `serviceId?`
  (restrict), `inventoryItemId?` (restrict), `quantity Decimal(12,3)`, `sortOrder`.
- `ComboPrice` (`combo_prices`): `@@id([comboId, bodyTypeId])`, `price Decimal(12,2)`. Solo en `FIXED`.
- `WorkOrderItem`: `comboId String? @db.Uuid` (SetNull) y `comboName String?` (snapshot).
- Migración `20261005000000_carwash_combos`.

## Contrato compartido (`packages/shared/src/combos/`)

- `comboPricingModeSchema`, `comboStatusSchema` (`LIVE | SCHEDULED | EXPIRED | PAUSED`).
- `comboItemInputSchema`: `{ serviceId }` | `{ inventoryItemId, quantity: int 1..10 }`.
- `createComboSchema`: `name` (trim, 1..40), `items` (≥2), `pricingMode`, `discountPercent?`,
  `prices: { bodyTypeId, price: money }[]` (default `[]`), `validFrom` / `validTo?` (`YYYY-MM-DD`),
  `weekdays` (int 0..6, ≥1, sin repetir), `isActive` (default `true`). `superRefine` con lo que se
  puede validar sin base: ≥1 servicio, sin repetidos, `discountPercent` presente solo en `PERCENT`,
  `validTo ≥ validFrom`. `updateComboSchema` = todo opcional (los arrays reemplazan).
- `combosQuerySchema`: `search` (`listSearch`), `status?`, `...pageQueryShape`.
- `ComboDetail`: `{ id, code, name, pricingMode, discountPercent, validFrom, validTo, weekdays,
isActive, status, items: { kind, serviceId, inventoryItemId, code, name, quantity, stockOnHand |
null }[], prices: { bodyTypeId, listPrice, price }[], outOfStock: string[] }` — `prices` siempre
  trae todos los tipos de carro activos, calculados en `PERCENT`.
- `ComboOption` (alta): `{ id, name, items: { kind, name, quantity }[], prices: { bodyTypeId,
listPrice, price }[], outOfStock: string[] }`.
- Ticket: `ticketBase.combos: z.array({ comboId: uuid }).default([])` y lo mismo en
  `updateTicketSchema.combos?`. `TicketItem` gana `comboId: string | null` y `comboName: string | null`.
- `PERMISSIONS.combos` con `read` y `manage`.

## API

| Método | Ruta                                 | Permiso         | Request / Response                        | Errores                                        |
| ------ | ------------------------------------ | --------------- | ----------------------------------------- | ---------------------------------------------- |
| GET    | `/combos`                            | `combos.read`   | `combosQuerySchema` → `Page<ComboDetail>` | 422                                            |
| GET    | `/combos/:id`                        | `combos.read`   | → `ComboDetail`                           | 404                                            |
| POST   | `/combos`                            | `combos.manage` | `createComboSchema` → `ComboDetail`       | 422 `VALIDATION_ERROR`, 409 `COMBO_NAME_TAKEN` |
| PATCH  | `/combos/:id`                        | `combos.manage` | `updateComboSchema` → `ComboDetail`       | 404, 422, 409                                  |
| GET    | `/carwash/combos`                    | `carwash.read`  | → `ComboOption[]` disponibles hoy         | —                                              |
| GET    | `/floor/combos`                      | sesión de pista | → `ComboOption[]` disponibles hoy         | —                                              |
| POST   | `/carwash/tickets`, `/floor/tickets` | (los de hoy)    | `+ combos`                                | 422 `COMBO_NOT_AVAILABLE`, `DUPLICATE_COMBO`   |
| PATCH  | `/carwash/tickets/:id`               | (los de hoy)    | `+ combos` (criterio 8)                   | ídem                                           |

Módulo nuevo `apps/api/src/modules/combos/` con sus capas (`domain/` para estado, precio y
prorrateo puros; `application/` con casos de uso y puerto; `infrastructure/` Prisma;
`presentation/` controlador). Carwash consume un puerto propio (`ComboCatalog` en
`carwash/application/ports/`) para leer combos por id con sus precios; la expansión a líneas vive en
`carwash/application/build-ticket-items.ts` usando el prorrateo del dominio de combos.
Orden estable de la lista: `name`, `id`.

## UI

- **Catálogo** (`/settings/catalog?tab=combos`, pestaña «Combos» con `combos.read`): `ScreenHeader`
  ya existente del catálogo; búsqueda con debounce, filtros por estado (Todos, Vigentes,
  Programados, Vencidos, Pausados), lista paginada. Cada combo: nombre, chip de estado, fechas y
  días, componentes en una línea, precio por tipo de carro (uno solo si todos dan igual) con
  «−$X», chip ámbar «Sin <producto>». Acciones: Editar, Duplicar (abre el editor con «(copia)» y
  pausado), Pausar/Activar.
- **Editor** (diálogo de una columna, react-hook-form + `zodResolver` sobre `createComboSchema`):
  Nombre; «Incluye» con buscador de servicios y productos (productos con búsqueda al servidor y
  debounce); «Precio» con selector Precio fijo / Descuento % y tabla Separado / Combo; «Vigencia»
  con Desde, Hasta, «Sin fin», días L M M J V S D; «Activo». Errores solo al guardar.
- **Alta** (`TicketForm`, oficina y pista): tarjeta «Combos» con los disponibles hoy, precio del tipo
  de carro elegido, chip «Agregado» o «Sin <producto>» (deshabilitado). Se oculta si hoy no hay
  combos. El resumen muestra el combo como una fila con su precio. Con el combo elegido, el lavado
  ya está completo.
- **Detalle / cobro / pista:** `TicketLines` agrupa por `comboId` bajo el nombre del combo con su
  total. El diálogo de edición conserva los combos del lavado, deja quitarlos y agregar los de hoy.
- **Debounce:** auditar todo input de búsqueda por texto en `apps/web/src` y pasar por
  `useDebouncedValue` los que todavía consultan en cada tecla.
- Densidad `bahia` y ancho de tablet en todo lo nuevo. Sin texto de ayuda.

## Fuera de alcance

- Combos para la rentadora. Combos con cantidad > 1 del mismo combo en un lavado.
- Horas del día en la vigencia. Borrar combos. Reporte de ventas por combo.

## Tareas

- [x] Prototipo `docs/prototype/combos.html`.
- [x] Prisma: modelos, migración, `SEQUENCE_COLUMNS`, prefijo `CMB`.
- [x] Shared: `combos/` (schemas + contratos), `combos` en ticket, `PERMISSIONS.combos` + test.
- [ ] API: dominio (estado, precio, prorrateo) con tests; módulo combos con casos de uso, puerto,
      repo en memoria y tests; controlador; `/carwash/combos` y `/floor/combos`; expansión en
      crear/editar lavado con tests (criterios 3–8); `apps/api/AGENTS.md` una línea del módulo.
- [ ] Web: pestaña Combos + editor; tarjeta de combos en el alta (oficina y pista); resumen;
      agrupación en `TicketLines` y lista; edición; auditoría de debounce; tests de lógica pura.
- [ ] `scripts/verify-104.sh`.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-104.sh   # con el stack levantado
```
