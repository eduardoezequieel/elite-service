# 114 — Días para cubrir la tarifa

**Estado:** Terminada
**Módulo:** fleet (web) | **Depende de:** 100, 103

## Task

En el diálogo «Precio de renta», debajo de la tarifa diaria, mostrar cuántos días al mes hay que
rentar el carro para cubrir la cuota, el seguro, el GPS y los otros fijos. Es la misma cuenta que
`breakEvenDays` (spec 100, RN-5). Cambia mientras se escribe la tarifa.

## Done

- [x] Con costos y tarifa válida mayor a 0: «A $25.00 hay que rentarlo 16 días al mes para cubrir
      $400.00.» El dinero usa el formato de la ficha. Los días salen hacia arriba: 11.6 cuenta
      como 12. Un día se escribe «1 día».
- [x] La tarifa es la escrita en el campo, no la guardada.
- [x] Tarifa vacía, 0 o inválida, con costos: «El carro cuesta $400.00 al mes.» Sin días.
- [x] Sin costos (fijos + cuota activa = 0): no hay línea.
- [x] Sin `rentals.reports` (`costsHidden`): no hay línea.
- [x] La cuota que ya trae seguro y GPS no los suma otra vez. La cuota entra solo si hoy cae en
      su plazo. Las dos cosas las resuelve `breakEvenDays`, con `vehicleStart(vehicle, [], [])`.
- [x] Test del texto: días hacia arriba, un día, tarifa vacía, sin costos.

## Always

- Reusar `breakEvenDays`. No una segunda fórmula.
- La línea va bajo la tarifa diaria, a lo ancho del diálogo, en `text-dense`.
- Mostrador, bahía y tablet: no cambia el grid de los campos.

## Ask first

- La misma línea en la tarjeta «Tarifas y km», fuera del diálogo.
- Contar la cuota cuando no hay fecha de compra ni de primera cuota, mirando la primera renta.

## Never

- Cambiar `breakEvenDays` ni la pestaña «¿Cuánto dejó?».
- Pedir rentas o gastos solo para esta línea.
- Abrir el navegador o levantar servidores.

## Verify

```sh
pnpm build && pnpm lint && pnpm test
```
