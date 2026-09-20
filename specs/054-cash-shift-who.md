# 054 — Quién abrió y quién cerró la caja

**Estado:** Borrador
**Módulo:** carwash (solo web) | **Depende de:** 010

## Task

La base ya guarda las dos firmas del turno —`openedByUserId` y `closedByUserId`, puestas por el use
case con el usuario de la sesión— y las dos viajan en el contrato (`CashSession.openedBy` /
`closedBy`). La pantalla de Caja no las muestra: el turno abierto dice «Turno abierto» y nada más, y
el Historial tiene una sola columna «Quién» que dibuja `closedBy ?? openedBy`, así que un turno que
abrió una persona y cerró otra se lee como si lo hubiera hecho una sola. Eso es exactamente lo que
hay que poder auditar.

Nada de backend, nada de migración: es la misma información, mostrada.

## Done

- [ ] `cash-history.ts` (nuevo, puro, sin React): `sessionActors(session)` devuelve los actores del
      turno sin repetir —`openedBy`, más `closedBy` si es otro id— y `matchesActor(session, id)` es
      verdadero si ese id abrió **o** cerró. De ahí salen las opciones y el filtro «Quién», que hoy
      solo mira a uno de los dos.
- [ ] `cash-history.spec.ts`: turno abierto y cerrado por la misma persona da un actor; por personas
      distintas da dos, en orden abrió→cerró; turno sin cerrar da solo quien abrió; `matchesActor`
      acierta con el que abrió y con el que cerró, y falla con un tercero.
- [ ] `cash-screen.tsx`, turno abierto: el subtítulo del `ScreenHeader` pasa de «Turno abierto» a
      «Abrió <nombre> · <hora>» con `formatWhen(session.openedAt)`. Sin turno sigue diciendo «Sin
      turno abierto».
- [ ] `cash-screen.tsx`, Historial: la columna «Quién» se parte en dos, **«Abrió»** y **«Cerró»**,
      cada una con su nombre completo. Nunca «—» ni un hueco: en el Historial solo hay turnos
      cerrados, y los dos nombres existen siempre.
- [ ] `cash-screen.tsx`: el filtro «Quién» usa `sessionActors` para sus opciones y `matchesActor`
      para filtrar, así que buscar a alguien trae los turnos que abrió y los que cerró. `sessionWho`
      desaparece.
- [ ] Apilado (<900px) las dos columnas bajan rotuladas, una debajo de la otra: «Abrió» y «Cerró»
      con su nombre a la derecha. La columna «Turno» sigue siendo el `stack: 'title'` de la tarjeta.

## Always

- Los dos nombres salen del contrato tal cual. La pantalla no elige uno ni los combina.
- Quien abre y quien cierra los fija el use case con el usuario de la sesión: la UI los lee, nunca
  los manda.

## Ask first

- Si el turno abierto también debe decir cuánto lleva abierto (una duración viva, como la columna
  «Entrada» del lavado): esta spec muestra la hora de apertura, un dato quieto.
- Si el taller quiere el nombre **histórico** del usuario (el que tenía el día del turno) en vez del
  actual: eso es congelarlo en la fila al abrir y cerrar, otra migración.

## Never

- Nunca dibujar un solo nombre para el turno: si los dos existen, se ven los dos.
- Nunca deducir quién cerró a partir de quién abrió.

## Verify

`pnpm lint && pnpm test && pnpm build`
