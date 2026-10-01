'use client';

import {
  AGREEMENT_STATUS_LABELS,
  PERMISSIONS,
  RENTAL_COVERAGE_LABELS,
  agreementVehicleLabel,
  lateNoticeText,
  moneyToCents,
  rentalWhenLabel,
  returnReminderText,
} from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';
import {
  ArrowLeftRight,
  CalendarPlus,
  KeyRound,
  MessageCircle,
  Pencil,
  RefreshCw,
  Undo2,
  XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailField } from '@/components/ui/detail-field';
import { PlateChip } from '@/components/ui/plate-chip';
import { Reference } from '@/components/ui/reference';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { AgreementBillingPanel } from '@/features/rental-billing/components/agreement-billing-panel';
import { AgreementDocumentsActions } from '@/features/rental-documents/components/agreement-documents-actions';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { formatCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import {
  PAYMENT_METHOD_LABELS,
  customerPhone,
  vehicleTitle,
  whatsappHref,
} from '../agreement-format';
import { nowField } from '../datetime';
import { useAgreement, useCheckinAgreement, useCheckoutAgreement } from '../hooks/use-agreements';
import { CancelDialog, ExtendDialog, ReassignDialog, SwapDialog } from './agreement-action-dialogs';
import { AgreementEditDialog } from './agreement-edit-dialog';
import { AgreementStatusStamp } from './agreement-status-stamp';
import { InspectionSummary } from './inspection-summary';
import { InspectionWizard } from './inspection-wizard';
import { AmountRow } from './rental-fields';

const ICON = 'size-icon text-text-faint';
/** Si los ajustes no llegaron, la gracia del prototipo. */
const DEFAULT_GRACE_HOURS = 1;

type Dialog = 'checkout' | 'checkin' | 'extend' | 'swap' | 'reassign' | 'edit' | 'cancel';

/** El detalle de una renta (096). Lee la renta de la consulta, nunca de una copia (051). */
export function AgreementDetailScreen({ id }: { id: string }) {
  const agreement = useAgreement(id);

  if (agreement.isPending) return <DetailSkeleton label="Cargando la renta" />;

  if (agreement.error !== null || agreement.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {agreement.error?.message ?? 'No se pudo cargar la renta.'}
      </p>
    );
  }

  return <AgreementDetail agreement={agreement.data} />;
}

function AgreementDetail({ agreement }: { agreement: RentalAgreement }) {
  const { can, canAny } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const status = agreement.derivedStatus;
  const open = agreement.status === 'RESERVED' || agreement.status === 'IN_PROGRESS';
  const inProgress = agreement.status === 'IN_PROGRESS';
  const hasPayments = moneyToCents(agreement.totals.paid) > 0;
  const phone = customerPhone(agreement.customer);
  const vehicleName = agreementVehicleLabel(agreement.vehicle);

  const whatsapp =
    status === 'LATE'
      ? {
          label: 'Avisar atraso',
          text: lateNoticeText({
            customerName: agreement.customer.fullName,
            vehicleName,
            plannedReturnAt: agreement.plannedReturnAt,
          }),
        }
      : open
        ? {
            label: 'Recordar regreso',
            text: returnReminderText({
              customerName: agreement.customer.fullName,
              vehicleName,
              plannedReturnAt: agreement.plannedReturnAt,
              returnLocation: agreement.returnLocation,
            }),
          }
        : null;

  const action = (key: Dialog, label: string, icon: ReactNode) => (
    <Button type="button" variant="outline" onClick={() => setDialog(key)}>
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={
          agreement.contractNumber === null ? 'Reserva' : `Contrato ${agreement.contractNumber}`
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {agreement.contractNumber === null ? null : (
              <Reference value={agreement.contractNumber} />
            )}
            <AgreementStatusStamp status={status} size="lg" />
            <span>{agreement.customer.fullName}</span>
          </span>
        }
      >
        <AgreementDocumentsActions agreement={agreement} />
        {canManage && agreement.status === 'RESERVED' ? (
          <Button type="button" onClick={() => setDialog('checkout')}>
            <KeyRound className="size-icon" strokeWidth={1.5} aria-hidden />
            Entregar
          </Button>
        ) : null}
        {canManage && inProgress ? (
          <Button type="button" onClick={() => setDialog('checkin')}>
            <Undo2 className="size-icon" strokeWidth={1.5} aria-hidden />
            Recibir
          </Button>
        ) : null}
      </ScreenHeader>

      {canManage && open ? (
        <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-1">
          {inProgress
            ? action(
                'extend',
                'Extender',
                <CalendarPlus className={ICON} strokeWidth={1.5} aria-hidden />,
              )
            : null}
          {inProgress
            ? action(
                'swap',
                'Cambiar carro',
                <ArrowLeftRight className={ICON} strokeWidth={1.5} aria-hidden />,
              )
            : null}
          {agreement.status === 'RESERVED'
            ? action(
                'reassign',
                'Reasignar',
                <RefreshCw className={ICON} strokeWidth={1.5} aria-hidden />,
              )
            : null}
          {action('edit', 'Editar', <Pencil className={ICON} strokeWidth={1.5} aria-hidden />)}
          {whatsapp === null ? null : (
            <Button asChild variant="outline">
              <a
                href={whatsappHref(phone, whatsapp.text)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className={ICON} strokeWidth={1.5} aria-hidden />
                {whatsapp.label}
              </a>
            </Button>
          )}
          {agreement.status === 'RESERVED' || (inProgress && !hasPayments) ? (
            <Button type="button" variant="destructive" onClick={() => setDialog('cancel')}>
              <XCircle className="size-icon" strokeWidth={1.5} aria-hidden />
              Cancelar
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <PartiesCard agreement={agreement} />
          <DatesCard agreement={agreement} />
          <InspectionSummary title="Inspección de salida" inspection={agreement.pickupInspection} />
          {agreement.status === 'RESERVED' ? null : (
            <InspectionSummary
              title="Inspección de regreso"
              inspection={agreement.returnInspection}
              compareWith={agreement.pickupInspection}
            />
          )}
          <ExtensionsCard agreement={agreement} />
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
          <TotalsCard agreement={agreement} />
          <AgreementBillingPanel agreement={agreement} />
          <GuaranteeCard agreement={agreement} />
        </aside>
      </div>

      <AgreementDialogs
        agreement={agreement}
        dialog={dialog}
        graceHours={settings.data?.graceHours ?? DEFAULT_GRACE_HOURS}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function AgreementDialogs({
  agreement,
  dialog,
  graceHours,
  onClose,
}: {
  agreement: RentalAgreement;
  dialog: Dialog | null;
  graceHours: number;
  onClose: () => void;
}) {
  const checkout = useCheckoutAgreement();
  const checkin = useCheckinAgreement();
  const { toast } = useToast();
  const context = {
    vehicleOdometerKm: agreement.vehicle.odometerKm,
    pickupInspection: agreement.pickupInspection,
    pickupOdometerKm: agreement.pickupOdometerKm,
    deposit: agreement.deposit,
    depositMethod: agreement.depositMethod,
    depositHeld: agreement.depositHeld,
  };
  const vehicle = {
    label: `${vehicleTitle(agreement.vehicle)} · ${agreement.vehicle.plate ?? 'sin placa'}`,
    freeKmPerDay: agreement.vehicle.freeKmPerDay,
    extraKmPrice: agreement.vehicle.extraKmPrice,
  };
  const close = () => {
    checkout.reset();
    checkin.reset();
    onClose();
  };

  if (dialog === 'checkout') {
    return (
      <InspectionWizard
        mode="checkout"
        context={context}
        vehicle={vehicle}
        initialAt={nowField()}
        estimatedTotal={agreement.totals.total}
        pending={checkout.isPending}
        error={checkout.error?.message ?? null}
        onClose={close}
        onSubmit={(input) =>
          checkout.mutate(
            { id: agreement.id, input },
            {
              onSuccess: (saved) => {
                toast({
                  title: 'Carro entregado',
                  description:
                    saved.contractNumber === null ? undefined : `Contrato ${saved.contractNumber}`,
                });
                close();
              },
            },
          )
        }
      />
    );
  }
  if (dialog === 'checkin') {
    return (
      <InspectionWizard
        mode="checkin"
        agreement={agreement}
        graceHours={graceHours}
        context={context}
        vehicle={vehicle}
        initialAt={nowField()}
        pending={checkin.isPending}
        error={checkin.error?.message ?? null}
        onClose={close}
        onSubmit={(input) =>
          checkin.mutate(
            { id: agreement.id, input },
            {
              onSuccess: () => {
                toast({ title: 'Carro recibido', description: agreement.customer.fullName });
                close();
              },
            },
          )
        }
      />
    );
  }
  if (dialog === 'extend') return <ExtendDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'swap') return <SwapDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'reassign') return <ReassignDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'cancel') return <CancelDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'edit') return <AgreementEditDialog agreement={agreement} onClose={onClose} />;
  return null;
}

function DetailCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading aside={aside}>{title}</CardSectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [[data-density=bahia]_&]:xl:grid-cols-2">
        {children}
      </div>
    </Card>
  );
}

function PartiesCard({ agreement }: { agreement: RentalAgreement }) {
  const { can } = usePermissions();
  const { customer, vehicle } = agreement;
  const linkClass = 'text-text font-semibold underline-offset-4 hover:underline';

  return (
    <DetailCard title="Cliente y carro">
      <DetailField label="Cliente">
        {can(PERMISSIONS.renters.actions.read.key) ? (
          <OriginLink href={`/rentals/customers/${customer.id}`} className={linkClass}>
            {customer.fullName}
          </OriginLink>
        ) : (
          customer.fullName
        )}
        <span className="text-text-dim block text-dense">
          {[customer.documentId, customerPhone(customer)].filter(Boolean).join(' · ') || '—'}
        </span>
      </DetailField>
      <DetailField label="Carro">
        <span className="flex flex-wrap items-center gap-2">
          {vehicle.plate === null ? null : <PlateChip plate={vehicle.plate} size="sm" />}
          {can(PERMISSIONS.fleet.actions.read.key) ? (
            <OriginLink href={`/rentals/fleet/${vehicle.id}`} className={linkClass}>
              {vehicleTitle(vehicle)}
            </OriginLink>
          ) : (
            vehicleTitle(vehicle)
          )}
        </span>
      </DetailField>
      <DetailField label="Conductor adicional">
        {agreement.additionalDriver === null
          ? 'Ninguno'
          : [agreement.additionalDriver.name, agreement.additionalDriver.licenseNumber]
              .filter(Boolean)
              .join(' · ')}
      </DetailField>
      {agreement.previousAgreementId === null ? null : (
        <DetailField label="Viene de un cambio de carro">
          <OriginLink
            href={`/rentals/agreements/${agreement.previousAgreementId}`}
            className={linkClass}
          >
            Ver la renta anterior
          </OriginLink>
          {agreement.swapReason ? (
            <span className="text-text-dim block text-dense">{agreement.swapReason}</span>
          ) : null}
        </DetailField>
      )}
      {agreement.nextAgreementId === null ? null : (
        <DetailField label="Siguió con otro carro">
          <OriginLink
            href={`/rentals/agreements/${agreement.nextAgreementId}`}
            className={linkClass}
          >
            Ver la renta siguiente
          </OriginLink>
        </DetailField>
      )}
      {agreement.cancelReason === null ? null : (
        <DetailField label="Cancelada">
          {agreement.cancelReason}
          {agreement.cancelledAt === null ? null : (
            <span className="text-text-dim block text-dense">
              {rentalWhenLabel(agreement.cancelledAt)}
            </span>
          )}
        </DetailField>
      )}
      {agreement.notes === null ? null : (
        <DetailField label="Observaciones">
          <span className="whitespace-pre-line">{agreement.notes}</span>
        </DetailField>
      )}
    </DetailCard>
  );
}

function DatesCard({ agreement }: { agreement: RentalAgreement }) {
  const when = (iso: string | null) => (iso === null ? '—' : rentalWhenLabel(iso));

  return (
    <DetailCard
      title="Fechas"
      aside={`${agreement.billableDays} ${agreement.billableDays === 1 ? 'día' : 'días'}`}
    >
      <DetailField label="Sale (planificado)">
        {when(agreement.plannedPickupAt)}
        <span className="text-text-dim block text-dense">{agreement.pickupLocation}</span>
      </DetailField>
      <DetailField label="Regresa (planificado)">
        <span
          className={
            agreement.derivedStatus === 'LATE' ? 'text-danger-text font-semibold' : undefined
          }
        >
          {when(agreement.plannedReturnAt)}
          {agreement.derivedStatus === 'LATE' ? ` · ${AGREEMENT_STATUS_LABELS.LATE}` : ''}
        </span>
        <span className="text-text-dim block text-dense">{agreement.returnLocation}</span>
      </DetailField>
      <DetailField label="Salió">
        {when(agreement.actualPickupAt)}
        {agreement.pickupOdometerKm === null ? null : (
          <span className="text-text-dim block text-dense tabular-nums">
            {agreement.pickupOdometerKm} km
          </span>
        )}
      </DetailField>
      <DetailField label="Regresó">
        {when(agreement.actualReturnAt)}
        {agreement.returnOdometerKm === null ? null : (
          <span className="text-text-dim block text-dense tabular-nums">
            {agreement.returnOdometerKm} km
          </span>
        )}
      </DetailField>
    </DetailCard>
  );
}

function ExtensionsCard({ agreement }: { agreement: RentalAgreement }) {
  if (agreement.extensions.length === 0) return null;

  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading aside={String(agreement.extensions.length)}>
        Extensiones
      </CardSectionHeading>
      <ul className="flex flex-col gap-2">
        {agreement.extensions.map((extension) => (
          <li key={extension.id} className="text-body flex flex-col">
            <span>
              {rentalWhenLabel(extension.previousReturnAt)} →{' '}
              {rentalWhenLabel(extension.newReturnAt)}
              <span className="text-text-dim">
                {' '}
                · {extension.addedDays >= 0 ? '+' : ''}
                {extension.addedDays} {Math.abs(extension.addedDays) === 1 ? 'día' : 'días'}
              </span>
            </span>
            {extension.note ? (
              <span className="text-text-dim text-dense">{extension.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TotalsCard({ agreement }: { agreement: RentalAgreement }) {
  const { totals } = agreement;
  const owes = moneyToCents(totals.balance) > 0;

  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading>Cuenta</CardSectionHeading>
      <AmountRow
        label={`${agreement.billableDays} × (${formatMoney(agreement.dailyRate)} + CDW ${formatMoney(agreement.cdwPerDay)})`}
        value={formatMoney(totals.rental)}
      />
      {moneyToCents(agreement.extraCharges) > 0 ? (
        <AmountRow
          label={agreement.extraChargesNote ?? 'Cargos extra'}
          value={formatMoney(agreement.extraCharges)}
        />
      ) : null}
      {moneyToCents(agreement.extraKmCharge) > 0 ? (
        <AmountRow label="Km extra" value={formatMoney(agreement.extraKmCharge)} />
      ) : null}
      {moneyToCents(agreement.discount) > 0 ? (
        <AmountRow label="Descuento" value={`-${formatMoney(agreement.discount)}`} />
      ) : null}
      <div className="border-line-soft flex flex-col gap-1.5 border-t pt-2.5">
        <AmountRow label="Total" value={formatMoney(totals.total)} strong />
        <AmountRow label="Pagado" value={formatMoney(totals.paid)} />
        <AmountRow
          label="Saldo"
          value={formatMoney(totals.balance)}
          strong
          tone={owes ? 'danger' : 'go'}
        />
      </div>
      {agreement.payments.length === 0 ? null : (
        <ul className="border-line-soft flex flex-col gap-1 border-t pt-2.5">
          {agreement.payments.map((payment) => (
            <li key={payment.id} className="text-dense flex items-baseline justify-between gap-3">
              <span className="text-text-dim">
                {rentalWhenLabel(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method]}
              </span>
              <span
                className={
                  payment.voidedAt === null
                    ? 'font-mono tabular-nums'
                    : 'is-ruled-out font-mono tabular-nums'
                }
              >
                {formatMoney(payment.amount)}
                {payment.voidedAt === null ? null : <span className="sr-only"> (anulado)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GuaranteeCard({ agreement }: { agreement: RentalAgreement }) {
  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading>Garantía</CardSectionHeading>
      <AmountRow
        label={`Depósito${agreement.depositMethod ? ` · ${PAYMENT_METHOD_LABELS[agreement.depositMethod]}` : ''}`}
        value={formatMoney(agreement.deposit)}
      />
      {agreement.depositReturnedAmount === null ? null : (
        <AmountRow label="Devuelto" value={formatMoney(agreement.depositReturnedAmount)} />
      )}
      <AmountRow label="En garantía" value={formatMoney(agreement.depositHeld)} strong />
      {agreement.depositTransferredToId === null ? null : (
        <OriginLink
          href={`/rentals/agreements/${agreement.depositTransferredToId}`}
          className="text-text-dim text-dense underline-offset-4 hover:underline"
        >
          El depósito pasó a la renta siguiente
        </OriginLink>
      )}
      {agreement.depositReturnNote ? (
        <p className="text-text-dim text-dense">{agreement.depositReturnNote}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <DetailField label="Cobertura">{RENTAL_COVERAGE_LABELS[agreement.coverage]}</DetailField>
        <DetailField label="Deducible">
          <span className="font-mono tabular-nums">{formatMoney(agreement.deductible)}</span>
        </DetailField>
        {agreement.cardLast4 ? (
          <DetailField label="Tarjeta">
            <span className="font-mono">•••• {agreement.cardLast4}</span>
          </DetailField>
        ) : null}
        {agreement.authorizationCode ? (
          <DetailField label="Autorización">
            <span className="font-mono">{agreement.authorizationCode}</span>
            {agreement.authorizationAmount ? (
              <span className="text-text-dim block text-dense">
                {formatMoney(agreement.authorizationAmount)}
                {agreement.authorizationDate
                  ? ` · ${formatCivil(agreement.authorizationDate)}`
                  : ''}
              </span>
            ) : null}
          </DetailField>
        ) : null}
      </div>
    </Card>
  );
}
