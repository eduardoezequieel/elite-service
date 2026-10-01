'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useWorkshopText } from '../hooks/use-fleet-maintenance';
import { whatsappUrl } from '../maintenance-view';

/**
 * «Lista para el taller» (099): el texto con los pendientes por carro, para
 * mandarlo por WhatsApp o copiarlo. El número lo elige quien lo manda.
 */
export function WorkshopTextDialog({ onClose }: { onClose: () => void }) {
  const workshop = useWorkshopText(true);
  const { toast } = useToast();
  const [copyError, setCopyError] = useState<string | null>(null);
  const text = workshop.data?.text ?? '';

  async function copy() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Lista copiada', description: 'Pegala en el chat del taller.' });
    } catch {
      setCopyError('No se pudo copiar. Seleccioná el texto y copialo a mano.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Lista para el taller</DialogTitle>
          <DialogDescription>
            Lo vencido y lo próximo de cada carro, listo para mandar.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {workshop.isPending ? (
            <p className="text-text-dim text-body">Armando la lista…</p>
          ) : workshop.error ? (
            <p className="text-danger-text text-body" role="alert">
              {workshop.error.message}
            </p>
          ) : (
            <pre
              aria-label="Texto para el taller"
              className="border-line-soft bg-surface-2 text-text max-h-[50vh] overflow-auto rounded-control border p-4 font-mono text-dense whitespace-pre-wrap [[data-density=bahia]_&]:text-body"
            >
              {text}
            </pre>
          )}
          {copyError === null ? null : (
            <p className="text-danger-text text-body" role="alert">
              {copyError}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={text === ''}
            onClick={() => void copy()}
          >
            <Copy className="size-icon" strokeWidth={1.5} aria-hidden />
            Copiar
          </Button>
          <a
            href={text === '' ? undefined : whatsappUrl(text)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={text === ''}
            className={cn(buttonVariants(), text === '' && 'pointer-events-none opacity-50')}
          >
            <MessageCircle className="size-icon" strokeWidth={1.5} aria-hidden />
            Abrir WhatsApp
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
