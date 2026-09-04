'use client';

import * as React from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';

import { ToastView, ToastViewport, type ToastAction, type ToastTone } from '@/components/ui/toast';

/**
 * El proveedor de avisos.
 *
 * Se monta una sola vez, en `app/layout.tsx`, dentro de `<Providers>`. Cualquier
 * pantalla pide un aviso con `useToast()`:
 *
 * ```tsx
 * const { toast } = useToast();
 * toast({ title: 'Lavado cobrado', description: 'CW-0142 · $12.00', tone: 'success' });
 * ```
 *
 * **Cuándo se usa:** para confirmar una mutación que salió bien y cuyo resultado
 * no se ve solo en la pantalla. Los errores se imprimen donde ocurren, con
 * `role=alert`; no se duplican en un aviso flotante.
 */
export interface ToastOptions {
  /** La frase corta que confirma qué pasó. */
  title: string;
  /** El detalle: el folio, el monto. Opcional. */
  description?: string;
  /** Verde para el bien, rojo para el mal. Por defecto `success`. */
  tone?: ToastTone;
  /** Acción opcional (p. ej. Deshacer). El aviso ya dura 5s. */
  action?: ToastAction;
}

interface ToastEntry extends ToastOptions {
  id: number;
  open: boolean;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** Cuánto se queda a la vista antes de irse solo. */
const TOAST_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<readonly ToastEntry[]>([]);
  const nextId = React.useRef(0);

  const toast = React.useCallback((options: ToastOptions) => {
    nextId.current += 1;
    const id = nextId.current;

    setEntries((current) => [...current, { ...options, id, open: true }]);
  }, []);

  const close = React.useCallback((id: number) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, open: false } : entry)),
    );
  }, []);

  // Radix anima la salida, así que el aviso se saca de la lista al terminar la
  // animación y no al cerrarse: si se quitara antes, se iría de golpe.
  const forget = React.useCallback((id: number) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = React.useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider duration={TOAST_DURATION_MS} swipeDirection="right">
        {children}

        {entries.map((entry) => (
          <ToastView
            key={entry.id}
            title={entry.title}
            description={entry.description}
            tone={entry.tone ?? 'success'}
            action={entry.action}
            open={entry.open}
            onOpenChange={(open) => {
              if (!open) close(entry.id);
            }}
            onAnimationEnd={() => {
              if (!entry.open) forget(entry.id);
            }}
          />
        ))}

        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

/** Pide un aviso desde cualquier pantalla. */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);

  if (context === null) {
    throw new Error('useToast must be used inside a <ToastProvider>.');
  }

  return context;
}
