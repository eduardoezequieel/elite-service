'use client';

import * as React from 'react';
import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * El aviso flotante.
 *
 * Es **aditivo**: confirma que una mutación salió bien —cobrado, guardado,
 * creado, marcado listo— cuando la pantalla no puede mostrarlo sola. Los errores
 * siguen imprimiéndose donde ocurren, con `role=alert`, y no se duplican acá.
 *
 * Verde para el bien, rojo para el mal, **siempre con icono y con la palabra**:
 * el color nunca es la única señal.
 *
 * Abajo a la derecha en escritorio; arriba y centrado en móvil, por encima de la
 * barra inferior.
 */
export type ToastTone = 'success' | 'error';

const TONE = {
  success: { Icon: CheckCircle2, color: 'text-go-text' },
  error: { Icon: TriangleAlert, color: 'text-danger-text' },
} as const satisfies Record<ToastTone, { Icon: typeof CheckCircle2; color: string }>;

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastViewProps extends React.ComponentProps<typeof ToastPrimitive.Root> {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: ToastAction;
}

export function ToastView({
  title,
  description,
  tone = 'success',
  action,
  className,
  ...props
}: ToastViewProps) {
  const { Icon, color } = TONE[tone];

  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-tone={tone}
      className={cn(
        'border-line-soft bg-surface text-text shadow-elite pointer-events-auto flex items-start gap-3 rounded-row border p-3.5',
        className,
      )}
      {...props}
    >
      <Icon
        className={cn('size-icon mt-0.5 shrink-0', color)}
        strokeWidth={ICON_STROKE_WIDTH}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <ToastPrimitive.Title className="text-body font-semibold">{title}</ToastPrimitive.Title>
        {description === undefined ? null : (
          <ToastPrimitive.Description className="text-text-dim mt-0.5 text-dense">
            {description}
          </ToastPrimitive.Description>
        )}
        {action === undefined ? null : (
          <ToastPrimitive.Action altText={action.label} asChild>
            <button
              type="button"
              className="text-flame-text mt-1 inline-flex min-h-(--touch-min) items-center text-dense font-semibold"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          </ToastPrimitive.Action>
        )}
      </div>

      <ToastPrimitive.Close
        aria-label="Cerrar el aviso"
        className="text-text-faint hover:text-text -m-1 inline-flex min-h-(--touch-min) min-w-(--touch-min) shrink-0 items-center justify-center rounded-control transition-colors duration-(--duration-state) ease-standard"
      >
        <X className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/** La región donde aterrizan los avisos. La monta `<ToastProvider>`, una vez. */
export function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'pointer-events-none fixed top-3 left-1/2 z-100 flex w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2 outline-none',
        'md:top-auto md:bottom-5 md:left-auto md:right-5 md:translate-x-0',
        className,
      )}
      {...props}
    />
  );
}

export { ToastPrimitive };
