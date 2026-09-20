# 051 — La nota del lavado, en vivo entre pista y mostrador

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 041, 042

## Task

1. El diálogo de cobro deja de trabajar sobre una copia congelada del ticket. La lista guarda el
   **id** y relee el ticket en cada render, así el hilo en vivo (042) también lo alcanza.
2. El campo de nota se sincroniza con lo que llega del otro lado: si no se tocó, adopta la nota
   ajena; si se tocó, **no se pisa** lo escrito.
3. Cuando hay conflicto —se escribió acá y el otro lado guardó algo distinto— se muestra qué
   guardaron y un botón para quedarse con esa nota.
4. La misma regla en la pista y en el mostrador: el campo es el mismo componente.

## Done

- [x] `TicketsScreen` guarda `chargingId`, no el objeto `Ticket`; el diálogo recibe el ticket de la lista.
- [x] Si el ticket sale del filtro al cobrarse, el diálogo conserva el último mientras se cierra.
- [x] `useTicketNote` adopta la nota remota solo si el campo no se tocó.
- [x] Con el campo tocado y una nota ajena distinta, `TicketNoteField` avisa y ofrece «Usar la de ellos».
- [x] Guardar la propia nota no deja un conflicto contra uno mismo.
- [x] `FloorTicketDetail` y `ChargeDialog` usan el mismo hook.
- [x] Tests de `syncNote` y `conflictOf` en `use-ticket-note.spec.ts`.

## Always

- La nota que se muestra sale del ticket de la consulta, nunca de una copia en estado local.
- El hilo actualiza; nunca borra lo que una persona está escribiendo.

## Ask first

- Si el taller quiere que la nota se guarde sola al escribir (sin botón): cambia el contrato de
  guardado y el conteo de requests.

## Never

- Nunca guardar un `Ticket` entero en `useState` para alimentar un diálogo: queda viejo apenas
  llega un evento.

## Verify

`pnpm lint && pnpm test && pnpm build` · en dos pantallas: guardar la nota en la pista y verla
aparecer en el diálogo de cobro sin recargar.
