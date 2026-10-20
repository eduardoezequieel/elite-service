import type { FleetAlert } from '@elite/shared';
import { AlertTriangle, FileText, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Los avisos de un carro (110, 121): rojo con triángulo si ya venció (`DUE`),
 * ámbar si viene (`WARN`), con documento o llave según el tipo. Lo usan la
 * tarjeta y la cabecera de la ficha.
 */
export function FleetAlertList({
  alerts,
  className,
}: {
  alerts: readonly FleetAlert[];
  className?: string;
}) {
  if (alerts.length === 0) return null;

  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {alerts.map((alert) => {
        const Icon =
          alert.level === 'DUE' ? AlertTriangle : alert.kind === 'DOCUMENT' ? FileText : Wrench;

        return (
          <li
            key={`${alert.kind}:${alert.text}`}
            className={cn(
              'text-label [[data-density=bahia]_&]:text-dense flex items-start gap-1.5',
              alert.level === 'DUE' ? 'text-danger-text' : 'text-warn-text',
            )}
          >
            <Icon className="mt-px size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            {alert.text}
          </li>
        );
      })}
    </ul>
  );
}
