'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { agreementVehicleLabel, moneyToCents } from '@elite/shared';
import type { CreateFineInput, RentalAgreement } from '@elite/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { FieldError, FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { OptionButton } from '@/features/rentals/components/new-rental-contract-step';
import { instantToField } from '@/features/rentals/datetime';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatCents, formatMoney } from '@/lib/money';
import { salvadorInstant, salvadorLocalNow } from '../billing-format';
import { fineFormSchema, type FineFormValues } from '../fine-form';
import { useCreateRentalFine, useFineResolution } from '../hooks/use-rental-billing';

/** Lo que más llega: un toque llena «De qué es». */
const QUICK_DESCRIPTIONS = [
  'Exceso de velocidad',
  'Mal estacionado',
  'Semáforo en rojo',
  'Sin cinturón',
] as const;

/**
 * Desde la renta (127 RN-3) el carro y el cliente son fijos y se le carga;
 * desde el carro (RN-4) la fecha dice quién lo tenía y, sin renta, queda como
 * gasto «Multa» del carro.
 */
export type FineTarget =
  | { kind: 'agreement'; agreement: RentalAgreement }
  | { kind: 'vehicle'; vehicleId: string; vehicleLabel: string };

/** Registrar una multa de tránsito (098 RN-4, 127). Sin interruptor: lo decide la fecha. */
export function FineDialog({ target, onClose }: { target: FineTarget; onClose: () => void }) {
  const createFine = useCreateRentalFine();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const agreement = target.kind === 'agreement' ? target.agreement : null;
  const vehicleId = agreement?.vehicleId ?? (target.kind === 'vehicle' ? target.vehicleId : '');
  const form = useForm<FineFormValues, unknown, CreateFineInput>({
    resolver: zodResolver(fineFormSchema),
    defaultValues: {
      vehicleId,
      agreementId: agreement?.id ?? '',
      // Una devuelta abre un minuto antes de su regreso: dentro de su tramo.
      occurredLocal:
        agreement === null || agreement.actualReturnAt === null
          ? salvadorLocalNow()
          : instantToField(new Date(Date.parse(agreement.actualReturnAt) - 60_000).toISOString()),
      amount: '',
      description: '',
      chargeToCustomer: true,
    },
  });
  const errors = form.formState.errors;
  const occurredLocal = useDebouncedValue(form.watch('occurredLocal'), 300);
  const occurredAt = salvadorInstant(occurredLocal);
  const resolution = useFineResolution(agreement === null ? vehicleId : '', occurredAt);
  const holder = resolution.data?.agreement ?? null;
  const resolving = agreement === null && occurredAt !== null && resolution.data === undefined;
  const description = form.watch('description');
  const amountCents = typedCents(form.watch('amount'));

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    createFine.mutate(
      agreement === null ? { ...input, chargeToCustomer: holder !== null } : input,
      {
        onSuccess: (fine) => {
          toast({
            title: 'Multa registrada',
            description:
              fine.chargedToCustomer && fine.agreement !== null
                ? `${formatMoney(fine.amount)} a ${fine.agreement.customerName}`
                : `${formatMoney(fine.amount)} · Gasto «Multa»`,
          });
          onClose();
        },
        onError: (error) => {
          const field = fieldOf(error.details);
          if (field !== null) form.setError('occurredLocal', { message: field });
          setFormError(error.message);
        },
      },
    );
  });

  const subtitle =
    agreement === null
      ? target.kind === 'vehicle'
        ? target.vehicleLabel
        : ''
      : `${agreementVehicleLabel(agreement.vehicle)} · ${agreement.customer.fullName}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-lg">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Multa</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <FieldBox>
                  <Label htmlFor="rental-fine-when">Fecha y hora</Label>
                  <Input
                    id="rental-fine-when"
                    type="datetime-local"
                    className="font-mono"
                    aria-invalid={errors.occurredLocal ? true : undefined}
                    {...form.register('occurredLocal')}
                  />
                </FieldBox>
                <FieldError message={errors.occurredLocal?.message} />
              </div>
              <TextField
                id="rental-fine-amount"
                label="Monto ($)"
                inputMode="decimal"
                placeholder="0.00"
                mono
                error={errors.amount?.message}
                {...form.register('amount')}
              />
            </div>
            <TextField
              id="rental-fine-description"
              label="De qué es"
              error={errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_DESCRIPTIONS.map((text) => (
                <OptionButton
                  key={text}
                  pressed={description === text}
                  className="px-3 text-dense [[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:text-body"
                  onClick={() =>
                    form.setValue('description', text, {
                      shouldValidate: errors.description !== undefined,
                    })
                  }
                >
                  {text}
                </OptionButton>
              ))}
            </div>

            {agreement === null ? (
              <FineHolder
                ready={occurredAt !== null}
                loading={resolving}
                holder={holder}
                error={resolution.error?.message ?? null}
              />
            ) : (
              <BalanceAfter balance={agreement.totals.balance} amountCents={amountCents} />
            )}

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" loading={createFine.isPending} disabled={resolving}>
              {agreement === null ? 'Guardar' : 'Cargar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function typedCents(value: string): number {
  try {
    return Math.max(0, moneyToCents(value.trim().replace(',', '.')));
  } catch {
    return 0;
  }
}

/** El 422 de la fecha fuera del tramo (127 RN-3) baja al campo. */
function fieldOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null || !('occurredAt' in details)) return null;
  const value = (details as { occurredAt: unknown }).occurredAt;
  return typeof value === 'string' ? value : null;
}

/** Desde la renta: el saldo de hoy y el que queda con la multa. */
function BalanceAfter({ balance, amountCents }: { balance: string; amountCents: number }) {
  const before = moneyToCents(balance);

  return (
    <dl className="bg-surface-2 border-line-soft grid grid-cols-2 gap-3 rounded-control border px-(--field-px) py-3">
      <div>
        <dt className="text-text-faint text-label">Saldo</dt>
        <dd className="font-mono text-body font-semibold tabular-nums">{formatCents(before)}</dd>
      </div>
      <div>
        <dt className="text-text-faint text-label">Queda</dt>
        <dd className="font-mono text-body font-semibold tabular-nums">
          {formatCents(before + amountCents)}
        </dd>
      </div>
    </dl>
  );
}

/** Desde el carro: a quién se le carga, dicho antes de guardar (RN-4). */
function FineHolder({
  ready,
  loading,
  holder,
  error,
}: {
  ready: boolean;
  loading: boolean;
  holder: { contractNumber: number | null; customerName: string } | null;
  error: string | null;
}) {
  if (!ready) return null;

  if (error !== null) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div
      className="bg-surface-2 border-line-soft flex min-h-(--touch-min) flex-wrap items-center justify-between gap-3 rounded-control border px-(--field-px) py-3"
      aria-live="polite"
    >
      {loading ? (
        <p className="text-text-dim text-body">Buscando…</p>
      ) : holder === null ? (
        <>
          <p className="text-body font-semibold">Sin renta</p>
          <Stamp label="Gasto «Multa»" tone="amber" />
        </>
      ) : (
        <>
          <p className="text-body">
            Lo tenía <b className="font-semibold">{holder.customerName}</b>
            {holder.contractNumber === null ? null : (
              <span className="text-text-dim font-mono"> · N° {holder.contractNumber}</span>
            )}
          </p>
          <Stamp label="Se le carga" tone="washing" pulse={false} />
        </>
      )}
    </div>
  );
}
