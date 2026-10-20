# 124 — La cobertura de daños se arregla en cada renta

**Estado:** Terminada — 19 oct 2026. Aprobada — 19 oct 2026, en el chat: «así me parece bien, implementalo» (tras el
prototipo `docs/prototype/damage-coverage.html`)
**Módulo:** `features/rentals` (web) | **Depende de:** 118

## Task

En el paso Contrato de la renta nueva, el bloque «Seguro Sí/No» confunde: el carro siempre tiene
seguro, y lo que se elige ahí es la cobertura de daños (CDW). Además, el cargo por día viene fijo de
Ajustes. El bloque pasa a preguntar quién paga si el carro se choca, y tanto el cargo por día como el
deducible se pueden escribir en cada renta. Ajustes solo da los valores iniciales. Es un cambio solo
de web: el API ya acepta `cdwPerDay` y `deductible` por renta, y `@elite/shared` no cambia.

## Done

- [x] El título del bloque es «Si choca el carro». La palabra «Seguro» y la sigla «CDW» no aparecen
      en este paso.
- [x] Hay dos opciones. La primera es «Paga hasta $X», con el cargo debajo («+ $Y/día», o «Sin
      cargo» si es 0). La segunda es «Paga todos los daños».
- [x] Al elegir la primera aparecen dos campos: «Cargo por día ($)» y «Paga si choca ($)». Los dos
      vienen llenos con el CDW y el deducible de Ajustes y se pueden editar.
- [x] Si el usuario ya escribió un valor, volver a elegir la opción no lo pisa.
- [x] El total del pie usa el cargo por día escrito. Un cargo de 0 vale. El deducible debe ser > 0.
- [x] El body manda `coverage: 'ACCEPTED'` con el cargo y el deducible escritos. Sin cobertura
      manda `DECLINED`, cargo `'0.00'` y deducible vacío.
- [x] En `bahia` los campos van en una columna.
- [x] `new-rental.spec.ts` cubre: cargo escrito en el total, cargo 0, deducible faltante y el body
      con y sin cobertura.
- [x] El paso Confirmar dice «Si choca» («Paga hasta $X» / «Paga todos los daños») y la línea
      «Cobertura» solo con cargo > 0.

## Always

- Cálculo de dinero con `agreementTotals`/`discountCeiling` de `@elite/shared`; no se duplica.

## Ask first

- Cambiar el diálogo de edición del contrato o el contrato impreso.

## Never

- Tocar el API, `@elite/shared` ni Ajustes.

## Verify

`pnpm build && pnpm lint && pnpm test`
