import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Reservado del logo. PROVISIONAL.
 *
 * El taller no entregó el wordmark de Elite Service en vectorial, y `/login` y
 * la cabecera del riel lo necesitan (spec 001 → Bloqueos, DESIGN.md → Logo).
 * La spec prevé exactamente esta salida: un reservado del tamaño correcto,
 * marcado como provisional en el código, más una tarea de reemplazo abierta.
 *
 * El marco punteado es deliberado: dice «acá falta algo», que es la verdad, en
 * vez de disimularlo con un texto que parezca definitivo.
 *
 * ---
 *
 * **Para reemplazarlo cuando llegue el archivo:** este componente es el único
 * lugar del que cuelga el reservado. Se cambia el marco punteado por el `<svg>`
 * o el `<Image>` del logo, se respeta el alto mínimo de 24px de la cabecera del
 * riel (DESIGN.md → Layout) y se borra `label`. Ninguna pantalla se toca.
 */
export function LogoPlaceholder({
  label,
  className,
}: {
  /** Texto del reservado. Desaparece cuando exista el logo de verdad. */
  label: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'border-rule text-muted-foreground flex h-8 items-center justify-center rounded-md border border-dashed text-label',
        className,
      )}
      title="Reservado del logo — falta el archivo original"
    >
      {label}
    </span>
  );
}
