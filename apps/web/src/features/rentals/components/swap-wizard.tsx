'use client';

import {
  API_ERROR_CODES,
  INSPECTION_ZONE_LABELS,
  PERMISSIONS,
  agreementVehicleLabel,
  fuelLabel,
  moneyToCents,
  rateForDays,
  rentalWhenLabel,
} from '@elite/shared';
import type { InspectionZone, RentalAgreement } from '@elite/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

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
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import type { ApiError } from '@/lib/api';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ZoneState } from '../car-3d-scene';
import { nowField } from '../datetime';
import { useSwapAgreement } from '../hooks/use-agreements';
import {
  addDamageLine,
  removeDamageLine,
  toggleDamageZone,
  toggleZone,
  type InspectionDraft,
} from '../inspection-draft';
import {
  SWAP_REASONS,
  SWAP_STEPS,
  initialSwapDraft,
  pickSwapVehicle,
  swapBody,
  swapPreview,
  swapStepError,
  type SwapDraft,
  type SwapRateMode,
  type SwapStep,
} from '../swap-draft';
import { Car3dViewer } from './car-3d-viewer';
import { CarDiagram } from './car-diagram';
import { DamageLines } from './damage-lines';
import { FuelGauge } from './fuel-gauge';
import { AccessoryChips, FULLSCREEN, Photos, WIDE } from './handover-wizard';
import { OptionButton } from './new-rental-contract-step';
import { AmountRow, DateTimeField } from './rental-fields';
import { VehicleAvailabilityField } from './vehicle-availability-field';

/**
 * Cambiar de carro (127 RN-5), como Riveras: Recibir el actual (km,
 * combustible, daños y por qué) → Entregar el nuevo (carro libre, km,
 * combustible, golpes, fotos y tarifa) → Listo (las dos rentas). Un solo
 * pedido: el API cierra una, abre la otra y pasa garantía y excedente.
 */
export function SwapWizard({
  agreement,
  graceHours,
  onClose,
}: {
  agreement: RentalAgreement;
  graceHours: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { canAny } = usePermissions();
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const accessoryNames = settings.data?.accessories ?? [];
  const swap = useSwapAgreement();
  const [draft, setDraft] = useState<SwapDraft>(() =>
    initialSwapDraft(agreement, accessoryNames, nowField()),
  );
  const [step, setStep] = useState<SwapStep>('return');
  const [error, setError] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<InspectionZone | null>(null);
  const [listZone, setListZone] = useState<InspectionZone | null>(null);
  const index = SWAP_STEPS.findIndex((candidate) => candidate.key === step);
  const preview = swapPreview(agreement, draft, graceHours);
  const pickupDamages = agreement.pickupInspection?.damages;

  const zoneStates = useMemo(() => {
    const states: Partial<Record<InspectionZone, ZoneState>> = {};
    for (const line of draft.returned.damageLines)
      if (line.zone !== null) states[line.zone] = 'new';
    for (const damage of pickupDamages ?? []) states[damage.zone] = 'old';
    return states;
  }, [draft.returned.damageLines, pickupDamages]);

  function patch(changes: Partial<SwapDraft>) {
    setDraft((previous) => ({ ...previous, ...changes }));
    setError(null);
  }

  function patchReturned(changes: Partial<InspectionDraft>) {
    setDraft((previous) => ({ ...previous, returned: { ...previous.returned, ...changes } }));
    setError(null);
  }

  function patchPickup(changes: Partial<InspectionDraft>) {
    setDraft((previous) => ({ ...previous, pickup: { ...previous.pickup, ...changes } }));
    setError(null);
  }

  const toggleReturnZone = useCallback(
    (zone: InspectionZone) => {
      setDraft((previous) => ({
        ...previous,
        returned: {
          ...previous.returned,
          ...toggleDamageZone(previous.returned, zone, agreement.pickupInspection),
        },
      }));
      setError(null);
    },
    [agreement.pickupInspection],
  );

  function go(target: SwapStep) {
    const targetIndex = SWAP_STEPS.findIndex((candidate) => candidate.key === target);
    for (let cursor = index; cursor < targetIndex; cursor += 1) {
      const candidate = SWAP_STEPS[cursor];
      if (candidate === undefined) continue;
      const problem = swapStepError(candidate.key, draft, agreement, graceHours);
      if (problem !== null) {
        setStep(candidate.key);
        setError(problem);
        return;
      }
    }
    setStep(target);
    setError(null);
  }

  function withAccessories(inspection: InspectionDraft): InspectionDraft {
    return {
      ...inspection,
      accessories: Object.fromEntries(
        accessoryNames.map((name) => [name, inspection.accessories[name] ?? true]),
      ),
    };
  }

  function submit() {
    const body = swapBody(
      {
        ...draft,
        returned: withAccessories(draft.returned),
        pickup: withAccessories(draft.pickup),
      },
      agreement,
      graceHours,
    );
    if (!body.ok) {
      setError(body.message);
      return;
    }
    setError(null);
    swap.mutate(
      { id: agreement.id, input: body.value },
      {
        onSuccess: ({ opened }) => {
          toast({
            title: 'Carro cambiado',
            description:
              opened.contractNumber === null ? undefined : `Sigue en N° ${opened.contractNumber}`,
          });
          onClose();
          router.push(`/rentals/agreements/${opened.id}`);
        },
        onError: (apiError) => {
          if (
            apiError.code === API_ERROR_CODES.VEHICLE_UNAVAILABLE ||
            apiError.code === API_ERROR_CODES.VEHICLE_NOT_RENTABLE
          ) {
            setStep('pickup');
          } else if (detailsMention(apiError, 'returnInspection')) {
            setStep('return');
          }
          setError(apiError.message);
        },
      },
    );
  }

  const vehicle = draft.vehicle;
  const tierRate = vehicle === null ? null : rateForDays(vehicle, preview.window.openedDays);
  const rateOptions: { mode: SwapRateMode; label: ReactNode }[] = [
    {
      mode: 'same',
      label: (
        <>
          La misma <Money value={agreement.dailyRate} />
        </>
      ),
    },
    ...(tierRate === null || moneyToCents(tierRate) === moneyToCents(agreement.dailyRate)
      ? []
      : [
          {
            mode: 'vehicle' as const,
            label: (
              <>
                Del carro <Money value={tierRate} />
              </>
            ),
          },
        ]),
    { mode: 'other', label: 'Otra' },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(FULLSCREEN, WIDE)}>
        <DialogHeader>
          <DialogTitle>Cambiar carro</DialogTitle>
          <DialogDescription>
            {agreementVehicleLabel(agreement.vehicle)} · {agreement.customer.fullName}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {SWAP_STEPS.map((candidate, position) => (
              <button
                key={candidate.key}
                type="button"
                aria-current={position === index ? 'step' : undefined}
                disabled={position > index}
                className={cn(
                  'min-h-(--touch-min) rounded-full px-3 text-dense font-semibold disabled:opacity-100',
                  '[[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:text-body',
                  position === index ? 'bg-surface-2 text-text' : 'text-text-dim',
                )}
                onClick={() => go(candidate.key)}
              >
                {position + 1}. {candidate.label}
              </button>
            ))}
          </div>

          {step === 'return' ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                <DateTimeField
                  id="swap-at"
                  label="Cuándo se cambia"
                  value={draft.returned.at}
                  onChange={(at) => patchReturned({ at })}
                />
                <TextField
                  id="swap-km-in"
                  label={
                    agreement.pickupOdometerKm === null
                      ? 'Km que entra'
                      : `Km que entra · desde ${agreement.pickupOdometerKm}`
                  }
                  inputMode="numeric"
                  mono
                  value={draft.returned.odometerKm}
                  onChange={(event) =>
                    patchReturned({ odometerKm: event.target.value.replace(/\D/g, '') })
                  }
                />
              </div>
              <div className="grid grid-cols-1 items-center justify-items-center gap-4 min-[560px]:grid-cols-[minmax(0,var(--gauge-w))_minmax(0,1fr)] min-[560px]:justify-items-stretch [[data-density=bahia]_&]:grid-cols-1 [[data-density=bahia]_&]:justify-items-center">
                <FuelGauge
                  value={draft.returned.fuelEighths}
                  pickup={agreement.pickupInspection?.fuelEighths ?? null}
                  invalid={error !== null && draft.returned.fuelEighths === null}
                  onChange={(fuelEighths) => patchReturned({ fuelEighths })}
                />
                <TextField
                  id="swap-fuel-amount"
                  label="Combustible ($)"
                  inputMode="decimal"
                  mono
                  placeholder="0.00"
                  className="w-full"
                  value={draft.returned.fuelAmount}
                  onChange={(event) => patchReturned({ fuelAmount: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 items-start gap-4 min-[560px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] [[data-density=bahia]_&]:grid-cols-1">
                <Car3dViewer
                  states={zoneStates}
                  listZone={listZone}
                  onToggle={toggleReturnZone}
                  onHover={setHoverZone}
                  fallback={
                    <CarDiagram
                      markOf={(zone) =>
                        zoneStates[zone] === 'old'
                          ? 'previous'
                          : zoneStates[zone] === 'new'
                            ? 'new'
                            : 'none'
                      }
                      locked={(zone) => zoneStates[zone] === 'old'}
                      onToggle={toggleReturnZone}
                    />
                  }
                />
                <div className="flex flex-col gap-3">
                  <DamageLines
                    lines={draft.returned.damageLines}
                    activeZone={hoverZone}
                    onPointZone={setListZone}
                    onAdd={() =>
                      patchReturned({ damageLines: addDamageLine(draft.returned.damageLines) })
                    }
                    onRemove={(id) => {
                      setListZone(null);
                      patchReturned(removeDamageLine(draft.returned, id));
                    }}
                    onChange={(id, changes) =>
                      patchReturned({
                        damageLines: draft.returned.damageLines.map((line) =>
                          line.id === id ? { ...line, ...changes } : line,
                        ),
                      })
                    }
                  />
                  {moneyToCents(preview.closed.charges.damagesSum) > 0 ? (
                    <p className="text-body text-text-dim tabular-nums">
                      {agreement.coverage === 'ACCEPTED' ? (
                        <>
                          Paga hasta <Money value={agreement.deductible} />
                          {' · '}
                        </>
                      ) : null}
                      Cobra <Money value={preview.closed.charges.damageCharge} />
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
              <div className="flex flex-col gap-2">
                <p className="text-label text-text-dim font-semibold">Por qué</p>
                <div className="flex flex-wrap gap-2">
                  {SWAP_REASONS.map((reason) => (
                    <OptionButton
                      key={reason}
                      pressed={draft.why === reason}
                      className="px-3 [[data-density=bahia]_&]:px-5"
                      onClick={() => patch({ why: draft.why === reason ? '' : reason })}
                    >
                      {reason}
                    </OptionButton>
                  ))}
                </div>
              </div>
              <TextField
                id="swap-detail"
                label="Detalle"
                value={draft.detail}
                onChange={(event) => patch({ detail: event.target.value })}
              />
            </div>
          ) : null}

          {step === 'pickup' ? (
            <div className="flex flex-col gap-4">
              <VehicleAvailabilityField
                id="swap-vehicle"
                label="Carro nuevo"
                freeOnly
                from={preview.window.at}
                to={preview.window.until}
                value={vehicle?.id ?? ''}
                excludeVehicleId={agreement.vehicleId}
                onChange={(_, row) =>
                  setDraft((previous) =>
                    pickSwapVehicle(previous, row?.vehicle ?? null, accessoryNames),
                  )
                }
              />
              {vehicle === null ? null : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                    <TextField
                      id="swap-km-out"
                      label={`Km que sale${vehicle.plate === null ? '' : ` · ${vehicle.plate}`}`}
                      inputMode="numeric"
                      mono
                      value={draft.pickup.odometerKm}
                      onChange={(event) =>
                        patchPickup({ odometerKm: event.target.value.replace(/\D/g, '') })
                      }
                    />
                    {preview.window.until === null ? null : (
                      <DetailField label="Regresa">
                        {rentalWhenLabel(preview.window.until)}
                      </DetailField>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <FuelGauge
                      pickup={null}
                      value={draft.pickup.fuelEighths}
                      invalid={error !== null && draft.pickup.fuelEighths === null}
                      onChange={(fuelEighths) => patchPickup({ fuelEighths })}
                    />
                  </div>
                  <Car3dViewer
                    states={Object.fromEntries(
                      draft.pickup.damages.map((damage) => [damage.zone, 'new' as const]),
                    )}
                    listZone={null}
                    onToggle={(zone) =>
                      patchPickup({ damages: toggleZone(draft.pickup.damages, zone) })
                    }
                    onHover={() => undefined}
                    fallback={
                      <CarDiagram
                        markOf={(zone) =>
                          draft.pickup.damages.some((damage) => damage.zone === zone)
                            ? 'marked'
                            : 'none'
                        }
                        onToggle={(zone) =>
                          patchPickup({ damages: toggleZone(draft.pickup.damages, zone) })
                        }
                      />
                    }
                  />
                  <AccessoryChips
                    names={accessoryNames}
                    draft={draft.pickup}
                    onPatch={patchPickup}
                  />
                  <Photos draft={draft.pickup} onPatch={patchPickup} inputId="swap-photos" />
                  <div className="flex flex-col gap-2">
                    <p className="text-label text-text-dim font-semibold">Tarifa por día</p>
                    <div className="flex flex-wrap gap-2">
                      {rateOptions.map((option) => (
                        <OptionButton
                          key={option.mode}
                          pressed={draft.rateMode === option.mode}
                          className="px-3 [[data-density=bahia]_&]:px-5"
                          onClick={() => patch({ rateMode: option.mode })}
                        >
                          {option.label}
                        </OptionButton>
                      ))}
                    </div>
                  </div>
                  {draft.rateMode === 'other' ? (
                    <TextField
                      id="swap-rate"
                      label="Otra tarifa ($)"
                      inputMode="decimal"
                      mono
                      value={draft.otherRate}
                      onChange={(event) => patch({ otherRate: event.target.value })}
                    />
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 'done' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
              <SwapCard
                stamp={<Stamp label="Cierra" tone="neutral" />}
                contract={agreement.contractNumber}
                plate={agreement.vehicle.plate}
              >
                <AmountRow
                  label={`${shortWhen(agreement.actualPickupAt ?? agreement.plannedPickupAt)} → ${shortWhen(preview.window.at)}`}
                  value={`${preview.window.closedDays} d`}
                />
                <AmountRow
                  label="Km"
                  value={`${agreement.pickupOdometerKm ?? '—'} → ${draft.returned.odometerKm}`}
                />
                <AmountRow
                  label="Combustible"
                  value={`${fuelOf(agreement.pickupInspection?.fuelEighths)} → ${fuelOf(draft.returned.fuelEighths)}`}
                />
                {moneyToCents(preview.closed.charges.fuelCharge) > 0 ? (
                  <AmountRow
                    label="Cargo combustible"
                    value={formatMoneyCompact(preview.closed.charges.fuelCharge)}
                  />
                ) : null}
                {moneyToCents(preview.closed.charges.damageCharge) > 0 ? (
                  <AmountRow
                    label="Daños"
                    value={formatMoneyCompact(preview.closed.charges.damageCharge)}
                  />
                ) : null}
                <AmountRow label="Total" value={formatMoneyCompact(preview.closed.totals.total)} />
                <AmountRow
                  label="Pagado"
                  value={formatMoneyCompact(preview.closed.totals.paid)}
                  tone="go"
                />
                <AmountRow
                  label="Saldo"
                  strong
                  value={formatMoneyCompact(preview.closed.totals.balance)}
                />
              </SwapCard>
              <SwapCard
                stamp={<Stamp label="Abre" tone="washing" pulse={false} />}
                contract={null}
                plate={vehicle?.plate ?? null}
              >
                <AmountRow
                  label={`${shortWhen(preview.window.at)} → ${shortWhen(preview.window.until)}`}
                  value={`${preview.window.openedDays} d`}
                />
                <AmountRow label="Km salida" value={draft.pickup.odometerKm} />
                <AmountRow label="Combustible" value={fuelOf(draft.pickup.fuelEighths)} />
                <AmountRow label="Tarifa" value={formatMoneyCompact(preview.rate)} />
                <AmountRow
                  label={`Garantía de N° ${agreement.contractNumber ?? '—'}`}
                  value={formatMoneyCompact(agreement.depositHeld)}
                />
                <AmountRow label="Total" value={formatMoneyCompact(preview.opened.total)} />
                {moneyToCents(preview.surplus) > 0 ? (
                  <AmountRow
                    label={`Pagado en N° ${agreement.contractNumber ?? '—'}`}
                    value={formatMoneyCompact(preview.opened.paid)}
                    tone="go"
                  />
                ) : null}
                <AmountRow
                  label="Saldo"
                  strong
                  value={formatMoneyCompact(preview.opened.balance)}
                />
              </SwapCard>
            </div>
          ) : null}

          <FormAlert message={error} />
        </DialogBody>
        <DialogFooter>
          {index > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => go(SWAP_STEPS[index - 1]!.key)}
            >
              Atrás
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
          )}
          {index < SWAP_STEPS.length - 1 ? (
            <Button type="button" onClick={() => go(SWAP_STEPS[index + 1]!.key)}>
              Seguir
            </Button>
          ) : (
            <Button type="button" loading={swap.isPending} onClick={submit}>
              Cambiar carro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Money({ value }: { value: string }) {
  return <b className="text-text font-mono">{formatMoneyCompact(value)}</b>;
}

/** Una de las dos rentas del resumen. */
function SwapCard({
  stamp,
  contract,
  plate,
  children,
}: {
  stamp: ReactNode;
  contract: number | null;
  plate: string | null;
  children: ReactNode;
}) {
  return (
    <section className="bg-surface-2 border-line-soft flex flex-col gap-2 rounded-row border p-4 [[data-density=bahia]_&]:gap-3 [[data-density=bahia]_&]:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {stamp}
        {contract === null ? null : <b className="font-mono">N° {contract}</b>}
        {plate === null ? null : <PlateChip plate={plate} size="sm" />}
      </div>
      {children}
    </section>
  );
}

function shortWhen(iso: string | null): string {
  return iso === null ? '—' : rentalWhenLabel(iso);
}

function fuelOf(eighths: number | null | undefined): string {
  return eighths === null || eighths === undefined ? '—' : fuelLabel(eighths);
}

function detailsMention(error: ApiError, prefix: string): boolean {
  return (
    typeof error.details === 'object' &&
    error.details !== null &&
    Object.keys(error.details).some((key) => key.startsWith(prefix))
  );
}
