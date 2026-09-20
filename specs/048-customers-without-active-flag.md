# 048 — Un cliente no se desactiva

**Estado:** Terminada
**Módulo:** shared + api (customers) + web (customers) | **Depende de:** 004

## Contexto

La 004 le dio al cliente un `isActive` copiado de empleados y usuarios. Pero un cliente no es un
actor del sistema: no entra, no cobra, no tiene permisos. Nadie usa la baja, y a cambio ocupa una
columna «Estado» entera en la lista, un filtro, un botón en la ficha, un interruptor en el diálogo
y un `activeOnly` que atraviesa web, API, casos de uso y repositorios. Se va entero, hasta la base.

## Historias

- Como usuario con `customers.manage`, quiero que la ficha del cliente tenga solo lo que uso
  —nombre, teléfono, carros y lavados—, para dejar de decidir sobre un estado que no significa nada.

## Criterios de aceptación

- **Dado** el diálogo de edición de un cliente, **cuando** se abre, **entonces** tiene nombre,
  teléfono y nada más.
- **Dado** la lista de Clientes, **cuando** se carga, **entonces** no hay columna «Estado», ni
  filtro de actividad, ni la palabra «activos» en el subtítulo: dice «3 clientes».
- **Dado** la ficha de un cliente, **cuando** se abre, **entonces** no hay sello Activo/Inactivo ni
  botón «Desactivar» / «Reactivar».
- **Dado** `GET /customers?q=…`, **cuando** se lo llama, **entonces** devuelve a todos los que
  coinciden y el parámetro `activeOnly` ya no existe (se ignora si alguien lo manda).
- **Dado** `PATCH /customers/:id` con `{"isActive":false}`, **cuando** se lo llama, **entonces**
  responde 200 y el campo se **ignora**: los schemas Zod del repo no son estrictos, así que una
  clave que no está en el contrato se descarta, no rompe.
- **Dado** un cliente cualquiera, **cuando** se escribe su nombre en un lavado, **entonces** se
  sugiere: ya no hay nadie a quien esconder.
- **Dado** el JSON de un cliente en cualquier respuesta —lista, ficha, `match`, el cliente de un
  lavado—, **cuando** se lo lee, **entonces** no trae la clave `isActive`.

## Reglas de negocio

- **RN-1 (deroga la 004 RN-4).** El cliente no tiene estado. No se desactiva, no se reactiva y no
  se borra: se corrige. Todos los clientes se sugieren siempre.
- **RN-2.** La baja lógica sigue existiendo donde sí hay un actor —usuarios, empleados, servicios y
  categorías del catálogo—. `matchesActivity` y `activityOptions` de `lib/list-filters` se quedan
  tal cual para esas pantallas.
- **RN-3.** Un cliente que hoy está desactivado vuelve a verse y a sugerirse. Es la consecuencia
  aceptada de la migración y no se compensa con nada.

## Permisos

Ninguno nuevo. `customers.read` y `customers.manage` siguen igual.

## Datos

`Customer.isActive` se borra del `schema.prisma` y de la tabla `customers`, con una migración
`DROP COLUMN`. **Destructiva e irreversible:** quién estaba desactivado no se puede recuperar.

## API

| Método  | Ruta               | Cambio                                                                    |
| ------- | ------------------ | ------------------------------------------------------------------------- |
| `GET`   | `/customers`       | sin el query `activeOnly`; devuelve a todos                               |
| `GET`   | `/floor/customers` | sin el query `activeOnly`; devuelve a todos                               |
| `GET`   | `/customers/match` | compara contra todos los clientes                                         |
| `PATCH` | `/customers/:id`   | `isActive` fuera de `updateCustomerSchema`: se ignora si alguien lo manda |
| —       | todas              | el objeto `Customer` ya no lleva `isActive`                               |

## UI

- **Lista de Clientes:** fuera la columna «Estado», el `FiltersPopover` entero (el de actividad era
  su único campo) y el `.is-ruled-out` del nombre. El subtítulo pasa a «N clientes» / «1 cliente».
  Queda el buscador, que es el que se usa.
- **Ficha del cliente:** fuera el `Stamp` del encabezado, el botón «Desactivar» / «Reactivar» y su
  `DeactivateConfirmDialog`. Queda «Editar».
- **Diálogo de cliente:** fuera el interruptor «Cliente activo», su texto de ayuda y el
  `DeactivateConfirmDialog` que lo confirmaba. Nombre y teléfono.
- `DeactivateConfirmDialog` y `Switch` siguen en `components/ui/`: los usan otras pantallas.

## Fuera de alcance

- Borrar clientes de verdad. Un cliente con lavados no se borra nunca.
- Tocar la baja lógica de usuarios, empleados, servicios o categorías.
- Fusionar clientes duplicados.

## Tareas

- [x] `packages/shared`: `Customer` sin `isActive`; `updateCustomerSchema` sin `isActive`.
- [x] `apps/api`: `schema.prisma` sin la columna + migración `DROP COLUMN`.
- [x] `apps/api`: puerto `CustomerRepository` sin `activeOnly` ni `isActive`; repositorio Prisma y
      el en memoria alineados; `UpdateCustomerUseCase` y `FindCustomerMatchUseCase` sin el filtro.
- [x] `apps/api`: `CustomersController` y `FloorTicketsController` sin el query `activeOnly`.
- [x] `apps/api`: `prisma-ticket.repository` deja de mapear `isActive` en el cliente del lavado.
- [x] `apps/api`: tests de `customer.usecases.spec.ts` y las fixturas de `ticket.usecases.spec.ts`.
- [x] `apps/web`: `customers-screen`, `customer-detail-screen`, `customer-dialog`, `customers/api.ts`,
      `use-customers.ts` y la fixtura de `lib/list-filters.spec.ts`.
- [x] `scripts/verify-004.sh`: fuera el bloque 4 y la parte de baja del bloque 8; el resto se
      queda y sigue pasando.
- [x] `specs/004-customers.md`: RN-4 marcada como derogada por esta spec.

## Verificación

`pnpm lint && pnpm test && pnpm build`, y `scripts/verify-004.sh` contra un stack levantado —lo
corre el usuario: pide Postgres, la migración aplicada y el API arriba—.
