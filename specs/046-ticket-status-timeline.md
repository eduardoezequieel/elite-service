# 046 — Línea de tiempo de estados del lavado

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003, 037, 042

## Contexto

Hoy un ticket solo guarda `createdAt`, `washingStartedAt` y `chargedAt`: si un lavado tardó dos
horas, nadie puede decir en cuál estado se fue el tiempo ni quién lo movió. El admin necesita ver,
por ticket, los tramos por los que pasó, cuánto duró cada uno y quién hizo cada cambio.

## Historias

- Como usuario con `carwash.audit`, quiero ver la línea de tiempo de un lavado, para saber cuánto
  estuvo en cada estado y quién lo movió.
- Como usuario con `carwash.audit`, quiero que el tramo en curso tenga un contador que corre, para
  ver de un vistazo cuánto lleva parado un lavado abierto.

## Criterios de aceptación

- **Dado** un lavado recién abierto, **cuando** se pide su línea de tiempo, **entonces** trae un
  solo tramo: `OPEN`, con `enteredAt` igual a la hora de apertura, `leftAt: null`,
  `durationSeconds: null` y el actor que lo abrió.
- **Dado** un lavado que pasó `OPEN → WASHING → READY → PAID`, **cuando** se pide su línea de
  tiempo, **entonces** trae cuatro tramos en orden ascendente por `enteredAt`, los tres primeros
  con `leftAt` y `durationSeconds` calculados, y el último abierto.
- **Dado** un cambio de estado hecho desde la pista, **cuando** se lee el tramo que abre,
  **entonces** su actor es `{ kind: 'employee', name: <nombre del empleado al momento> }`.
- **Dado** un lavado que vuelve de `WASHING` a `OPEN`, **cuando** se lee su línea, **entonces**
  aparecen dos tramos `OPEN` distintos, cada uno con su propia duración.
- **Dado** un lavado creado antes de esta spec, **cuando** se pide su línea de tiempo, **entonces**
  la respuesta es `{ segments: [], recorded: false }` y la UI dice que no hay historial.
- **Dado** un usuario sin `carwash.audit`, **cuando** pide `GET /carwash/tickets/:id/timeline`,
  **entonces** recibe `403` con `code: 'FORBIDDEN'`.
- **Dado** un usuario sin `carwash.audit`, **cuando** abre el detalle de un lavado, **entonces** ve
  el detalle completo sin la tarjeta de línea de tiempo.
- **Dado** el detalle abierto con un tramo en curso, **cuando** pasa un segundo, **entonces** el
  contador de ese tramo avanza sin volver a pedir nada al API.

## Reglas de negocio

- **RN-1:** La fila de historial se escribe en la **misma transacción** que el cambio de estado. Si
  no se puede escribir el historial, el cambio de estado no ocurre.
- **RN-2:** Se registra un evento por cada entrada a un estado, incluida la apertura del ticket
  (`fromStatus: null`). Un cambio que no mueve el estado (editar líneas, nota, responsable) **no**
  genera fila.
- **RN-3:** El actor se toma de la sesión que el guard ya resolvió, nunca del cuerpo del request
  (igual que 042). Si no se puede atribuir, la fila queda con actor nulo.
- **RN-4:** El nombre del actor se guarda como **snapshot** en la fila. Si después se renombra o se
  borra al empleado, la línea de tiempo sigue diciendo quién fue.
- **RN-5:** Las duraciones cerradas las calcula el API: `durationSeconds` es la diferencia entre el
  `enteredAt` de un tramo y el del siguiente. El tramo final queda abierto (`leftAt: null`,
  `durationSeconds: null`) y su contador lo corre la web con el reloj del cliente.
- **RN-6:** `PAID` y `VOID` son estados terminales: su tramo queda abierto en los datos, pero la UI
  no le corre contador ni lo suma al total.
- **RN-7:** El total del lavado es la suma de los tramos cerrados; si el último no es terminal, se
  le suma el tiempo en curso.
- **RN-8:** Los lavados anteriores a esta spec no se reconstruyen. Sin filas ⇒ `recorded: false`.

## Permisos

| Clave           | Descripción                                                             |
| --------------- | ----------------------------------------------------------------------- |
| `carwash.audit` | Ver la línea de tiempo de un lavado: estados, duración y quién lo movió |

## Datos

`apps/api/prisma/schema.prisma`, migración nueva:

```prisma
enum StatusActorKind {
  USER
  EMPLOYEE
}

/// Una entrada a un estado. Solo se agrega: nunca se edita ni se borra (RN-1).
model WorkOrderStatusEvent {
  id          String           @id @default(uuid()) @db.Uuid
  workOrderId String           @db.Uuid
  /// `null` en la fila de apertura.
  fromStatus  WorkOrderStatus?
  toStatus    WorkOrderStatus

  actorKind       StatusActorKind?
  actorUserId     String?          @db.Uuid
  actorEmployeeId String?          @db.Uuid
  /// Snapshot del nombre al momento del cambio (RN-4).
  actorName       String?

  occurredAt DateTime @default(now())

  workOrder WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  actorUser     User?     @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  actorEmployee Employee? @relation(fields: [actorEmployeeId], references: [id], onDelete: SetNull)

  @@index([workOrderId, occurredAt])
  @@map("work_order_status_events")
}
```

## API

| Método | Ruta                            | Request | Response         | Errores                                 |
| ------ | ------------------------------- | ------- | ---------------- | --------------------------------------- |
| GET    | `/carwash/tickets/:id/timeline` | —       | `TicketTimeline` | `403 FORBIDDEN`, `404 TICKET_NOT_FOUND` |

En `@elite/shared` (`contracts.ts`):

```ts
export interface TicketTimelineActor {
  kind: 'user' | 'employee';
  name: string;
}

export interface TicketTimelineSegment {
  id: string;
  status: WorkOrderStatus;
  /** ISO. */
  enteredAt: string;
  /** ISO. `null` si es el tramo actual. */
  leftAt: string | null;
  /** `null` si es el tramo actual. */
  durationSeconds: number | null;
  actor: TicketTimelineActor | null;
}

export interface TicketTimeline {
  segments: TicketTimelineSegment[];
  /** `false` en lavados anteriores a la spec 046 (RN-8). */
  recorded: boolean;
}
```

## UI

`apps/web/src/features/carwash/components/ticket-timeline.tsx`, montado en
`ticket-detail-screen.tsx` como una `Card` más, después de la de cobro, solo si
`can('carwash.audit')`.

- Encabezado `Línea de tiempo` y, a la derecha, el total (`Total 1 h 04 min`).
- Una fila por tramo, en orden cronológico: `TicketStatusStamp` del estado, la hora de entrada
  (`10:38 a. m.`), la duración y, debajo, `por <nombre del actor>` o `sin atribuir`.
- Formato de duración: `45 s` bajo un minuto, `12 min` bajo una hora, `1 h 04 min` de ahí en
  adelante. El tramo en curso agrega los segundos bajo la hora (`12 min 30 s`) y refresca cada
  segundo con un `setInterval` que se limpia al desmontar.
- `recorded: false` ⇒ la tarjeta muestra una sola línea: «Este lavado es anterior al registro de
  tiempos.»
- Densidades: en `mostrador` cada tramo es una fila de una línea con la duración alineada a la
  derecha; en `bahia` el tramo ocupa dos líneas con tipografía y áreas táctiles de la densidad, sin
  truncar el nombre del actor. Ancho de tablet sin scroll horizontal.
- La query del timeline se invalida junto con la del ticket cuando llega un evento del stream (042)
  de ese ticket.

## Fuera de alcance

- Reconstruir el historial de lavados viejos.
- Reporte agregado de tiempos por día, empleado o servicio (sería otra spec).
- Historial de cambios que no mueven el estado (líneas, precios, responsable).
- Ver la línea de tiempo desde la pista.

## Verificación

`scripts/verify-046.sh` contra un stack levantado: abre un ticket, lo mueve
`OPEN → WASHING → READY → PAID`, pide el timeline y comprueba el orden, el conteo de tramos, las
duraciones cerradas, el actor de cada uno, y que un usuario sin `carwash.audit` recibe `403`.

## Tareas

- [x] `packages/shared`: agregar `carwash.audit` al catálogo de permisos y los tipos
      `TicketTimeline*` al contrato.
- [x] Prisma: modelo `WorkOrderStatusEvent`, enum `StatusActorKind`, relaciones y migración.
- [x] Dominio: `ticket-timeline.ts` — de filas ordenadas a tramos con `leftAt` y `durationSeconds`
      (RN-5), con su `.spec.ts` (tramo único, varios tramos, estados repetidos, lista vacía).
- [x] Puerto `TicketRepository`: los métodos que mueven estado (`create`, `setStatus`, `charge`,
      `reverse` y el de anulación) reciben el actor y escriben la fila en la misma transacción
      (RN-1); nuevo `listStatusEvents(id)`.
- [x] `prisma-ticket.repository.ts` y el `FakeTicketRepository` de los tests implementan lo
      anterior.
- [x] `ticket.usecases.ts`: pasar el actor a esas escrituras y agregar `timeline(id)`; tests de que
      cada transición deja su fila con el actor correcto.
- [x] `carwash-tickets.controller.ts`: `GET /carwash/tickets/:id/timeline` con
      `@RequirePermissions(PERMISSIONS.carwash.actions.audit.key)`.
- [x] Web: hook `useTicketTimeline`, componente `ticket-timeline.tsx`, montaje en el detalle tras
      el chequeo de permiso, contador en vivo y las dos densidades.
- [x] `scripts/verify-046.sh` y su enlace en la sección **Verificación**.
- [x] `pnpm build`, `pnpm lint`, `pnpm test`.
