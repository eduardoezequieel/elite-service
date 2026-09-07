# 024 — Máscara de placas SV y flujo ágil de cliente nuevo

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 012, 004

## Task

1. Restringir la máscara de placa en el alta de lavado al formato de El Salvador (1–2 letras + hasta 6 dígitos, ej. `P123-456`), impidiendo teclear caracteres inválidos o dígitos de más.
2. Permitir que en el buscador de clientes, al presionar Enter o perder foco sin coincidencias (y en tablet con la tecla de acción «Siguiente» / `enterKeyHint="next"`), se tome automáticamente lo escrito como cliente nuevo sin obligar a hacer clic en «Es alguien nuevo».

## Done

- [x] `formatPlate` valida formato SV estricto: prefijo de 1 o 2 letras (`[A-Z]{1,2}`) seguido de hasta 6 dígitos.
- [x] `formatPlate` trunca cualquier dígito extra más allá de 6 números y rechaza caracteres inválidos.
- [x] Formatea con guion a los 3 dígitos (ej. `P123-456`, `MB123-456`).
- [x] Campo de placa en `ticket-form.tsx` tiene `maxLength={10}`.
- [x] En `CustomerField`, presionar Enter toma el texto como cliente nuevo si no hay coincidencias (o si no se eligió sugerencia).
- [x] `CustomerField` incluye `enterKeyHint="next"` en el input para que teclados virtuales de tablet muestren la acción adecuada.
- [x] Al perder foco (`onBlur`), si hay texto ingresado y la búsqueda no devolvió coincidencias, se pasa automáticamente a cliente nuevo.
- [x] El botón «Es alguien nuevo» sigue visible y accesible como alternativa explícita táctil.

## Always

- Solo caracteres válidos de placas salvadoreñas en el campo de placa.
- Mantener la normalización (`normalizePlate`) compatible con la búsqueda existente.
- En tablet, permitir avanzar al tipo de carro sin fricción de clics redundantes.

## Never

- Nunca permitir placas con más de 6 dígitos numéricos.
- Nunca romper la selección de clientes existentes al hacer clic en sugerencias.

## Verify

`pnpm lint && pnpm test && pnpm build`
