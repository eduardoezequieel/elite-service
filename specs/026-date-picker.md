# 026 — Selector de fecha propio

**Estado:** Terminada
**Módulo:** web/ui | **Depende de:** 002-design-system, 009-carwash-commissions, 014-carwash-search-and-date

## Task

Sacar el calendario nativo del navegador y poner una primitiva propia en
`apps/web/src/components/ui/date-field.tsx`, con marca Elite, en los dos temas y las dos
densidades, que deje elegir **cualquier** fecha y que también se pueda **escribir**.

Comportamiento aprobado: `docs/prototype/date-picker.html`. Esta spec lo baja a React.

Dos modos, una sola pieza:

- `DateField` — fecha suelta. Reemplaza `DaySelector` en `/carwash`.
- `DateRangeField` — rango. Un solo disparador en `/carwash/commissions`.

**Ruta técnica:** calendario first-party portado del prototipo. Cero dependencias nuevas,
cero ADR. `react-day-picker` se descartó: el gesto (rieles, salto de año, hoja, máscara,
flip) ya está escrito y el dueño lo aprobó visualmente.

## Done

- [x] `date-field.tsx` exporta `DateField` y `DateRangeField`. Ningún `type="date"` ni
      `showPicker()` queda en `apps/web/src`.
- [x] `lib/civil-date.ts` concentra `todayCivil`, `parseTyped`, `maskDate`, `addDays` y el
      resumen del rango. Tests en `civil-date.spec.ts`.
- [x] Cerrado, el rango es un único botón (`31 ago – 6 sep 2026 · 7 días`). Cero FieldBox
      Desde/Hasta en la pantalla.
- [x] Cerrado, el día: botón con icono y `Hoy` o `dd/mm/yyyy`.
- [x] Escribir vive adentro del panel.
- [x] Atajos `Hoy · 7 días · Este mes` en riel (chips bajo 900px). Se van los Tabs de
      comisiones.
- [x] ≥900px popover con flip si no cabe abajo. <900px hoja desde abajo.
- [x] Salto de mes y año desde el encabezado.
- [x] Rango se aplica con `Aplicar`. Fecha suelta, al tocar el día.
- [x] Rango inválido escrito a mano: alerta, no consulta, texto no se revierte.

## Always

- Locale `es-SV`, semana desde el lunes, display `dd/mm/yyyy`. Al API: `YYYY-MM-DD` en
  `America/El_Salvador`.
- Cualquier fecha es elegible.
- Tamaños desde `--control-h`, `--touch-min`, `--field-*`, `--icon-size`.
- Día elegido: `--surface-3` + filete `--flame` + peso. Interior del rango: tinte 12%.
  Nunca `--gradient-action` en un día.
- Todo estado lleva palabra además de color.

## Ask first

- (Cerrado) Motor: propio, no shadcn calendar.
- (Cerrado) El rango de comisiones queda en estado local, no en la URL.
- (Cerrado) Tests del parseo en `@elite/web` (`civil-date.spec.ts`).

## Never

- Nunca `input type="date"`, `showPicker()` ni `<select>` nativo de mes/año.
- Nunca un hex fuera de `globals.css`.
- Nunca texto de UI en inglés.
- Nunca tocar el API ni el `DataTable`.
- Nunca un popup chico bajo 900px.

## Verify

`bash scripts/verify-026.sh`
