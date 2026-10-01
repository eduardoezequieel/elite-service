'use client';

import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PRINT_SETS, sheetCount, type PrintOptions, type PrintSets } from '../print-layout';

const SET_LABELS: Record<PrintSets, string> = {
  both: 'Original y copia del cliente',
  original: 'Solo el original',
};

/** «4 hojas de papel». */
export function sheetCountLabel(options: PrintOptions): string {
  const count = sheetCount(options);

  return `${count} ${count === 1 ? 'hoja' : 'hojas'} de papel`;
}

/**
 * Las opciones del juego impreso, como ítems de un menú: los juegos, la doble
 * cara y la hoja de inspección. Elegir no cierra el menú, así se ve la cuenta
 * de hojas antes de abrir la impresión.
 */
export function PrintOptionsItems({
  options,
  onChange,
}: {
  options: PrintOptions;
  onChange: (next: PrintOptions) => void;
}) {
  const keepOpen = (event: Event) => event.preventDefault();

  return (
    <>
      <DropdownMenuLabel className="text-label text-text-faint">Juegos</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={options.sets}
        onValueChange={(value) => {
          const sets = PRINT_SETS.find((option) => option === value);
          if (sets !== undefined) onChange({ ...options, sets });
        }}
      >
        {PRINT_SETS.map((sets) => (
          <DropdownMenuRadioItem key={sets} value={sets} onSelect={keepOpen}>
            {SET_LABELS[sets]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        checked={options.includeInspection}
        onSelect={keepOpen}
        onCheckedChange={(checked) => onChange({ ...options, includeInspection: checked === true })}
      >
        Incluir hoja de inspección
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={options.duplex}
        onSelect={keepOpen}
        onCheckedChange={(checked) => onChange({ ...options, duplex: checked === true })}
      >
        Doble cara
      </DropdownMenuCheckboxItem>
      <p className="text-text-dim text-dense px-2.5 py-1.5" role="status">
        Tamaño carta · {sheetCountLabel(options)}
      </p>
    </>
  );
}
