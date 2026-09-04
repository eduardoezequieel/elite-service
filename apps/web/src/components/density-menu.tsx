'use client';

import { Monitor, Smartphone, Tablet } from 'lucide-react';

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useDensity, type DensityPreference } from '@/components/density-provider';

const ICON_STROKE_WIDTH = 1.5;

const OPTIONS: { value: DensityPreference; label: string; Icon: typeof Monitor }[] = [
  { value: 'auto', label: 'Automática', Icon: Monitor },
  { value: 'mostrador', label: 'Mostrador', Icon: Tablet },
  { value: 'bahia', label: 'Bahía', Icon: Smartphone },
];

/** Opciones de densidad para meter en un menú que ya existe. */
export function DensityMenuItems() {
  const { mode, density, setDensity } = useDensity();
  const value: DensityPreference = mode === 'auto' ? 'auto' : density;

  return (
    <>
      <DropdownMenuLabel className="text-text-faint text-label">Densidad</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => setDensity(next as DensityPreference)}
      >
        {OPTIONS.map(({ value: option, label, Icon }) => (
          <DropdownMenuRadioItem key={option} value={option}>
            <Icon className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
