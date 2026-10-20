'use client';

import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import type { Renter } from '@elite/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Path } from 'react-hook-form';

import { backLinkFor } from '@/components/app-shell/back-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert } from '@/features/inventory/components/form-fields';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import {
  RENTERS_QUERY_KEY,
  useCreateRenter,
  useRenter,
  useUpdateRenter,
} from '@/features/renters/hooks/use-renters';
import {
  draftFromRenter,
  draftFromSearch,
  licenseStatus,
  quickRenterCreate,
  quickRenterUpdate,
} from '@/features/renters/quick-renter';
import type { ApiError } from '@/lib/api';
import { todayCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  AGREEMENT_FORM_FIELDS,
  type AgreementFormValues,
  type AgreementPrefill,
} from '../agreement-form';
import { fieldToInstant, nowField } from '../datetime';
import { useAvailability, useCreateAgreement } from '../hooks/use-agreements';
import {
  NEW_RENTAL_STEPS,
  fieldsOfRange,
  firstBlockedStep,
  leavesToday,
  newRentalBody,
  newRentalMoney,
  newRentalStart,
  notBeforeNow,
  newRentalStepError,
  validRange,
  withTime,
  type NewRentalPrice,
  type NewRentalStep,
  type NewRentalValues,
  type StepContext,
} from '../new-rental';
import { NewRentalCarStep } from './new-rental-car-step';
import {
  NewRentalClientStep,
  quickRenterCheckOf,
  useQuickRenterMatches,
  type ClientFormState,
} from './new-rental-client-step';
import { NewRentalConfirmStep, type NewRentalMode } from './new-rental-confirm-step';
import { NewRentalContractStep } from './new-rental-contract-step';

type FieldName = Path<AgreementFormValues>;

/** Si los ajustes no llegaron, la edad mínima del prototipo. */
const DEFAULT_MIN_DRIVER_AGE = 21;

/** Baja un `ApiError` a sus campos y devuelve el mensaje general. */
export function applyAgreementError(
  error: ApiError,
  setError: (name: FieldName, error: { message: string }) => void,
): string {
  if (error.code === 'VEHICLE_UNAVAILABLE' || error.code === 'VEHICLE_NOT_RENTABLE') {
    setError('vehicleId', { message: error.message });
  }
  if (error.code === 'RENTER_BLOCKED') setError('customerId', { message: error.message });

  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if ((AGREEMENT_FORM_FIELDS as string[]).includes(field) && typeof message === 'string') {
        setError(field as FieldName, { message });
      }
    }
  }

  return error.message;
}

/** El paso al que vuelve un rechazo del API, para corregir donde está el dato. */
function stepOfError(error: ApiError): NewRentalStep | null {
  if (
    error.code === API_ERROR_CODES.VEHICLE_UNAVAILABLE ||
    error.code === API_ERROR_CODES.VEHICLE_NOT_RENTABLE
  ) {
    return 1;
  }
  if (error.code === API_ERROR_CODES.RENTER_BLOCKED) return 2;
  if (error.code === API_ERROR_CODES.DISCOUNT_EXCEEDS_SUBTOTAL) return 3;

  return null;
}

/**
 * Nueva renta en cuatro pasos (118): Carro → Cliente → Contrato → Confirmar,
 * con el total al pie en cuanto hay carro. «Seguir a la entrega» crea la
 * reserva y abre el asistente de entrega de la ficha.
 */
export function AgreementFormScreen({ prefill }: { prefill: AgreementPrefill }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can, canAny } = usePermissions();
  const canManageRenters = can(PERMISSIONS.renters.actions.manage.key);
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const create = useCreateAgreement();
  const createRenter = useCreateRenter();
  const updateRenter = useUpdateRenter();

  const [today] = useState(() => todayCivil());
  const [start] = useState(() => newRentalStart(prefill, today, nowField()));
  const [values, setValues] = useState<NewRentalValues>(start.values);
  const [step, setStep] = useState<NewRentalStep>(start.step);
  const [reached, setReached] = useState<NewRentalStep>(start.step);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<NewRentalMode>('deliver');
  const [clientQuery, setClientQuery] = useState('');
  const [clientForm, setClientForm] = useState<ClientFormState | null>(null);

  const rangeOk = validRange(values.plannedPickupAt, values.plannedReturnAt);
  const pickupAt = fieldToInstant(values.plannedPickupAt);
  const returnAt = fieldToInstant(values.plannedReturnAt);
  const availability = useAvailability(
    rangeOk && pickupAt !== null && returnAt !== null ? { from: pickupAt, to: returnAt } : null,
  );
  const row = availability.data?.find(
    (candidate) => candidate.vehicle.id === values.vehicleId && candidate.availability === 'FREE',
  );
  const price: NewRentalPrice | null =
    row === undefined || !rangeOk
      ? null
      : { dailyRate: row.dailyRate, billableDays: row.billableDays };
  const money = price === null ? null : newRentalMoney(values, price);

  const chosenQuery = useRenter(values.customerId, values.customerId !== '');
  const chosen: Renter | undefined =
    chosenQuery.data?.id === values.customerId ? chosenQuery.data : undefined;
  // El cuarto de hora siguiente: la salida no puede quedar antes (118).
  const now = nowField();
  const context: StepContext = {
    now,
    price,
    customer:
      chosen === undefined
        ? null
        : {
            licenseExpired: licenseStatus(chosen.licenseExpiresAt, today) === 'expired',
            blocked: chosen.isBlocked || !chosen.isActive,
          },
  };

  const matches = useQuickRenterMatches(clientForm);
  const check = quickRenterCheckOf(clientForm, today, matches);

  // Un carro que ya no está libre en el rango se suelta (también el de la URL).
  const vehicleGone =
    values.vehicleId !== '' &&
    rangeOk &&
    availability.data !== undefined &&
    !availability.isFetching &&
    row === undefined;
  useEffect(() => {
    if (!vehicleGone) return;
    setValues((previous) => ({ ...previous, vehicleId: '' }));
    setStep(1);
    setReached(1);
  }, [vehicleGone]);

  function patch(changes: Partial<NewRentalValues>) {
    setValues((previous) => ({ ...previous, ...changes }));
    setError(null);
  }

  function goTo(target: NewRentalStep) {
    if (target > step) {
      const blocked = firstBlockedStep(target, values, context);
      if (blocked !== null) {
        setStep(blocked.step);
        setError(blocked.message);
        return;
      }
    }
    setStep(target);
    setReached((previous) => (target > previous ? target : previous));
    setError(null);
  }

  function close() {
    router.push(backLinkFor(pathname)?.href ?? '/rentals/agreements');
  }

  function chooseCustomer(customerId: string) {
    patch({ customerId });
    setClientForm(null);
  }

  function pickExisting(customerId: string) {
    chooseCustomer(customerId);
    setClientQuery('');
  }

  function backToSearch() {
    if (clientForm !== null && clientForm.editingId === null) {
      const { draft } = clientForm;
      setClientQuery(draft.fullName.trim() || draft.documentId || draft.phone);
    }
    setClientForm(null);
    setError(null);
  }

  function saveClient() {
    if (clientForm === null || check === null || !check.valid || matches.checking) return;

    const saved = (renter: Renter) => {
      queryClient.setQueryData([...RENTERS_QUERY_KEY, renter.id], renter);
      setValues((previous) => ({ ...previous, customerId: renter.id }));
      setClientForm(null);
      setClientQuery('');
      setError(null);
      setStep(3);
      setReached((previous) => (previous > 3 ? previous : 3));
      toast({ title: 'Cliente guardado', description: renter.fullName });
    };
    const failed = (apiError: ApiError) => setError(apiError.message);

    if (clientForm.editingId === null) {
      createRenter.mutate(quickRenterCreate(clientForm.draft), {
        onSuccess: saved,
        onError: failed,
      });
    } else {
      updateRenter.mutate(
        { id: clientForm.editingId, input: quickRenterUpdate(clientForm.draft) },
        { onSuccess: saved, onError: failed },
      );
    }
  }

  const leaves = leavesToday(values.plannedPickupAt, today);
  const deliver = leaves && mode === 'deliver';

  function submit() {
    const blocked = firstBlockedStep(4, values, context);
    if (blocked !== null) {
      setStep(blocked.step);
      setError(blocked.message);
      return;
    }

    const body = newRentalBody(values);
    if (!body.ok) {
      setError(body.message);
      return;
    }

    setError(null);
    create.mutate(body.value, {
      onSuccess: (saved) => {
        toast({
          title: deliver ? 'Lista para entregar' : 'Renta reservada',
          description: saved.customer.fullName,
        });
        router.push(
          deliver
            ? `/rentals/agreements/${saved.id}?action=deliver`
            : `/rentals/agreements/${saved.id}`,
        );
      },
      onError: (apiError) => {
        const target = stepOfError(apiError);
        if (target !== null) setStep(target);
        setError(apiError.message);
      },
    });
  }

  const inForm = step === 2 && clientForm !== null;
  const clientBlocked = newRentalStepError(2, values, context) !== null;

  const left = inForm ? (
    <Button type="button" variant="outline" onClick={backToSearch}>
      <ChevronLeft className="size-icon" strokeWidth={1.5} aria-hidden />
      Atrás
    </Button>
  ) : step > 1 ? (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        setStep((step - 1) as NewRentalStep);
        setError(null);
      }}
    >
      <ChevronLeft className="size-icon" strokeWidth={1.5} aria-hidden />
      Atrás
    </Button>
  ) : (
    <Button type="button" variant="outline" onClick={close}>
      Cerrar
    </Button>
  );

  const right = inForm ? (
    <Button
      type="button"
      disabled={check === null || !check.valid || matches.checking}
      loading={createRenter.isPending || updateRenter.isPending}
      onClick={saveClient}
    >
      Guardar y seguir
      <ChevronRight className="size-icon" strokeWidth={1.5} aria-hidden />
    </Button>
  ) : step < 4 ? (
    <Button
      type="button"
      disabled={step === 2 && clientBlocked}
      onClick={() => goTo((step + 1) as NewRentalStep)}
    >
      {step === 3 ? 'Revisar' : 'Siguiente'}
      <ChevronRight className="size-icon" strokeWidth={1.5} aria-hidden />
    </Button>
  ) : deliver ? (
    <Button type="button" loading={create.isPending} onClick={submit}>
      Seguir a la entrega
      <ChevronRight className="size-icon" strokeWidth={1.5} aria-hidden />
    </Button>
  ) : (
    <Button type="button" loading={create.isPending} onClick={submit}>
      <Check className="size-icon" strokeWidth={1.5} aria-hidden />
      Reservar
    </Button>
  );

  return (
    <div>
      <ScreenHeader title="Nueva renta" />

      <div className="border-line-soft bg-surface flex flex-col rounded-card border">
        <StepBar step={step} reached={reached} onStep={goTo} />

        <div className="flex flex-col gap-5 p-(--plate-pad)">
          {step === 1 ? (
            <NewRentalCarStep
              now={now}
              pickupAt={values.plannedPickupAt}
              returnAt={values.plannedReturnAt}
              rangeValid={rangeOk}
              onRange={(range) => {
                const next = fieldsOfRange(range, values.plannedPickupAt, values.plannedReturnAt);
                patch(notBeforeNow(next.pickupAt, next.returnAt, now));
              }}
              onPickupTime={(time) =>
                patch({ plannedPickupAt: withTime(values.plannedPickupAt, time) })
              }
              onReturnTime={(time) =>
                patch({ plannedReturnAt: withTime(values.plannedReturnAt, time) })
              }
              vehicleId={values.vehicleId}
              onVehicle={(picked) => patch({ vehicleId: picked.vehicle.id })}
              rows={availability.data ?? []}
              loading={availability.isPending}
              error={availability.error?.message ?? null}
            />
          ) : null}

          {step === 2 ? (
            <NewRentalClientStep
              today={today}
              minDriverAge={settings.data?.minDriverAge ?? DEFAULT_MIN_DRIVER_AGE}
              query={clientQuery}
              onQuery={setClientQuery}
              customerId={values.customerId}
              chosen={chosen}
              onChoose={chooseCustomer}
              canManage={canManageRenters}
              onNew={() => {
                setClientForm({ draft: draftFromSearch(clientQuery), editingId: null });
                setError(null);
              }}
              onEditChosen={() => {
                if (chosen === undefined) return;
                setClientForm({ draft: draftFromRenter(chosen), editingId: chosen.id });
                setError(null);
              }}
              form={clientForm}
              onDraft={(draft) => {
                setClientForm((previous) => (previous === null ? null : { ...previous, draft }));
                setError(null);
              }}
              onBackToSearch={backToSearch}
              onUse={pickExisting}
              matches={matches}
              check={check}
            />
          ) : null}

          {step === 3 ? (
            <NewRentalContractStep
              values={values}
              onPatch={patch}
              defaultCdwPerDay={settings.data?.defaultCdwPerDay ?? null}
              defaultDeductible={settings.data?.defaultDeductible ?? null}
            />
          ) : null}

          {step === 4 && row !== undefined && money !== null ? (
            <NewRentalConfirmStep
              row={row}
              values={values}
              customerName={chosen?.fullName ?? ''}
              money={money}
              leavesToday={leaves}
              mode={deliver ? 'deliver' : 'reserve'}
              onMode={setMode}
              onGoto={goTo}
            />
          ) : null}

          <FormAlert message={error} />
        </div>

        <div className="border-line-soft bg-surface sticky bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-2.5 rounded-b-card border-t p-(--plate-pad) md:bottom-0">
          {left}
          {money === null ? (
            <span className="flex-1" />
          ) : (
            <span className="mr-auto flex items-baseline gap-2.5 [[data-density=bahia]_&]:order-first [[data-density=bahia]_&]:basis-full">
              <span className="text-text-faint text-label">Total</span>
              <span className="font-display text-text text-figure font-bold italic tabular-nums">
                {formatMoney(money.total)}
              </span>
            </span>
          )}
          <span className="ml-auto">{right}</span>
        </div>
      </div>
    </div>
  );
}

/** Los cuatro pasos: hechos con ✓, el actual resaltado; se vuelve a uno ya alcanzado tocándolo. */
function StepBar({
  step,
  reached,
  onStep,
}: {
  step: NewRentalStep;
  reached: NewRentalStep;
  onStep: (step: NewRentalStep) => void;
}) {
  return (
    <ol className="grid grid-cols-4 gap-2 px-(--plate-pad) pt-3.5">
      {NEW_RENTAL_STEPS.map((label, index) => {
        const n = (index + 1) as NewRentalStep;
        const done = n < step;
        const current = n === step;

        return (
          <li key={label} className="min-w-0">
            <button
              type="button"
              disabled={n > reached}
              aria-current={current ? 'step' : undefined}
              onClick={() => onStep(n)}
              className={cn(
                'relative flex min-h-(--touch-min) w-full items-center gap-2 pt-3.5 pb-1 text-left font-semibold disabled:cursor-default',
                'before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-full before:transition-colors before:duration-(--duration-state)',
                done || current ? 'before:bg-flame' : 'before:bg-line',
                current ? 'text-text' : done ? 'text-text-dim' : 'text-text-faint',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-label tabular-nums',
                  current && 'gradient-action border-transparent text-white',
                  done && 'tint text-go-text',
                  !current && !done && 'border-current',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : n}
              </span>
              <span className={cn('truncate', !current && 'max-sm:sr-only')}>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
