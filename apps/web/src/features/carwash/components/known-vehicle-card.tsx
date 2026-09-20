'use client';

import type { LastWash, VehicleWithOwner } from '@elite/shared';

import { OriginLink } from '@/components/app-shell/origin-link';
import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { Reference } from '@/components/ui/reference';
import { Stamp } from '@/components/ui/stamp';
import { formatMoney } from '../cash-format';
import { lastWashDateLabel, lastWashPaymentLabel, lastWashWashersLabel } from '../last-wash';
import { referenceOf } from '../reference';
import { LastWashNote } from './last-wash-note';

export function KnownVehicleCard({
  vehicle,
  canManage = false,
  linkToTicket = false,
  onEdit,
  onDeselect,
}: {
  vehicle: VehicleWithOwner;
  canManage?: boolean;
  /**
   * El número del lavado anterior lleva a su ficha.
   *
   * Lo decide quien monta el formulario, no la ficha: en oficina se abre el
   * ticket, en la pista no, porque ahí no se navega a lavados ajenos (036). Va
   * como prop y no leyendo la URL para que la misma pieza sirva en los dos
   * sitios sin adivinar dónde está.
   */
  linkToTicket?: boolean;
  onEdit?: () => void;
  onDeselect: () => void;
}) {
  const makeAndColor = [vehicle.make, vehicle.color].filter(Boolean).join(' · ');

  return (
    <div className="rounded-row border-[1.5px] border-[color-mix(in_oklab,var(--go)_40%,var(--line))] bg-[color-mix(in_oklab,var(--go)_8%,var(--surface-2))] p-4 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <PlateChip plate={vehicle.plate} />
          <Stamp label="Ya lo conocemos" tone="queue" />
        </div>

        <div className="flex items-center gap-2">
          {canManage && onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Cambiar datos
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onDeselect}>
            No es este carro
          </Button>
        </div>
      </div>

      {/* La nota manda sobre los datos del carro: quien lo va a lavar tiene que
          verla antes que la marca y el color (052). Si no hay, no ocupa nada:
          la pieza devuelve `null` y el `gap` no deja hueco. */}
      <div className="mt-3.5 flex flex-col gap-3.5">
        <LastWashNote lastWash={vehicle.lastWash} />

        <div className="grid gap-3 sm:grid-cols-2 text-dense">
          <div>
            <span className="text-text-faint text-label block">Tipo de vehículo</span>
            <span className="text-text font-semibold">{vehicle.bodyType.name}</span>
          </div>

          <div>
            <span className="text-text-faint text-label block">Marca y color</span>
            <span className="text-text font-semibold">
              {makeAndColor !== '' ? makeAndColor : 'Sin especificar'}
            </span>
          </div>

          <div>
            <span className="text-text-faint text-label block">Responsable</span>
            <span className="text-text font-semibold">
              {vehicle.currentOwner
                ? `${vehicle.currentOwner.fullName}${vehicle.currentOwner.phone ? ` · ${vehicle.currentOwner.phone}` : ''}`
                : 'Sin responsable'}
            </span>
          </div>
        </div>

        <div className="w-full">
          <span className="text-text-faint text-label block">Último lavado</span>

          {vehicle.lastWash === null ? (
            <span className="text-text text-dense font-semibold">Primer lavado registrado</span>
          ) : (
            <LastWashBreakdown lastWash={vehicle.lastWash} linkToTicket={linkToTicket} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * La factura del lavado anterior, resumida (057).
 *
 * Hasta la 057 esto era una línea —«12 ago · Lavado + aspirado»— porque el
 * contrato solo traía el primer servicio, y en el mostrador la pregunta que
 * sigue a «¿ya vino?» es siempre «¿qué le hicieron y cuánto pagó?». Así que se
 * dibuja entero: cuándo, con qué número, quién lo lavó, cada línea con su
 * precio y el pie con el total y el método.
 *
 * Los precios salen tal cual del ticket cobrado: acá no se suma ni se
 * recalcula nada, ni siquiera el total.
 */
function LastWashBreakdown({
  lastWash,
  linkToTicket,
}: {
  lastWash: LastWash;
  linkToTicket: boolean;
}) {
  const number = referenceOf(lastWash.number);

  return (
    <div className="mt-1 flex w-full flex-col">
      <p className="text-text-dim text-dense flex flex-wrap items-center gap-x-1.5">
        <span>{lastWashDateLabel(lastWash.createdAt)}</span>
        <span aria-hidden>·</span>
        {linkToTicket ? (
          // Un `<Link>` suelto hacia una ficha lleva el origen, o volver caería
          // en «Lavados» y no en el alta que se estaba escribiendo (056). El
          // área tocable es la del sistema: en la bahía se abre con el dedo.
          <OriginLink
            href={`/carwash/${lastWash.id}`}
            aria-label={`Abrir el lavado #${number}`}
            className="min-h-touch rounded-control inline-flex items-center px-1 -mx-1"
          >
            <Reference value={number} active />
          </OriginLink>
        ) : (
          <Reference value={number} />
        )}
        <span aria-hidden>·</span>
        <span>{lastWashWashersLabel(lastWash)}</span>
      </p>

      {/* Las filas no se tocan —solo se leen—, así que no miden `--touch-min`:
          lo que suben es la letra, a `text-body`, que es la del detalle del
          lavado y la que se lee de pie. */}
      <ul className="mt-0.5 flex flex-col">
        {lastWash.items.map((item, index) => (
          <li
            key={`${item.serviceName}-${index}`}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="text-text text-body">{item.serviceName}</span>
            <span className="text-text text-body font-mono tabular-nums">
              {formatMoney(item.unitPrice)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-line-soft mt-1.5 flex items-baseline justify-between gap-3 border-t pt-1.5">
        <span className="text-text-faint text-label">Total</span>
        <span className="text-body flex items-baseline gap-1.5">
          <span className="text-text font-mono font-semibold tabular-nums">
            {formatMoney(lastWash.total)}
          </span>
          <span className="text-text-dim" aria-hidden>
            ·
          </span>
          <span className="text-text-dim">{lastWashPaymentLabel(lastWash)}</span>
        </span>
      </div>
    </div>
  );
}
