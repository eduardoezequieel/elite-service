'use client';

import { PERMISSIONS, moneyToCents, rentalWhenLabel } from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';
import { MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
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
import { PaymentDialog } from '@/features/rental-billing/components/payment-dialog';
import { agreementPrintHref } from '@/features/rental-documents/components/agreement-documents-actions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { replaceParam } from '@/lib/list-params';
import { saleReturnPhrase, vehicleTitle } from '../agreement-format';
import { useAgreement, useAssignContractNumber } from '../hooks/use-agreements';
import { AgreementAccount } from './agreement-account';
import { CancelDialog, ExtendDialog } from './agreement-action-dialogs';
import { AgreementEditDialog } from './agreement-edit-dialog';
import { AgreementStatusStamp } from './agreement-status-stamp';
import { HandoverWizard } from './handover-wizard';
import { InspectionSummary } from './inspection-summary';
import { RenterHistory } from './renter-history';

/** Si los ajustes no llegaron, la gracia del prototipo. */
const DEFAULT_GRACE_HOURS = 1;

type Dialog = 'checkout' | 'checkin' | 'extend' | 'edit' | 'cancel' | 'pay' | 'deposit';

/** El detalle de una renta (108). Un primario y el resto en «⋯». */
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
  const canCancel =
    agreement.status === 'RESERVED' ||
    (inProgress && moneyToCents(agreement.totals.paid) === 0);
  const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  const returnAt = agreement.actualReturnAt ?? agreement.plannedReturnAt;

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
            <span>{saleReturnPhrase(pickup, returnAt)}</span>
          </span>
        }
      >
        <AgreementStatusStamp status={status} size="lg" />
        {primary === null ? null : (
          <Button type="button" onClick={() => setDialog(primary.dialog)}>
            {primary.label}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Más">
              <MoreHorizontal className="size-icon" strokeWidth={1.5} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!canManage || (agreement.status !== 'RESERVED' && !inProgress)}
              onSelect={() => setDialog('edit')}
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canManage || !inProgress} onSelect={() => setDialog('extend')}>
              Dar más días
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canManage || !canCancel} onSelect={() => setDialog('cancel')}>
              Cancelar
            </DropdownMenuItem>
            <DropdownMenuItem disabled={assign.isPending} onSelect={printContract}>
              Imprimir contrato
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(agreementPrintHref(agreement.id))}>
              Imprimir inspección
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ScreenHeader>

      {assign.error === null ? null : (
        <p className="text-danger-text text-dense" role="alert">
          {assign.error.message}
        </p>
      )}

      <AgreementAccount agreement={agreement} />

      <details className="border-line-soft rounded-row border px-4 py-3">
        <summary className="min-h-(--touch-min) cursor-pointer text-body font-semibold">
          Historial
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <RenterHistory customerId={agreement.customerId} folded />
        </div>
      </details>

      <InspectionSummary title="Salida" inspection={agreement.pickupInspection} />
      {agreement.status === 'RESERVED' ? null : (
        <InspectionSummary
          title="Regreso"
          inspection={agreement.returnInspection}
          compareWith={agreement.pickupInspection}
        />
      )}
      <Extensions agreement={agreement} />
      {agreement.notes === null && agreement.cancelReason === null ? null : (
        <Card className="gap-2 px-card">
          {agreement.cancelReason === null ? null : (
            <p className="text-body">
              <span className="text-text-dim">Cancelada. </span>
              {agreement.cancelReason}
            </p>
          )}
          {agreement.notes === null ? null : (
            <p className="text-body whitespace-pre-line">{agreement.notes}</p>
          )}
        </Card>
      )}

      <AgreementDialogs
        agreement={agreement}
        dialog={dialog}
        graceHours={settings.data?.graceHours ?? DEFAULT_GRACE_HOURS}
        onClose={() => setDialog(null)}
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
  if (canManage && agreement.status === 'RESERVED') return { label: 'Entregar', dialog: 'checkout' };
  if (canManage && (agreement.derivedStatus === 'IN_PROGRESS' || agreement.derivedStatus === 'LATE')) {
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
}: {
  agreement: RentalAgreement;
  dialog: Dialog | null;
  graceHours: number;
  onClose: () => void;
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
  if (dialog === 'extend') return <ExtendDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'cancel') return <CancelDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'edit') return <AgreementEditDialog agreement={agreement} onClose={onClose} />;
  if (dialog === 'pay') {
    return (
      <PaymentDialog agreementId={agreement.id} balance={agreement.totals.balance} onClose={onClose} />
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
