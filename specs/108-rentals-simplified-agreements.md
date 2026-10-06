# 108 — Rentas: tres filtros, alta en cuatro datos, una acción por ficha y asistente de tres pasos

**Estado:** Terminada
**Módulo:** `features/rentals`, `features/renters` (web) · `@elite/shared` rentals/agreements.ts,
rentals/renters.ts · rentals, renters (api, solo si el contrato lo pide) |
**Depende de:** 107. Corre en paralelo con 109 y 110.

## Contexto

Los informes 03, 04, 05 y 08 de la auditoría (5 oct 2026): la lista abre el archivo entero con
cinco estados escondidos en «filtros avanzados»; el alta tiene ~30 campos a la vista cuando
importan cuatro; la ficha enfrenta nueve botones, dos tarjetas «Cuenta», once diálogos y un
asistente de siete pasos; el alta de cliente pide dieciocho campos de contrato. El prototipo
aprobado `docs/prototype/rentals-simplified.html` (pestaña Rentas, Nueva renta, ficha y
asistente) es el diseño.

## Criterios de aceptación

### Lista (`/rentals/agreements`)

- **Dado** la lista, **entonces** arriba hay tres botones de filtro: **Por salir** (`RESERVED`),
  **En la calle** (`IN_PROGRESS` + `LATE`), **Ya volvió** (`FINISHED`); «Todas» y «Canceladas»
  dentro de «Más». Por defecto «En la calle». Un buscador «Placa o cliente». El botón de fechas
  dice «Todas las fechas» cuando no filtra. Se borra el popover de cinco estados. Paginación en
  servidor como en la 101; el filtro va a la URL (`?status=`).
- **Dado** una fila, **entonces** muestra: `PlateChip` + nombre del carro, cliente, «sale jue 8,
  9:00 → vuelve lun 12, 9:00», sello de estado y «Debe $…» solo si `balance > 0`. Nada más.
- `AGREEMENT_STATUS_LABELS` pasa a: Reservada, **En la calle**, Atrasada, **Devuelta**, Cancelada.

### Nueva renta (`/rentals/agreements/new`)

- **Dado** la pantalla, **entonces** a la vista hay solo cuatro campos: **Cliente** (combobox
  «Nombre, DUI o teléfono» con «Nuevo cliente» inline: nombre, DUI o pasaporte, celular, número de
  licencia, vencimiento de licencia), **Sale** (por defecto hoy 11:00), **Regresa** (mañana 11:00),
  **Carro** (solo los libres en ese rango, cada uno con su precio por día). Debajo, el total
  escrito: «$35 × 3 días = $105». Un plegable cerrado «Más datos del contrato» con seguro/CDW,
  deducible, descuento, garantía, conductor adicional y notas.
- **Dado** que «Sale» es hoy, **entonces** el botón primario es «Entregar ahora» y abre el
  asistente al guardar; si no, es «Reservar». Un solo botón primario.
- Los `?vehicleId&from&to&customerId` de Hoy, Libre y la ficha del cliente siguen prellenando. El
  borrador (`form-draft.ts`) se mantiene.
- **Dado** el alta de cliente en la web (el inline de Nueva renta y `renter-dialog`), **entonces**
  nombre, documento (DUI o pasaporte) y celular son obligatorios en ese formulario; el resto queda
  opcional y se completa desde la ficha del cliente antes de imprimir el contrato (la impresión
  avisa qué falta, como ya hace la 097). `createRenterSchema` y el API siguen exigiendo solo el
  nombre: la importación CSV descarta la fila solo si no trae nombre. Si una columna de
  `rental_customers` fuera `NOT NULL` para alguno de esos campos, **preguntar antes** (ver «Ask
  first»): esta spec no toca `schema.prisma`.
- `renter-dialog.tsx` usa el mismo formulario corto, con el resto bajo «Más datos». La lista de
  clientes pierde el sello «Activo»; queda un solo freno: un interruptor «No rentar» con motivo,
  en la ficha (mapea a `active = false`).

### Ficha (`/rentals/agreements/[id]`)

- **Dado** la ficha, **entonces** la cabecera lleva `PlateChip` + carro, cliente (enlace a su
  ficha), fechas en lenguaje hablado y el sello. **Un** botón primario según el estado derivado:
  `RESERVED` → «Entregar»; `IN_PROGRESS` o `LATE` → «Recibir»; `FINISHED` con `balance > 0` →
  «Cobrar»; `FINISHED` con saldo cero y garantía en custodia → «Devolver garantía»; si no, ninguno.
  Lo demás en un menú «⋯»: Editar, Dar más días, Cancelar, Imprimir contrato, Imprimir inspección.
  «Imprimir inspección» abre solo esa hoja (`?sheet=inspection`) y no asigna número. «Imprimir
  contrato» queda deshabilitado si no hay número y no hay `rentals.manage`, o si está cancelada y
  todavía no tiene número; una cancelada que ya tiene número se imprime.
- **Dado** `?action=deliver` o `?action=return` en la URL (los manda Hoy, 107), **entonces** la
  ficha abre el asistente correspondiente al cargar, si el estado lo permite.
- **Dado** la cuenta, **entonces** hay un solo bloque «Cuenta»: tres cifras **Total**, **Pagado**,
  **Debe**, los renglones (días, seguro, multas, descuento) y la lista de pagos con «Anular» en
  «⋯». La garantía es una línea: «Garantía $100 en efectivo» / «Devuelta $80» / «Sin garantía».
  Se borra `agreement-billing-panel.tsx`; el bloque nuevo vive en
  `features/rentals/components/agreement-account.tsx` y usa los hooks y diálogos de
  `features/rental-billing` (pago, anulación, devolución) sin modificarlos. Con saldo,
  `rentals.charge` y la renta no cancelada, la cuenta muestra un «Cobrar» secundario; el primario de
  la cabecera no cambia.
- `renter-history.tsx` se queda, plegado bajo el nombre del cliente, en la cabecera.
- La ficha muestra una tarjeta con Sale, Regresa, Seguro (Sí/No), Golpe (deducible), Conductor si
  hay otro, y Notas si hay. Sin texto de ayuda.

### Asistente de entregar y recibir

- **Dado** «Entregar» o «Recibir», **entonces** se abre un asistente de **tres** pasos, en la
  ficha (en `bahia`, pantalla completa): **Kilometraje** (km, combustible en cuatro tramos —Vacío,
  ¼, ½, ¾, Lleno— guardados como `fuelEighths` 0/2/4/6/8, hora puesta en «ahora» y editable),
  **Golpes** (diagrama con zonas tocables: al entregar marca golpes
  existentes, al recibir distingue viejos de nuevos; fotos; accesorios como chips de los que la
  rentadora marca en Ajustes), **Cobro** (saldo, monto, método; al entregar la garantía se
  cobra, al recibir se devuelve o se retiene con nota; botón «Entregar» o «Recibir»). Se puede
  volver atrás; cerrar a medias guarda lo marcado (`inspection-draft.ts`).
- **Dado** «Entregar»/«Recibir» en el paso 3, **entonces** se llama primero al endpoint de
  entrega/recepción existente con la inspección, y después, si hay monto, a
  `POST /rentals/agreements/:id/payments` y, si corresponde, a `deposit-return`. Si el pago
  responde `409 CASH_NOT_OPEN` (109), la entrega queda hecha y el asistente muestra «Abrí la caja
  para cobrar» con un enlace a Caja; el saldo sigue en la ficha.
- Se borra `inspection-wizard.tsx` de siete pasos; nace `handover-wizard.tsx`. Llantas y batería
  pasan a una nota opcional del paso 1. `car-diagram.tsx`, `fuel-picker.tsx` y
  `inspection-summary.tsx` se reutilizan.

### Texto y densidad

- Sin subtítulos, ayudas ni leyendas; vacíos de una línea («Nada por salir», «Nadie en la calle»,
  «Nada devuelto»). Rótulos de una o dos palabras; botones de un verbo.
- `bahia`: lista a una columna, filtros como chips de `--touch-min`, asistente a pantalla completa.

## Reglas de negocio

- **RN-1:** El estado visible es el derivado de la 096 (`LATE` se deriva); solo cambian los
  rótulos.
- **RN-2:** El precio escrito usa la misma fórmula del API (`agreementTotals()` en shared): la
  pantalla nunca calcula un total distinto al que guardará.
- **RN-3:** Un cliente con `isActive = false` o `isBlocked = true` no se puede elegir en Nueva
  renta; el combobox lo muestra con «No rentar» y deshabilitado. Un `?customerId` de ese cliente no
  queda seleccionado: se muestra el aviso y el alta no se puede guardar.

## Permisos

Sin claves nuevas. Nueva renta y el asistente: `rentals.manage`; cobrar: `rentals.charge`.

## Datos

Sin cambios. Si el contrato de clientes obliga a una migración, se pregunta primero.

## API

Sin endpoints nuevos. `createRenterSchema` exige solo el nombre, como antes de esta spec; documento
y celular los pide el formulario web (`createRenterFormSchema`), no el API ni la importación CSV.
`createAgreementSchema` ya tiene opcional todo lo que «Más datos» esconde (verificar; si algo que
el alta corta no manda fuese obligatorio, hacerlo opcional con el mismo default que usa la UI hoy).
El asistente no manda `payment` dentro del checkout ni del checkin: cobra después con
`POST /rentals/agreements/:id/payments` y, si corresponde, `deposit-return`. El depósito de la
entrega sigue dentro del checkout. El schema del checkout no se toca (lo cierra la 109).

## Convivencia con 107, 109 y 110

Esta spec es dueña de `features/rentals/**` y `features/renters/**`, de
`rentals/agreements.ts` y `rentals/renters.ts` en shared, y del `page.tsx` de rentas y clientes.
No toca `nav-items.ts`, `user-menu.ts`, `features/rental-billing/**` (salvo importarlo),
`features/fleet*`, `features/rental-reports`, `schema.prisma` ni `errors.ts`. Borra
`agreement-billing-panel.tsx`; la 109 no lo toca.

## Decisiones

- «No rentar» escribe `isActive = false` y `isBlocked = true`, con motivo. El API solo rechaza un
  alta nueva si `isBlocked` es true; el interruptor prende con cualquiera de las dos. Apagarlo deja
  `isActive = true`, `isBlocked = false` y borra el motivo.
- Documento y celular son obligatorios solo en el formulario web de alta (inline y `renter-dialog`).
  `createRenterSchema` exige el nombre. La importación CSV sigue la regla del diálogo: sin nombre,
  la fila no entra.
- «Más datos del contrato» muestra seguro/CDW, deducible, descuento, garantía, conductor adicional
  y notas. Lugares, tarifa por día escrita, días a cobrar, cargos extra, IVA, tarjeta y autorización
  quedan solo en «Editar». El alta igual manda los defaults de esos campos.
- El combustible del asistente son cinco tramos guardados como `fuelEighths` 0/2/4/6/8. Sin cambio
  de schema.
- WhatsApp y cambiar de carro una renta en curso quedan fuera.
- «Imprimir inspección» lee `?sheet=inspection` en la vista de impresión. El cambio en
  `features/rental-documents` es el mínimo para no arrastrar el contrato ni asignar número.

## Ask first

- Si `rental_customers` tiene columnas `NOT NULL` que el alta corta ya no manda.
- Si el dueño quiere cargos automáticos al recibir (combustible faltante, accesorio faltante):
  hoy el API no los calcula; quedan como nota de la inspección.

## Never

- Nunca dos botones primarios en la ficha ni en el alta.
- Nunca un campo del contrato a la vista fuera de «Más datos».
- Nunca calcular el total en la UI con otra fórmula que la de shared.

## Fuera de alcance

- Cargos automáticos de combustible y accesorios; WhatsApp; cambiar de carro una renta en curso.

## Tareas

- [x] Shared: rótulos nuevos de estado; `createRenterSchema` sigue con solo el nombre; el formulario
      web exige documento y celular; revisar `createAgreementSchema`; tests.
- [x] Lista: `agreements-screen.tsx` con tres filtros + «Más», buscador, filas de tres datos,
      «Todas las fechas»; borrar el popover de estados.
- [x] Alta: `agreement-form-screen.tsx` en cuatro campos + «Más datos del contrato» + total
      escrito + «Entregar ahora»/«Reservar»; `customer-field.tsx` con «Nuevo cliente» corto.
- [x] Clientes: `renter-dialog.tsx` corto, interruptor «No rentar», lista sin «Activo».
- [x] Ficha: cabecera con un primario + «⋯», `?action=`, `agreement-account.tsx`, borrar
      `agreement-billing-panel.tsx`.
- [x] `handover-wizard.tsx` de tres pasos con draft; borrar `inspection-wizard.tsx`.
- [x] Tests de `agreement-form.ts`, `inspection-draft.ts`, `renter-form.ts` actualizados.
- [x] `apps/web/AGENTS.md` si cambia una convención (p. ej. «un primario por pantalla»).

## Verificación

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-095.sh && bash scripts/verify-096.sh`
