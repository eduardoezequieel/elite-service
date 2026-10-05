'use client';

import { PERMISSIONS, type TabDetail, type TabLine, type TabPayment } from '@elite/shared';
import { Banknote, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { METHOD_LABELS } from '@/features/carwash/cash-format';
import { timeLabel } from '@/lib/civil-date';
import { formatCents, toCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useTab } from '../hooks/use-tabs';
import { newSaleHref, quantityMark, tabTimeline, type TimelineDay } from '../tab-format';
import { ChargeTabDialog } from './charge-tab-dialog';
import { HolderKindStamp, TabClosedStamp } from './tab-stamps';
import { VoidTabLineDialog } from './void-tab-line-dialog';

/**
 * `/sales/tabs/[id]`: una cuenta (105).
 *
 * Cabecera con el nombre, el tipo y el número; «Anotar productos» y «Cobrar»
 * si sigue abierta. Debajo la tarjeta Debe / Anotado / Abonado y la línea de
 * tiempo por día: cada producto con su hora y su «Quitar», lo quitado tachado
 * con su motivo, y los abonos en verde.
 *
 * Los diálogos guardan el id de la línea, nunca una copia (051): la cuenta se
 * relee de la consulta en cada render.
 */
export function TabDetailScreen({ id }: { id: string }) {
  const tab = useTab(id);
  const { can } = usePermissions();
  const canCharge = can(PERMISSIONS.carwash.actions.charge.key);
  const [charging, setCharging] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  if (tab.data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <ScreenHeader title="Cuenta" />
        {tab.error ? (
          <p className="text-danger-text text-body" role="alert">
            {tab.error.message}
          </p>
        ) : (
          <p className="text-text-faint text-body" role="status">
            Cargando…
          </p>
        )}
      </div>
    );
  }

  const data = tab.data;
  const open = data.status === 'OPEN';
  const balanceCents = toCents(data.balance) ?? 0;
  const days = tabTimeline(data);
  const voiding = data.lines.find((line) => line.id === voidingId) ?? null;
  const canVoid = canCharge && open;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        className="mb-1"
        title={data.holder.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2.5">
            <HolderKindStamp kind={data.holder.kind} />
            <span className="text-text-faint font-mono text-dense">{data.number}</span>
            <TabClosedStamp tab={data} />
          </span>
        }
      >
        {open && canCharge ? (
          <>
            <Button asChild variant="outline">
              <Link href={newSaleHref({ kind: 'tab', tabId: data.id })}>
                <Plus aria-hidden strokeWidth={1.5} />
                Anotar productos
              </Link>
            </Button>
            <Button type="button" disabled={balanceCents <= 0} onClick={() => setCharging(true)}>
              <Banknote aria-hidden strokeWidth={1.5} />
              Cobrar
            </Button>
          </>
        ) : null}
      </ScreenHeader>

      <div className="flex w-full max-w-205 flex-col gap-5">
        <BalanceCard tab={data} />

        {days.length === 0 ? (
          <EmptyState title="Vacía" />
        ) : (
          days.map((day) => (
            <TimelineDayBlock
              key={day.day}
              day={day}
              onVoid={canVoid ? (line) => setVoidingId(line.id) : null}
            />
          ))
        )}
      </div>

      {charging && open ? <ChargeTabDialog tab={data} onOpenChange={setCharging} /> : null}
      {voiding === null ? null : (
        <VoidTabLineDialog
          tabId={data.id}
          line={voiding}
          onOpenChange={(next) => {
            if (!next) setVoidingId(null);
          }}
        />
      )}
    </div>
  );
}

/** Debe, Anotado y Abonado. El saldo va en llama mientras debe. */
function BalanceCard({ tab }: { tab: TabDetail }) {
  const owes = (toCents(tab.balance) ?? 0) > 0;
  const secondary =
    'font-display text-headline text-text-dim italic tabular-nums [[data-density=bahia]_&]:text-(length:--stat-size)';

  return (
    <Card className="divide-line-soft grid grid-cols-[1.3fr_1fr_1fr] gap-0 divide-x py-0">
      <div className="flex min-w-0 flex-col px-4 py-4 sm:px-5.5">
        <span className="text-text-faint text-label">
          {tab.status === 'OPEN' ? 'Debe' : 'Saldo'}
        </span>
        <span
          className={cn(
            'text-figure tabular-nums [[data-density=bahia]_&]:text-(length:--stat-size-lg)',
            owes ? 'text-flame-text' : 'text-text',
          )}
        >
          ${tab.balance}
        </span>
      </div>
      <div className="flex min-w-0 flex-col justify-end px-4 py-4 sm:px-5.5">
        <span className="text-text-faint text-label">Anotado</span>
        <span className={secondary}>${tab.total}</span>
      </div>
      <div className="flex min-w-0 flex-col justify-end px-4 py-4 sm:px-5.5">
        <span className="text-text-faint text-label">Abonado</span>
        <span className={secondary}>${tab.paid}</span>
      </div>
    </Card>
  );
}

/** Un día de la línea de tiempo: el título, lo anotado ese día y sus filas. */
function TimelineDayBlock({
  day,
  onVoid,
}: {
  day: TimelineDay;
  onVoid: ((line: TabLine) => void) | null;
}) {
  return (
    <section aria-label={day.label} className="flex flex-col gap-1.5">
      <div className="text-text-faint flex items-baseline justify-between gap-3 px-1 pb-0.5 text-label [[data-density=bahia]_&]:text-dense">
        <span>{day.label}</span>
        {day.totalCents > 0 ? (
          <span className="font-mono tabular-nums">{formatCents(day.totalCents)}</span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {day.entries.map((entry) =>
          entry.kind === 'line' ? (
            <LineEntry
              key={entry.line.id}
              line={entry.line}
              onVoid={onVoid !== null && entry.line.isVoidable ? () => onVoid(entry.line) : null}
            />
          ) : (
            <PaymentEntry key={entry.payment.id} payment={entry.payment} />
          ),
        )}
      </ul>
    </section>
  );
}

/**
 * La fila de la línea de tiempo: hora, qué, cuánto y la acción. La hora nunca
 * se parte; bajo 640px sube a su propio renglón y la acción baja al pie. Las
 * columnas de monto y acción tienen ancho mínimo para que los montos alineen
 * de una fila a otra.
 */
const ENTRY_CLASS = cn(
  'grid min-h-row grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 rounded-row border px-3.5 py-2',
  'sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]',
  '[[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:py-3',
);
const TIME_CLASS =
  'text-text-faint col-span-2 text-dense whitespace-nowrap tabular-nums sm:col-span-1 sm:w-20 [[data-density=bahia]_&]:text-body [[data-density=bahia]_&]:sm:w-24';
const AMOUNT_CLASS =
  'min-w-16 text-right font-mono font-semibold tabular-nums [[data-density=bahia]_&]:text-title';
const ACTION_CLASS =
  'col-span-2 flex justify-start max-sm:empty:hidden sm:col-span-1 sm:min-w-22 sm:justify-end';
const WHAT_CLASS = 'text-text font-semibold [[data-density=bahia]_&]:text-title';

function LineEntry({ line, onVoid }: { line: TabLine; onVoid: (() => void) | null }) {
  const voided = line.voided !== null;
  const mark = quantityMark(line.quantity);

  return (
    <li className={cn(ENTRY_CLASS, 'border-line-soft bg-surface')}>
      <span className={TIME_CLASS}>{timeLabel(line.createdAt)}</span>
      <span className="flex min-w-0 flex-col">
        <span className={cn(WHAT_CLASS, voided && 'is-ruled-out text-text-faint')}>
          {line.name}
          {mark === null ? null : <span className="text-text-faint font-normal"> {mark}</span>}
        </span>
        {line.voided === null ? null : (
          <span className="text-text-faint text-dense">{line.voided.reason}</span>
        )}
      </span>
      <span className={cn(AMOUNT_CLASS, voided ? 'is-ruled-out text-text-faint' : 'text-text')}>
        ${line.total}
      </span>
      <span className={ACTION_CLASS}>
        {voided ? (
          <Stamp tone="neutral" label="Quitado" />
        ) : onVoid === null ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={onVoid}>
            Quitar
          </Button>
        )}
      </span>
    </li>
  );
}

function PaymentEntry({ payment }: { payment: TabPayment }) {
  return (
    <li
      className={cn(
        ENTRY_CLASS,
        'border-[color-mix(in_srgb,var(--go)_25%,var(--line-soft))] bg-[color-mix(in_srgb,var(--go)_6%,var(--surface))]',
      )}
    >
      <span className={TIME_CLASS}>{timeLabel(payment.paidAt)}</span>
      <span className={WHAT_CLASS}>
        Abono <span className="text-text-faint font-normal">· {METHOD_LABELS[payment.method]}</span>
      </span>
      <span className={cn(AMOUNT_CLASS, 'text-go-text')}>−${payment.amount}</span>
      <span className={ACTION_CLASS} />
    </li>
  );
}
