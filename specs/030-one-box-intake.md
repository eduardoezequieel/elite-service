# 030 — Alta de una sola caja: carro y dueño en un toque, con precio editable

**Estado:** Aprobada
**Módulo:** web + carwash | **Depende de:** 012, 021, 022, 024, 026, 028

> Aprobada por el usuario en el chat del 2026-09-06 («quiero que implementemos esto ya»), sobre el
> prototipo `docs/prototype/customer-intake.html`.

## Contexto

El alta de hoy tiene dos búsquedas que compiten —nombre y placa— y estados invisibles: «cliente
elegido» y «cliente escrito» se distinguen por un rótulo diminuto pero deciden si se crea una
persona. Las preguntas de identidad («¿Es el mismo?», «¿cambió de dueño?») caen al pulsar Guardar,
con el cliente enfrente. En la bahía, de pie y con la tablet en la mano, eso es más caro todavía.

## Historias

- Como usuario con `carwash.manage`, quiero escribir una sola cosa —placa, nombre o teléfono— y que
  el sistema resuelva carro y dueño de un toque, para no decidir entre «buscar» y «crear».
- Como lavador en la pista, quiero anotar un carro que nunca vino sin pelear con modos de pantalla y poder editar el precio con descuento si aplica.
- Como usuario con `carwash.manage`, quiero tocar el precio del servicio y bajarlo, para aplicar un
  descuento sin salir del alta.

## Criterios de aceptación

- **Dado** el alta vacía, **cuando** escribo 2+ caracteres, **entonces** veo en una sola lista los
  carros cuya placa coincide (con su dueño en la misma fila) y los clientes cuyo nombre o teléfono
  coincide, más una fila final «Es un carro nuevo».
- **Dado** un resultado de carro, **cuando** lo toco, **entonces** quedan resueltos placa, tipo,
  marca, color **y** el dueño registrado, sin pasos extra.
- **Dado** un cliente con un solo carro, **cuando** lo toco, **entonces** su carro queda
  preseleccionado. **Con más de uno**, veo sus carros como láminas tocables y elijo con un toque.
- **Dado** un cliente elegido, **entonces** se muestra como pastilla con su nombre, su teléfono y
  una «×»; lo escrito a mano se ve como texto normal en el campo.
- **Dado** un nombre escrito que se parece a un cliente existente, **cuando** salgo del campo,
  **entonces** la pregunta «¿Es el mismo?» aparece **en línea, bajo el campo**, con «Sí, es él» y
  «No, es otro», y no al pulsar Guardar.
- **Dado** un servicio elegido (en oficina o pista), **cuando** toco su precio, **entonces** puedo editarlo,
  con atajos −$1, −$2, −$5 y −10%, y «Sin descuento» para volver al catálogo.
- **Dado** un precio editado por encima del catálogo, **entonces** se recorta al catálogo antes de
  enviarse; por debajo de 0 se recorta a 0.
- **Dado** un descuento aplicado, **entonces** el resumen muestra la línea «Descuento −$X» y el
  total ya descontado, y el ticket se abre con ese `unitPrice`.
- **Dado** el ancho de tablet con densidad `bahia`, **entonces** toda fila de resultado, lámina de
  carro y control de precio mide ≥44px de alto.

## Reglas de negocio

- **RN-1:** El descuento solo baja. El tope es el precio de catálogo del servicio para el tipo de
  carro elegido; el piso es 0. Lo valida además el API (022, `PRICE_ABOVE_CATALOG`).
- **RN-2:** El precio se edita tanto en **oficina** (`/carwash/new`) como en **pista** (`/floor/new`),
  con los mismos atajos y tope de catálogo.
- **RN-3:** Cambiar el tipo de carro recalcula el tope: si el precio editado queda por encima del
  catálogo nuevo, se recorta.
- **RN-4:** El nombre del cliente sigue siendo obligatorio para abrir un lavado.
- **RN-5:** Un cliente elegido de la lista viaja como `customerId` y nunca se pisa su ficha, salvo
  que se editen su nombre o teléfono a mano (028).

## Permisos

No introduce claves nuevas. En oficina se apoya en `carwash.manage`; en pista cualquier empleado con
sesión activa puede ajustar el precio con tope de catálogo (022).

## Datos

Sin cambios de schema.

## API

Sin endpoints nuevos. Se usan los existentes: `GET /vehicles?q=`, `GET /customers?q=`,
`GET /customers/:id/vehicles`, sus gemelos de `/floor`, y `POST` de alta, que ya acepta
`items[].unitPrice` con tope de catálogo (022).

## UI

- **Una caja** «Placa, nombre o teléfono» con resultados unificados, navegable con `↑ ↓` + `Enter`.
- **Ficha resuelta**: placa, carro, dueño y último lavado en una lámina, con un solo «Cambiar».
- **Carro nuevo**: placa, tipo de carro y dueño; marca y color plegados como opcionales.
- **Dueño**: pastilla si está registrado, campo de texto si es nuevo, confirmación en línea.
- **Servicio**: el precio es un botón; al tocarlo se edita, con atajos de descuento y el precio de
  catálogo tachado al lado.
- Desaparece la tarjeta suelta «Tipo de vehículo»: el tipo vive donde se necesita.

## Fuera de alcance

- Abrir un lavado **sin nombre de cliente** (solo placa). Es la propuesta que quedó sin respuesta;
  cambia RN-4 y se decide aparte.
- Una clave `carwash.discount` propia. Hoy basta `carwash.manage`.
- Buscar clientes por el nombre de su dueño **desde la fila del carro** (exigiría N consultas por
  resultado): el nombre se busca por la fila de cliente.

## Tareas

- [x] `pricing.ts`: helpers puros de dinero, recorte al catálogo y descuento, con tests.
- [x] `use-intake-search.ts`: búsqueda unificada de carros y clientes con debounce.
- [x] `intake-field.tsx`: la caja única, la lista de resultados y el teclado.
- [x] `owner-field.tsx`: el dueño como pastilla, con confirmación «¿Es el mismo?» en línea.
- [x] `ticket-form.tsx`: fases (buscar / elegir carro / conocido / nuevo), precio editable y resumen
      con descuento.
- [x] `vehicle-change-dialog.tsx`: usa el campo de dueño nuevo.
- [ ] Verificado a ojo en ancho de tablet y densidad `bahia`. Pendiente: en esta máquina no
      hay binario de Chrome ni extensión conectada, así que no se pudo capturar la pantalla.

## Verificación

`pnpm lint && pnpm test && pnpm build`
