'use client';

import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { DOCUMENT_KIND_LABELS, type DocumentKind } from '../quick-renter';

const KINDS = Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[];

/**
 * El documento con su tipo en la misma caja, como `PhoneField`: el tipo
 * (DUI o Pasaporte) a la izquierda y el número a la derecha.
 */
export function DocumentField({
  id,
  label,
  kind,
  value,
  onKindChange,
  onValueChange,
  className,
}: {
  id: string;
  label: string;
  kind: DocumentKind;
  value: string;
  onKindChange: (kind: DocumentKind) => void;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDui = kind === 'DUI';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <FieldBox data-open={open ? 'true' : undefined} className="data-[open=true]:border-flame">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Tipo: ${DOCUMENT_KIND_LABELS[kind]}`}
                className="text-text hover:bg-surface -my-1 -ml-1.5 flex min-h-touch shrink-0 items-center gap-1.5 rounded-control px-1.5 text-body transition-colors duration-(--duration-state) ease-standard"
              >
                {DOCUMENT_KIND_LABELS[kind]}
                <ChevronDown
                  aria-hidden
                  strokeWidth={1.5}
                  className={cn(
                    'text-text-faint size-icon transition-transform duration-(--duration-state) ease-standard',
                    open && 'rotate-180',
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                inputRef.current?.focus({ preventScroll: true });
              }}
            >
              <DropdownMenuRadioGroup
                value={kind}
                onValueChange={(next) => {
                  if (next !== kind) onKindChange(next as DocumentKind);
                }}
              >
                {KINDS.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {DOCUMENT_KIND_LABELS[option]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span aria-hidden className="bg-line h-5 w-px shrink-0" />
          <Input
            ref={inputRef}
            id={id}
            autoComplete="off"
            className="font-mono"
            inputMode={isDui ? 'numeric' : 'text'}
            placeholder={isDui ? '00000000-0' : 'Número de pasaporte'}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        </div>
      </FieldBox>
    </div>
  );
}
