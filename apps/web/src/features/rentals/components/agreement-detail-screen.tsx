'use client';

import { PERMISSIONS, moneyToCents, rentalWhenLabel } from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';
import { ArrowLeftRight, CalendarPlus, MoreHorizontal, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailField } from '@/components/ui/detail-field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlateChip } from '@/components/ui/plate-chip';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { depositStatus } from '@/features/rental-billing/billing-format';
import { DepositReturnDialog } from '@/features/rental-billing/components/deposit-return-dialog';
import { FineDialog } from '@/features/rental-billing/components/fine-dialog';
import { PaymentDialog } from '@/features/rental-billing/components/payment-dialog';
import { agreementPrintHref } from '@/features/rental-documents/components/agreement-documents-actions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { replaceParam } from '@/lib/list-params';
import { formatMoneyCompact } from '@/lib/money';
import { saleReturnPhrase, vehicleTitle } from '../agreement-format';
import { useAgreement, useAssignContractNumber } from '../hooks/use-agreements';
import { AgreementAccount } from './agreement-account';
import { CancelDialog, ExtendDialog } from './agreement-action-dialogs';
import { AgreementEditDialog } from './agreement-edit-dialog';
import { AgreementStatusStamp } from './agreement-status-stamp';
import { HandoverWizard } from './handover-wizard';
import { InspectionSummary } from './inspection-summary';
import { RenterHistory } from './renter-history';
import { SwapWizard } from './swap-wizard';

/** Si los ajustes no llegaron, la gracia del prototipo. */
const DEFAULT_GRACE_HOURS = 1;

type Dialog =
  'checkout' | 'checkin' | 'extend' | 'swap' | 'fine' | 'edit' | 'cancel' | 'pay' | 'deposit';

/**
 * El detalle de una renta (108, 127 RN-1): en curso, Recibir de primario y
 * Extender, Multa, Cambiar carro y Cobrar a la vista; en «⋯» solo Editar,
 * Cancelar e imprimir. Cada botón se esconde sin su permiso.
 */
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
  const router = useRouter();
  const { can, canAny } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);
  const canReadRenters = can(PERMISSIONS.renters.actions.read.key);
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const assign = useAssignContractNumber();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const openedAction = useRef(false);
  const status = agreement.derivedStatus;
  const owes = moneyToCents(agreement.totals.balance) > 0;
  const held = depositStatus(agreement).kind === 'held';
  const inProgress = agreement.status === 'IN_PROGRESS';
  /** En curso o atrasada (RN-1). */
  const live = status === 'IN_PROGRESS' || status === 'LATE';
  const canCancel =
    agreement.status === 'RESERVED' || (inProgress && moneyToCents(agreement.totals.paid) === 0);
  const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  const returnAt = agreement.actualReturnAt ?? agreement.plannedReturnAt;
  const canPrintContract =
    agreement.contractNumber !== null || (canManage && agreement.status !== 'CANCELLED');

  useEffect(() => {
    if (openedAction.current) return;
    const action = new URLSearchParams(window.location.search).get('action');
    if (action !== 'deliver' && action !== 'return') return;
    openedAction.current = true;
    replaceParam('action', null);
    if (!canManage) return;
    if (action === 'deliver' && agreement.status === 'RESERVED') setDialog('checkout');
    if (action === 'return' && agreement.status === 'IN_PROGRESS') setDialog('checkin');
  }, [agreement.status, canManage]);

  const primary = primaryAction(agreement, canManage, canCharge, owes, held);

  function printContract() {
    const href = agreementPrintHref(agreement.id);
    if (agreement.contractNumber !== null) {
      router.push(href);
      return;
    }
    assign.mutate(agreement.id, { onSuccess: () => router.push(href) });
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {agreement.vehicle.plate === null ? null : (
              <PlateChip plate={agreement.vehicle.plate} />
            )}
            <span>{vehicleTitle(agreement.vehicle)}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-col gap-1">
            {canReadRenters ? (
              <OriginLink
                href={`/rentals/customers/${agreement.customer.id}`}
                className="text-text font-semibold underline-offset-4 hover:underline"
              >
                {agreement.customer.fullName}
              </OriginLink>
            ) : (
              <span className="font-semibold">{agreement.customer.fullName}</span>
            )}
            <details>
              <summary className="min-h-(--touch-min) cursor-pointer text-body font-semibold">
                Historial
              </summary>
              <div className="flex flex-col gap-3 pt-2">
                <RenterHistory customerId={agreement.customerId} folded />
              </div>
            </details>
            <span>{saleReturnPhrase(pickup, returnAt)}</span>
          </span>
        }
      >
        <AgreementStatusStamp status={status} size="lg" />
        <div className="flex flex-wrap items-center gap-2.5 [[data-density=bahia]_&]:w-full [[data-density=bahia]_&]:[&>*]:min-h-(--touch-min)">
          {primary === null ? null : (
            <Button type="button" onClick={() => setDialog(primary.dialog)}>
              {primary.label}
            </Button>
          )}
          {live && canManage ? (
            <Button type="button" variant="outline" onClick={() => setDialog('extend')}>
              <CalendarPlus className="size-icon" strokeWidth={1.5} aria-hidden />
              Extender
            </Button>
          ) : null}
          {canCharge && (live || agreement.status === 'FINISHED') ? (
            <Button type="button" variant="outline" onClick={() => setDialog('fine')}>
              <Receipt className="size-icon" strokeWidth={1.5} aria-hidden />
              Multa
            </Button>
          ) : null}
          {live && canManage ? (
            <Button type="button" variant="outline" onClick={() => setDialog('swap')}>
              <ArrowLeftRight className="size-icon" strokeWidth={1.5} aria-hidden />
              Cambiar carro
            </Button>
          ) : null}
          {live && canCharge && owes ? (
            <Button type="button" variant="outline" onClick={() => setDialog('pay')}>
              Cobrar
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Más">
                <MoreHorizontal className="size-icon" strokeWidth={1.5} aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage ? (
                <DropdownMenuItem
                  disabled={agreement.status !== 'RESERVED' && !inProgress}
                  onSelect={() => setDialog('edit')}
                >
                  Editar
                </DropdownMenuItem>
              ) : null}
              {canManage ? (
                <DropdownMenuItem disabled={!canCancel} onSelect={() => setDialog('cancel')}>
                  Cancelar
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={!canPrintContract || assign.isPending}
                onSelect={printContract}
              >
                Imprimir contrato
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => router.push(agreementPrintHref(agreement.id, 'inspection'))}
              >
                Imprimir inspección
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ScreenHeader>

      {assign.error === null ? null : (
        <p className="text-danger-text text-dense" role="alert">
          {assign.error.message}
        </p>
      )}

      <AgreementAccount agreement={agreement} />
      <ContractFacts agreement={agreement} />

      <InspectionSummary title="Salida" inspection={agreement.pickupInspection} />
      {agreement.status === 'RESERVED' ? null : (
        <InspectionSummary
          title="Regreso"
          inspection={agreement.returnInspection}
          compareWith={agreement.pickupInspection}
        />
      )}
      <Extensions agreement={agreement} />
      <AgreementDialogs
        agreement={agreement}
        dialog={dialog}
        graceHours={settings.data?.graceHours ?? DEFAULT_GRACE_HOURS}
        onClose={() => setDialog(null)}
        onSwap={() => setDialog('swap')}
      />
    </div>
  );
}

function primaryAction(
  agreement: RentalAgreement,
  canManage: boolean,
  canCharge: boolean,
  owes: boolean,
  held: boolean,
): { label: string; dialog: Dialog } | null {
  if (canManage && agreement.status === 'RESERVED')
    return { label: 'Entregar', dialog: 'checkout' };
  if (
    canManage &&
    (agreement.derivedStatus === 'IN_PROGRESS' || agreement.derivedStatus === 'LATE')
  ) {
    return { label: 'Recibir', dialog: 'checkin' };
  }
  if (canCharge && agreement.derivedStatus === 'FINISHED' && owes) {
    return { label: 'Cobrar', dialog: 'pay' };
  }
  if (canCharge && agreement.derivedStatus === 'FINISHED' && !owes && held) {
    return { label: 'Devolver garantía', dialog: 'deposit' };
  }
  return null;
}

function AgreementDialogs({
  agreement,
  dialog,
  graceHours,
  onClose,
  onSwap,
}: {
  agreement: RentalAgreement;
  dialog: Dialog | null;
  graceHours: number;
  onClose: () => void;
  onSwap: () => void;
}) {
  if (dialog === 'checkout' || dialog === 'checkin') {
    return (
      <HandoverWizard
        mode={dialog === 'checkout' ? 'checkout' : 'checkin'}
        agreement={agreement}
        graceHours={graceHours}
        onClose={onClose}
      />
    );
  }
  if (dialog === 'extend') {
    return (
      <ExtendDialog
        agreement={agreement}
        graceHours={graceHours}
        onClose={onClose}
        onSwap={onSwap}
      />
    );
  }
  if (dialog === 'swap') {
    return <SwapWizard agreement={agreement} graceHours={graceHours} onClose={onClose} />;
  }
  if (dialog === 'fine') {
    return <FineDialog target={{ kind: 'agreement', agreement }} onClose={onClose} />;
  }
  if (dialog === 'cancel') return <CancelDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'edit') return <AgreementEditDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'pay') {
    return (
      <PaymentDialog
        agreementId={agreement.id}
        balance={agreement.totals.balance}
        onClose={onClose}
      />
    );
  }
  if (dialog === 'deposit') {
    return (
      <DepositReturnDialog
        agreementId={agreement.id}
        deposit={agreement.depositHeld}
        onClose={onClose}
      />
    );
  }
  return null;
}

function ContractFacts({ agreement }: { agreement: RentalAgreement }) {
  const driver = agreement.additionalDriver;

  return (
    <Card className="px-card">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <DetailField label="Sale">{rentalWhenLabel(agreement.plannedPickupAt)}</DetailField>
        <DetailField label="Regresa">{rentalWhenLabel(agreement.plannedReturnAt)}</DetailField>
        <DetailField label="Seguro">
          {agreement.coverage === 'ACCEPTED'
            ? 'Sí'
            : agreement.coverage === 'DECLINED'
              ? 'No'
              : '—'}
        </DetailField>
        <DetailField label="Golpe">{formatMoneyCompact(agreement.deductible)}</DetailField>
        {driver === null ? null : <DetailField label="Conductor">{driver.name}</DetailField>}
        {agreement.cancelReason === null ? null : (
          <DetailField label="Cancelada">{agreement.cancelReason}</DetailField>
        )}
        {agreement.notes === null ? null : (
          <DetailField label="Notas">{agreement.notes}</DetailField>
        )}
      </div>
    </Card>
  );
}

function Extensions({ agreement }: { agreement: RentalAgreement }) {
  if (agreement.extensions.length === 0) return null;

  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading>Días</CardSectionHeading>
      <ul className="flex flex-col gap-2">
        {agreement.extensions.map((extension) => (
          <li key={extension.id} className="text-body">
            {rentalWhenLabel(extension.previousReturnAt)} → {rentalWhenLabel(extension.newReturnAt)}
            {extension.note ? <span className="text-text-dim"> · {extension.note}</span> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
