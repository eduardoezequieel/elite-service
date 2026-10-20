'use client';

import { FLEET_CATEGORY_LABELS, PERMISSIONS, moneyToCents } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';
import { Info, Lock, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { formatCivil, todayCivil } from '@/lib/civil-date';
import { formatCents, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useFleetVehicle } from '../hooks/use-fleet';
import {
  FLEET_COST_CARDS,
  FLEET_VEHICLE_CARD_TITLES,
  expiryMark,
  extrasInInstallment,
  financingProgress,
  hasFreeKm,
  rateFallback,
  type FleetVehicleCard,
} from '../vehicle-form';
import { FleetVehicleSectionDialog } from './fleet-vehicle-section-dialog';

const DEFAULT_DAYS_ALERT = 7;

const money = (amount: string | null) => (amount === null ? '—' : formatMoney(amount));
const km = (value: number) => value.toLocaleString('es-SV');
const cents = (amount: string | null) => (amount === null ? 0 : moneyToCents(amount));

function Faint({ children }: { children: ReactNode }) {
  return <span className="text-text-faint">{children}</span>;
}

function PerDay() {
  return <span className="text-text-faint">/día</span>;
}

/**
 * Una sección de la ficha: título chico en versales, su «Editar» si se puede,
 * y debajo las filas.
 */
function Section({
  title,
  onEdit,
  children,
}: {
  title: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-line-soft bg-surface min-w-0 rounded-card border px-card pt-1.5 pb-2.5">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <h2 className="text-text-dim text-dense flex items-center gap-2 font-semibold tracking-[0.04em] uppercase">
          {title}
        </h2>
        {onEdit === undefined ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />
            Editar
            <span className="sr-only"> {typeof title === 'string' ? title : ''}</span>
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Una fila: etiqueta a la izquierda, valor a la derecha (y una aclaración debajo). */
function Row({
  label,
  hint,
  total = false,
  children,
}: {
  label: string;
  hint?: ReactNode;
  total?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-t py-2.5 [[data-density=bahia]_&]:py-3.5',
        total ? 'border-line' : 'border-line-soft',
      )}
    >
      <dt className={cn('shrink-0', total ? 'text-text font-semibold' : 'text-text-dim')}>
        {label}
      </dt>
      <dd
        className={cn(
          'flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right',
          total && 'font-bold',
        )}
      >
        {children}
        {hint === undefined ? null : (
          <span className="text-text-faint text-dense basis-full">{hint}</span>
        )}
      </dd>
    </div>
  );
}

/** Una sección de costo para quien no tiene `rentals.reports` (RN-1): bajo llave. */
function LockedSection({ title }: { title: string }) {
  return (
    <Section
      title={
        <>
          <Lock className="text-text-faint size-4" strokeWidth={1.5} aria-hidden />
          {title}
        </>
      }
    >
      <p className="border-line-soft text-text-dim text-body border-t pt-3 pb-2">
        Solo lo ve quien tiene permiso de rentabilidad.
      </p>
    </Section>
  );
}

/**
 * La pestaña Ficha de un carro (095, en tarjetas desde la 103, en filas desde
 * `docs/prototype/fleet-vehicle-sheet.html`, sin franja de resumen desde la
 * 121): las secciones, cada una con su diálogo. Lee el mismo carro que el
 * marco: la consulta es una sola en caché.
 */
export function FleetVehicleDetail({ id }: { id: string }) {
  const vehicle = useFleetVehicle(id);

  if (vehicle.data === undefined) return null;

  return <Detail vehicle={vehicle.data} />;
}

function Detail({ vehicle }: { vehicle: FleetVehicle }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const settings = useRentalSettings();
  const daysAlert = settings.data?.daysAlert ?? DEFAULT_DAYS_ALERT;
  const today = todayCivil();
  const [editing, setEditing] = useState<FleetVehicleCard | null>(null);

  const editFor = (card: FleetVehicleCard) =>
    canManage && !(vehicle.costsHidden && FLEET_COST_CARDS.includes(card))
      ? () => setEditing(card)
      : undefined;

  return (
    <>
      {/* Dos columnas en escritorio: lo de rentar a la izquierda, papeles y plata a la
          derecha. Una bajo 900px y en `bahia`. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <div className="grid min-w-0 content-start gap-4">
          <RatesSection vehicle={vehicle} onEdit={editFor('rates')} />
          <CarSection vehicle={vehicle} onEdit={editFor('identity')} />
          <Section title={FLEET_VEHICLE_CARD_TITLES.notes} onEdit={editFor('notes')}>
            <p
              className={cn(
                'border-line-soft text-body border-t pt-3 pb-2 whitespace-pre-line',
                vehicle.notes === null && 'text-text-faint',
              )}
            >
              {vehicle.notes ?? 'Sin notas.'}
            </p>
          </Section>
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <DocumentsSection
            vehicle={vehicle}
            today={today}
            daysAlert={daysAlert}
            onEdit={editFor('documents')}
          />
          {vehicle.costsHidden ? (
            <>
              <LockedSection title={FLEET_VEHICLE_CARD_TITLES.purchase} />
              <LockedSection title={FLEET_VEHICLE_CARD_TITLES.fixed} />
            </>
          ) : (
            <>
              <PurchaseSection vehicle={vehicle} today={today} onEdit={editFor('purchase')} />
              <FixedSection vehicle={vehicle} onEdit={editFor('fixed')} />
            </>
          )}
        </div>
      </div>

      {editing === null ? null : (
        <FleetVehicleSectionDialog
          vehicle={vehicle}
          card={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

interface SectionProps {
  vehicle: FleetVehicle;
  onEdit: (() => void) | undefined;
}

function RatesSection({ vehicle, onEdit }: SectionProps) {
  const rate = (field: 'weeklyRate' | 'monthlyRate') => {
    const fallback = rateFallback(vehicle, field);

    return fallback === null ? (
      <span>
        <span className="font-mono">{money(vehicle[field])}</span>
        <PerDay />
      </span>
    ) : (
      <Faint>{fallback.replace(' que la diaria', '')}</Faint>
    );
  };
  const free = hasFreeKm(vehicle);

  return (
    <Section title={FLEET_VEHICLE_CARD_TITLES.rates} onEdit={onEdit}>
      <dl>
        <Row label="De 1 a 6 días">
          <span>
            <span className="font-mono">{money(vehicle.dailyRate)}</span>
            <PerDay />
          </span>
        </Row>
        <Row label="De 7 a 29 días">{rate('weeklyRate')}</Row>
        <Row label="30 días o más">{rate('monthlyRate')}</Row>
        <Row
          label="Km incluidos"
          hint={free ? undefined : `Cada km de más: ${money(vehicle.extraKmPrice)}`}
        >
          {free || vehicle.freeKmPerDay === null ? (
            'Sin límite'
          ) : (
            <span>
              <span className="font-mono">{km(vehicle.freeKmPerDay)}</span> km
              <PerDay />
            </span>
          )}
        </Row>
      </dl>
    </Section>
  );
}

/** Marca y modelo ya están en el título: aquí no se repiten. El kilometraje es de solo lectura. */
function CarSection({ vehicle, onEdit }: SectionProps) {
  return (
    <Section title={FLEET_VEHICLE_CARD_TITLES.identity} onEdit={onEdit}>
      <dl>
        <Row label="Placa">
          {vehicle.plate === null ? (
            <Faint>Sin placa</Faint>
          ) : (
            <PlateChip plate={vehicle.plate} size="sm" />
          )}
        </Row>
        <Row label="Tipo">{FLEET_CATEGORY_LABELS[vehicle.category]}</Row>
        <Row label="Año">{vehicle.year ?? <Faint>Sin dato</Faint>}</Row>
        <Row label="Color">{vehicle.color ?? <Faint>Sin dato</Faint>}</Row>
        <Row label="Kilometraje">
          <span>
            <span className="font-mono">{km(vehicle.odometerKm)}</span> km
          </span>
        </Row>
      </dl>
    </Section>
  );
}

function Expiry({
  date: civil,
  today,
  daysAlert,
}: {
  date: string | null;
  today: string;
  daysAlert: number;
}) {
  if (civil === null) return <Faint>Sin fecha</Faint>;

  const mark = expiryMark(civil, today, daysAlert);

  return (
    <>
      {formatCivil(civil)}
      <Stamp label={mark?.label ?? 'Al día'} tone={mark?.tone ?? 'green'} />
    </>
  );
}

function DocumentsSection({
  vehicle,
  today,
  daysAlert,
  onEdit,
}: SectionProps & { today: string; daysAlert: number }) {
  return (
    <Section title={FLEET_VEHICLE_CARD_TITLES.documents} onEdit={onEdit}>
      <dl>
        <Row label="Seguro vence">
          <Expiry date={vehicle.insuranceExpiresAt} today={today} daysAlert={daysAlert} />
        </Row>
        <Row label="Tarjeta vence">
          <Expiry date={vehicle.registrationExpiresAt} today={today} daysAlert={daysAlert} />
        </Row>
        <Row label="Aseguradora">{vehicle.insurer ?? <Faint>Sin dato</Faint>}</Row>
        <Row label="Póliza">
          {vehicle.policyNumber === null ? (
            <Faint>Sin dato</Faint>
          ) : (
            <span className="font-mono">{vehicle.policyNumber}</span>
          )}
        </Row>
      </dl>
    </Section>
  );
}

function PurchaseSection({ vehicle, today, onEdit }: SectionProps & { today: string }) {
  const progress = financingProgress(vehicle, today);

  return (
    <Section title={FLEET_VEHICLE_CARD_TITLES.purchase} onEdit={onEdit}>
      <dl>
        <Row label="Precio">
          {vehicle.purchasePrice === null ? (
            <Faint>Sin dato</Faint>
          ) : (
            <span className="font-mono">{money(vehicle.purchasePrice)}</span>
          )}
        </Row>
        <Row label="Fecha">
          {vehicle.purchasedAt === null ? (
            <Faint>Sin dato</Faint>
          ) : (
            formatCivil(vehicle.purchasedAt)
          )}
        </Row>
        {vehicle.financed ? (
          <>
            <Row label="Prima">
              <span className="font-mono">{money(vehicle.downPayment)}</span>
            </Row>
            <Row
              label="Cuota"
              hint={vehicle.installmentIncludesExtras ? 'Trae el seguro y el GPS' : undefined}
            >
              <span>
                <span className="font-mono">{money(vehicle.installment)}</span>
                <Faint>/mes</Faint>
              </span>
            </Row>
            {progress === null ? (
              <Row label="Plazo">
                {vehicle.termMonths === null ? (
                  <Faint>Sin dato</Faint>
                ) : (
                  `${vehicle.termMonths} meses`
                )}
              </Row>
            ) : (
              <div className="border-line-soft border-t py-2.5 [[data-density=bahia]_&]:py-3.5">
                <div className="mb-1.5 flex justify-between gap-3">
                  <span className="text-text-dim">Pagado</span>
                  <span>
                    <b className="font-mono">{progress.paid}</b> de{' '}
                    <span className="font-mono">{progress.term}</span> cuotas
                  </span>
                </div>
                <div
                  className="bg-surface-3 mt-0.5 mb-2 h-1.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.term}
                  aria-valuenow={progress.paid}
                  aria-label="Cuotas pagadas"
                >
                  <span
                    className="gradient-action block h-full"
                    style={{ width: `${(progress.paid / progress.term) * 100}%` }}
                  />
                </div>
                <p className="text-text-faint text-dense">
                  Faltan {progress.left} · termina en {progress.endsIn}
                </p>
              </div>
            )}
          </>
        ) : (
          <Row label="Pago">
            {vehicle.purchasePrice === null ? <Faint>Sin dato</Faint> : 'Al contado'}
          </Row>
        )}
      </dl>
    </Section>
  );
}

function FixedSection({ vehicle, onEdit }: SectionProps) {
  const included = extrasInInstallment(vehicle);
  const total =
    (included ? 0 : cents(vehicle.insuranceMonthly) + cents(vehicle.gpsMonthly)) +
    cents(vehicle.otherFixedMonthly);
  const amount = (value: string | null) =>
    value === null ? (
      <span className="text-text-faint font-mono">{formatCents(0)}</span>
    ) : (
      <span className="font-mono">{money(value)}</span>
    );

  return (
    <Section title={FLEET_VEHICLE_CARD_TITLES.fixed} onEdit={onEdit}>
      {included ? (
        <p className="bg-surface-2 text-text-dim text-dense mb-2.5 flex gap-2 rounded-control px-3 py-2.5">
          <Info className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          El seguro y el GPS ya van en la cuota.
        </p>
      ) : null}
      <dl>
        {included ? null : (
          <>
            <Row label="Seguro">{amount(vehicle.insuranceMonthly)}</Row>
            <Row label="GPS">{amount(vehicle.gpsMonthly)}</Row>
          </>
        )}
        <Row label="Otros">{amount(vehicle.otherFixedMonthly)}</Row>
        <Row label="Total" total>
          <span className="font-mono">{formatCents(total)}</span>
        </Row>
      </dl>
    </Section>
  );
}
