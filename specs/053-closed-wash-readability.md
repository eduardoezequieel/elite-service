# 053 — El lavado cerrado se lee sin adivinar

**Estado:** Terminada
**Módulo:** carwash (web + contrato + api mínimo) | **Depende de:** 003, 010, 046, 049

## Task

Tres cosas de la misma pantalla —lista y detalle del lavado— que hoy mienten o quedan huérfanas.

1. **«Cobrado» se ve apagado como si no hubiera pasado nada.** El chip usa `--text-faint`, el gris
   más débil del sistema, casi idéntico al de «En espera». Un lavado cobrado es el final bueno del
   ciclo: pasa al verde de «Listo», con su relleno de siempre. Y ya que se toca: **los cinco
   estados llevan icono**, no solo ese. Un chip con punto al lado de uno con icono se lee como dos
   componentes distintos.
2. **La columna «Entrada» cuenta un tramo, no el lavado.** Hoy muestra
   `waitLabel(washingStartedAt ?? createdAt)`, así que un carro que volvió a la bahía a las 2:17
   dice «4 min» aunque entró a la 1:05 y la línea de tiempo diga 1 h 15 min. El número pasa a
   significar siempre lo mismo: **cuánto estuvo el carro en el taller desde que entró**.
3. **La tarjeta «Cobro» tiene el título huérfano.** «Cobro» se escribe con la misma tipografía y
   color que «Método» y «Monto», así que se lee como una fila a la que le falta el valor de la
   derecha. Pasa a verse como encabezado, y la tarjeta gana el dato que faltaba: **quién cobró**,
   que ya está en `payments.recorded_by_user_id` desde la 003 pero nunca viajó al contrato.

## Done

- [x] `@elite/shared`: `TicketPayment.recordedBy: { id: string; fullName: string }`. Nunca falta:
      la columna es obligatoria desde la 003 y la FK nueva garantiza que el usuario existe.
- [x] `apps/api/prisma/schema.prisma`: `Payment.recordedBy` relación a `User` sobre la columna
      existente `recordedByUserId` (`onDelete: Restrict`), con su inverso
      `recordedPayments Payment[] @relation("PaymentRecordedBy")` en `User`. Migración nueva: solo
      agrega la FK, ninguna columna.
- [x] `prisma-ticket.repository.ts`: el `include` de `payment` trae `recordedBy` (id y `fullName`) y
      lo mapea. El resto del mapeo no cambia.
- [x] `apps/web/src/features/carwash/elapsed.ts` (puro, sin React): `elapsedLabel(ticket, now)`
      devuelve el texto de la columna o `null`. `PAID` → `durationLabel(paidAt − createdAt)`,
      congelado. `VOID` → `null`. Cualquier otro → `durationLabel(now − createdAt)`, vivo. Usa el
      vocabulario de `duration.ts`, el mismo de la línea de tiempo: por eso los números cuadran.
- [x] `elapsed.spec.ts`: cobrado da el total entrada→cobro y no se mueve con `now`; cobrado sin
      `payment` cae al tramo vivo; anulado da `null`; `WASHING` cuenta desde `createdAt` aunque
      tenga `washingStartedAt` posterior.
- [x] `tickets-screen.tsx`: la columna «Entrada» es `timeOf(createdAt)` y, si `elapsedLabel` no es
      `null`, `·` y la duración. Ya no lee `washingStartedAt`.
- [x] `stamp.tsx`: el tono `paid` pasa a `--go-text` con el relleno normal del chip. El latido deja
      de ser cosa del punto: cuando hay icono, late el icono.
- [x] `ticket-status-stamp.tsx`: cada estado trae su icono de `lucide-react` —`OPEN` `Clock`,
      `WASHING` `Droplets` (late), `READY` `CircleCheck`, `PAID` `Banknote`, `VOID` `Ban`—. Las
      palabras no cambian, y el icono nunca las reemplaza.
- [x] `board-screen.tsx`: los chips «Lavando» y «Listo» salen de `TicketStatusStamp`, no de un
      `Stamp` armado ahí. «Libre» no es estado de lavado pero comparte fila con uno: lleva
      `CircleDashed` para que los dos se lean igual.
- [x] Los `Stamp` que usan un tono del ciclo **sin** nombrar un estado —«Carro nuevo», «Ya lo
      conocemos», el descuento del `service-picker`, el rubro del catálogo— siguen con punto.
- [x] `card.tsx`: `CardSectionHeading` —`text-title` en `--text` con filete `--line-soft` debajo—
      para el encabezado de una tarjeta que agrupa filas etiqueta/valor.
- [x] `ticket-detail-screen.tsx`: «Cobro», «Servicios» y «Línea de tiempo» usan
      `CardSectionHeading`. La tarjeta de cobro suma `Cobró` (`recordedBy.fullName ?? '—'`) y
      `Hora` (`timeOf(paidAt)`), en ese orden después de «Monto».
- [x] `apps/web/DESIGN.md`: la tabla del chip de estado suma la columna de icono con los cinco, la
      regla de «todos con icono o ninguno», y la sección nueva de `CardSectionHeading`.

## Always

- La duración de la columna y la de la línea de tiempo salen del mismo `duration.ts`: si dos
  pantallas muestran el mismo lavado, muestran el mismo número.
- El chip lleva la palabra escrita. El icono la acompaña, nunca la reemplaza.
- El estado de un lavado se dibuja con `TicketStatusStamp`. Ninguna pantalla arma el suyo.
- `recordedBy` es dato de lectura: nadie lo edita, y el cobro lo sigue fijando el use case con el
  usuario de la sesión.

## Ask first

- Si el taller quiere el nombre **histórico** de quien cobró (el que tenía el día del cobro, como
  hace el historial de la 046) en vez del actual: eso es copiar el nombre a la fila de `payments`,
  otra migración y otro criterio.
- Si «Servicios» y «Línea de tiempo» de otras pantallas (caja, tablero) también deben migrar a
  `CardSectionHeading`: esta spec solo toca el detalle del lavado.

## Never

- Nunca volver a calcular la duración desde `washingStartedAt` en una lista: ese campo es el tramo
  en curso, no el lavado.
- Nunca dejar que un lavado cobrado siga contando tiempo: cerrado es cerrado.
- Nunca mezclar chips de estado con punto y con icono en la misma pantalla.

## Verify

`pnpm lint && pnpm test && pnpm build`
