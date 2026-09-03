import type { ReactNode } from 'react';

import { FloorShell } from '@/features/floor/components/floor-shell';

/**
 * Layout de la vista pista.
 *
 * No reusa el `AppShell` de oficina a propósito: son dos vistas, no la misma
 * con botones más grandes (RN-0). El riel tabulado y los permisos no existen acá;
 * el enlace de regreso sí, porque la pista también tiene fichas adentro.
 *
 * `/floor/login` queda **fuera de este layout**, en un grupo de rutas aparte.
 * Tiene que ser así: `FloorShell` exige sesión y redirige a `/floor/login` si no
 * la hay, así que envolver el propio login con él lo mandaría a sí mismo en un
 * bucle y la pantalla se quedaría en «Cargando…» para siempre.
 */
export default function FloorLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <FloorShell>{children}</FloorShell>;
}
