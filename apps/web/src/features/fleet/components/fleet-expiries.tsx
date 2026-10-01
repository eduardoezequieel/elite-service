import { formatCivil } from '@/lib/civil-date';
import type { FleetExpiry } from '../vehicle-form';

/**
 * Los vencimientos a la vista de un carro (095). Nunca solo color: cada uno
 * dice qué vence y cuándo, y lo vencido lo dice con esa palabra.
 */
export function FleetExpiries({ expiries }: { expiries: readonly FleetExpiry[] }) {
  if (expiries.length === 0) return <span className="text-text-faint">—</span>;

  return (
    <span className="flex flex-col gap-0.5">
      {expiries.map((expiry) => (
        <span
          key={expiry.label}
          className={
            expiry.overdue
              ? 'text-danger-text text-dense font-semibold'
              : 'text-warn-text text-dense font-semibold'
          }
        >
          {expiry.label} {expiry.overdue ? 'vencido' : 'vence'} {formatCivil(expiry.date)}
        </span>
      ))}
    </span>
  );
}
