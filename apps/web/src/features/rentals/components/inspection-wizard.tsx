'use client';

import {
  INSPECTION_MAX_PHOTOS,
  INSPECTION_ZONE_LABELS,
  PERMISSIONS,
  agreementTotals,
  billableDays,
  centsToMoney,
  moneyToCents,
  newDamages,
  storedFileUrl,
} from '@elite/shared';
import type {
  CheckinInput,
  CheckoutInput,
  InspectionZone,
  PaymentMethod,
  RentalAgreement,
} from '@elite/shared';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { rentalFileSrc, uploadRentalFile } from '@/features/rental-settings/api';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import { fieldToInstant } from '../datetime';
import { wholeOrNull } from '../form-draft';
import {
  INSPECTION_STEPS,
  checkinBody,
  checkinExtraKm,
  checkoutBody,
  initialDraft,
  stepError,
  toggleZone,
  type InspectionContext,
  type InspectionDraft,
  type InspectionStep,
} from '../inspection-draft';
import { resizeImage } from '../resize-image';
import { CarDiagram, type ZoneMark } from './car-diagram';
import { FuelPicker } from './fuel-picker';
import { AmountRow, ChoiceField, DateTimeField, SwitchRow } from './rental-fields';

const ICON = 'size-icon';

/** Lo que el asistente muestra del carro. */
export interface InspectionVehicle {
  label: string;
  freeKmPerDay: number | null;
  extraKmPrice: string | null;
}

type WizardProps = {
  context: InspectionContext;
  vehicle: InspectionVehicle;
  /** Valor inicial del paso «Fecha y hora». */
  initialAt: string;
  pending: boolean;
  /** El `message` del `ApiError`, al pie. */
  error: string | null;
  onClose: () => void;
} & (
  | {
      mode: 'checkout';
      /** El total estimado de la renta, para tenerlo a la vista al cobrar. */
      estimatedTotal?: string | null;
      onSubmit: (body: CheckoutInput) => void;
    }
  | {
      mode: 'checkin';
      agreement: RentalAgreement;
      graceHours: number;
      onSubmit: (body: CheckinInput) => void;
    }
);

/**
 * Entrega y recepción del carro (096), pensadas para el celular: un paso por
 * pantalla, a pantalla completa bajo 900px, con objetivos táctiles grandes.
 * Fecha y hora · km y combustible · inspección · accesorios · llantas y
 * batería · fotos · cobro. Solo fecha, km y combustible son obligatorios (RN-8).
 */
export function InspectionWizard(props: WizardProps) {
  const { context, vehicle, mode } = props;
  const { canAny } = usePermissions();
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const accessoryNames = settings.data?.accessories ?? [];

  const [draft, setDraft] = useState<InspectionDraft>(() =>
    initialDraft(mode, context, accessoryNames, props.initialAt),
  );
  const [step, setStep] = useState<InspectionStep>('when');
  const [localError, setLocalError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const index = INSPECTION_STEPS.findIndex((candidate) => candidate.key === step);
  const isLast = index === INSPECTION_STEPS.length - 1;

  function patch(changes: Partial<InspectionDraft>) {
    setDraft((previous) => ({ ...previous, ...changes }));
    setLocalError(null);
  }

  // Días de la recepción: el cálculo con la gracia de ajustes (RN-4).
  const checkinDays =
    props.mode === 'checkin' ? computedDays(props.agreement, draft.at, props.graceHours) : null;

  function next() {
    const problem = stepError(step, mode, draft, context);
    if (problem !== null) {
      setLocalError(problem);
      return;
    }
    const following = INSPECTION_STEPS[index + 1];
    if (following === undefined) return;
    if (following.key === 'charge' && checkinDays !== null && draft.billableDays === '') {
      patch({ billableDays: String(checkinDays) });
    }
    setStep(following.key);
    setLocalError(null);
  }

  function back() {
    const previous = INSPECTION_STEPS[index - 1];
    if (previous !== undefined) setStep(previous.key);
    setLocalError(null);
  }

  function submit() {
    for (const candidate of INSPECTION_STEPS) {
      const problem = stepError(candidate.key, mode, draft, context);
      if (problem !== null) {
        setStep(candidate.key);
        setLocalError(problem);
        return;
      }
    }

    // Los ajustes pueden llegar después de abrir: lo que no se tocó cuenta
    // como presente.
    const complete: InspectionDraft = {
      ...draft,
      accessories: Object.fromEntries(
        accessoryNames.map((name) => [name, draft.accessories[name] ?? true]),
      ),
    };

    if (props.mode === 'checkout') {
      const body = checkoutBody(complete);
      if (!body.ok) return setLocalError(body.message);
      props.onSubmit(body.value);
    } else {
      const body = checkinBody(complete, checkinDays ?? 1);
      if (!body.ok) return setLocalError(body.message);
      props.onSubmit(body.value);
    }
  }

  const title = mode === 'checkout' ? 'Entregar el carro' : 'Recibir el carro';

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="md:max-w-2xl max-md:h-svh max-md:max-h-none max-md:rounded-t-none">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (isLast) submit();
            else next();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{vehicle.label}</DialogDescription>
            <StepsBar index={index} />
          </DialogHeader>

          <DialogBody ref={bodyRef} className="space-y-5">
            {step === 'when' ? (
              <Question
                hint={mode === 'checkout' ? 'Cuándo sale el carro.' : 'Cuándo volvió el carro.'}
              >
                {mode === 'checkout' ? '¿A qué hora sale?' : '¿A qué hora regresó?'}
              </Question>
            ) : null}
            {step === 'when' ? (
              <DateTimeField
                id="inspection-at"
                label="Fecha y hora"
                value={draft.at}
                onChange={(event) => patch({ at: event.target.value })}
              />
            ) : null}

            {step === 'km' ? (
              <KmStep mode={mode} draft={draft} context={context} onPatch={patch} />
            ) : null}

            {step === 'damages' ? (
              <DamagesStep mode={mode} draft={draft} context={context} onPatch={patch} />
            ) : null}

            {step === 'accessories' ? (
              <AccessoriesStep
                draft={draft}
                names={accessoryNames}
                loading={settings.isPending}
                onPatch={patch}
              />
            ) : null}

            {step === 'tires' ? <TiresStep draft={draft} onPatch={patch} /> : null}

            {step === 'photos' ? <PhotosStep draft={draft} onPatch={patch} /> : null}

            {step === 'charge' && props.mode === 'checkout' ? (
              <CheckoutChargeStep
                draft={draft}
                estimatedTotal={props.estimatedTotal ?? null}
                onPatch={patch}
              />
            ) : null}

            {step === 'charge' && props.mode === 'checkin' ? (
              <CheckinChargeStep
                draft={draft}
                context={context}
                vehicle={vehicle}
                agreement={props.agreement}
                computedDays={checkinDays ?? 1}
                onPatch={patch}
              />
            ) : null}

            <FormAlert message={localError ?? props.error} />
          </DialogBody>

          <DialogFooter>
            {index > 0 ? (
              <Button type="button" variant="ghost" className="mr-auto" onClick={back}>
                <ChevronLeft className={ICON} strokeWidth={1.5} aria-hidden />
                Atrás
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" loading={props.pending}>
              {isLast ? (mode === 'checkout' ? 'Entregar carro' : 'Recibir carro') : 'Siguiente'}
              {isLast ? null : <ChevronRight className={ICON} strokeWidth={1.5} aria-hidden />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Días a cobrar al recibir en `at`: con la salida real y la gracia de ajustes. */
function computedDays(agreement: RentalAgreement, at: string, graceHours: number): number {
  const returnAt = fieldToInstant(at) ?? new Date().toISOString();
  const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;

  return billableDays(pickup, returnAt, graceHours);
}

function StepsBar({ index }: { index: number }) {
  return (
    <ol
      aria-label={`Paso ${index + 1} de ${INSPECTION_STEPS.length}: ${INSPECTION_STEPS[index]?.label ?? ''}`}
      className="mt-3 grid grid-cols-7 gap-1.5"
    >
      {INSPECTION_STEPS.map((candidate, position) => (
        <li
          key={candidate.key}
          aria-current={position === index ? 'step' : undefined}
          className={cn(
            'flex min-w-0 flex-col gap-1.5 text-label font-semibold',
            position === index
              ? 'text-text'
              : position < index
                ? 'text-text-dim'
                : 'text-text-faint',
          )}
        >
          <span
            aria-hidden
            className={cn('h-1 rounded-full', position <= index ? 'bg-flame' : 'bg-line')}
          />
          {/* Solo se rotula el paso actual: los demás son la barra. */}
          <span className={cn('truncate', position !== index && 'invisible')}>
            {candidate.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Question({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div>
      <h3 className="text-headline text-text">{children}</h3>
      {hint === undefined ? null : <p className="text-text-dim mt-1 text-body">{hint}</p>}
    </div>
  );
}

type StepProps = {
  draft: InspectionDraft;
  onPatch: (changes: Partial<InspectionDraft>) => void;
};

function KmStep({
  mode,
  draft,
  context,
  onPatch,
}: StepProps & { mode: 'checkout' | 'checkin'; context: InspectionContext }) {
  const reference =
    mode === 'checkin' && context.pickupOdometerKm !== null
      ? `Salió con ${context.pickupOdometerKm} km`
      : `El carro tenía ${context.vehicleOdometerKm} km`;

  return (
    <div className="flex flex-col gap-5">
      <Question hint={reference}>¿Cuánto marca el tablero?</Question>
      <TextField
        id="inspection-km"
        label="Kilometraje"
        inputMode="numeric"
        mono
        className="[&_input]:text-figure"
        value={draft.odometerKm}
        onChange={(event) => onPatch({ odometerKm: event.target.value.replace(/\D/g, '') })}
      />
      <div className="flex flex-col gap-2">
        <p className="text-label text-text-faint">Combustible</p>
        <FuelPicker
          value={draft.fuelEighths}
          onChange={(fuelEighths) => onPatch({ fuelEighths })}
        />
        {mode === 'checkin' && context.pickupInspection !== null ? (
          <p className="text-text-dim text-dense">
            Salió con {context.pickupInspection.fuelEighths}/8.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DamagesStep({
  mode,
  draft,
  context,
  onPatch,
}: StepProps & { mode: 'checkout' | 'checkin'; context: InspectionContext }) {
  const previousZones = new Set(
    mode === 'checkin' ? (context.pickupInspection?.damages ?? []).map((d) => d.zone) : [],
  );
  const marked = new Set(draft.damages.map((damage) => damage.zone));
  const fresh = new Set(
    mode === 'checkin'
      ? newDamages(context.pickupInspection, { damages: draft.damages }).map((d) => d.zone)
      : [],
  );

  function markOf(zone: InspectionZone): ZoneMark {
    if (fresh.has(zone)) return 'new';
    if (previousZones.has(zone)) return 'previous';
    return marked.has(zone) ? 'marked' : 'none';
  }

  function describe(zone: InspectionZone, description: string) {
    onPatch({
      damages: draft.damages.map((damage) =>
        damage.zone === zone ? { ...damage, description } : damage,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Question
        hint={
          mode === 'checkin'
            ? 'Lo punteado ya venía de la salida. Tocá una zona para marcar un daño nuevo.'
            : 'Tocá cada zona con un golpe, rayón o raspón.'
        }
      >
        ¿Dónde tiene daños?
      </Question>

      <div className="grid gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <CarDiagram
          markOf={markOf}
          onToggle={(zone) => onPatch({ damages: toggleZone(draft.damages, zone) })}
        />

        <div className="flex flex-col gap-3">
          {draft.damages.length === 0 ? (
            <p className="text-text-dim text-body">Sin daños marcados.</p>
          ) : (
            draft.damages.map((damage) => (
              <div key={damage.zone} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-semibold">
                    {INSPECTION_ZONE_LABELS[damage.zone]}
                  </span>
                  <span className="flex items-center gap-1">
                    {mode === 'checkin' ? (
                      fresh.has(damage.zone) ? (
                        <Stamp label="Nuevo" tone="red" />
                      ) : (
                        <Stamp label="Ya venía" tone="neutral" />
                      )
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onPatch({ damages: toggleZone(draft.damages, damage.zone) })}
                    >
                      <X className={ICON} strokeWidth={1.5} aria-hidden />
                      <span className="sr-only">Quitar {INSPECTION_ZONE_LABELS[damage.zone]}</span>
                    </Button>
                  </span>
                </div>
                <TextField
                  id={`damage-${damage.zone}`}
                  label="Qué tiene"
                  placeholder="Rayón de 10 cm"
                  value={damage.description}
                  onChange={(event) => describe(damage.zone, event.target.value)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AccessoriesStep({
  draft,
  names,
  loading,
  onPatch,
}: StepProps & { names: readonly string[]; loading: boolean }) {
  const missing = names.filter((name) => draft.accessories[name] === false).length;

  return (
    <div className="flex flex-col gap-4">
      <Question hint={missing === 0 ? 'Todo marcado está en el carro.' : `Faltan ${missing}.`}>
        ¿Qué accesorios tiene?
      </Question>
      {names.length === 0 ? (
        <p className="text-text-dim text-body">
          {loading ? 'Cargando la lista…' : 'No hay accesorios en los ajustes.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
          {names.map((name) => {
            const id = `accessory-${name}`;

            return (
              <li key={name}>
                <label
                  htmlFor={id}
                  className="hover:bg-surface-2 flex min-h-(--touch-min) cursor-pointer items-center gap-3 rounded-control px-2"
                >
                  <Checkbox
                    id={id}
                    checked={draft.accessories[name] ?? true}
                    onCheckedChange={(checked) =>
                      onPatch({ accessories: { ...draft.accessories, [name]: checked === true } })
                    }
                  />
                  <span
                    className={cn(
                      'text-body',
                      draft.accessories[name] === false && 'text-danger-text font-semibold',
                    )}
                  >
                    {name}
                    {draft.accessories[name] === false ? ' · falta' : ''}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TiresStep({ draft, onPatch }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Question hint="Opcional: el estado a simple vista.">¿Cómo están llantas y batería?</Question>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField
          id="tires-front"
          label="Llantas delanteras"
          placeholder="Buenas"
          value={draft.tiresFront}
          onChange={(event) => onPatch({ tiresFront: event.target.value })}
        />
        <TextField
          id="tires-rear"
          label="Llantas traseras"
          placeholder="Buenas"
          value={draft.tiresRear}
          onChange={(event) => onPatch({ tiresRear: event.target.value })}
        />
        <TextField
          id="battery"
          label="Batería"
          placeholder="Arranca bien"
          value={draft.battery}
          onChange={(event) => onPatch({ battery: event.target.value })}
        />
        <TextAreaField
          id="inspection-notes"
          label="Notas de la inspección"
          className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
          value={draft.notes}
          onChange={(event) => onPatch({ notes: event.target.value })}
        />
      </div>
    </div>
  );
}

function PhotosStep({ draft, onPatch }: StepProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const full = draft.photoIds.length >= INSPECTION_MAX_PHOTOS;

  async function add(files: FileList | null) {
    if (files === null || files.length === 0) return;
    setError(null);

    const room = INSPECTION_MAX_PHOTOS - draft.photoIds.length;
    const picked = Array.from(files).slice(0, room);
    const uploaded: string[] = [];
    setUploading(picked.length);

    for (const file of picked) {
      try {
        const { blob, name } = await resizeImage(file);
        const ref = await uploadRentalFile('INSPECTION_PHOTO', blob, name);
        uploaded.push(ref.id);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'No se pudo subir una foto.');
      }
      setUploading((count) => count - 1);
    }

    onPatch({ photoIds: [...draft.photoIds, ...uploaded] });
    if (input.current !== null) input.current.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      <Question hint="Opcional. Se reducen antes de subirse.">Fotos del carro</Question>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        id="inspection-photos"
        onChange={(event) => void add(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full sm:w-fit"
        disabled={full}
        loading={uploading > 0}
        onClick={() => input.current?.click()}
      >
        <Camera className={ICON} strokeWidth={1.5} aria-hidden />
        {uploading > 0 ? `Subiendo ${uploading}…` : 'Tomar o elegir fotos'}
      </Button>

      {error === null ? null : (
        <p className="text-danger-text text-body" role="alert">
          {error}
        </p>
      )}

      {draft.photoIds.length === 0 ? (
        <p className="text-text-dim text-body">Todavía no hay fotos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {draft.photoIds.map((id, position) => (
            <li
              key={id}
              className="border-line bg-surface-2 relative aspect-square overflow-hidden rounded-control border"
            >
              {/* `<img>` y no `next/image`: la foto la sirve el API con sesión. */}
              <img
                src={rentalFileSrc(storedFileUrl(id))}
                alt={`Foto ${position + 1}`}
                className="size-full object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-1 right-1"
                onClick={() =>
                  onPatch({ photoIds: draft.photoIds.filter((photo) => photo !== id) })
                }
              >
                <X className={ICON} strokeWidth={1.5} aria-hidden />
                <span className="sr-only">Quitar la foto {position + 1}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentFields({ draft, onPatch }: StepProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
      <TextField
        id="payment-amount"
        label="Pago ahora ($, opcional)"
        inputMode="decimal"
        placeholder="0.00"
        mono
        value={draft.paymentAmount}
        onChange={(event) => onPatch({ paymentAmount: event.target.value })}
      />
      <ChoiceField
        id="payment-method"
        label="Método del pago"
        options={PAYMENT_METHOD_OPTIONS}
        value={draft.paymentMethod}
        onChange={(value) => onPatch({ paymentMethod: value as PaymentMethod })}
      />
      {draft.paymentMethod === 'CASH' ? null : (
        <TextField
          id="payment-reference"
          label="Referencia (opcional)"
          value={draft.paymentReference}
          onChange={(event) => onPatch({ paymentReference: event.target.value })}
        />
      )}
    </div>
  );
}

const DEPOSIT_METHOD_OPTIONS = [{ value: '', label: 'Sin método' }, ...PAYMENT_METHOD_OPTIONS];

function CheckoutChargeStep({
  draft,
  estimatedTotal,
  onPatch,
}: StepProps & { estimatedTotal: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <Question hint="El depósito queda en garantía; el pago abona a la renta.">
        Depósito y pago
      </Question>
      {estimatedTotal === null ? null : (
        <AmountRow label="Total estimado de la renta" value={formatMoney(estimatedTotal)} strong />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField
          id="checkout-deposit"
          label="Depósito ($)"
          inputMode="decimal"
          placeholder="0.00"
          mono
          value={draft.deposit}
          onChange={(event) => onPatch({ deposit: event.target.value })}
        />
        <ChoiceField
          id="checkout-deposit-method"
          label="Método del depósito"
          options={DEPOSIT_METHOD_OPTIONS}
          value={draft.depositMethod}
          onChange={(value) => onPatch({ depositMethod: value as PaymentMethod | '' })}
        />
      </div>
      <PaymentFields draft={draft} onPatch={onPatch} />
    </div>
  );
}

function CheckinChargeStep({
  draft,
  context,
  vehicle,
  agreement,
  computedDays,
  onPatch,
}: StepProps & {
  context: InspectionContext;
  vehicle: InspectionVehicle;
  agreement: RentalAgreement;
  computedDays: number;
}) {
  const typed = wholeOrNull(draft.billableDays);
  const days = typeof typed === 'number' && typed > 0 ? typed : computedDays;
  const extra = checkinExtraKm(draft, context, vehicle, days);
  const finesCharged = centsToMoney(
    agreement.fines
      .filter((fine) => fine.chargedToCustomer)
      .reduce((sum, fine) => sum + moneyToCents(fine.amount), 0),
  );
  const totals = agreementTotals({
    dailyRate: agreement.dailyRate,
    cdwPerDay: agreement.cdwPerDay,
    billableDays: days,
    extraCharges: agreement.extraCharges,
    extraKmCharge: extra?.charge ?? '0.00',
    finesCharged,
    discount: agreement.discount,
    payments: agreement.payments,
  });
  const overridden = typeof typed === 'number' && typed !== computedDays;

  return (
    <div className="flex flex-col gap-4">
      <Question hint={`Calculado: ${computedDays} ${computedDays === 1 ? 'día' : 'días'}.`}>
        Días, km y depósito
      </Question>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField
          id="checkin-days"
          label="Días a cobrar"
          inputMode="numeric"
          mono
          value={draft.billableDays}
          onChange={(event) => onPatch({ billableDays: event.target.value.replace(/\D/g, '') })}
        />
        {overridden ? (
          <TextField
            id="checkin-days-note"
            label="Por qué cambian los días"
            value={draft.billableDaysNote}
            onChange={(event) => onPatch({ billableDaysNote: event.target.value })}
          />
        ) : null}
        <SwitchRow
          id="checkin-extra-km"
          label="Cobrar km extra"
          hint={
            extra === null || extra.allowed === null
              ? 'Este carro tiene km libres.'
              : `Recorrió ${extra.driven} km de ${extra.allowed} libres: ${extra.extra} km extra.`
          }
          checked={draft.chargeExtraKm}
          onCheckedChange={(chargeExtraKm) => onPatch({ chargeExtraKm })}
        />
      </div>

      <div className="border-line-soft bg-surface-2 flex flex-col gap-1.5 rounded-row border p-3.5">
        <AmountRow
          label={`Renta · ${days} ${days === 1 ? 'día' : 'días'}`}
          value={formatMoney(totals.rental)}
        />
        <AmountRow label="Km extra" value={formatMoney(extra?.charge ?? '0.00')} />
        <AmountRow label="Total" value={formatMoney(totals.total)} strong />
        <AmountRow label="Pagado" value={formatMoney(totals.paid)} />
        <AmountRow
          label="Saldo"
          value={formatMoney(totals.balance)}
          strong
          tone={moneyToCents(totals.balance) > 0 ? 'danger' : 'go'}
        />
      </div>

      <PaymentFields draft={draft} onPatch={onPatch} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField
          id="deposit-return"
          label={`Devolver del depósito ($, hay ${formatMoney(context.depositHeld)})`}
          inputMode="decimal"
          placeholder="0.00"
          mono
          value={draft.depositReturnAmount}
          onChange={(event) => onPatch({ depositReturnAmount: event.target.value })}
        />
        <ChoiceField
          id="deposit-return-method"
          label="Cómo se devuelve"
          options={DEPOSIT_METHOD_OPTIONS}
          value={draft.depositReturnMethod}
          onChange={(value) => onPatch({ depositReturnMethod: value as PaymentMethod | '' })}
        />
        <TextField
          id="deposit-return-note"
          label="Nota de la devolución (opcional)"
          className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
          value={draft.depositReturnNote}
          onChange={(event) => onPatch({ depositReturnNote: event.target.value })}
        />
        <TextAreaField
          id="checkin-notes"
          label="Observaciones de la renta"
          className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
          value={draft.agreementNotes}
          onChange={(event) => onPatch({ agreementNotes: event.target.value })}
        />
      </div>
    </div>
  );
}
