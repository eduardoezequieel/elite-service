# 087 — Entrada en cascada y latido sutil

**Estado:** Terminada (aprobada por chat, 28 sept 2026: «adelante»)
**Módulo:** web | **Depende de:** DESIGN.md (Movimiento), 042 (hilo en vivo), 067 (carga)

## Contexto

El usuario vio el prototipo `docs/prototype/pulse-motion.html` y eligió **entrada en cascada** y
**latido sutil** (chat, 28 sept 2026). Hoy `DESIGN.md` prohíbe animar al entrar a una sección y
solo deja latir el icono de «Lavando». Esta spec cambia esa regla y aplica el movimiento en las
piezas comunes (`ScreenHeader`, `StatCard`, `Card`, `DataTable`, `EmptyState`, `Stamp`, la
campana), no pantalla por pantalla.

## Historias

- Como persona en el mostrador o en la bahía, quiero que la pantalla aparezca en orden de lectura y
  que lo que cambia se marque una vez, para notar qué llegó sin buscarlo.

## Criterios de aceptación

- **Dado** que se abre una pantalla, **cuando** se monta, **entonces** cabecera, tarjetas de cifra,
  tarjetas, filas y vacío entran con `elite-enter-rise` (opacidad + 8px, `--duration-mount`
  280ms) en cascada de `--stagger-step` 35ms por paso, con tope de 16 pasos.
- **Dado** una lista montada, **cuando** llegan datos nuevos y las filas conservan su `rowKey`,
  **entonces** esas filas no vuelven a animarse.
- **Dado** una lista montada, **cuando** aparecen 1 o 2 filas nuevas y sigue a la vista al menos una
  de antes, **entonces** las nuevas llevan `data-arrived` y destellan una vez (`elite-flash`, 1.6s).
  Un cambio de página, de filtro o de lista entera no destella.
- **Dado** un `Stamp` montado, **cuando** cambia su `tone` o su `label`, **entonces** salta una vez
  (`elite-pop`, 420ms) y suelta un anillo. Al montarse no salta.
- **Dado** un `StatCard` con cifra de texto o número, **cuando** la cifra cambia, **entonces** salta
  una vez. Al montarse no salta.
- **Dado** la campana, **cuando** `unread` sube, **entonces** el icono se mece y el globo salta una
  vez. Cuando baja (se leyó algo) no se mueve.
- **Dado** el chip «en vivo» del cajón de avisos, **cuando** hay hilo en vivo, **entonces** el punto
  suelta un anillo en bucle (`elite-ring`, 1.6s). «sin conexión» no late.
- **Dado** `prefers-reduced-motion: reduce`, **entonces** nada entra en cascada ni late: todo
  aparece quieto y entero en el primer cuadro, sin esperar el escalonado.
- Las entradas viven solo dentro de `main` y `.board-screen`: diálogos, menús y el toast conservan
  su propia animación y no se suman a la cascada.

## Reglas de negocio

- **RN-1:** El movimiento se decide en las piezas del sistema y en `globals.css`. Ninguna pantalla
  escribe una animación propia.
- **RN-2:** Los bucles del sistema pasan a ser cuatro: el icono de «Lavando», el anillo de «en
  vivo», la aguja del medidor y el brillo del esqueleto. Nada más late en bucle.
- **RN-3:** Todo lo demás es de una sola vez: entrar, llegar, cambiar.
- **RN-4:** La densidad no cambia el movimiento: `mostrador` y `bahia` usan las mismas duraciones.

## Permisos

Ninguno.

## UI

- `globals.css`: tokens `--duration-mount` (280ms), `--stagger-step` (35ms), `--duration-pulse`
  (1.6s); keyframes `elite-enter-rise`, `elite-flash`, `elite-pop`, `elite-ring`, `elite-bell`;
  reglas por `data-slot` (`screen-header`, `stat-card`, `card`, `data-table-row`, `empty-state`,
  `stamp`, `notification-bell`) y el bloque de movimiento reducido.
- El paso de la cascada: `ScreenHeader` 0, `StatCard`/`Card` según su posición entre hermanos,
  filas `4 + índice en la página` (en línea, `--enter-step`), `EmptyState` 2.
- `lib/motion.ts`: `arrivedKeys`, `countChange`, `rose` y `changeMark`, puras y con tests.
- `lib/use-motion.ts`: `useArrivedKeys(keys)` y `useChangeMark(value, isChange?)`, sobre esas funciones.

## Fuera de alcance

- Transiciones entre rutas (la pantalla que se va no se anima).
- Pista (`/floor`) más allá de lo que ya use `ScreenHeader` / `Card` / `Stamp`.
- La marca de estado (063), la carga (067), diálogos y menús: quedan como están.
- Latidos del nivel «Todo» del prototipo.

## Tareas

- [x] `lib/motion.ts` + `lib/motion.spec.ts` (llegadas: 0 en el primer render, 1–2 nuevas con
      alguna de antes, ninguna al cambiar de página o de lista; `rose` solo cuando sube).
- [x] `lib/use-motion.ts`.
- [x] Tokens, keyframes, reglas por slot y movimiento reducido en `globals.css`.
- [x] `ScreenHeader` con `data-slot="screen-header"`.
- [x] `DataTable`: `--enter-step` por fila y `data-arrived` en las dos vistas (tabla y lámina).
- [x] `Stamp` y `StatCard`: `data-changed` al cambiar, no al montar.
- [x] Campana: mecida y globo al subir `unread`. Chip «en vivo» del cajón con anillo.
- [x] `DESIGN.md` → Movimiento, Accesibilidad y Don'ts reescritos con la regla nueva.
- [x] Prototipo en `docs/prototype/pulse-motion.html`.

## Always

- Cada duración sale de un token de `globals.css`.
- `pointer-events` y el foco no cambian: una fila que entra ya se puede tocar.
- Una fila que conserva su `rowKey` no se vuelve a animar.

## Ask first

- Sumar la cascada a otra pieza que no esté en la lista de arriba.
- Cualquier bucle nuevo.

## Never

- Animar la salida de una pantalla o bloquearla hasta que termine la entrada.
- Bajar la opacidad de un dato ya montado para «llamar la atención».
- Esconder un dato detrás de una animación: al terminar, todo queda en su sitio y a opacidad 1.

## Verify

`pnpm build && pnpm lint && pnpm test`

La revisión visual (escritorio, tablet, 390px, `bahia`, claro/oscuro, movimiento reducido) la hace
el usuario.
