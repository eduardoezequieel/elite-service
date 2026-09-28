'use client';

import type { ComponentProps } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Los campos de los diálogos del inventario: etiqueta adentro de la caja, error
 * afuera y debajo (convención 9). Aceptan lo que devuelve `register()`.
 */

export function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) return null;

  return (
    <p className="text-danger-text text-label" role="alert">
      {message}
    </p>
  );
}

export function TextField({
  id,
  label,
  error,
  mono = false,
  className,
  ...props
}: ComponentProps<'input'> & { id: string; label: string; error?: string; mono?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <FieldBox>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          autoComplete="off"
          className={mono ? 'font-mono' : undefined}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </FieldBox>
      <FieldError message={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  className,
  ...props
}: ComponentProps<'textarea'> & { id: string; label: string; error?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <FieldBox>
        <Label htmlFor={id}>{label}</Label>
        <Textarea id={id} rows={3} aria-invalid={error ? true : undefined} {...props} />
      </FieldBox>
      <FieldError message={error} />
    </div>
  );
}

/**
 * Un campo que usa Escape para sí —una búsqueda escrita, una lista abierta— se
 * marca con `data-keeps-escape`, y ahí Escape no cierra el diálogo (091). Va en
 * el `onEscapeKeyDown` del `DialogContent`.
 */
export function keepLocalEscape(event: KeyboardEvent): void {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest('[data-keeps-escape]')) event.preventDefault();
}

/** El `details.itemId` de un error de una línea de entrada o entrega (091 RN-2). */
export function detailsItemId(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const itemId = (details as Record<string, unknown>).itemId;

  return typeof itemId === 'string' ? itemId : null;
}

/** El mensaje general del formulario, al pie. */
export function FormAlert({ message }: { message: string | null }) {
  if (message === null) return null;

  return (
    <p className="text-danger-text text-body" role="alert">
      {message}
    </p>
  );
}
