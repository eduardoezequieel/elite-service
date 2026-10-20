'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  API_ERROR_CODES,
  PERMISSIONS,
  agreementVehicleLabel,
  cancelSchema,
  reassignSchema,
  rentalWhenLabel,
} from '@elite/shared';
import type { PaymentMethod, RentalAgreement } from '@elite/shared';
import { ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DetailField } from '@/components/ui/detail-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { useAddRentalPayment } from '@/features/rental-billing/hooks/use-rental-billing';
import { ApiError } from '@/lib/api';
import { formatCents, formatMoneyCompact } from '@/lib/money';
import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import { fieldToInstant } from '../datetime';
import {
  EXTEND_QUICK_DAYS,
  extendBody,
  extendPayment,
  extendPreview,
  initialExtendDraft,
  quickReturn,
  type ExtendDraft,
} from '../extend-draft';
import { moneyOrNull } from '../form-draft';
import {
  useCancelAgreement,
  useExtendAgreement,
  useReassignAgreement,
} from '../hooks/use-agreements';
import { OptionButton } from './new-rental-contract-step';
import { ChoiceField, DateTimeField, SwitchRow } from './rental-fields';
import { VehicleAvailabilityField } from './vehicle-availability-field';

/**
 * Los diálogos chicos del detalle de una renta (096): extender (127),
 * reasignar una reserva y cancelar. El cambio de carro es `SwapWizard`. Una
 * columna, objetivos táctiles y el error del API al pie (convención 16).
 */

function ActionDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  pending,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description: ReactNode;
  submitLabel: string;
  destructive?: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={onSubmit}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {children}
            <FormAlert message={error} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructiveSolid' : 'default'}
              loading={pending}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Baja `details` a los campos del diálogo y devuelve el mensaje general. */
function fieldErrors<Name extends string>(
  error: ApiError,
  fields: readonly Name[],
  setError: (name: Name, value: { message: string }) => void,
): string {
  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if ((fields as readonly string[]).includes(field) && typeof message === 'string') {
        setError(field as Name, { message });
      }
    }
  }
  return error.message;
}

type DialogProps = { agreement: RentalAgreement; onClose: () => void };

// --- Extender ---------------------------------------------------------------

/**
 * Extender (127 RN-2): se queda la tarifa pactada aunque pase de 7 o 30 días.
 * «Cobrar ahora» es un segundo pedido, como la entrega (108): si el cobro
 * falla, la extensión queda y se muestra el error.
 */
export function ExtendDialog({
  agreement,
  graceHours,
  onClose,
  onSwap,
}: DialogProps & { graceHours: number; onSwap?: () => void }) {
  const extend = useExtendAgreement();
  const addPayment = useAddRentalPayment(agreement.id);
  const { can } = usePermissions();
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);
  const canSwap = can(PERMISSIONS.rentals.actions.manage.key) && onSwap !== undefined;
  const { toast } = useToast();
  const [draft, setDraft] = useState<ExtendDraft>(() => ({
    ...initialExtendDraft(agreement),
    charge: canCharge,
  }));
  const [error, setError] = useState<string | null>(null);
  const [clash, setClash] = useState(false);
  const [cashClosed, setCashClosed] = useState(false);
  const [extended, setExtended] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const preview = extendPreview(agreement, draft, graceHours);
  const payAmount = draft.payTouched ? draft.payAmount : preview.suggestedPay;
  const invalid =
    preview.returnError !== null || preview.rateError !== null || preview.payError !== null;

  function patch(changes: Partial<ExtendDraft>) {
    setDraft((previous) => ({ ...previous, ...changes }));
    setError(null);
    setClash(false);
  }

  async function charge(): Promise<boolean> {
    const payment = extendPayment(draft, preview);
    if (payment === null) return true;
    if (!payment.ok) {
      setError(payment.message);
      return false;
    }
    try {
      await addPayment.mutateAsync(payment.value);
      return true;
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === API_ERROR_CODES.CASH_NOT_OPEN) {
        setCashClosed(true);
        return false;
      }
      setError(reason instanceof ApiError ? reason.message : 'No se pudo cobrar.');
      return false;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setChecked(true);
    if (!extended && invalid) return;

    setBusy(true);
    setError(null);
    setCashClosed(false);
    try {
      if (!extended) {
        const body = extendBody(draft);
        if (!body.ok) {
          setError(body.message);
          return;
        }
        try {
          await extend.mutateAsync({ id: agreement.id, input: body.value });
        } catch (reason) {
          if (reason instanceof ApiError && reason.code === API_ERROR_CODES.VEHICLE_UNAVAILABLE) {
            setClash(true);
          }
          setError(reason instanceof ApiError ? reason.message : 'No se pudo extender.');
          return;
        }
        setExtended(true);
      }
      if (!(await charge())) return;
      toast({
        title: 'Renta extendida',
        description: `Regresa ${rentalWhenLabel(fieldToInstant(draft.returnAt) ?? agreement.plannedReturnAt)}`,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const show = (message: string | null) => (checked ? (message ?? undefined) : undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-xl">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Extender</DialogTitle>
            <DialogDescription>
              {agreementVehicleLabel(agreement.vehicle)} · {agreement.customer.fullName}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <fieldset disabled={extended} className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {EXTEND_QUICK_DAYS.map((days) => {
                  const value = quickReturn(agreement, days);
                  return (
                    <OptionButton
                      key={days}
                      pressed={draft.returnAt === value}
                      className="px-3 [[data-density=bahia]_&]:px-5"
                      onClick={() => patch({ returnAt: value })}
                    >
                      +{days} {days === 1 ? 'día' : 'días'}
                    </OptionButton>
                  );
                })}
              </div>
              <DetailField label="Regresaba">
                {rentalWhenLabel(agreement.plannedReturnAt)}
              </DetailField>
              <DateTimeField
                id="extend-return"
                label="Regresa"
                value={draft.returnAt}
                onChange={(returnAt) => patch({ returnAt })}
                error={show(preview.returnError)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                <TextField
                  id="extend-rate"
                  label="Tarifa por día ($)"
                  inputMode="decimal"
                  mono
                  value={draft.dailyRate}
                  error={show(preview.rateError)}
                  onChange={(event) => patch({ dailyRate: event.target.value })}
                />
                <TextField
                  id="extend-note"
                  label="Nota"
                  value={draft.note}
                  onChange={(event) => patch({ note: event.target.value })}
                />
              </div>
            </fieldset>

            <dl className="bg-surface-2 border-line-soft grid grid-cols-3 gap-3 rounded-control border px-(--field-px) py-3 [[data-density=bahia]_&]:py-4">
              <SummaryFigure label="Días">
                {agreement.billableDays} → {preview.days ?? '—'}
              </SummaryFigure>
              <SummaryFigure label="Agrega">
                {preview.days === null
                  ? '—'
                  : `${preview.addedCents >= 0 ? '+' : '−'}${formatCents(Math.abs(preview.addedCents))}`}
              </SummaryFigure>
              <SummaryFigure label="Saldo">
                {preview.days === null ? '—' : formatCents(preview.balanceCents)}
              </SummaryFigure>
            </dl>

            {canCharge ? (
              <div className="flex flex-col gap-4">
                <SwitchRow
                  id="extend-charge"
                  label="Cobrar ahora"
                  checked={draft.charge}
                  onCheckedChange={(charge) => patch({ charge })}
                />
                {draft.charge ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                    <TextField
                      id="extend-pay"
                      label="Monto ($)"
                      inputMode="decimal"
                      mono
                      value={payAmount}
                      error={show(preview.payError)}
                      onChange={(event) =>
                        patch({ payAmount: event.target.value, payTouched: true })
                      }
                    />
                    <ChoiceField
                      id="extend-method"
                      label="Método"
                      options={PAYMENT_METHOD_OPTIONS}
                      value={draft.method}
                      onChange={(method) => patch({ method: method as PaymentMethod })}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <FormAlert message={error} />
            {clash && canSwap ? (
              <Button type="button" variant="outline" onClick={onSwap}>
                <ArrowLeftRight className="size-icon" strokeWidth={1.5} aria-hidden />
                Cambiar carro
              </Button>
            ) : null}
            {cashClosed ? (
              <p className="text-danger-text text-body font-semibold" role="alert">
                Abra la caja para cobrar.{' '}
                <Link href="/rentals/cash" className="underline underline-offset-4">
                  Caja
                </Link>
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <p className="mr-auto flex items-baseline gap-2">
              <span className="text-text-dim text-dense">Total</span>
              <b className="font-display text-figure italic tabular-nums">
                {preview.days === null ? '—' : formatMoneyCompact(preview.after.total)}
              </b>
            </p>
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" loading={busy}>
              {extended ? 'Cobrar' : 'Extender'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-faint text-label">{label}</dt>
      <dd className="font-mono text-body font-semibold tabular-nums [[data-density=bahia]_&]:text-title">
        {children}
      </dd>
    </div>
  );
}

// --- Reasignar --------------------------------------------------------------

interface ReassignValues {
  vehicleId: string;
  dailyRate: string;
}

const reassignFormSchema = z
  .custom<ReassignValues>()
  .transform((values): Record<string, unknown> => ({
    vehicleId: values.vehicleId,
    dailyRate: moneyOrNull(values.dailyRate) ?? undefined,
  }))
  .pipe(reassignSchema);

export function ReassignDialog({ agreement, onClose }: DialogProps) {
  const reassign = useReassignAgreement();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ReassignValues, unknown, z.output<typeof reassignFormSchema>>({
    resolver: zodResolver(reassignFormSchema),
    defaultValues: { vehicleId: '', dailyRate: '' },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((input) => {
    setError(null);
    reassign.mutate(
      { id: agreement.id, input },
      {
        onSuccess: (saved) => {
          toast({ title: 'Reserva reasignada', description: saved.vehicle.plate ?? undefined });
          onClose();
        },
        onError: (apiError) => {
          if (apiError.code === 'VEHICLE_UNAVAILABLE' || apiError.code === 'VEHICLE_NOT_RENTABLE') {
            form.setError('vehicleId', { message: apiError.message });
          }
          setError(fieldErrors(apiError, ['vehicleId', 'dailyRate'] as const, form.setError));
        },
      },
    );
  });

  return (
    <ActionDialog
      title="Reasignar la reserva"
      description="La reserva pasa a otro carro libre en las mismas fechas."
      submitLabel="Reasignar"
      pending={reassign.isPending}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <Controller
        control={form.control}
        name="vehicleId"
        render={({ field }) => (
          <VehicleAvailabilityField
            id="reassign-vehicle"
            label="Carro"
            from={agreement.plannedPickupAt}
            to={agreement.plannedReturnAt}
            value={field.value}
            onChange={(vehicleId) => field.onChange(vehicleId)}
            excludeVehicleId={agreement.vehicleId}
            error={errors.vehicleId?.message}
          />
        )}
      />
      <TextField
        id="reassign-rate"
        label="Tarifa por día ($, vacío = la misma)"
        inputMode="decimal"
        mono
        placeholder={agreement.dailyRate}
        error={errors.dailyRate?.message}
        {...form.register('dailyRate')}
      />
    </ActionDialog>
  );
}

// --- Cancelar ---------------------------------------------------------------

const cancelFormSchema = z.custom<{ reason: string }>().pipe(cancelSchema);

export function CancelDialog({ agreement, onClose }: DialogProps) {
  const cancel = useCancelAgreement();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ reason: string }, unknown, z.output<typeof cancelFormSchema>>({
    resolver: zodResolver(cancelFormSchema),
    defaultValues: { reason: '' },
  });

  const submit = form.handleSubmit((input) => {
    setError(null);
    cancel.mutate(
      { id: agreement.id, input },
      {
        onSuccess: () => {
          toast({ title: 'Renta cancelada', description: agreement.customer.fullName });
          onClose();
        },
        onError: (apiError) => setError(apiError.message),
      },
    );
  });

  return (
    <ActionDialog
      title="Cancelar la renta"
      description={
        agreement.status === 'IN_PROGRESS'
          ? 'Una renta en curso solo se cancela si no tiene pagos. El carro vuelve a quedar libre.'
          : 'La reserva se cancela y el carro queda libre en esas fechas.'
      }
      submitLabel="Cancelar renta"
      destructive
      pending={cancel.isPending}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextAreaField
        id="cancel-reason"
        label="Por qué se cancela"
        error={form.formState.errors.reason?.message}
        {...form.register('reason')}
      />
    </ActionDialog>
  );
}
