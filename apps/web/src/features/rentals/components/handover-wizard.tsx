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
  storedFileUrl,
} from '@elite/shared';
import type { InspectionZone, PaymentMethod, RentalAgreement } from '@elite/shared';
import { Camera, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { PAYMENT_METHOD_OPTIONS, accountLines } from '../agreement-format';
import type { ZoneState } from '../car-3d-scene';
import { fieldToInstant, nowField } from '../datetime';
import { moneyOrNull, textOrNull } from '../form-draft';
import { useCheckinAgreement, useCheckoutAgreement } from '../hooks/use-agreements';
import {
  INSPECTION_STEPS,
  addDamageLine,
  checkinBody,
  checkinPreview,
  checkinExtraKm,
  checkoutBody,
  clearInspectionDraft,
  initialDraft,
  inspectionDraftKey,
  readInspectionDraft,
  removeDamageLine,
  stepError,
  toggleDamageZone,
  toggleZone,
  writeInspectionDraft,
  type InspectionDraft,
  type InspectionMode,
  type InspectionStep,
} from '../inspection-draft';
import { resizeImage } from '../resize-image';
import { AccountLineRow } from './agreement-account';
import { Car3dViewer } from './car-3d-viewer';
import { CarDiagram, type ZoneMark } from './car-diagram';
import { DamageLines } from './damage-lines';
import { FuelGauge } from './fuel-gauge';
import { AmountRow, ChoiceField, DateTimeField, SwitchRow } from './rental-fields';

/** `sessionStorage` puede tirar en modo privado. */
function draftStore(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Recibir (126) lleva la cuenta al costado en escritorio: el diálogo se ensancha. */
export const WIDE = 'md:max-w-2xl lg:max-w-5xl';

/** Pantalla completa en el teléfono y en `bahia` (108); el cambio de carro (127) la reutiliza. */
export const FULLSCREEN =
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
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [hoverZone, setHoverZone] = useState<InspectionZone | null>(null);
  const [listZone, setListZone] = useState<InspectionZone | null>(null);

  useEffect(() => {
    if (handedOver) return;
    const store = draftStore();
    if (store !== null) writeInspectionDraft(store, key, draft);
  }, [draft, handedOver, key]);

  const index = INSPECTION_STEPS.findIndex((candidate) => candidate.key === step);
  const days = checkinDays(agreement, draft.at, graceHours);
  const extra = mode === 'checkin' ? checkinExtraKm(draft, context, agreement.vehicle, days) : null;

  const preview =
    mode === 'checkin' ? checkinPreview(agreement, draft, days, extra?.charge ?? '0.00') : null;
  /** Lo que se debe al cerrar este paso: en la recepción ya trae combustible y daños (126). */
  const owed = preview?.totals.balance ?? agreement.totals.balance;

  // El monto a cobrar se prellena con el saldo y lo sigue mientras nadie lo escriba.
  useEffect(() => {
    if (step !== 'charge' || paymentTouched) return;
    const cents = Math.max(0, moneyToCents(owed));
    const amount = cents > 0 ? centsToMoney(cents) : '';
    setDraft((previous) =>
      previous.paymentAmount === amount ? previous : { ...previous, paymentAmount: amount },
    );
  }, [owed, paymentTouched, step]);

  const pickupDamages = agreement.pickupInspection?.damages;
  const zoneStates = useMemo(() => {
    const states: Partial<Record<InspectionZone, ZoneState>> = {};
    for (const line of draft.damageLines) if (line.zone !== null) states[line.zone] = 'new';
    for (const damage of pickupDamages ?? []) states[damage.zone] = 'old';
    return states;
  }, [draft.damageLines, pickupDamages]);

  const toggleReturnZone = useCallback(
    (zone: InspectionZone) => {
      setDraft((previous) => ({
        ...previous,
        ...toggleDamageZone(previous, zone, agreement.pickupInspection),
      }));
      setLocalError(null);
    },
    [agreement.pickupInspection],
  );

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

  const receiving = mode === 'checkin';
  const account =
    preview === null ? null : (
      <ReturnAccount lines={accountLines(preview.account)} totals={preview.totals} />
    );

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className={cn(FULLSCREEN, receiving && WIDE)}>
        <DialogHeader>
          <DialogTitle>{receiving ? 'Recibir' : 'Entregar'}</DialogTitle>
        </DialogHeader>
        <DialogBody
          className={cn(
            'grid grid-cols-1 items-start gap-5',
            account !== null &&
              'lg:grid-cols-[minmax(0,1fr)_20rem] [[data-density=bahia]_&]:lg:grid-cols-1',
          )}
        >
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {INSPECTION_STEPS.map((candidate, position) => (
                <button
                  key={candidate.key}
                  type="button"
                  aria-current={position === index ? 'step' : undefined}
                  className={cn(
                    'min-h-(--touch-min) rounded-full px-3 text-dense font-semibold',
                    '[[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:text-body',
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
                  label="Fecha"
                  value={draft.at}
                  onChange={(at) => patch({ at })}
                />
                <TextField
                  id="handover-km"
                  label="Km"
                  inputMode="numeric"
                  mono
                  value={draft.odometerKm}
                  onChange={(event) => patch({ odometerKm: event.target.value.replace(/\D/g, '') })}
                />
                {receiving ? (
                  <div className="grid grid-cols-1 items-center justify-items-center gap-4 min-[560px]:grid-cols-[minmax(0,var(--gauge-w))_minmax(0,1fr)] min-[560px]:justify-items-stretch [[data-density=bahia]_&]:grid-cols-1 [[data-density=bahia]_&]:justify-items-center">
                    <FuelGauge
                      value={draft.fuelEighths}
                      pickup={agreement.pickupInspection?.fuelEighths ?? null}
                      invalid={localError !== null && draft.fuelEighths === null}
                      onChange={(fuelEighths) => patch({ fuelEighths })}
                    />
                    <TextField
                      id="handover-fuel-amount"
                      label="Combustible ($)"
                      inputMode="decimal"
                      mono
                      placeholder="0.00"
                      className="w-full"
                      value={draft.fuelAmount}
                      onChange={(event) => patch({ fuelAmount: event.target.value })}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <FuelGauge
                      pickup={null}
                      value={draft.fuelEighths}
                      invalid={localError !== null && draft.fuelEighths === null}
                      onChange={(fuelEighths) => patch({ fuelEighths })}
                    />
                  </div>
                )}
                <TextAreaField
                  id="handover-note"
                  label="Nota"
                  value={draft.notes}
                  onChange={(event) => patch({ notes: event.target.value })}
                />
              </div>
            ) : null}

            {step === 'damages' && receiving ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 items-start gap-4 min-[560px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] [[data-density=bahia]_&]:grid-cols-1">
                  <Car3dViewer
                    states={zoneStates}
                    listZone={listZone}
                    onToggle={toggleReturnZone}
                    onHover={setHoverZone}
                    fallback={
                      <CarDiagram
                        markOf={(zone) => markOf(mode, agreement, draft, zone)}
                        locked={(zone) => zoneStates[zone] === 'old'}
                        onToggle={toggleReturnZone}
                      />
                    }
                  />
                  <div className="flex flex-col gap-3">
                    <DamageLines
                      lines={draft.damageLines}
                      activeZone={hoverZone}
                      onPointZone={setListZone}
                      onAdd={() => patch({ damageLines: addDamageLine(draft.damageLines) })}
                      onRemove={(id) => {
                        setListZone(null);
                        patch(removeDamageLine(draft, id));
                      }}
                      onChange={(id, changes) =>
                        patch({
                          damageLines: draft.damageLines.map((line) =>
                            line.id === id ? { ...line, ...changes } : line,
                          ),
                        })
                      }
                    />
                    {preview !== null && moneyToCents(preview.charges.damagesSum) > 0 ? (
                      <p className="text-body text-text-dim tabular-nums">
                        {agreement.coverage === 'ACCEPTED' ? (
                          <>
                            Paga hasta{' '}
                            <b className="text-text font-mono">
                              {formatMoneyCompact(agreement.deductible)}
                            </b>
                            {' · '}
                          </>
                        ) : null}
                        Cobra{' '}
                        <b className="text-text font-mono">
                          {formatMoneyCompact(preview.charges.damageCharge)}
                        </b>
                      </p>
                    ) : null}
                    {pickupDamages === undefined || pickupDamages.length === 0 ? null : (
                      <ul className="text-dense text-text-faint flex flex-col gap-0.5">
                        {pickupDamages.map((damage) => (
                          <li key={damage.zone} className="flex items-center gap-1.5">
                            <span aria-hidden className="bg-warn-text/45 size-2 rounded-[2px]" />
                            {INSPECTION_ZONE_LABELS[damage.zone]}
                            <span className="sr-only"> (ya venía)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <AccessoryChips names={accessoryNames} draft={draft} onPatch={patch} />
                <Photos draft={draft} onPatch={patch} />
              </div>
            ) : null}

            {step === 'damages' && !receiving ? (
              <div className="flex flex-col gap-4">
                <Car3dViewer
                  states={Object.fromEntries(
                    draft.damages.map((damage) => [damage.zone, 'new' as const]),
                  )}
                  listZone={null}
                  onToggle={(zone) => patch({ damages: toggleZone(draft.damages, zone) })}
                  onHover={() => undefined}
                  fallback={
                    <CarDiagram
                      markOf={(zone) => markOf(mode, agreement, draft, zone)}
                      onToggle={(zone) => patch({ damages: toggleZone(draft.damages, zone) })}
                    />
                  }
                />
                <AccessoryChips names={accessoryNames} draft={draft} onPatch={patch} />
                <Photos draft={draft} onPatch={patch} />
              </div>
            ) : null}

            {step === 'charge' ? (
              <div className="flex flex-col gap-4">
                {account === null ? (
                  <p className="text-title tabular-nums">Debe {formatMoneyCompact(owed)}</p>
                ) : (
                  <div className="lg:hidden [[data-density=bahia]_&]:block">{account}</div>
                )}
                {receiving ? null : (
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
                )}
                {canCharge && moneyToCents(owed) > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                    <TextField
                      id="handover-amount"
                      label="Monto"
                      inputMode="decimal"
                      mono
                      value={draft.paymentAmount}
                      onChange={(event) => {
                        setPaymentTouched(true);
                        patch({ paymentAmount: event.target.value });
                      }}
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
                {receiving && canCharge && moneyToCents(agreement.depositHeld) > 0 ? (
                  <>
                    <SwitchRow
                      id="handover-return"
                      label={`Devolver garantía ${formatMoneyCompact(agreement.depositHeld)}`}
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
                    Abra la caja para cobrar.{' '}
                    <Link href="/rentals/cash" className="underline underline-offset-4">
                      Caja
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            <FormAlert message={localError} />
          </div>
          {account === null ? null : (
            <aside className="sticky top-0 hidden lg:block [[data-density=bahia]_&]:hidden">
              {account}
            </aside>
          )}
        </DialogBody>
        <DialogFooter>
          {index > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => go(INSPECTION_STEPS[index - 1]!.key)}
            >
              Atrás
            </Button>
          ) : null}
          {index < INSPECTION_STEPS.length - 1 ? (
            <Button type="button" onClick={() => go(INSPECTION_STEPS[index + 1]!.key)}>
              Seguir
            </Button>
          ) : (
            <Button
              type="button"
              loading={busy}
              disabled={handedOver}
              onClick={() => void submit()}
            >
              {receiving ? 'Recibir' : 'Entregar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * La cuenta de la recepción (126): los renglones de `accountLines`, el total,
 * lo pagado y lo que se debe o se devuelve. Solo lectura.
 */
function ReturnAccount({
  lines,
  totals,
}: {
  lines: ReturnType<typeof accountLines>;
  totals: { total: string; paid: string; balance: string };
}) {
  const balance = moneyToCents(totals.balance);
  const give = balance < 0;

  return (
    <div className="bg-surface-2 border-line-soft flex flex-col gap-2 rounded-row border p-4 [[data-density=bahia]_&]:p-5">
      <p className="text-body font-semibold">Cuenta</p>
      {lines.map((line) => (
        <AccountLineRow key={line.key} line={line} />
      ))}
      <div className="border-line-soft my-1 border-t" />
      <AmountRow label="Total" value={formatMoneyCompact(totals.total)} />
      <AmountRow label="Pagado" value={`−${formatMoneyCompact(totals.paid)}`} tone="go" />
      <div className="border-line flex items-baseline justify-between gap-3 border-t pt-3">
        <span className="text-body font-semibold">{give ? 'Devolver' : 'Debe'}</span>
        <b
          className={cn(
            'font-display text-figure italic tabular-nums',
            give ? 'text-go-text' : 'text-text',
          )}
        >
          {formatMoneyCompact(centsToMoney(Math.abs(balance)))}
        </b>
      </div>
    </div>
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

/** Los accesorios del paso Golpes, también en «Entregar» del cambio de carro (127). */
export function AccessoryChips({
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
    <section aria-labelledby="accessories-title" className="flex flex-col gap-2">
      <p
        id="accessories-title"
        className="text-dense text-text-dim [[data-density=bahia]_&]:text-body"
      >
        <b className="text-text font-semibold">Accesorios</b> · toque lo que falta
      </p>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => {
          const present = draft.accessories[name] ?? true;
          return (
            <li key={name}>
              <button
                type="button"
                aria-pressed={present}
                aria-label={`${name}: ${present ? 'está' : 'falta'}`}
                className={cn(
                  'inline-flex min-h-(--touch-min) items-center gap-1.5 rounded-full border px-3 text-dense font-semibold',
                  present
                    ? 'border-line bg-surface'
                    : 'border-danger bg-danger/10 text-danger-text line-through',
                )}
                onClick={() => onPatch({ accessories: { ...draft.accessories, [name]: !present } })}
              >
                {present ? (
                  <Check aria-hidden className="text-go-text size-4 shrink-0" />
                ) : (
                  <X aria-hidden className="size-4 shrink-0" />
                )}
                {name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Las fotos del paso Golpes, también en «Entregar» del cambio de carro (127). */
export function Photos({
  draft,
  onPatch,
  inputId = 'handover-photos',
}: {
  draft: InspectionDraft;
  onPatch: (changes: Partial<InspectionDraft>) => void;
  inputId?: string;
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
        id={inputId}
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
            <li
              key={id}
              className="border-line relative aspect-square overflow-hidden rounded-control border"
            >
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
