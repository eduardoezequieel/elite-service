import type { ToastOptions } from '@/components/toast-provider';

/**
 * Aviso de «Marcar listo» con Deshacer de 5s (el proveedor ya dura eso).
 * Deshacer llama a `reopen` del mismo lavado.
 */
export function readyUndoToast(reference: number, onUndo: () => void): ToastOptions {
  return {
    title: `Lavado #${reference} marcado listo`,
    action: { label: 'Deshacer', onClick: onUndo },
  };
}
