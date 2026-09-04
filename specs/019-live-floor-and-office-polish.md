# 019 — Fila viva, lavadores, tiempos, táctil y recibo

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003, 014

## Task

Ola 2 de UI sobre lo que ya existe. Hallazgos 03, 16, 17 (tiempos con
`createdAt`), 18, 19, 20, 21, 23, 25. El 24 ya lo cubrió 012. El 17 del audit
quedó refutado como estaba escrito: sí se usa `createdAt` en la ficha del
cliente; falta en la fila.

## Done

- [x] `/carwash` y `/floor` refrescan solos cada 15s y muestran cuándo.
- [x] `refetchOnWindowFocus` en esas listas.
- [x] La tarjeta de pista nombra a todos los lavadores, no `+1`.
- [x] La tarjeta y la fila de oficina muestran hora de entrada y espera.
- [x] Barra <900px: cuatro destinos + `Más` (resto, tema, usuario, densidad).
- [x] `DataTable` apila bajo 1100px.
- [x] Acciones de fila de Lavados en alto `--control-h`, no `sm`.
- [x] `Salir` de pista pide confirmación.
- [x] Densidad se puede fijar desde el riel y desde `Más`.
- [x] Un lavado `PAID` tiene `Imprimir recibo` (`window.print`).

## Always

- Autorización por `module.action`.
- El latido del Stamp `washing` solo en el estado Lavando (020).

## Never

- Nunca `refetchInterval` global en el QueryClient.
- Nunca dejar tema y usuario como octavo y noveno ítem de la barra.

## Verify

`pnpm lint && pnpm test && pnpm build`
