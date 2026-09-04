'use client';

import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Diálogo modal: una de las dos capas que flotan de verdad sobre el documento,
 * por eso lleva la sombra única del sistema. Habla el lenguaje de tarjeta —radio
 * `--radius-card` (14px), filete `--line-soft`, fondo `--surface`—.
 *
 * Bajo 900px deja de ser una ventana centrada y **sube desde abajo** como una
 * hoja: pegado al borde inferior, a todo el ancho y sin redondear el pie. La
 * animación de entrada la elige `globals.css` por el mismo corte.
 */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-50 bg-bg/70 ease-standard', className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'border-line-soft bg-surface text-text shadow-elite fixed z-50 flex flex-col overflow-hidden ease-standard outline-none',
          // Táctil (<900px): la hoja que sube desde abajo, pegada al pie.
          'inset-x-0 bottom-0 mx-auto w-full max-h-[calc(100svh-3rem)] rounded-card rounded-b-none border sm:max-w-lg',
          // Escritorio: la ventana centrada de siempre.
          'md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:mx-0 md:max-h-[calc(100svh-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-b-card',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="text-text-faint hover:text-text absolute top-4 right-4 z-10 inline-flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center rounded-control transition-colors duration-(--duration-state) ease-standard disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon"
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'border-line-soft flex shrink-0 flex-col gap-1.5 border-b p-plate pr-12 text-left',
        className,
      )}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('flex-1 min-h-0 overflow-y-auto p-plate space-y-4', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'border-line-soft flex shrink-0 flex-col-reverse gap-2 border-t p-plate sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="secondary">Cerrar</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-headline text-text', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-body text-text-dim', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
