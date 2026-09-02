# 003 — Carwash: catálogo, tickets y cobro

**Estado:** Aprobada
**Módulo:** `employees`, `customers`, `vehicles`, `services`, `carwash` | **Depende de:** spec 001 (auth + Prisma) terminada · spec 002 (sistema de diseño) terminada

## Contexto

Elite Service lava carros además de repararlos. El lavado no pasa por cotización ni diagnóstico.

Hay **dos lugares de trabajo, dos vistas, dos entradas**. No es la misma app con botones más
grandes.

- **Pista (empleado).** Tablet. El lavador entra con usuario y PIN, anota el carro y el
  servicio, puede bajar el precio y marca listo. No cobra. No ve catálogo, usuarios ni roles.
- **Oficina (admin).** Escritorio o tablet de mostrador. Quien entra es un _usuario_ de la spec
  001 (correo y contraseña). Acá viven el catálogo, los empleados, el cobro y los roles que
  **muestran u ocultan** cada pantalla de esta vista. Un rol de cajero puede ver solo la fila y
  cobrar; un rol de gerente ve todo.

Una persona es **o empleado o admin**. Si alguien hace las dos cosas, tiene dos accesos (dos
cuentas). El código no pregunta el nombre de un rol: pregunta _qué tipo de sesión_ es y, si es
admin, _qué permisos_ tiene.

El precio a veces cambia según el tipo de carro (sedán, camioneta, pick up) y a veces no. El
catálogo guarda un precio base y, si hace falta, un precio por tipo.

## Historias

- Como empleado de pista, quiero entrar con mi usuario y PIN (y que el usuario ya esté escrito
  en esa tablet), para ponerme a anotar sin pelearme con un correo.
- Como empleado de pista, quiero anotar cliente, placa, tipo de carro y uno o más servicios en
  pocos toques, bajar el precio si hay descuento y marcar listo, para que en oficina puedan
  cobrar.
- Como usuario con `carwash.charge`, quiero ver los tickets listos y cobrar el total en un solo
  toque de método, sin editar el trabajo.
- Como usuario con `services.manage`, quiero cargar servicios y precios por tipo de carro, para
  que en la pista el monto ya venga puesto.
- Como usuario con `employees.manage`, quiero crear empleados (usuario + PIN), para dar acceso a
  la pista sin meterlos en la vista admin.
- Como usuario con `roles.manage`, quiero armar roles que muestren u oculten pantallas de la
  vista admin (cobro, catálogo, empleados), para que cada puesto de oficina vea solo lo suyo.

## Criterios de aceptación

### Dos mundos

- **Dado** un empleado activo con usuario y PIN válidos, **cuando** hace `POST /api/floor/login`,
  **entonces** recibe sesión de pista (cookie `elite_floor_session`) y entra a `/floor`. No
  recibe permisos de admin.
- **Dado** esa sesión de pista, **cuando** pide `/api/users`, `/api/roles`, `/api/auth/me` o
  cualquier ruta de cobro, **entonces** responde `401` o `403`. La vista `/carwash` (admin) lo
  redirige a `/floor`.
- **Dado** un usuario admin con sesión `elite_session`, **cuando** entra a `/floor`, **entonces**
  lo redirige a su vista admin. No puede usar la pista con esa cuenta.
- **Dado** el login de pista en una tablet, **cuando** un empleado entra, **entonces** su
  usuario queda guardado en ese aparato y la próxima vez el campo usuario viene lleno y el
  foco está en el PIN. El PIN no se guarda.
- **Dado** usuario o PIN inválidos, o empleado desactivado, **cuando** intenta entrar,
  **entonces** `401 INVALID_CREDENTIALS` con el mismo mensaje (no se revela cuál falló).

### Catálogo y precios

- **Dado** un servicio con precio base $2 y sin fila en la matriz para camioneta, **cuando** se
  agrega a un ticket de camioneta, **entonces** el precio sugerido es $2.
- **Dado** el mismo servicio con $10 en la matriz para camioneta, **cuando** se agrega a un
  ticket de camioneta, **entonces** el precio sugerido es $10, no el base.
- **Dado** un ticket `OPEN` con una línea a $10 de catálogo, **cuando** el empleado pone $8,
  **entonces** se guarda $8 y queda el $10 original como referencia.
- **Dado** esa misma línea a $10, **cuando** intenta poner $12, **entonces** el API responde
  `422 PRICE_ABOVE_CATALOG` y el precio no cambia.

### Ticket

- **Dado** cliente + placa + tipo de carro + al menos un servicio, **cuando** un empleado abre
  el ticket, **entonces** nace en `OPEN` con número `CW-0001` (o el siguiente), precios
  copiados a las líneas, y ese empleado queda como lavador.
- **Dado** un ticket `OPEN` anotado por Carlos, **cuando** José (otro empleado activo) lo marca
  listo, **entonces** pasa a `READY`. El lavador sigue siendo Carlos.
- **Dado** un usuario admin con `carwash.manage`, **cuando** abre un ticket de emergencia desde
  oficina, **entonces** nace en `OPEN`. Si eligió un empleado, ese es el lavador; si no, el
  lavador se muestra como «Oficina».
- **Dado** un ticket `READY`, **cuando** un usuario admin con `carwash.charge` cobra con un
  método y el monto igual al total, **entonces** pasa a `PAID`, queda un pago único y ya no se
  edita.
- **Dado** un ticket `READY` con total $14, **cuando** se intenta cobrar $10, **entonces**
  responde `422 PAYMENT_AMOUNT_MISMATCH` y sigue `READY`.
- **Dado** un empleado, **cuando** abre el detalle de un ticket `READY`, **entonces** no existe
  el botón Cobrar. El cobro no vive en la pista.
- **Dado** un ticket `OPEN` o `READY`, **cuando** un admin con `carwash.void` lo anula,
  **entonces** pasa a `VOID`. Un ticket `PAID` no se anula en esta spec. El empleado no anula.
- **Dado** una placa que ya existe, **cuando** se abre otro ticket con esa placa, **entonces**
  se reutiliza el mismo vehículo y se actualiza el dueño actual si el cliente es otro.

### Uso en tablet (pista, obligatorio)

- **Dado** densidad `bahía` en `/floor`, **cuando** se anota o se mira la fila, **entonces**
  ningún objetivo táctil es menor a 44×44, nada depende de `hover`, y hay **un solo botón
  primario** por pantalla.
- **Dado** `/floor/new`, **cuando** se elige el tipo de carro, **entonces** son tres botones
  grandes (Sedán, Camioneta, Pick up), no un `<select>`.
- **Dado** `/floor/new`, **cuando** se eligen servicios, **entonces** cada servicio es una
  lámina tocable con el precio ya resuelto para el tipo elegido.
- **Dado** `/floor` bajo 768px, **cuando** hay tickets, **entonces** se ven como pila de
  láminas numeradas, no como tabla con scroll horizontal.
- **Dado** el cobro en `/carwash/:id` (admin), **cuando** se abre el diálogo, **entonces** el
  total aparece en tipografía Figure y el método son tres botones grandes, no un desplegable.

## Reglas de negocio

- **RN-0 (dos actores).** En el sistema hay dos sujetos, no dos roles:
  - `User` (spec 001): entra con correo y contraseña, ve la **vista admin**, se autoriza por
    claves `module.action`.
  - `Employee`: entra con usuario y PIN, ve la **vista pista**, no tiene roles ni permisos.
    Estar activo es su autorización para anotar, descontar y marcar listo.

  Preguntar `user.role === 'admin'` o `employee.role === 'lavador'` está prohibido. La vista se
  decide por el **tipo de sesión** (`user` | `employee`). Lo que un admin ve dentro de su vista
  se decide por permisos.

- **RN-1 (áreas).** Cada categoría y cada servicio lleva `area`. Esta spec solo crea y muestra
  `CARWASH`. El valor `WORKSHOP` existe en el modelo para el taller; la UI no lo ofrece.
- **RN-2 (precio).** Todo servicio tiene `defaultPrice` ≥ 0, con IVA incluido (13%). Si existe
  una fila en `ServicePrice` para ese servicio y ese tipo de carro, gana la fila. Si no, gana
  el base. Una celda vacía no es cero: es «usar el base».
- **RN-3 (matriz opcional).** No todos los servicios tienen matriz. Un aromatizante a $2 para
  cualquier carro solo llena `defaultPrice`. Los tres lavados premium sí llenan la matriz.
- **RN-4 (snapshot).** Al agregar una línea se copian `serviceName`, `serviceCode`,
  `catalogPrice`, `unitPrice` y `taxRate`. Si después cambia el catálogo, los tickets viejos no
  se recalculan. Si en un ticket `OPEN` se cambia el tipo de carro, las líneas que todavía
  tienen `unitPrice = catalogPrice` se recalculan; las que ya tienen descuento se dejan.
- **RN-5 (descuento).** En un ticket `OPEN`, el empleado (pista) puede **bajar** `unitPrice`.
  El piso es 0. El techo es `catalogPrice`. Si el total queda en 0, no se cobra: en oficina se
  anula (cortesía). Un admin con `carwash.manage` puede corregir líneas de un `OPEN` con la
  misma regla.
- **RN-6 (varios servicios).** Un ticket lleva una o más líneas. El total es la suma de
  `unitPrice`. No hay cantidad distinta de 1 en v1.
- **RN-7 (alta).** La pista abre tickets (flujo normal). La oficina también puede abrirlos de
  **emergencia** (`carwash.manage`): misma ficha, más un selector de lavador. Hacen falta:
  cliente, placa, tipo de carro y al menos un servicio activo `CARWASH`. Marca y color son
  opcionales.
- **RN-8 (lavador).** En pista, quien abre el ticket queda como lavador; no se elige a mano. En
  oficina, se puede elegir un empleado de la lista o dejarlo vacío («Oficina»). Ese dato no
  cambia cuando otro marca listo. Queda asentado para comisiones futuras; esta spec no las
  calcula.
- **RN-9 (estados).** Solo estas transiciones:

  ```
  OPEN  → READY   (marcar listo: cualquier empleado activo, o un admin con carwash.manage)
  READY → OPEN    (reabrir: cualquier empleado activo, o un admin con carwash.manage)
  OPEN  → VOID    (anular: solo admin con carwash.void)
  READY → VOID    (anular: solo admin con carwash.void)
  READY → PAID    (cobrar: solo admin con carwash.charge)
  ```

  `PAID` y `VOID` no salen de ahí. El empleado no cobra ni anula. Ver la fila de otros no
  implica ser el lavador.

- **RN-10 (cobro).** Solo desde `READY`, **solo en la vista admin**. Un solo pago. El monto
  tiene que ser **igual al total** y el total > 0. Métodos: efectivo, tarjeta, transferencia.
  No hay saldo, crédito, caja ni DTE.
- **RN-11 (anulación).** Solo `OPEN` o `READY`, solo admin con `carwash.void`. El ticket no se
  borra.
- **RN-12 (placa).** Una placa activa = un vehículo. Se reutiliza. Si cambia el cliente, el
  dueño actual se actualiza y queda historial.
- **RN-13 (bajas).** Clientes, vehículos, servicios, categorías, tipos de carro y empleados se
  desactivan, no se eliminan. Un empleado desactivado no entra a la pista; sus sesiones dejan
  de valer (mismo espíritu que RN-4 de 001).
- **RN-14 (IVA).** Precios con IVA incluido. `taxRate` 0.1300 en servicio y snapshot. Esta spec
  no muestra el desglose ni emite factura.
- **RN-15 (números).** Tickets: `CW-` + 4 dígitos, correlativo. En pantalla el número de
  referencia es `#14` (sin prefijo), igual en pista y oficina [Components → El número de
  referencia]. `CW-0014` viaja en datos y se muestra como texto secundario en el detalle.
  Servicios: `SRV-` + 4 dígitos. Empleados no llevan folio público; el usuario de login es su
  referencia.
- **RN-16 (permisos, solo admin).** La vista admin se autoriza por `module.action`. Ejemplo (no
  va en el código): un rol Cajero lleva `carwash.read` y `carwash.charge`. Un rol Gerente lleva
  además catálogo, empleados, anular, roles. La pista no consulta este catálogo.
- **RN-17 (uso).** Una pantalla, una acción principal. Tipo de carro, servicio y método de pago
  se eligen tocando, nunca con un desplegable. Copy en español, caja normal, al grano.
- **RN-18 (login de pista).** Usuario único, no es un correo. PIN de 4 a 8 dígitos numéricos,
  hash bcrypt factor 12, nunca se devuelve ni se loguea. El **usuario se recuerda en el
  aparato** (localStorage) siempre que un login salga bien; el PIN no. Quien tiene
  `employees.manage` puede reemplazar el PIN; eso invalida las sesiones de pista de ese
  empleado (`pinChangedAt`, igual que RN-10 de 001).
- **RN-19 (sesiones).** Cookie de pista `elite_floor_session`, distinta de `elite_session`
  (001). JWT con `kind: "employee"` y `sub` = id del empleado, 8 horas, `httpOnly` +
  `SameSite=Lax`. La cookie de admin no abre la pista y al revés. Un login de pista no pisa la
  cookie admin (y al revés): conviven en el navegador pero cada vista mira la suya.

## Permisos

Solo aplican a la **vista admin** (sesión `user`). El empleado de pista no tiene filas acá.

| Clave              | Descripción                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| `customers.read`   | Ver clientes                                                            |
| `customers.manage` | Crear y editar clientes                                                 |
| `vehicles.read`    | Ver vehículos                                                           |
| `vehicles.manage`  | Crear y editar vehículos                                                |
| `services.read`    | Ver el catálogo de servicios y precios                                  |
| `services.manage`  | Crear, editar y desactivar categorías, servicios y la matriz de precios |
| `employees.read`   | Ver la lista de empleados                                               |
| `employees.manage` | Crear, editar, desactivar empleados y reemplazar su PIN                 |
| `carwash.read`     | Ver tickets de lavado (fila de oficina)                                 |
| `carwash.manage`   | Abrir tickets de emergencia, editar `OPEN`, marcar listo y reabrir      |
| `carwash.charge`   | Cobrar un ticket `READY`. No edita servicios ni precios                 |
| `carwash.void`     | Anular un ticket `OPEN` o `READY`                                       |

El seed de 001 sincroniza las claves nuevas al rol `Administrator`. No se siembra un rol
«Cajero» ni «Lavador». El lavador **no es un rol**: es un `Employee`.

## Datos

Se agrega al schema de Prisma de 001. Dinero: `Decimal(12, 2)`. Tasas: `Decimal(6, 4)`. IDs:
uuid.

```
enum BusinessArea     CARWASH | WORKSHOP
enum WorkOrderStatus  OPEN | READY | PAID | VOID
enum PaymentMethod    CASH | CARD | TRANSFER

Employee          id, username (unique), pinHash, pinChangedAt, fullName, isActive,
                  createdAt, updatedAt

Customer          id, fullName, phone?, isActive, createdAt, updatedAt
VehicleBodyType   id, key (unique), name, sortOrder, isActive
Vehicle           id, plate (unique), bodyTypeId, make?, color?, isActive, createdAt, updatedAt
VehicleOwner      vehicleId, customerId, isCurrent, fromDate, toDate?
                  unique (vehicleId, customerId, fromDate)

ServiceCategory   id, name, area, sortOrder, isActive
Service           id, code (unique), name, categoryId, area, defaultPrice, taxRate (0.1300),
                  isActive, createdAt, updatedAt
ServicePrice      serviceId + bodyTypeId (PK), price

WorkOrder         id, number (unique), area, status, customerId, vehicleId,
                  bodyTypeId (snapshot), notes?,
                  openedByEmployeeId?, openedByUserId?,
                  chargedByUserId?, chargedAt?,
                  createdAt, updatedAt
WorkOrderItem     id, workOrderId, serviceId?, serviceCode, serviceName,
                  catalogPrice, unitPrice, taxRate, sortOrder
WorkOrderAssignment  workOrderId + employeeId (PK), assignedAt
Payment           id, workOrderId (unique en v1), method, amount, paidAt, recordedByUserId
```

Al crear desde pista se inserta `WorkOrderAssignment` con el empleado de la sesión
(`openedByEmployeeId`). Al crear desde oficina: si eligieron un empleado, ese va en
`openedByEmployeeId` y en la assignment; si no, `openedByEmployeeId` queda nulo,
`openedByUserId` es quien abrió, y en UI el lavador dice «Oficina». No hay FK de empleado a
usuario: son mundos separados. El taller reutilizará `WorkOrder`, `WorkOrderItem` y el
catálogo. `WorkOrder.area` en esta spec siempre es `CARWASH`.

### Seed de catálogo (carwash)

Tipos de carro (datos, no lógica):

| key      | name      |
| -------- | --------- |
| `sedan`  | Sedán     |
| `suv`    | Camioneta |
| `pickup` | Pick up   |

Categorías `CARWASH`: Lavado premium; Limpieza de tapicería; Pulido de pintura; Pulido de
silvines; Lavado de chasis. Las últimas cuatro quedan sin servicios hasta que se carguen.

Servicios de Lavado premium (precios del Excel del negocio, IVA incluido):

| Código   | Nombre                                 | Base (sedán) | Camioneta | Pick up |
| -------- | -------------------------------------- | ------------ | --------- | ------- |
| SRV-0001 | Lavado + aspirado                      | 8.00         | 10.00     | 10.00   |
| SRV-0002 | Lavado + aspirado + pasteado a mano    | 10.00        | 12.00     | 14.00   |
| SRV-0003 | Lavado + aspirado + pasteado a máquina | 14.00        | 16.00     | 18.00   |

El base es el precio de sedán. La matriz cubre los tres tipos. Un re-seed **no pisa** precios
editados a mano.

No se siembran empleados: los crea quien tenga `employees.manage`.

## API

Todos bajo `/api`. Errores `{ code, message, details? }`. Sin paginación en v1. Fechas del día
en zona `America/El_Salvador`.

### Pista — sesión empleado (`kind: employee`)

Públicos: `POST /floor/login`. El resto exige cookie `elite_floor_session`.

| Método | Ruta                           | Request                                  | Response                                                  | Errores                                        |
| ------ | ------------------------------ | ---------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/floor/login`                 | `{ username, pin }`                      | `{ employee: { id, username, fullName } }` + cookie pista | 401 `INVALID_CREDENTIALS`                      |
| POST   | `/floor/logout`                | —                                        | 204, limpia cookie pista                                  | —                                              |
| GET    | `/floor/me`                    | —                                        | `{ employee }`                                            | 401                                            |
| GET    | `/floor/tickets?status=&date=` | default hoy; `OPEN` y `READY`            | tickets de la fila                                        | 401                                            |
| POST   | `/floor/tickets`               | ver cuerpo abajo                         | ticket                                                    | 422 `TICKET_INCOMPLETE`, `PRICE_ABOVE_CATALOG` |
| GET    | `/floor/tickets/:id`           | —                                        | ticket + líneas + lavador                                 | 404                                            |
| PATCH  | `/floor/tickets/:id`           | solo `OPEN`; cualquier empleado activo   | ticket                                                    | 409 `TICKET_NOT_OPEN`                          |
| POST   | `/floor/tickets/:id/ready`     | cualquier empleado activo                | ticket `READY`                                            | 409                                            |
| POST   | `/floor/tickets/:id/reopen`    | cualquier empleado activo, desde `READY` | ticket `OPEN`                                             | 409                                            |
| GET    | `/floor/services`              | catálogo `CARWASH` activo                | servicios + matriz                                        | 401                                            |
| GET    | `/floor/customers?q=`          | búsqueda                                 | clientes                                                  | 401                                            |
| POST   | `/floor/customers`             | `{ fullName, phone? }`                   | cliente                                                   | 422                                            |
| GET    | `/floor/vehicles?q=`           | por placa                                | vehículo + dueño                                          | 401                                            |
| GET    | `/floor/vehicle-body-types`    | —                                        | tipos activos                                             | 401                                            |

Cuerpo de `POST /floor/tickets`:

```
{
  customerId?,
  customer?: { fullName, phone? },
  vehicleId?,
  vehicle?: { plate, bodyTypeId, make?, color? },
  items: [{ serviceId, unitPrice? }],
  notes?
}
```

El lavador es el empleado autenticado. No hay `washerId` en el cuerpo. No existe
`/floor/.../charge` ni `/floor/.../void`.

### Oficina — sesión usuario (spec 001 + permisos)

| Método | Ruta                               | Request                                                          | Response                         | Errores                                                          |
| ------ | ---------------------------------- | ---------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| GET    | `/employees`                       | —                                                                | `Employee[]` (sin pinHash)       | 403 `employees.read`                                             |
| POST   | `/employees`                       | `{ fullName, username, pin }`                                    | `Employee`                       | 409 `USERNAME_TAKEN`, 422 PIN                                    |
| PATCH  | `/employees/:id`                   | `{ fullName?, username?, pin?, isActive? }`                      | `Employee`                       | 404, 409, PIN invalida sesión (RN-18)                            |
| GET    | `/customers?q=`                    | —                                                                | `Customer[]`                     | 403 `customers.read`                                             |
| POST   | `/customers`                       | `{ fullName, phone? }`                                           | `Customer`                       | 403 `customers.manage`                                           |
| PATCH  | `/customers/:id`                   | `{ fullName?, phone?, isActive? }`                               | `Customer`                       | 404                                                              |
| GET    | `/vehicles?q=`                     | —                                                                | vehículo + dueño                 | 403 `vehicles.read`                                              |
| POST   | `/vehicles`                        | `{ plate, bodyTypeId, customerId, make?, color? }`               | `Vehicle`                        | 409 `PLATE_TAKEN`                                                |
| PATCH  | `/vehicles/:id`                    | `{ plate?, bodyTypeId?, make?, color?, isActive?, customerId? }` | `Vehicle`                        | 404, 409                                                         |
| GET    | `/vehicle-body-types`              | —                                                                | tipos activos                    | 401 (sesión user)                                                |
| GET    | `/service-categories?area=CARWASH` | —                                                                | categorías                       | 403 `services.read`                                              |
| POST   | `/service-categories`              | `{ name, area=CARWASH, sortOrder? }`                             | categoría                        | 403 `services.manage`                                            |
| PATCH  | `/service-categories/:id`          | `{ name?, sortOrder?, isActive? }`                               | categoría                        | 404                                                              |
| GET    | `/services?area=CARWASH`           | —                                                                | servicios + matriz               | 403 `services.read`                                              |
| POST   | `/services`                        | `{ name, categoryId, defaultPrice, prices? }`                    | servicio                         | 403, 422                                                         |
| PATCH  | `/services/:id`                    | `{ name?, categoryId?, defaultPrice?, isActive?, prices? }`      | servicio                         | 404                                                              |
| GET    | `/carwash/tickets?status=&date=`   | default hoy                                                      | tickets                          | 403 `carwash.read`                                               |
| POST   | `/carwash/tickets`                 | igual que pista + `employeeId?`                                  | ticket                           | 422 `TICKET_INCOMPLETE`, `PRICE_ABOVE_CATALOG`, `INVALID_WASHER` |
| GET    | `/carwash/tickets/:id`             | —                                                                | ticket + líneas + lavador + pago | 404                                                              |
| PATCH  | `/carwash/tickets/:id`             | edición `OPEN`                                                   | ticket                           | 409 `TICKET_NOT_OPEN`                                            |
| POST   | `/carwash/tickets/:id/ready`       | —                                                                | ticket `READY`                   | 409                                                              |
| POST   | `/carwash/tickets/:id/reopen`      | —                                                                | ticket `OPEN`                    | 409 `TICKET_NOT_READY`                                           |
| POST   | `/carwash/tickets/:id/charge`      | `{ method, amount }`                                             | ticket `PAID` + pago             | 422 `PAYMENT_AMOUNT_MISMATCH`, 409                               |
| POST   | `/carwash/tickets/:id/void`        | —                                                                | ticket `VOID`                    | 409 `TICKET_NOT_VOIDABLE`                                        |

`POST /carwash/tickets` exige `carwash.manage`. `employeeId` opcional: un empleado activo, o
nada («Oficina»). `INVALID_WASHER` si el id no existe o está inactivo.

Códigos nuevos en `@elite/shared`: `USERNAME_TAKEN`, `PLATE_TAKEN`, `TICKET_INCOMPLETE`,
`TICKET_NOT_OPEN`, `TICKET_NOT_READY`, `TICKET_NOT_VOIDABLE`, `PRICE_ABOVE_CATALOG`,
`PAYMENT_AMOUNT_MISMATCH`, `INVALID_WASHER`. `INVALID_CREDENTIALS` se reutiliza (001).

El JWT de 001 sigue llevando `sub` = userId. Esta spec le agrega `kind: "user"` en los tokens
**nuevos** de admin; los tokens viejos sin `kind` se tratan como `user` (no se corta la jornada
al desplegar). Los de pista llevan siempre `kind: "employee"`.

## UI

Dos shells. Mismos tokens de la spec 002. Español, caja normal. Un primario por pantalla. Sin
toasts. Cero `<select>` para tipo de carro, servicio y pago.

**Pista.** De pie, tablet, manos a veces húmedas. Anotar un carro en menos de un minuto.

**Oficina.** Mostrador o dueño. Ver la fila, cobrar, armar precios, dar de alta empleados,
armar roles.

Lo atractivo es lo mismo en las dos: ficha de catálogo, número `#14`, placa, sello, un naranja
de acento. No es un panel con sombra ni un tablero de autos.

### Vista pista — `/floor`

Sin riel de oficina. Sin pestaña de configuración. Cabecera mínima: nombre del empleado +
«Salir». Bajo 768px, barra inferior propia de **esta** vista (Fila · Nuevo), no la del admin.

#### `/floor/login`

Lámina centrada, ancho 360px, densidad `bahía` de primera. Título «Pista». Campos: Usuario,
PIN (numérico, no se ve el número). Primario: «Entrar».

El usuario se lee y se escribe en `localStorage` (`floor-username`) **siempre** que el login
salga bien. Al abrir: campo usuario lleno si hay valor, foco en PIN. Error al pie, Sello Rojo,
mismo texto que credenciales inválidas de 001.

No hay enlace a `/login` de admin en esta pantalla (y al revés): cada entrada es un mundo.

#### `/floor` — la fila

Pestañas: Recibidos · Listos. (Cobrados no: eso es oficina.) Primario: «Nuevo lavado».

Cada ticket es una lámina en `bahía`, tabla en `mostrador` si alguien abre pista en escritorio
(caso raro; igual se entrega). Lámina: `#14`, placa en Title, cliente, servicio, total,
sello Recibido (Azul) o Listo (Ámbar), lavador. Recibido: botón «Marcar listo» visible, 48px,
para **cualquier** empleado (RN-9). Tocar el cuerpo abre el detalle.

Vacío Recibidos: «No hay carros en la fila. Tocá Nuevo lavado para anotar el primero.»
Vacío Listos: «Nada marcado listo.»

#### `/floor/new`

Una sola pantalla con scroll. Primario «Abrir lavado» fijo al pie en `bahía`. Trama de 45° +
motivo hasta que haya placa, tipo, cliente y un servicio.

1. **Placa** — el campo más grande. Al escribir, busca. Match → lámina compacta para confirmar.
   Sin match → se enciende el resto.
2. **Tipo de carro** — tres botones iguales: Sedán · Camioneta · Pick up. Activo: muesca
   naranja 3px y peso 600.
3. **Cliente** — si el carro ya existía, texto plano + «Es otra persona». Si es nuevo: Nombre
   obligatorio, Teléfono opcional. Marca y color detrás de «Datos del carro (opcional)»,
   cerrado.
4. **Qué se lava** — láminas de servicio con precio ya resuelto. Sin tipo, no se pueden
   marcar. Varios a la vez. Total encima del primario.

Descuento: el precio de una línea marcada es tocable. Campo numérico. No acepta más que el
catálogo: «No puede pasar de $10.00». Si bajó: «Lista $10.00» en Grafito.

#### `/floor/:id`

`#14` + placa en Display. Sello. Lavador. Líneas con lista vs cobrado si hay descuento. Total
en Figure.

Pie: `OPEN` → «Marcar listo» (primario) y editar líneas. `READY` → «Devolver a recibidos»
(secundario). Cualquier empleado activo. Nunca Cobrar, nunca Anular.

### Vista admin — riel de 001

Pestaña «Carwash» si hay cualquier `carwash.*`. Icono `droplets`. Pestaña «Servicios» si hay
`services.*` (o enlace desde Carwash; v1: `/catalog/services` en el riel si hay
`services.read`). Empleados viven en `/settings/employees`, junto a usuarios y roles, visible
con `employees.read`.

Un cajero (rol armado a mano con `carwash.read` + `carwash.charge`) ve Carwash y no ve
Servicios ni Empleados ni Usuarios.

#### `/carwash` — fila de oficina

Cabecera: «Carwash». Si hay `carwash.manage`, primario «Nuevo lavado» (emergencia). Tres
pestañas: Recibidos · Listos · Cobrados (hoy).

Mostrador: tabla del sistema. Bahía: pila de láminas. Columnas/lámina: `#`, placa, cliente,
servicio, total, lavador (nombre del empleado), sello.

Acción visible según permiso y estado: Listo + `carwash.charge` → «Cobrar». Recibido +
`carwash.manage` → «Marcar listo». Tocar abre detalle.

Sellos: Recibido Azul · Listo Ámbar · Cobrado Verde · Anulado Rojo.

Vacío Listos: «Nada listo para cobrar.» Vacío Cobrados: «Hoy no se ha cobrado ningún lavado.»
Vacío Recibidos: «No hay carros recibidos. En pista se anotan, o acá con Nuevo lavado.»

#### `/carwash/new` — emergencia

Misma ficha que `/floor/new` (placa, tipo, cliente, servicios, descuento). Extra, arriba
del primario: «Lavador», lista de empleados activos. Se puede dejar vacío: queda «Oficina».
Primario: «Abrir lavado». Visible con `carwash.manage`.

#### `/carwash/:id`

Igual lenguaje visual que la pista (el mismo número, la misma ficha) más el bloque de cobro.

| Estado  | `carwash.manage`                                                                      | `carwash.charge`  | `carwash.void` |
| ------- | ------------------------------------------------------------------------------------- | ----------------- | -------------- |
| `OPEN`  | Editar líneas, Marcar listo                                                           | —                 | Anular         |
| `READY` | Reabrir                                                                               | Cobrar (primario) | Anular         |
| `PAID`  | Solo lectura (método, monto, quién cobró)                                             | —                 | —              |
| `VOID`  | Solo lectura, número del ticket con la regla de anulación y «Este lavado fue anulado» | —                 | —              |

**Cobrar:** diálogo. Cifra Figure `$14.00`. Tres botones: Efectivo · Tarjeta · Transferencia.
Al elegir uno, el primario pasa a «Cobrar en efectivo». Sin campo de monto.

**Anular:** diálogo destructivo, rojo pleno solo adentro. «Se anula el lavado #14. No se puede
deshacer.»

#### `/catalog/services`

Igual que en la redacción anterior: lista por categoría, matriz de precios en el diálogo,
categorías vacías visibles acá para agregarles servicios. Texto plano si solo hay
`services.read`.

#### `/settings/employees`

Tabla del sistema, el mismo patrón que `/settings/users` (001). Columnas: nombre, usuario,
estado. Sello Activo / Inactivo. Inactivo: regla de anulación sobre el nombre, igual que en
`/settings/users` — el usuario de pista se sigue leyendo limpio porque hace falta para reactivarlo.

Diálogo crear/editar: nombre, usuario, PIN (solo dígitos, 4–8), activo. Primario «Guardar
empleado». Quien tiene `employees.read` y no `manage` ve texto plano, sin botón crear.

El usuario autenticado (admin) no aparece acá: no es un empleado.

### Copy

| Lugar                    | Texto                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| Login pista              | Entrar                                                               |
| Primario alta pista      | Abrir lavado                                                         |
| Primario fila pista      | Nuevo lavado                                                         |
| Listo                    | Marcar listo                                                         |
| Cobro admin              | Cobrar                                                               |
| Anular admin             | Anular lavado                                                        |
| Vacío pista              | No hay carros en la fila. Tocá Nuevo lavado para anotar el primero.  |
| Vacío oficina, recibidos | No hay carros recibidos. En pista se anotan, o acá con Nuevo lavado. |
| Lavador vacío (oficina)  | Oficina                                                              |
| Descuento ilegal         | No puede pasar de $10.00                                             |
| PIN                      | El PIN son 4 a 8 números.                                            |

Nada de «ticket», «submit» ni «orden de trabajo» en la pista.

### Componentes y features

No hay un design system paralelo. Features: `features/floor` (login + fila + alta + detalle),
`features/carwash` (fila, alta de emergencia y cobro admin), `features/catalog`,
`features/employees`. Clientes y vehículos se crean **dentro** del alta; no hay `/clientes`
ni `/vehiculos` en v1.

El login de pista no reutiliza el de 001 (correo/contraseña). Puede reutilizar la lámina
centrada de 360px y los campos.

JWT: el guard de 001 se extiende para distinguir `kind`. Rutas `/api/floor/*` exigen
empleado; el resto de lo autenticado exige usuario, salvo los `@Public()`.

## Fuera de alcance

- Que un admin entre a la pista con la misma cuenta, o un empleado a la oficina.
- Vincular `Employee` con `User` (la misma persona con dos accesos se opera a mano).
- Roles o permisos dentro de la pista (todos los empleados activos hacen lo mismo).
- Caja: abrir, cerrar, arqueo, retiros.
- Comisiones (sí se guarda quién lavó).
- Subir el precio por encima del catálogo.
- Varios lavadores en el mismo ticket.
- DTE / desglose de IVA.
- Crédito, pagos parciales, más de un pago.
- Inventario, insumos, máquinas.
- Cotizaciones, diagnóstico, inspección, bahías de taller.
- Servicios `WORKSHOP` en la UI.
- Pantallas de listado de clientes o vehículos.
- Tienda / POS, membresías.
- Anular o reabrir un `PAID`.
- Recordar el PIN, login biométrico, «entrar como» desde admin.

## Revisión previa a la aprobación

Revisada contra el código ya construido (specs 001 y 002 terminadas). Las dos dependencias
declaradas se cumplen. Lo que sigue no son objeciones al diseño de la spec: son cosas que hay que
resolver dentro de ella y que no estaban en la lista de tareas.

**1. Etiquetas de las acciones nuevas en la matriz de roles.** La matriz de `/settings/roles` arma
sus columnas sola a partir del registro de permisos, así que `charge` y `void` aparecen sin tocar
nada. Pero `ACTION_LABELS` en `permission-matrix.tsx` solo traduce `read` → «Ver» y `manage` →
«Administrar»; una acción sin entrada cae al `?? action` y se pinta con su clave en inglés. Sin
agregar «Cobrar» y «Anular» ahí, la pantalla muestra `charge` y `void` a la cara del usuario, que
contradice la regla 1 del AGENTS.md raíz. Va en la tarea de permisos.

**2. La matriz crece a 8 módulos × 4 acciones.** Hoy son 2 × 2. Con esta spec pasa a ocho filas y
cuatro columnas, la mayoría de las celdas con guion porque casi ningún módulo tiene `charge` ni
`void`. La spec ya resolvió lo semántico —el guion dice «ese módulo no tiene esa acción», no
«casilla sin marcar»—, pero conviene mirarla dentro del diálogo, en tablet y en densidad `bahía`,
antes de darla por buena. Es el único sitio del sistema donde una tabla crece por las dos
dimensiones a la vez.

**3. Ponerle fecha de vencimiento al `kind` ausente.** La spec resuelve bien el despliegue: los
tokens viejos de 001 no llevan `kind` y se tratan como `user` para no cortar la jornada. El detalle
es que esa tolerancia no expira sola, y un token sin `kind` tratado como `user` es exactamente la
forma que tendría que tener un token falsificado si alguna vez se filtra el `JWT_SECRET`. Como la
jornada dura 8 horas, la regla puede quitarse al día siguiente del despliegue. Conviene dejarlo
escrito como tarea y no como intención, porque si no, no se hace.

**4. `POST /floor/login` tiene que ser público, y solo él.** El guard de 001 es global con
`@Public()` como excepción. Al agregar el segundo tipo de sesión, cada ruta `/api/floor/*` necesita
decir explícitamente cuál de las dos cookies exige; una ruta de pista que se olvide de declararlo
cae en el guard de admin y responde 401 a un empleado con sesión válida. Es un error silencioso y
fácil de cometer, así que la tarea del guard debería incluir un test que recorra las rutas
registradas y falle si alguna `/floor/*` no declara su tipo de sesión.

## Verificación

### Automática — `scripts/verify-003.sh`

**72 comprobaciones** contra un stack levantado: los dos mundos y sus cookies, el catálogo y sus
precios por tipo de carro, el alta desde pista y desde oficina, el descuento, las transiciones, el
cobro, la anulación, el reemplazo de PIN y la reutilización de placa. Crea empleado, clientes,
vehículos y tickets con sufijo `VIS` y los borra al terminar. Sale con código 1 si algo falla.

```bash
docker compose up -d
pnpm build && pnpm --filter @elite/api db:seed
pnpm dev                      # en otra terminal
bash scripts/verify-003.sh
```

### Verificado a ojo, en el navegador

Con Chrome sin ventana por el protocolo de DevTools, con datos reales:

- **Pista en `bahía`** — `/floor/login` con el usuario recordado, la fila en láminas tocables y el
  alta con tipo de carro y servicios como botones. Sin pestañas: la pista tiene una sola cosa que
  hacer.
- **Oficina en claro y oscuro** — la fila como tabla del sistema, el detalle con el cobro, el
  catálogo con la matriz desplegada y el guion que dice «usa el base».
- **RN-16 con un rol de verdad** — se creó un rol Cajero con `carwash.read` y `carwash.charge`. En
  su riel aparece **una sola pestaña**, Lavados; no hay botón de «Nuevo lavado»; y contra el API
  recibe `403` en catálogo, empleados, usuarios, alta y anulación, y `200` al cobrar.

## Tareas

- [x] Etiquetas en español de `charge` y `void` en `ACTION_LABELS` de `permission-matrix.tsx`, y revisar la matriz de 8×4 en el diálogo, en tablet y en densidad `bahía` (ver _Revisión previa_, puntos 1 y 2).
- [x] Permisos nuevos y códigos de error en `@elite/shared`; seed 001 los pone en
      `Administrator`.
- [x] Schema: `Employee`, catálogo, vehículos, clientes, tickets con
      `openedByEmployeeId?` / `openedByUserId?` / `chargedByUserId` + migración.
- [x] Seed de tipos de carro, categorías y tres servicios con matriz (sin pisar precios).
- [x] Dominio pista: login PIN, `pinChangedAt`, `isActive`. Tests en memoria.
- [x] Dominio tickets: precio (RN-2), descuento (RN-5), transiciones (RN-9: cualquier
      empleado marca listo), cobro (RN-10), lavador (RN-8). Tests en memoria.
- [x] API `/floor/*` (login, me, tickets, catálogo de lectura, clientes/vehículos de alta).
- [x] API admin: empleados, catálogo, tickets **con alta de emergencia**, cobro, anular.
- [x] Guard: `kind` user vs employee, dos cookies, sin cruzar vistas. Incluye un test que recorra las rutas registradas y falle si alguna `/floor/*` no declara su tipo de sesión (_Revisión previa_, punto 4).
- [ ] Quitar la tolerancia al `kind` ausente el día después del despliegue, pasada una jornada de 8 h (_Revisión previa_, punto 3).
- [x] UI `/floor/login` (usuario recordado) y shell de pista en `bahía`.
- [x] UI `/floor`, `/floor/new`, `/floor/:id` (marcar listo sin ser el que anotó).
- [x] UI admin `/carwash`, `/carwash/new` (lavador opcional), `/carwash/:id` (cobro),
      `/catalog/services`, `/settings/employees`.
- [x] Pestañas del riel admin por permiso (RN-16). Cajero no ve catálogo ni empleados.
- [x] Verificar criterios (tests + tablet `bahía` en pista + escritorio en oficina). 165 tests unitarios, 72 comprobaciones end-to-end y la revisión visual de las dos vistas; el detalle está en _Verificación_.
