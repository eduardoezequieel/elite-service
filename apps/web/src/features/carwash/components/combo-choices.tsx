'use client';

import type { ComboOption } from '@elite/shared';
import { useFormContext, useWatch } from 'react-hook-form';

import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form';
import { Stamp } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';
import { intakeComboChoices, toggleCombo, type ComboChoice } from '../combo-lines';
import type { TicketFormInput, TicketFormOutput } from '../ticket-draft';

/**
 * Las tarjetas de combos (104): nombre, precio, lo que trae y, abajo, el chip
 * «Agregado» o el ámbar «Sin <producto>» (deshabilitada). Se tocan enteras:
 * `aria-pressed` dice si está elegida, y el chip lo dice con palabra.
 */
export function ComboChoices({
  choices,
  value,
  onChange,
  disabled = false,
}: {
  choices: readonly ComboChoice[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map((choice) => {
        const picked = value.includes(choice.id);
        const blocked = choice.missing !== null && !picked;

        return (
          <button
            key={choice.id}
            type="button"
            aria-pressed={picked}
            disabled={disabled || blocked}
            onClick={() => onChange(toggleCombo(value, choice.id))}
            className={cn(
              'bg-surface-2 min-h-row flex cursor-pointer flex-col items-stretch gap-1.5 rounded-row border-(length:--selectable-border) px-(--field-px) py-3 text-left',
              'transition-colors duration-(--duration-state) ease-standard',
              'disabled:cursor-not-allowed',
              picked ? 'border-flame' : 'border-line hover:border-text-faint',
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-text font-semibold [[data-density=bahia]_&]:text-title">
                {choice.name}
              </span>
              <span className="text-text shrink-0 font-mono font-bold tabular-nums">
                {choice.price === null ? '—' : `$${choice.price}`}
              </span>
            </span>
            <span className="text-text-dim text-dense">{choice.detail}</span>
            {choice.missing !== null ? (
              <Stamp tone="amber" label={choice.missing} />
            ) : picked ? (
              <Stamp tone="green" label="Agregado" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * «Combos» del alta (104): los de hoy, con el precio del tipo de carro elegido.
 * Sin combos hoy, la tarjeta no se dibuja.
 */
export function CombosCard({ options }: { options: readonly ComboOption[] }) {
  const { control } = useFormContext<TicketFormInput, unknown, TicketFormOutput>();
  const bodyTypeId = useWatch({ control, name: 'bodyTypeId' });

  if (options.length === 0) return null;

  return (
    <Card className="min-w-0 gap-0 px-card">
      <fieldset className="min-w-0">
        <legend className="text-title text-text">Combos</legend>
        <div className="mt-4">
          <FormField
            control={control}
            name="combos"
            render={({ field }) => (
              <ComboChoices
                choices={intakeComboChoices(options, bodyTypeId)}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </fieldset>
    </Card>
  );
}
