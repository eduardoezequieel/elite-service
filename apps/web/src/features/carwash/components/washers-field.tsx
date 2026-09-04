'use client';

import { cn } from '@/lib/utils';
import { givenName } from '../washers';

export interface WasherOption {
  id: string;
  fullName: string;
}

/**
 * Chips de quiénes lavaron. Sin `<select>`: se tocan, miden al menos
 * `--touch-min` (44×44 en bahía) y el elegido se marca con filete y tinte, no
 * solo con color.
 */
export function WashersField({
  employees,
  value,
  onChange,
  lockedIds = [],
  allowEmpty = false,
  disabled = false,
}: {
  employees: readonly WasherOption[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  /** En el alta de pista, quien abre no se puede sacar. */
  lockedIds?: readonly string[];
  /** Oficina admite conjunto vacío («Oficina»). */
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  const locked = new Set(lockedIds);

  const byId = new Map(employees.map((employee) => [employee.id, employee]));

  for (const id of lockedIds) {
    if (!byId.has(id)) {
      byId.set(id, { id, fullName: id });
    }
  }

  function toggle(id: string): void {
    if (disabled || locked.has(id)) return;

    const next = selected.has(id) ? value.filter((current) => current !== id) : [...value, id];

    if (!allowEmpty && next.length === 0) return;

    onChange(next);
  }

  function chooseOffice(): void {
    if (disabled || locked.size > 0) return;
    onChange([...lockedIds]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allowEmpty ? (
        <WasherChip
          label="Oficina"
          selected={value.length === 0}
          disabled={disabled}
          onSelect={chooseOffice}
        />
      ) : null}
      {[...byId.values()].map((employee) => (
        <WasherChip
          key={employee.id}
          label={givenName(employee.fullName)}
          selected={selected.has(employee.id)}
          locked={locked.has(employee.id)}
          disabled={disabled}
          onSelect={() => toggle(employee.id)}
        />
      ))}
    </div>
  );
}

function WasherChip({
  label,
  selected,
  locked = false,
  disabled = false,
  onSelect,
}: {
  label: string;
  selected: boolean;
  locked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-disabled={disabled || locked}
      disabled={disabled}
      className={cn(
        'min-h-touch min-w-touch inline-flex cursor-pointer items-center justify-center rounded-row border-[1.5px] px-3.5 py-2 text-body font-semibold',
        'transition-colors duration-(--duration-state) ease-standard',
        selected
          ? 'border-flame bg-[color-mix(in_oklab,var(--flame)_9%,transparent)] text-text'
          : 'border-line bg-surface-2 text-text hover:border-text-faint',
        locked && 'cursor-default',
        disabled && 'cursor-default opacity-70',
      )}
    >
      {label}
    </button>
  );
}
