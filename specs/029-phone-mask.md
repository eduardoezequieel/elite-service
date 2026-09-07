# 029 — Máscara de teléfono SV (####-####)

**Estado:** Terminada
**Módulo:** web + customers | **Depende de:** 004, 028

## Task

1. Crear la función utilitaria `formatPhone` para aplicar formato de teléfono salvadoreño de 8 dígitos (`####-####`).
2. Aplicar la máscara en tiempo real (`onChange`) y limitar a `maxLength={9}` en los inputs de teléfono de `CustomerField` (ficha de lavado) y `CustomerDialog` (módulo de clientes).

## Done

- [x] `formatPhone` descarta caracteres no numéricos, admite hasta 8 dígitos y coloca un guion tras el cuarto dígito (ej. `7777-8888`).
- [x] Si se pega o ingresa con prefijo internacional `+503` o `503` seguido de 8 dígitos, extrae los 8 dígitos salvadoreños.
- [x] El campo de teléfono en `CustomerField` (`customer-field.tsx`) usa `formatPhone` en `onChange` y `maxLength={9}`.
- [x] El campo de teléfono en `CustomerDialog` (`customer-dialog.tsx`) usa `formatPhone` en `onChange` y `maxLength={9}`.

## Always

- Solo dígitos numéricos y el guion en la posición 4 (`####-####`).
- El campo sigue siendo opcional: permite borrarlo por completo y dejarlo vacío.
- Preservar `inputMode="tel"` para teclado numérico en tablets y móviles.

## Ask first

- ¿Soportar números internacionales con longitud variable o restringir al estándar de El Salvador de 8 dígitos (`####-####`)?

## Never

- Nunca permitir más de 8 dígitos numéricos.
- Nunca romper la desvinculación o guardado de clientes sin teléfono.

## Verify

`pnpm lint && pnpm test && pnpm build`
