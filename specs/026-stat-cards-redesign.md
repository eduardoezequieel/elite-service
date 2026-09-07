# 026 — Rediseño de contadores y tarjetas de estadística

**Estado:** Terminada

## Task

Rediseñar el componente `StatCard` para agregar soporte de iconos, estandarizar la altura en todas las tarjetas y pulir la tipografía y alineación (eliminando espacios flotantes en decimales), aplicándolo primero en la pantalla de lavados (`TicketsScreen`).

## Done

- [x] `StatCard` soporta prop `icon` opcional con contenedor estilizado por tono (`default`, `go`, `flame`).
- [x] `StatCard` estandariza altura mínima uniforme (`min-h-[96px]`) en escritorio y tablet.
- [x] La tipografía muestra el valor numérico en Saira itálica bold y ajusta la unidad pegada a los decimales sin hueco espurio.
- [x] En `TicketsScreen`, las 4 tarjetas muestran su visual correspondiente (icono de cola, listo, cobrado y el medidor de arco).
- [x] `pnpm build` y `pnpm lint` pasan limpios.

## Always

- Mantener la jerarquía de tokens de `DESIGN.md` (colores, radios, fuentes Saira e Inter).
- Preservar el componente firma `SegmentGauge` para el avance del día.
- Respetar la accesibilidad táctil y densidades `mostrador` / `bahia`.

## Ask first

- Cambiar la ubicación de los medidores o introducir nuevas dependencias de iconos fuera de `lucide-react`.

## Never

- Usar `uppercase` forzado en etiquetas.
- Romper el diseño en 1 columna (móvil) o 2 columnas (tablet).

## Verify

```bash
pnpm lint && pnpm build
```
