'use client';

import { Search } from 'lucide-react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Piezas comunes de los tabs Rentas e Historial (117).
 */

/** En `bahia` la lista va siempre en tarjetas, como las demás listas táctiles. */
export const BAHIA_CARDS =
  '[[data-density=bahia]_&]:[&_[data-layout=table]]:!hidden [[data-density=bahia]_&]:[&_[data-layout=cards]]:!flex';

/** En `bahia` y en tablet, los filtros se reparten a lo ancho y bajan de fila si no caben. */
export const FILTER_CHIP_SPREAD =
  'justify-center max-md:flex-[1_1_140px] [[data-density=bahia]_&]:flex-[1_1_140px]';

/** El buscador, primero y a todo el ancho. */
export function AgreementSearch({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <FieldBox>
      <Label htmlFor={id}>Buscar</Label>
      <div className="flex items-center gap-2">
        <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
        <Input
          id={id}
          type="search"
          className="min-w-0 flex-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
    </FieldBox>
  );
}
