'use client';

import { Button } from '@/components/ui/button';
import type { BarSummary } from '../settings-changes';

/**
 * La barra de guardar (120): fija abajo y solo con cambios. Con errores dice
 * qué revisar y Guardar queda deshabilitado. En el teléfono queda encima de la
 * barra de navegación del pie.
 */
export function SaveBar({
  summary,
  hasErrors,
  saving,
  onDiscard,
}: {
  summary: BarSummary;
  hasErrors: boolean;
  saving: boolean;
  onDiscard: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className="border-line bg-surface-2 fixed bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-30 flex w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-card border py-2.5 pr-2.5 pl-4.5 sm:flex-nowrap md:bottom-4 md:left-[calc(var(--rail-width)+(100%-var(--rail-width))/2)] md:w-[min(40rem,calc(100%-var(--rail-width)-2rem))]"
    >
      <p
        className={
          hasErrors
            ? 'text-danger-text min-w-0 flex-1 basis-full font-semibold sm:basis-auto'
            : 'text-text min-w-0 flex-1 basis-full font-semibold sm:basis-auto'
        }
        aria-live="polite"
      >
        {summary.title}
        {summary.detail === '' ? null : (
          <span className="text-text-faint font-medium"> · {summary.detail}</span>
        )}
      </p>
      <Button type="button" variant="ghost" className="max-sm:flex-1" onClick={onDiscard}>
        Descartar
      </Button>
      <Button
        type="submit"
        form="rental-settings-form"
        disabled={hasErrors}
        loading={saving}
        className="max-sm:flex-1"
      >
        Guardar
      </Button>
    </div>
  );
}
