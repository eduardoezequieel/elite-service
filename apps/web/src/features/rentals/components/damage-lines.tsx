'use client';

import type { InspectionZone } from '@elite/shared';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DraftDamageLine } from '../inspection-draft';

/**
 * spec 126, RN-2 — Las líneas de daño al recibir: pieza + monto, como el
 * `checkinForm` de Riveras. Una línea con zona se ilumina cuando esa pieza
 * está bajo el dedo en el visor, y al revés: apuntar a la línea avisa su zona.
 */
export function DamageLines({
  lines,
  activeZone,
  onChange,
  onRemove,
  onAdd,
  onPointZone,
}: {
  lines: readonly DraftDamageLine[];
  activeZone: InspectionZone | null;
  onChange: (id: string, changes: Partial<Pick<DraftDamageLine, 'part' | 'amount'>>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onPointZone: (zone: InspectionZone | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body font-semibold">Daños</p>
      {lines.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {lines.map((line, position) => (
            <li
              key={line.id}
              onPointerEnter={() => onPointZone(line.zone)}
              onPointerLeave={() => onPointZone(null)}
              onFocus={() => onPointZone(line.zone)}
              className={cn(
                'bg-surface-2 grid grid-cols-[minmax(0,1fr)_minmax(0,var(--amount-w))_var(--touch-min)] items-center gap-2 rounded-row border p-1.5 transition-colors duration-(--duration-state) ease-standard',
                '[[data-density=bahia]_&]:p-2',
                line.zone !== null && line.zone === activeZone
                  ? 'border-danger'
                  : 'border-line-soft',
              )}
            >
              <Input
                aria-label={`Pieza ${position + 1}`}
                placeholder="Pieza"
                value={line.part}
                className="bg-surface"
                onChange={(event) => onChange(line.id, { part: event.target.value })}
              />
              <Input
                aria-label={`Monto ${position + 1}`}
                placeholder="$0.00"
                inputMode="decimal"
                value={line.amount}
                className="bg-surface text-right font-mono"
                onChange={(event) => onChange(line.id, { amount: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-(--touch-min)"
                aria-label={`Quitar ${line.part === '' ? `el daño ${position + 1}` : line.part}`}
                onClick={() => onRemove(line.id)}
              >
                <X className="size-icon" strokeWidth={1.5} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="ghost" className="self-start" onClick={onAdd}>
        <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
        Daño
      </Button>
    </div>
  );
}
