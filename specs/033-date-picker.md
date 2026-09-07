# 033 — Selector de fecha propio

**Estado:** Aprobada
**Módulo:** web/ui | **Depende de:** 002-design-system, 009-carwash-commissions, 014-carwash-search-and-date

## Task

Sacar el calendario nativo del navegador del front y poner una primitiva propia en
`apps/web/src/components/ui/date-field.tsx`, con marca Elite, en los dos temas y las dos
densidades, que deje elegir **cualquier** fecha y que también se pueda **escribir**.

Comportamiento aprobado: `docs/prototype/date-picker.html` (maqueta interactiva). Ahí está
resuelto el gesto entero; esta spec lo baja a React sin inventar nada nuevo.

Dos modos, una sola pieza:

- `DateField` — fecha suelta. Reemplaza `DaySelector` en `/carwash`.
- `DateRangeField` — rango. Reemplaza los dos `Input type="date"` de `/carwash/commissions`.

**Ruta técnica (decidida, con justificación):** `npx shadcn@latest add calendar popover` y
restilar el `calendar` con tokens Elite; la rejilla la mueve `react-day-picker`, el resto —campo,
máscara, salto de mes/año, hoja táctil, presets— es nuestro. Comparadas:
(1) nativo: rechazado por el dueño — cromo del navegador, inglés, sin tokens ni densidad;
(2) **shadcn calendar restilado: elegida** — locale, semana en lunes, modo rango, rejilla
accesible y flechas ya resueltos; el look sale entero de `classNames` con tokens;
(3) calendario 100% propio: es lo que hace el prototipo, ~250 líneas de aritmética de fechas y
navegación por teclado que habría que testear, sin ganancia visual;
(4) solo máscara `dd/mm/yyyy`: la bahía no tipea con guantes; deja fuera a media audiencia.
`react-day-picker` sería la única dependencia nueva (sin `date-fns`: los formatos salen de `Intl`).

**Rango: un solo disparador y un solo panel, no dos campos sueltos ni dos pickers linkeados.**
Cerrado, el rango es **un botón** que dice qué se está mirando (`31 ago – 6 sep 2026 · 7 días`).
Abierto, adentro del panel viven las tres cosas: el riel de atajos, los dos campos `Desde` y
`Hasta` que se escriben, y el calendario. Un panel = un gesto; el segundo toque acota contra el
primero (así `from > to` no se puede armar picando) y bajo 900px dos calendarios apilados no caben
en una hoja. Sacar los campos de la pantalla libera la barra de comisiones y deja de haber dos
lugares —Tabs y campos— peleando por el mismo estado.

## Done

- [x] `date-field.tsx` exporta `DateField` y `DateRangeField`. Ningún `type="date"` ni
      `showPicker()` queda en `apps/web/src`.
- [x] `lib/civil-date.ts` concentra `todayCivil`, `parseCivil`, `formatCivil`, `parseTyped`,
      `maskDate` y `addDays`; `tickets-screen.tsx` y `commissions-screen.tsx` dejan de tener
      su copia.
- [x] **Cerrado, el rango** (comisiones): un único botón de `--control-h` con icono de
      calendario, resumen y cheurón. El resumen dice extremos y cuenta:
      `31 ago – 6 sep 2026 · 7 días`, `6 sep 2026 · 1 día`, y el año del extremo inicial solo
      aparece si difiere del final (`28 dic 2025 – 3 ene 2026`). Ningún campo de texto queda
      suelto en la pantalla.
- [x] **Cerrado, el día** (`/carwash`): botón de `--control-h` con icono y el día
      (`Hoy` o `dd/mm/yyyy`), como hoy.
- [x] **Escribir vive adentro del panel**, en los dos modos: el rango lleva `Desde` y `Hasta`
      en `FieldBox` arriba del calendario, separados por `a`; la fecha suelta, un campo
      `Ir a la fecha`. `inputMode="numeric"`, las barras las pone la máscara, se interpreta al
      salir del campo o con Enter. En escritorio el foco entra por el campo; en la hoja, por la
      rejilla.
- [x] **Atajos adentro del panel, en riel**: `Hoy · 7 días · Este mes` en columna a la izquierda
      del calendario (≥900px) y en chips arriba de la rejilla (<900px), bajo el título `Atajos`.
      El que calza con lo elegido lleva **tilde**, no solo color. Se van los `Tabs` de la barra de
      comisiones: el estado del rango vive en un solo lugar.
- [x] **Abierto ≥900px:** popover anclado al disparador — `rounded-card`, `shadow-elite`,
      `border-line-soft`, `bg-surface`, entrada `--duration-enter`. Abre hacia abajo; si no cabe,
      **se da vuelta** y abre hacia arriba; si no cabe de ningún lado, va al lado con más aire y
      hace scroll adentro (nunca recortado). Igual en horizontal: si se sale por la derecha, se
      alinea por la derecha del disparador.
- [x] **Abierto <900px:** hoja desde abajo a todo el ancho, con el mismo gesto que
      `dialog.tsx`; celdas de al menos `--touch-min` y la rejilla estirada al ancho.
- [x] **Salto de mes y año:** `‹ ›` mueven un mes; el mes del encabezado es un botón que abre,
      dentro del mismo panel, la rejilla de 12 meses y la de 12 años con `‹ ›` de bloque.
      Llegar a enero 2024 desde hoy toma como máximo 4 toques.
- [x] **Comisiones, un solo estado `{ from, to }`:** lo escriben el atajo, los campos y la
      rejilla, y nunca queda un extremo huérfano ni un rango custom ignorado (hoy pasa eso).
- [x] **Aplicar:** la fecha suelta se aplica al tocar el día y cierra; su pie lleva `Hoy`.
      El rango **no aplica nada hasta `Aplicar`**, igual en popover que en hoja: picar días y
      escribir arman un borrador, `Cancelar`, `Escape` o tocar afuera lo tiran y queda el rango
      anterior. `Aplicar` está deshabilitado mientras falte un extremo o el rango esté al revés.
- [x] **El panel dice qué hace el próximo toque**: «Tocá la fecha inicial», «Desde X. Ahora la
      final», «De X a Y. Tocá la nueva inicial». Sin esa línea, un calendario para dos campos
      es adivinanza.
- [x] **Rango inválido** (`from > to` escrito a mano): mensaje «La fecha inicial es posterior a
      la final» con `role="alert"` en `--danger-text`, dentro del panel y debajo de los campos;
      el texto escrito **no** se revierte, `Aplicar` queda apagado y sigue el último rango
      válido. Los dos campos se validan juntos, nunca uno solo.
- [x] **Teclado:** Tab entra al campo y al botón; en el panel las flechas mueven día,
      `PageUp/PageDown` mes, `Shift+PageUp/PageDown` año, `Home/End` extremos de la semana,
      `Enter` elige, `Escape` cierra sin aplicar y devuelve el foco al disparador. Siempre hay
      exactamente una celda con `tabIndex 0`, también después de cambiar de mes.
- [x] Verificado a 390px, 900px y 1180px, en `mostrador` y en `bahia`, en claro y en oscuro.

## Always

- Locale `es-SV`: meses y días en español, **semana desde el lunes**, display `dd/mm/yyyy`.
  Al API sigue viajando `YYYY-MM-DD` en `America/El_Salvador`.
- Cualquier fecha es elegible: sin `min`, sin `max`, pasado y futuro.
- Tamaños, alturas y áreas táctiles desde `--control-h`, `--touch-min`, `--field-*` e
  `--icon-size`.
- **Los días no llevan degradado.** El elegido (y cada extremo del rango) se marca con filete
  `--flame`, superficie `--surface-3` y peso; el interior del rango, con el relleno de tinte
  (`--tint-fill`); hoy, con filete `--line` y peso; los días de otro mes, `--text-faint`.
  `--gradient-action` es del botón primario y del subrayado, no de una celda de 44px.
- Todo estado lleva palabra además de color: la línea del panel y la frase del error.
- El panel funciona sin `hover`: el rango se dibuja con lo elegido, no con el puntero.

## Ask first

- ¿ADR nuevo en `docs/ARCHITECTURE.md` por sumar `react-day-picker`, o calendario 100% propio
  —el del prototipo, ya escrito— para no tocar dependencias?
- ¿El riel lleva solo los tres atajos ya aprobados (`Hoy`, `7 días`, `Este mes`) o suma también
  `Ayer`, `Últimos 30 días` y `Mes pasado`, como la referencia del dueño?
- ¿El rango de comisiones viaja en la URL (`?from=&to=`) como el `?date=` de 014, o queda en
  estado local?
- ¿Se agrega runner de tests a `@elite/web` para cubrir `parseTyped`/`maskDate`/`addMonths`, o
  esa lógica se mueve a `@elite/shared`, que hoy tampoco corre tests?

## Never

- Nunca `input type="date"`, `showPicker()` ni `<select>` nativo de mes/año: eso es el cromo que
  se rechazó.
- Nunca un hex, un radio, una sombra ni un alto literal fuera de `globals.css`.
- Nunca `--gradient-action` pintando un día, ni el panel recortado por el borde de la ventana.
- Nunca texto de UI en inglés («September», «Clear», «Today»).
- Nunca tocar el API, el contrato de fechas, otras pantallas ni el `DataTable`.
- Nunca un popup chico bajo 900px, ni scroll horizontal en el panel.

## Verify

`pnpm lint && pnpm test && pnpm build && ! grep -rn 'type="date"\|showPicker' apps/web/src`

Y el gesto contra la maqueta: `open docs/prototype/date-picker.html`, con los interruptores de
tema y densidad, a 390px y a 1280px. Ahí se comprueban a ojo las tres cosas que no salen en un
comando: el panel se da vuelta cuando no cabe abajo, ningún día lleva degradado, y el disparador
cerrado dice el rango entero.
