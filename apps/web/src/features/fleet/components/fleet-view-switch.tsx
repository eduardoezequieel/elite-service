import Link from 'next/link';

import { cn } from '@/lib/utils';

const LINKS = [
  { key: 'cars', href: '/rentals/fleet', label: 'Carros' },
  { key: 'earnings', href: '/rentals/fleet/earnings', label: '¿Cuánto dejó?' },
] as const;

/** Carros o cuánto dejó cada uno (110). Solo con `rentals.reports`. */
export function FleetViewSwitch({ current }: { current: 'cars' | 'earnings' }) {
  return (
    <div role="group" aria-label="Vista" className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const selected = link.key === current;

        return (
          <Link
            key={link.key}
            href={link.href}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'border-line bg-surface-2 inline-flex min-h-(--touch-min) items-center rounded-control border px-4 text-body font-semibold',
              '[[data-density=bahia]_&]:px-5',
              selected ? 'border-flame text-text' : 'text-text-dim',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
