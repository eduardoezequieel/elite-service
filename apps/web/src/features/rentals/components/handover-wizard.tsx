'use client';

import {
  API_ERROR_CODES,
  INSPECTION_MAX_PHOTOS,
  INSPECTION_ZONE_LABELS,
  PERMISSIONS,
  billableDays,
  centsToMoney,
  createPaymentSchema,
  moneyToCents,
  newDamages,
  storedFileUrl,
} from '@elite/shared';
import type { InspectionZone, PaymentMethod, RentalAgreement } from '@elite/shared';
import { Camera, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import {
  useAddRentalPayment,
  useReturnRentalDeposit,
} from '@/features/rental-billing/hooks/use-rental-billing';
import { rentalFileSrc, uploadRentalFile } from '@/features/rental-settings/api';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { ApiError } from '@/lib/api';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import { fieldToInstant, nowField } from '../datetime';
import { moneyOrNull, textOrNull } from '../form-draft';
import { useCheckinAgreement, useCheckoutAgreement } from '../hooks/use-agreements';
import {
  INSPECTION_STEPS,
  checkinBody,
  checkinExtraKm,
  checkoutBody,
  clearInspectionDraft,
  initialDraft,
  inspectionDraftKey,
  readInspectionDraft,
  stepError,
  toggleZone,
  writeInspectionDraft,
  type InspectionDraft,
  type InspectionMode,
  type InspectionStep,
} from '../inspection-draft';
import { resizeImage } from '../resize-image';
import { CarDiagram, type ZoneMark } from './car-diagram';
import { FuelPicker } from './fuel-picker';
import { ChoiceField, DateTimeField, SwitchRow } from './rental-fields';

/** `sessionStorage` puede tirar en modo privado. */
function draftStore(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const FULLSCREEN =
  'max-md:h-svh max-md:max-h-none max-md:rounded-none md:max-w-2xl [[data-density=bahia]_&]:md:inset-0 [[data-density=bahia]_&]:md:top-0 [[data-density=bahia]_&]:md:left-0 [[data-density=bahia]_&]:md:h-svh [[data-density=bahia]_&]:md:max-h-none [[data-density=bahia]_&]:md:w-full [[data-density=bahia]_&]:md:max-w-none [[data-density=bahia]_&]:md:translate-x-0 [[data-density=bahia]_&]:md:translate-y-0 [[data-density=bahia]_&]:md:rounded-none';

/**
 * Entregar o recibir (108): kilometraje, golpes y cobro. El pago va en un
 * segundo pedido para que un 409 de caja no deshaga la entrega.
 */
export function HandoverWizard({
  mode,
  agreement,
  graceHours,
  onClose,
}: {
  mode: InspectionMode;
  agreement: RentalAgreement;
  graceHours: number;
  onClose: () => void;
}) {
  const { can, canAny } = usePermissions();
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const accessoryNames = settings.data?.accessories ?? [];
  const checkout = useCheckoutAgreement();
  const checkin = useCheckinAgreement();
  const addPayment = useAddRentalPayment(agreement.id);
  const returnDeposit = useReturnRentalDeposit(agreement.id);
  const key = inspectionDraftKey(agreement.id, mode);
  const context = {
    vehicleOdometerKm: agreement.vehicle.odometerKm,
    pickupInspection: agreement.pickupInspection,
    pickupOdometerKm: agreement.pickupOdometerKm,
    deposit: agreement.deposit,
    depositMethod: agreement.depositMethod,
    depositHeld: agreement.depositHeld,
  };

  const [draft, setDraft] = useState<InspectionDraft>(() => {
    const fresh = initialDraft(mode, context, accessoryNames, nowField());
    const store = draftStore();
    if (store === null) return fresh;

    return readInspectionDraft(store, key) ?? fresh;
  });
  const [step, setStep] = useState<InspectionStep>('km');
  const [localError, setLocalError] = useState<string | null>(null);
  const [handedOver, setHandedOver] = useState(false);
  const [cashClosed, setCashClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnHeld, setReturnHeld] = useState(moneyToCents(agreement.depositHeld) > 0);
  const [retainNote, setRetainNote] = useState('');
  const seededPayment = useRef(false);

  useEffect(() => {
    if (handedOver) return;
    const store = draftStore();
    if (store !== null) writeInspectionDraft(store, key, draft);
  }, [draft, handedOver, key]);

  const index = INSPECTION_STEPS.findIndex((candidate) => candidate.key === step);
  const days = checkinDays(agreement, draft.at, graceHours);
  const extra =
    mode === 'checkin'
      ? checkinExtraKm(draft, context, agreement.vehicle, days)
      : null;

  useEffect(() => {
    if (step !== 'charge' || seededPayment.current || draft.paymentAmount !== '') return;
    seededPayment.current = true;
    const cents = Math.max(
      0,
      moneyToCents(agreement.totals.balance) +
        (mode === 'checkin' ? moneyToCents(extra?.charge ?? '0') : 0),
    );
    if (cents > 0) setDraft((previous) => ({ ...previous, paymentAmount: centsToMoney(cents) }));
  }, [agreement.totals.balance, draft.paymentAmount, extra?.charge, mode, step]);

  function patch(changes: Partial<InspectionDraft>) {
    setDraft((previous) => ({ ...previous, ...changes }));
    setLocalError(null);
  }

  function problemAt(target: InspectionStep): string | null {
    return stepError(target, mode, draft, context);
  }

  function go(target: InspectionStep) {
    const targetIndex = INSPECTION_STEPS.findIndex((candidate) => candidate.key === target);
    if (targetIndex > index) {
      for (let cursor = index; cursor < targetIndex; cursor += 1) {
        const candidate = INSPECTION_STEPS[cursor];
        if (candidate === undefined) continue;
        const problem = problemAt(candidate.key);
        if (problem !== null) {
          setStep(candidate.key);
          setLocalError(problem);
          return;
        }
      }
    }
    setStep(target);
    setLocalError(null);
  }

  function close() {
    if (!handedOver) {
      const store = draftStore();
      if (store !== null) writeInspectionDraft(store, key, draft);
    }
    onClose();
  }

  async function submit() {
    if (handedOver || busy) return;
    for (const candidate of INSPECTION_STEPS) {
      const problem = problemAt(candidate.key);
      if (problem !== null) {
        setStep(candidate.key);
        setLocalError(problem);
        return;
      }
    }

    const complete: InspectionDraft = {
      ...draft,
      paymentAmount: '',
      depositReturnAmount: '',
      accessories: Object.fromEntries(
        accessoryNames.map((name) => [name, draft.accessories[name] ?? true]),
      ),
      agreementNotes:
        mode === 'checkin' && !returnHeld && retainNote.trim() !== ''
          ? [draft.agreementNotes, `Garantía retenida: ${retainNote.trim()}`]
              .filter((part) => part.trim() !== '')
              .join('\n')
          : draft.agreementNotes,
    };

    setBusy(true);
    setLocalError(null);
    try {
      if (mode === 'checkout') {
        const body = checkoutBody(complete);
        if (!body.ok) {
          setLocalError(body.message);
          return;
        }
        await checkout.mutateAsync({ id: agreement.id, input: body.value });
      } else {
        const body = checkinBody(complete, days);
        if (!body.ok) {
          setLocalError(body.message);
          return;
        }
        await checkin.mutateAsync({ id: agreement.id, input: body.value });
      }
      setHandedOver(true);
      const store = draftStore();
      if (store !== null) clearInspectionDraft(store, key);

      const amount = moneyOrNull(draft.paymentAmount);
      if (canCharge && amount !== null && moneyToCents(amount) > 0) {
        const payment = createPaymentSchema.safeParse({
          amount,
          method: draft.paymentMethod,
          reference: textOrNull(draft.paymentReference),
        });
        if (!payment.success) {
          setLocalError(payment.error.issues[0]?.message ?? 'Revisá el cobro.');
          return;
        }
        try {
          await addPayment.mutateAsync(payment.data);
        } catch (error) {
          if (error instanceof ApiError && error.code === API_ERROR_CODES.CASH_NOT_OPEN) {
            setCashClosed(true);
            return;
          }
          setLocalError(error instanceof ApiError ? error.message : 'No se pudo cobrar.');
          return;
        }
      }

      if (
        mode === 'checkin' &&
        canCharge &&
        returnHeld &&
        moneyToCents(agreement.depositHeld) > 0
      ) {
        await returnDeposit.mutateAsync({ amount: agreement.depositHeld });
      }
      onClose();
    } catch (error) {
      setLocalError(error instanceof ApiError ? error.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  const fresh = newDamages(agreement.pickupInspection, { damages: draft.damages });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className={FULLSCREEN}>
        <DialogHeader>
          <DialogTitle>{mode === 'checkout' ? 'Entregar' : 'Recibir'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {INSPECTION_STEPS.map((candidate, position) => (
              <button
                key={candidate.key}
                type="button"
                className={cn(
                  'min-h-(--touch-min) rounded-full px-3 text-dense font-semibold',
                  position === index ? 'bg-surface-2 text-text' : 'text-text-dim',
                )}
                onClick={() => go(candidate.key)}
              >
                {candidate.label}
              </button>
            ))}
          </div>

          {step === 'km' ? (
            <div className="flex flex-col gap-4">
              <DateTimeField
                id="handover-at"
                label="Hora"
                value={draft.at}
                onChange={(event) => patch({ at: event.target.value })}
              />
              <TextField
                id="handover-km"
                label="Km"
                inputMode="numeric"
                mono
                value={draft.odometerKm}
                onChange={(event) => patch({ odometerKm: event.target.value.replace(/\D/g, '') })}
              />
              <FuelPicker
                scale="quarters"
                value={draft.fuelEighths}
                invalid={localError !== null && draft.fuelEighths === null}
                onChange={(fuelEighths) => patch({ fuelEighths })}
              />
              <TextAreaField
                id="handover-note"
                label="Nota"
                value={draft.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </div>
          ) : null}

          {step === 'damages' ? (
            <div className="flex flex-col gap-4">
              <CarDiagram
                markOf={(zone) => markOf(mode, agreement, draft, zone)}
                locked={
                  mode === 'checkin'
                    ? (zone) =>
                        agreement.pickupInspection?.damages.some((damage) => damage.zone === zone) ===
                        true
                    : undefined
                }
                onToggle={(zone) => {
                  if (
                    mode === 'checkin' &&
                    agreement.pickupInspection?.damages.some((damage) => damage.zone === zone)
                  ) {
                    return;
                  }
                  patch({ damages: toggleZone(draft.damages, zone) });
                }}
              />
              {mode === 'checkin' && fresh.length > 0 ? (
                <p className="text-danger-text text-body font-semibold">
                  {fresh.map((damage) => INSPECTION_ZONE_LABELS[damage.zone]).join(', ')}
                </p>
              ) : null}
              <AccessoryChips
                names={accessoryNames}
                draft={draft}
                onPatch={patch}
              />
              <Photos draft={draft} onPatch={patch} />
            </div>
          ) : null}

          {step === 'charge' ? (
            <div className="flex flex-col gap-4">
              <p className="text-title tabular-nums">
                Debe {formatMoneyCompact(agreement.totals.balance)}
              </p>
              {mode === 'checkout' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                  <TextField
                    id="handover-deposit"
                    label="Garantía"
                    inputMode="decimal"
                    mono
                    value={draft.deposit}
                    onChange={(event) => patch({ deposit: event.target.value })}
                  />
                  <ChoiceField
                    id="handover-deposit-method"
                    label="Método"
                    options={[{ value: '', label: 'Sin método' }, ...PAYMENT_METHOD_OPTIONS]}
                    value={draft.depositMethod}
                    onChange={(value) => patch({ depositMethod: value as PaymentMethod | '' })}
                  />
                </div>
              ) : null}
              {canCharge ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                  <TextField
                    id="handover-amount"
                    label="Monto"
                    inputMode="decimal"
                    mono
                    value={draft.paymentAmount}
                    onChange={(event) => patch({ paymentAmount: event.target.value })}
                  />
                  <ChoiceField
                    id="handover-method"
                    label="Método"
                    options={PAYMENT_METHOD_OPTIONS}
                    value={draft.paymentMethod}
                    onChange={(value) => patch({ paymentMethod: value as PaymentMethod })}
                  />
                </div>
              ) : null}
              {mode === 'checkin' && canCharge && moneyToCents(agreement.depositHeld) > 0 ? (
                <>
                  <SwitchRow
                    id="handover-return"
                    label="Devolver garantía"
                    checked={returnHeld}
                    onCheckedChange={setReturnHeld}
                  />
                  {returnHeld ? null : (
                    <TextField
                      id="handover-retain"
                      label="Nota"
                      value={retainNote}
                      onChange={(event) => setRetainNote(event.target.value)}
                    />
                  )}
                </>
              ) : null}
              {cashClosed ? (
                <p className="text-danger-text text-body font-semibold" role="alert">
                  Abrí la caja para cobrar.{' '}
                  <Link href="/rentals/cash" className="underline underline-offset-4">
                    Caja
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <FormAlert message={localError} />
        </DialogBody>
        <DialogFooter>
          {index > 0 ? (
            <Button type="button" variant="secondary" onClick={() => go(INSPECTION_STEPS[index - 1]!.key)}>
              Atrás
            </Button>
          ) : null}
          {index < INSPECTION_STEPS.length - 1 ? (
            <Button type="button" onClick={() => go(INSPECTION_STEPS[index + 1]!.key)}>
              Seguir
            </Button>
          ) : (
            <Button type="button" loading={busy} disabled={handedOver} onClick={() => void submit()}>
              {mode === 'checkout' ? 'Entregar' : 'Recibir'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function checkinDays(agreement: RentalAgreement, at: string, graceHours: number): number {
  const instant = fieldToInstant(at);
  const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  if (instant === null) return agreement.billableDays;
  return billableDays(pickup, instant, graceHours);
}

function markOf(
  mode: InspectionMode,
  agreement: RentalAgreement,
  draft: InspectionDraft,
  zone: InspectionZone,
): ZoneMark {
  const marked = draft.damages.some((damage) => damage.zone === zone);
  if (!marked) return 'none';
  if (mode === 'checkout') return 'marked';
  const previous = agreement.pickupInspection?.damages.some((damage) => damage.zone === zone);
  return previous ? 'previous' : 'new';
}

function AccessoryChips({
  names,
  draft,
  onPatch,
}: {
  names: readonly string[];
  draft: InspectionDraft;
  onPatch: (changes: Partial<InspectionDraft>) => void;
}) {
  if (names.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {names.map((name) => {
        const present = draft.accessories[name] ?? true;
        return (
          <li key={name}>
            <button
              type="button"
              aria-pressed={present}
              className={cn(
                'min-h-(--touch-min) rounded-full border px-3 text-dense font-semibold',
                present ? 'border-line bg-surface' : 'border-danger text-danger-text',
              )}
              onClick={() =>
                onPatch({ accessories: { ...draft.accessories, [name]: !present } })
              }
            >
              {name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Photos({
  draft,
  onPatch,
}: {
  draft: InspectionDraft;
  onPatch: (changes: Partial<InspectionDraft>) => void;
}) {
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
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        id="handover-photos"
        onChange={(event) => void add(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={full}
        loading={uploading > 0}
        onClick={() => input.current?.click()}
      >
        <Camera className="size-icon" strokeWidth={1.5} aria-hidden />
        Fotos
      </Button>
      {error === null ? null : (
        <p className="text-danger-text text-body" role="alert">
          {error}
        </p>
      )}
      {draft.photoIds.length === 0 ? null : (
        <ul className="grid grid-cols-3 gap-2">
          {draft.photoIds.map((id, position) => (
            <li key={id} className="border-line relative aspect-square overflow-hidden rounded-control border">
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
                onClick={() => onPatch({ photoIds: draft.photoIds.filter((photo) => photo !== id) })}
              >
                <X className="size-icon" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">Quitar la foto {position + 1}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
