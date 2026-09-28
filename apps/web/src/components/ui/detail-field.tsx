import type { ReactNode } from 'react';

/**
 * Un dato de la ficha en modo lectura: etiqueta encima, valor debajo, sin caja
 * (convención 14 de `apps/web/AGENTS.md`: lo que se ve pero no se edita va como
 * texto plano, nunca como un control muerto).
 */
export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-label text-text-faint">{label}</span>
      <div className="text-body">{children}</div>
    </div>
  );
}
