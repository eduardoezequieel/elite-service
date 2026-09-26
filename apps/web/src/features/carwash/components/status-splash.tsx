'use client';

import type { WorkOrderStatus } from '@elite/shared';
import * as React from 'react';

import { STAMP_TONE_TEXT } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';
import { createSplashController, type SplashEntry } from '../status-splash-state';
import { statusLook } from './ticket-status-stamp';

/**
 * La marca de estado (063): al confirmar un cambio que salió bien, el estado
 * nuevo aparece grande en el centro durante 1200 ms y se va solo.
 *
 * Es **aditiva**, como el aviso: no reemplaza al toast —que sigue con su
 * «Deshacer»— ni lo repite para los lectores de pantalla (`aria-hidden`).
 * Tampoco bloquea: `pointer-events-none`, se puede seguir tocando debajo.
 * Al pedirla, la pantalla sube hasta arriba.
 *
 * Vive en el layout y no en el diálogo que la pide, porque el diálogo se cierra
 * y la tarjeta de la fila se desmonta justo cuando la marca tiene que verse.
 */
export interface StatusSplashContextValue {
  splash: (status: WorkOrderStatus, caption: string) => void;
}

const StatusSplashContext = React.createContext<StatusSplashContextValue | null>(null);

export function StatusSplashProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = React.useState<SplashEntry | null>(null);
  const [controller] = React.useState(() => createSplashController(setEntry));

  React.useEffect(() => controller.dispose, [controller]);

  const value = React.useMemo<StatusSplashContextValue>(
    () => ({
      splash: (status, caption) => {
        controller.show(status, caption);
        scrollToTop();
      },
    }),
    [controller],
  );

  return (
    <StatusSplashContext.Provider value={value}>
      {children}
      {entry === null ? null : <StatusSplashView key={entry.id} entry={entry} />}
    </StatusSplashContext.Provider>
  );
}

/**
 * Tras el cambio, la pantalla vuelve arriba, donde están la placa y el sello
 * del estado nuevo. Sin deslizamiento si el sistema pide movimiento reducido:
 * `behavior` explícito ignora el `scroll-behavior` de `globals.css`.
 */
function scrollToTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

/** Pide la marca desde el `onSuccess` de un cambio de estado. */
export function useStatusSplash(): StatusSplashContextValue {
  const context = React.useContext(StatusSplashContext);

  if (context === null) {
    throw new Error('useStatusSplash must be used inside a <StatusSplashProvider>.');
  }

  return context;
}

function StatusSplashView({ entry }: { entry: SplashEntry }) {
  const { label, tone, icon } = statusLook(entry.status);

  return (
    <div
      aria-hidden
      data-slot="status-splash"
      data-state={entry.leaving ? 'closed' : 'open'}
      className="pointer-events-none fixed inset-0 z-90 flex items-center justify-center p-4"
    >
      <div
        data-slot="status-splash-panel"
        className="bg-surface border-line-soft shadow-dialog flex flex-col items-center gap-3 rounded-card border px-10 py-8 text-center [[data-density=bahia]_&]:gap-4 [[data-density=bahia]_&]:px-12 [[data-density=bahia]_&]:py-10"
      >
        <span
          className={cn(
            'tint relative flex size-28 items-center justify-center rounded-full [[data-density=bahia]_&]:size-40',
            STAMP_TONE_TEXT[tone],
          )}
        >
          {/* El anillo se dibuja alrededor del icono; `pathLength` lo vuelve un
              trazo de 100 sin importar el tamaño del círculo. */}
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
            <circle
              data-slot="status-splash-ring"
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={100}
            />
          </svg>
          <span
            data-slot="status-splash-icon"
            className="flex [&_svg]:size-12 [&_svg]:stroke-[1.75] [[data-density=bahia]_&]:[&_svg]:size-16"
          >
            {icon}
          </span>
        </span>

        <p
          className={cn(
            'text-title font-semibold [[data-density=bahia]_&]:text-figure',
            STAMP_TONE_TEXT[tone],
          )}
        >
          {label}
        </p>
        <p className="text-text-dim text-body tabular-nums">{entry.caption}</p>
      </div>
    </div>
  );
}
