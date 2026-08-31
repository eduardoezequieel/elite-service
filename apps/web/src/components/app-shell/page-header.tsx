'use client';

import type { ReactNode } from 'react';

/**
 * La cabecera de una pantalla, igual en todas (spec 003 → UI).
 *
 * Título en Display, una línea de contexto en Grafito que dice para qué sirve
 * la pantalla, y las acciones a la derecha. En pantalla angosta las acciones
 * bajan y ocupan el ancho: en la bahía se tocan, no se apuntan.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  /** Una frase corta: qué es esta pantalla, no cómo se usa. */
  description?: string;
  /** La acción principal de la pantalla. Una sola, a la derecha. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-display">{title}</h1>
        {description ? (
          <p className="text-body text-muted-foreground max-w-prose">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
