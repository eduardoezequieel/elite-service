# 060 — Cambiar un precio pide autorización

**Estado:** Aprobada (2026-09-20, por chat)
**Módulo:** carwash | **Depende de:** 003 (lavado), 045 (autorización), 059 (cuenta de cobro)

## Contexto

Hoy cualquiera que abra o edite un lavado puede bajarle el precio a una línea: el campo es editable
y el único tope es el precio del catálogo. El taller lo quiere como el supermercado: **recepción
cotiza mientras el lavado está abierto, pero desde que el lavado queda `READY` el precio se cierra**;
si está mal, llega alguien con llave y lo autoriza ahí mismo.
La llave ya existe en el sistema —la spec 045 pide correo y contraseña de un administrador sin
cerrar la sesión del cajero—; esta spec la aplica al precio y deja firmado quién autorizó qué.

Prototipo: `docs/prototype/joint-charge.html` (abrir un ticket de la cuenta y tocar el candado).

## Decisiones del usuario

- 2026-09-20: el precio se cambia como en el supermercado: el cajero no lo toca, un administrador
  autoriza en la misma pantalla con sus credenciales.
- 2026-09-20: recepción **sí** fija el precio mientras el lavado está abierto; la llave empieza
  cuando el lavado queda `READY` (RN-1).

## Historias

- Como recepción con `carwash.manage`, quiero fijar el precio mientras el lavado está abierto, para
  cotizarle al cliente que tengo enfrente sin llamar a nadie.
- Como cajero, quiero ver el precio pero no poder cambiarlo, para que nadie me reclame después un
  descuento que yo no decidí.
- Como cajero, quiero llamar al encargado y que autorice el precio en mi misma pantalla, para no
  cederle mi sesión ni mandar al cliente a otra caja.
- Como dueño, quiero que todo precio distinto al del catálogo quede firmado con nombre, motivo y
  precio anterior, para revisarlo al cierre.

## Criterios de aceptación

- **Dado** un lavado `OPEN` o `WASHING` y un usuario con `carwash.manage`, **cuando** edita el
  precio de una línea entre 0 y el precio del catálogo, **entonces** se guarda sin pedir
  autorización, como hoy.
- **Dado** un lavado `READY` —o la pantalla de cobro—, **cuando** el usuario mira una línea de
  servicio, **entonces** el precio se muestra como texto, no como campo editable, junto a un botón
  `Cambiar precio`.
- **Dado** el diálogo de cambiar precio, **cuando** falta el precio nuevo, el motivo o cualquiera de
  las dos credenciales, **entonces** el botón queda deshabilitado y no se llama al API.
- **Dado** el diálogo completo con credenciales de un usuario activo con `carwash.discount`,
  **cuando** confirma, **entonces** la línea queda con el precio nuevo, muestra el precio del
  catálogo tachado y la firma `Autorizó <nombre>`.
- **Dado** credenciales de un usuario **sin** `carwash.discount`, o incorrectas, o de un usuario
  desactivado, **cuando** confirma, **entonces** el API responde `403 AUTHORIZATION_FAILED` con el
  mismo texto para los tres casos, la línea no cambia y la sesión del cajero sigue abierta.
- **Dado** un precio nuevo mayor al del catálogo, **cuando** confirma, **entonces** el API responde
  `422 PRICE_ABOVE_CATALOG` y la línea no cambia.
- **Dado** un usuario que **sí** tiene `carwash.discount`, **cuando** cambia un precio, **entonces**
  igual se le piden correo y contraseña (mismo criterio que 045 RN-3).
- **Dado** un lavado ya cobrado (`PAID`), **cuando** se intenta cambiar un precio, **entonces** el
  API responde `409 TICKET_ALREADY_CHARGED`: primero se deshace el cobro (045).
- **Dado** una línea con precio autorizado, **cuando** alguien con `carwash.audit` abre la línea de
  tiempo del lavado, **entonces** ve el cambio con precio anterior, precio nuevo, motivo y quién
  autorizó.

## Reglas de negocio

- **RN-1: el precio se cierra al quedar listo.** Mientras el lavado está `OPEN` o `WASHING`, quien
  tenga `carwash.manage` fija el precio libre entre 0 y el catálogo. Desde `READY` en adelante
  —incluida la caja— ningún camino escribe `unitPrice` sin autorización.
- **RN-2:** La autorización se evalúa contra la clave `carwash.discount`, nunca contra el nombre de
  un rol.
- **RN-3:** Se pide siempre, incluso si el usuario logueado tiene el permiso (045 RN-3).
- **RN-4:** Solo hacia abajo: `0 <= unitPrice <= catalogPrice`. Cobrar de más no se autoriza, se
  corrige en el catálogo.
- **RN-5:** El motivo es obligatorio y queda guardado. Un texto vacío o en blanco no pasa.
- **RN-6:** Autorizar no abre sesión ni cambia el usuario de la pantalla; la contraseña del
  autorizante no se guarda en ningún lado (045 RN-4 y RN-5).
- **RN-7:** El precio del catálogo de la línea (`catalogPrice`) no se toca nunca: sigue siendo el
  snapshot del momento en que se agregó la línea (003 RN-4).
- **RN-8:** Un lavado cobrado no admite cambios de precio. Para corregirlo se deshace el cobro.
- **RN-9:** Volver un lavado de `READY` a `OPEN` (037) no reabre el precio hacia atrás: los precios
  ya autorizados conservan su firma.

## Permisos

| Clave              | Descripción                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `carwash.discount` | Autorizar un precio distinto al del catálogo en una línea de lavado |

Se agrega al catálogo de `@elite/shared` y lo sincroniza el seed. No se asigna sola a nadie: el
dueño la pone en el rol que quiera desde la administración.

## Datos

```prisma
model WorkOrderItem {
  // Firma del precio autorizado (RN-1). Null = precio del catálogo, sin cambio.
  priceAuthorizedByUserId String?   @db.Uuid
  priceAuthorizedAt       DateTime?
  priceReason             String?
  /// El precio que tenía la línea antes del cambio, para el historial.
  previousUnitPrice       Decimal?  @db.Decimal(12, 2)
}
```

El cambio también queda en el historial: `GET /carwash/tickets/:id/timeline` devuelve
`priceChanges: TicketPriceChange[]` (`@elite/shared`) junto a los tramos de estado de la spec 046,
con el servicio, el precio anterior, el nuevo, el motivo y el nombre **congelado** de quien firmó
(046 RN-4). Vacío es el caso normal.

## API

| Método | Ruta                                           | Request                                | Response     | Errores                                                                                                            |
| ------ | ---------------------------------------------- | -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| PATCH  | `/api/carwash/tickets/:id/items/:itemId/price` | `{ unitPrice, reason, authorization }` | `200` Ticket | `422 VALIDATION_ERROR`, `422 PRICE_ABOVE_CATALOG`, `403 AUTHORIZATION_FAILED`, `409 TICKET_ALREADY_CHARGED`, `404` |

El alta y la edición siguen aceptando `unitPrice` mientras el lavado está `OPEN` o `WASHING`. Si el
lavado ya está `READY`, responden `422 PRICE_CHANGE_NOT_AUTHORIZED`: a partir de ahí el precio se
cambia solo por el endpoint de arriba.

## UI

- **Alta y edición de un lavado abierto:** el campo de precio sigue como hoy (030), sin candado.
- **Línea de servicio de un lavado `READY` y de la caja:** precio como texto + botón candado
  `Cambiar precio`. Si tiene precio autorizado, muestra el del catálogo tachado y, debajo, la firma
  `Autorizó <nombre>`. El ticket entero muestra una insignia «Precio autorizado».
- **Diálogo `Cambiar precio`:** precio del catálogo a la izquierda, campo del precio nuevo, motivo,
  y el bloque de autorización de 045 (correo + contraseña) con su borde de advertencia. El error del
  API sale con `role="alert"` dentro del diálogo.
- **Densidades:** el candado cumple objetivo táctil en `bahia`; el diálogo es el de la 031, a pantalla
  completa en tablet.

## Fuera de alcance

- Subir un precio por encima del catálogo (se corrige en el catálogo, no en la orden).
- Descuentos por cliente, por flota o porcentuales.
- Cambiar precios de un lavado ya cobrado sin deshacer el cobro.
- Autorización por PIN en lugar de correo y contraseña (hoy la 045 usa credenciales; si el taller
  quiere PIN, es otra spec y aplica a las dos).

## Verificación

`scripts/verify-060.sh` contra el stack levantado: cambia el precio de una línea con credenciales
que tienen el permiso y verifica la firma en el ticket; repite con un usuario sin el permiso y
espera `403 AUTHORIZATION_FAILED`; manda un precio mayor al catálogo y espera
`422 PRICE_ABOVE_CATALOG`; edita el precio de un lavado `OPEN` sin autorización y espera `200`; repite sobre
uno `READY` y espera `422 PRICE_CHANGE_NOT_AUTHORIZED`; intenta cambiar el precio de un lavado `PAID` y espera `409`.

## Tareas

> Implementado el 2026-09-20. `pnpm build`, `pnpm lint` y `pnpm test` en verde. Falta correr
> `scripts/verify-060.sh` y aplicar las migraciones: piden el stack levantado.

- [x] `packages/shared`: permiso `carwash.discount`, schema del request y códigos de error nuevos.
- [x] `apps/api`: migración con las cuatro columnas de `work_order_items` y el evento
      `PRICE_CHANGED`.
- [x] `apps/api` application: caso de uso `AuthorizePrice` reutilizando el verificador de
      autorización de la 045, con tests de los cinco rechazos.
- [x] `apps/api`: alta y edición rechazan precios cambiados cuando el lavado ya está `READY`.
- [x] `apps/web`: línea de servicio de solo lectura + diálogo `Cambiar precio` en alta, edición y
      cobro.
- [x] `apps/web`: firma y tachado en la línea, insignia en el ticket, y los `priceChanges`
      intercalados en la línea de tiempo por fecha.
- [x] `scripts/verify-060.sh` y sección **Verificación** enlazada.
- [x] `pnpm build`, `pnpm lint`, `pnpm test`.
