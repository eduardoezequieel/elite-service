'use client';

import { FLEET_CATEGORY_LABELS, PERMISSIONS, moneyToCents } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';
import { Lock, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailField } from '@/components/ui/detail-field';
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
import { FleetVehicleSectionDialog, NoteLine } from './fleet-vehicle-section-dialog';

const DEFAULT_DAYS_ALERT = 7;

const money = (amount: string | null) => (amount === null ? '—' : formatMoney(amount));
const date = (civil: string | null) => (civil === null ? '—' : formatCivil(civil));
const km = (value: number) => `${value.toLocaleString('es-SV')} km`;
const cents = (amount: string | null) => (amount === null ? 0 : moneyToCents(amount));

/** Un dato que ocupa la fila entera de la tarjeta. */
const SPAN = 'sm:col-span-2';

function Faint({ children }: { children: ReactNode }) {
  return <span className="text-text-faint">{children}</span>;
}

/**
 * Una tarjeta de la ficha (103): título, su «Editar» si se puede, y los datos
 * en dos columnas (una bajo 640px).
 */
function DetailCard({
  title,
  onEdit,
  children,
}: {
  title: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading
        className="items-center"
        aside={
          onEdit === undefined ? undefined : (
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />
              Editar
              <span className="sr-only"> {typeof title === 'string' ? title : ''}</span>
            </Button>
          )
        }
      >
        {title}
      </CardSectionHeading>
      {children}
    </Card>
  );
}

function Fields({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/** Una tarjeta de costo para quien no tiene `rentals.reports` (RN-1): bajo llave. */
function LockedCard({ title }: { title: string }) {
  return (
    <DetailCard
      title={
        <span className="inline-flex items-center gap-2">
          <Lock className="text-text-faint size-4" strokeWidth={1.5} aria-hidden />
          {title}
        </span>
      }
    >
      <p className="text-text-dim text-body">Solo lo ve quien tiene permiso de rentabilidad.</p>
    </DetailCard>
  );
}

/**
 * La pestaña Ficha de un carro (095, en tarjetas desde la 103): identificación,
 * tarifas, compra, costos fijos, seguro y notas, cada una con su diálogo. Lee
 * el mismo carro que el marco: la consulta es una sola en caché.
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
      {/* Dos columnas en escritorio; una bajo 900px y en `bahia`. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <IdentityCard vehicle={vehicle} onEdit={editFor('identity')} />
        <RatesCard vehicle={vehicle} onEdit={editFor('rates')} />
        {vehicle.costsHidden ? (
          <>
            <LockedCard title={FLEET_VEHICLE_CARD_TITLES.purchase} />
            <LockedCard title={FLEET_VEHICLE_CARD_TITLES.fixed} />
          </>
        ) : (
          <>
            <PurchaseCard vehicle={vehicle} today={today} onEdit={editFor('purchase')} />
            <FixedCard vehicle={vehicle} onEdit={editFor('fixed')} />
          </>
        )}
        <DocumentsCard
          vehicle={vehicle}
          today={today}
          daysAlert={daysAlert}
          onEdit={editFor('documents')}
        />
        <DetailCard title={FLEET_VEHICLE_CARD_TITLES.notes} onEdit={editFor('notes')}>
          <p
            className={cn(
              'text-body whitespace-pre-line',
              vehicle.notes === null && 'text-text-faint',
            )}
          >
            {vehicle.notes ?? 'Sin notas.'}
          </p>
        </DetailCard>
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

interface CardProps {
  vehicle: FleetVehicle;
  onEdit: (() => void) | undefined;
}

function IdentityCard({ vehicle, onEdit }: CardProps) {
  return (
    <DetailCard title={FLEET_VEHICLE_CARD_TITLES.identity} onEdit={onEdit}>
      <Fields>
        <DetailField label="Marca y modelo">
          {vehicle.make} {vehicle.model}
        </DetailField>
        <DetailField label="Año">{vehicle.year ?? '—'}</DetailField>
        <DetailField label="Placa">
          {vehicle.plate === null ? (
            <Faint>Sin placa</Faint>
          ) : (
            <PlateChip plate={vehicle.plate} size="sm" />
          )}
        </DetailField>
        <DetailField label="Color">{vehicle.color ?? '—'}</DetailField>
        <DetailField label="Tipo">{FLEET_CATEGORY_LABELS[vehicle.category]}</DetailField>
        <DetailField label="Kilometraje">
          <span className="font-mono">{km(vehicle.odometerKm)}</span>
          <span className="text-text-faint text-dense block">
            Lo actualizan la entrega y la recepción
          </span>
        </DetailField>
      </Fields>
    </DetailCard>
  );
}

function RatesCard({ vehicle, onEdit }: CardProps) {
  const rate = (field: 'weeklyRate' | 'monthlyRate') => {
    const fallback = rateFallback(vehicle, field);

    return fallback === null ? (
      <span className="font-mono">{money(vehicle[field])}</span>
    ) : (
      <Faint>{fallback}</Faint>
    );
  };
  const free = hasFreeKm(vehicle);

  return (
    <DetailCard title={FLEET_VEHICLE_CARD_TITLES.rates} onEdit={onEdit}>
      <Fields>
        <div className={SPAN}>
          <DetailField label="Tarifa diaria">
            <span className="font-display text-headline font-bold italic">
              {money(vehicle.dailyRate)}
            </span>
          </DetailField>
        </div>
        <DetailField label="Por día, 7+ días">{rate('weeklyRate')}</DetailField>
        <DetailField label="Por día, 30+ días">{rate('monthlyRate')}</DetailField>
        <DetailField label="Km libres">
          {free || vehicle.freeKmPerDay === null
            ? 'Ilimitado'
            : `${km(vehicle.freeKmPerDay)} por día`}
        </DetailField>
        <DetailField label="Km adicional">
          {free ? (
            <Faint>No aplica</Faint>
          ) : (
            <>
              <span className="font-mono">{money(vehicle.extraKmPrice)}</span> por km
            </>
          )}
        </DetailField>
      </Fields>
    </DetailCard>
  );
}

function PurchaseCard({ vehicle, today, onEdit }: CardProps & { today: string }) {
  const progress = financingProgress(vehicle, today);

  return (
    <DetailCard title={FLEET_VEHICLE_CARD_TITLES.purchase} onEdit={onEdit}>
      <Fields>
        <DetailField label="Precio de compra">
          <span className="font-mono">{money(vehicle.purchasePrice)}</span>
        </DetailField>
        <DetailField label="Fecha de compra">{date(vehicle.purchasedAt)}</DetailField>
        {vehicle.financed ? (
          <>
            <DetailField label="Prima">
              <span className="font-mono">{money(vehicle.downPayment)}</span>
            </DetailField>
            <DetailField label="Cuota mensual">
              <span className="font-mono">{money(vehicle.installment)}</span>
              {vehicle.installmentIncludesExtras ? (
                <span className="text-text-faint text-dense block">Incluye seguro y GPS</span>
              ) : null}
            </DetailField>
            {progress === null ? (
              <DetailField label="Plazo">
                {vehicle.termMonths === null ? '—' : `${vehicle.termMonths} meses`}
              </DetailField>
            ) : (
              <div className={SPAN}>
                <DetailField label="Avance">
                  <div
                    className="bg-surface-3 my-1.5 h-1.5 overflow-hidden rounded-full"
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
                  <span className="text-dense">
                    Cuota <b className="font-mono">{progress.paid}</b> de{' '}
                    <b className="font-mono">{progress.term}</b> · faltan {progress.left} · termina
                    en {progress.endsIn}
                  </span>
                </DetailField>
              </div>
            )}
          </>
        ) : (
          <DetailField label="Forma de pago">Al contado</DetailField>
        )}
      </Fields>
    </DetailCard>
  );
}

function FixedCard({ vehicle, onEdit }: CardProps) {
  const included = extrasInInstallment(vehicle);
  const total =
    (included ? 0 : cents(vehicle.insuranceMonthly) + cents(vehicle.gpsMonthly)) +
    cents(vehicle.otherFixedMonthly);

  return (
    <DetailCard title={FLEET_VEHICLE_CARD_TITLES.fixed} onEdit={onEdit}>
      {included ? (
        <NoteLine>
          La cuota del financiamiento ya trae el seguro y el GPS. Acá solo van los que se pagan
          aparte.
        </NoteLine>
      ) : null}
      <Fields>
        {included ? null : (
          <>
            <DetailField label="Seguro">
              <span className="font-mono">{money(vehicle.insuranceMonthly)}</span>
            </DetailField>
            <DetailField label="GPS">
              <span className="font-mono">{money(vehicle.gpsMonthly)}</span>
            </DetailField>
          </>
        )}
        <DetailField label="Otros fijos">
          <span className="font-mono">{money(vehicle.otherFixedMonthly)}</span>
        </DetailField>
        <DetailField label="Total al mes">
          <span className="font-mono font-semibold">{formatCents(total)}</span>
        </DetailField>
      </Fields>
    </DetailCard>
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
    <span className="flex flex-wrap items-center gap-2">
      {formatCivil(civil)}
      {mark === null ? null : <Stamp label={mark.label} tone={mark.tone} />}
    </span>
  );
}

function DocumentsCard({
  vehicle,
  today,
  daysAlert,
  onEdit,
}: CardProps & { today: string; daysAlert: number }) {
  return (
    <DetailCard title={FLEET_VEHICLE_CARD_TITLES.documents} onEdit={onEdit}>
      <Fields>
        <DetailField label="Aseguradora">{vehicle.insurer ?? '—'}</DetailField>
        <DetailField label="Póliza">
          {vehicle.policyNumber === null ? (
            '—'
          ) : (
            <span className="font-mono">{vehicle.policyNumber}</span>
          )}
        </DetailField>
        <DetailField label="Vence el seguro">
          <Expiry date={vehicle.insuranceExpiresAt} today={today} daysAlert={daysAlert} />
        </DetailField>
        <DetailField label="Vence la tarjeta de circulación">
          <Expiry date={vehicle.registrationExpiresAt} today={today} daysAlert={daysAlert} />
        </DetailField>
      </Fields>
    </DetailCard>
  );
}
