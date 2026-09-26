# 055 — El turno de caja se lee de un vistazo

**Estado:** Terminada
**Módulo:** carwash (solo web) | **Depende de:** 010, 054

## Task

El detalle del turno es una tarjeta a todo el ancho con nueve filas etiqueta→valor: el rótulo pegado
al borde izquierdo y el número a 1500px de distancia, así que el ojo cruza la pantalla entera nueve
veces y ninguna fila pesa más que otra. Ahí adentro, los tres montos que de verdad cuentan el turno
—**efectivo, tarjeta y transferencia**— son tres líneas de 13px iguales a las demás: el arqueo por
método, que es el motivo de la pantalla, no se ve.

Se reordena en bloques, con el mismo lenguaje que ya usa Caja: tarjetas de estadística, rótulo
arriba y cifra grande debajo. Nada de backend, nada de contrato: es la misma información, ordenada.

## Done

- [x] `cash-method-stats.tsx` (nuevo): las tres tarjetas de método —**Efectivo**, **Tarjeta**,
      **Transferencia**— en una grilla de tres columnas, cada una con el icono de su método
      (`Banknote`, `CreditCard`, `ArrowLeftRight`, los mismos de `PaymentMethodStamp`). Efectivo va
      en tono `go`: es lo único que está en el cajón. Los tres aparecen siempre, aunque den `$0.00`:
      contar el cajón sin la fila de un método deja el turno a medias.
- [x] `cash-session-detail-screen.tsx`: la tarjeta única se parte en cuatro bloques, en este orden:
      **Turno** (una tarjeta con «Abrió» y «Cerró» en dos columnas, el nombre bajo el rótulo y la
      hora de `formatWhen` debajo, así el valor deja de estar al otro extremo de la pantalla),
      **Cobrado** (encabezado propio y `CashMethodStats`), **Efectivo en el cajón** (encabezado
      propio y tres tarjetas: Fondo, Esperado, Contado) y **Notas** (tarjeta propia a todo el
      ancho, solo si hay notas).
- [x] El tercer bloque se llamó «Arqueo» y el taller no usa esa palabra. El título dice de qué
      plata habla: la del cajón. Por eso tarjeta y transferencia no están ahí sino en «Cobrado».
- [x] El sello de diferencia sigue donde está, en el `ScreenHeader`: es el veredicto del turno.
- [x] `cash-screen.tsx`, turno abierto: la grilla suelta de seis tarjetas se agrupa igual —
      **Cobrado** con `CashMethodStats`, y **Turno** con Fondo, Esperado y Tickets cobrados—. Las
      dos pantallas quedan con la misma forma.
- [x] Apilado (<900px) los bloques caen uno bajo otro y las tarjetas pasan a una columna. Ningún
      valor queda separado de su rótulo.

## Always

- Un monto se dibuja con `StatCard`: rótulo arriba, cifra debajo. Nunca un rótulo a la izquierda y
  su número contra el borde derecho de una lámina ancha.
- Los tres métodos van juntos, en el mismo bloque y en el mismo orden: efectivo, tarjeta,
  transferencia.
- Los iconos de método salen de la misma tabla que `PaymentMethodStamp`. Si cambia uno, cambian los
  dos sitios.

## Ask first

- Si «Cobrado» debe mostrar también cuántos cobros hubo de cada método: eso se cuenta desde
  `payments`, y esta spec solo muestra los totales que ya manda el API.
- Si el bloque del efectivo debe repetir la diferencia como tarjeta además del sello del encabezado.

## Never

- Nunca esconder un método porque dio cero: se ve el cero.
- Nunca pintar la diferencia solo con color: el sello lleva su palabra («Cuadra», «Sobra $2.00»).

## Verify

`pnpm lint && pnpm test && pnpm build`
