'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FLEET_CATEGORY_LABELS, FLEET_VEHICLE_CATEGORIES, fleetVehicleName } from '@elite/shared';
import type { FleetVehicle, FleetVehicleCategory, UpdateFleetVehicleInput } from '@elite/shared';
import { Info } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Controller,
  useForm,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  FieldError,
  FormAlert,
  TextAreaField,
  TextField,
} from '@/features/inventory/components/form-fields';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import { useUpdateFleetVehicle } from '../hooks/use-fleet';
import {
  FLEET_VEHICLE_CARD_TITLES,
  extrasInInstallment,
  fleetVehicleSectionFormSchema,
  fleetVehicleSectionValuesOf,
  rateFallback,
  type FleetVehicleCard,
  type FleetVehicleSectionValues,
} from '../vehicle-form';

export const CATEGORY_OPTIONS = FLEET_VEHICLE_CATEGORIES.map((category) => ({
  value: category,
  label: FLEET_CATEGORY_LABELS[category],
}));

/** Las rejillas de los diálogos de la flota: dos columnas, una en `bahia` y bajo 640px. */
export const DIALOG_GRID =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1';
export const DIALOG_SPAN = 'sm:col-span-2 [[data-density=bahia]_&]:col-span-1';

/**
 * Baja los `details` de un 422 o el 409 de placa a su campo; devuelve el
 * mensaje general. El mismo en el alta y en cada tarjeta.
 */
export function applyApiError<Values extends FieldValues>(
  error: ApiError,
  fields: Values,
  setError: (name: Path<Values>, error: { message: string }) => void,
): string {
  if (error.code === 'PLATE_TAKEN' && 'plate' in fields) {
    setError('plate' as Path<Values>, { message: error.message });
  }

  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if (field in fields && typeof message === 'string') {
        setError(field as Path<Values>, { message });
      }
    }
  }

  return error.message;
}

/** Ayuda debajo de un campo, afuera de la caja (convención 9). */
export function FieldHelp({ children }: { children: ReactNode }) {
  return <p className="text-text-faint text-dense">{children}</p>;
}

/** Un interruptor con su rótulo y ayuda; ocupa la fila entera. Sin FieldBox (convención 9). */
function SwitchRow({
  id,
  label,
  help,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={cn('flex min-h-(--touch-min) items-center justify-between gap-3', DIALOG_SPAN)}>
      <label htmlFor={id} className="text-body font-semibold">
        {label}
        <span className="text-text-faint block text-dense font-normal">{help}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** El aviso de una línea dentro de una tarjeta o un diálogo: icono y texto, sin color de alarma. */
export function NoteLine({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-2 text-text-dim text-dense flex items-start gap-2 rounded-row px-3 py-2.5">
      <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

type SectionForm = UseFormReturn<FleetVehicleSectionValues, unknown, UpdateFleetVehicleInput>;
type FieldName = Path<FleetVehicleSectionValues>;

/**
 * El diálogo de una tarjeta de la ficha (103): **solo** sus campos, y el
 * `PATCH` lleva solo esos. Bajo 900px sube desde abajo (lo hace `Dialog`).
 */
export function FleetVehicleSectionDialog({
  vehicle,
  card,
  onClose,
}: {
  vehicle: FleetVehicle;
  card: FleetVehicleCard;
  onClose: () => void;
}) {
  const update = useUpdateFleetVehicle();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => fleetVehicleSectionFormSchema(card), [card]);
  const defaults = useMemo(() => fleetVehicleSectionValuesOf(vehicle), [vehicle]);
  const form: SectionForm = useForm<FleetVehicleSectionValues, unknown, UpdateFleetVehicleInput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const title = FLEET_VEHICLE_CARD_TITLES[card];

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    update.mutate(
      { id: vehicle.id, input },
      {
        onSuccess: () => {
          toast({ title: 'Guardado', description: title });
          onClose();
        },
        onError: (error) => setFormError(applyApiError(error, defaults, form.setError)),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{fleetVehicleName(vehicle)}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <SectionFields card={card} form={form} vehicle={vehicle} />
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={update.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionFields({
  card,
  form,
  vehicle,
}: {
  card: FleetVehicleCard;
  form: SectionForm;
  vehicle: FleetVehicle;
}) {
  const errors = form.formState.errors;
  const text = (name: FieldName) => ({ error: errors[name]?.message, ...form.register(name) });
  const money = (name: FieldName, placeholder = '0.00') => ({
    ...text(name),
    inputMode: 'decimal' as const,
    placeholder,
    mono: true,
  });
  const whole = (name: FieldName) => ({ ...text(name), inputMode: 'numeric' as const });
  const dateField = (name: FieldName, label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <TextField
          id={`fleet-${name}`}
          label={label}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          mono
          error={errors[name]?.message}
          name={field.name}
          value={String(field.value)}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(maskDate(event.target.value))}
        />
      )}
    />
  );
  const switchField = (name: FieldName, label: string, help: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <SwitchRow
          id={`fleet-${name}`}
          label={label}
          help={help}
          checked={field.value === true}
          onCheckedChange={field.onChange}
        />
      )}
    />
  );

  const limitedKm = form.watch('limitedKm');
  const financed = form.watch('financed');
  const weeklyRate = form.watch('weeklyRate');

  switch (card) {
    case 'identity':
      return (
        <>
          <div className={DIALOG_GRID}>
            <TextField id="fleet-make" label="Marca" placeholder="Kia" {...text('make')} />
            <TextField id="fleet-model" label="Modelo" placeholder="Rio" {...text('model')} />
            <TextField
              id="fleet-plate"
              label="Placa (opcional)"
              placeholder="P53DBC"
              mono
              {...text('plate')}
            />
            <TextField id="fleet-year" label="Año" placeholder="2022" {...whole('year')} />
            <TextField id="fleet-color" label="Color" placeholder="Gris" {...text('color')} />
            <CategoryField form={form} />
          </div>
          <div className="grid gap-1">
            <span className="text-label text-text-faint">Kilometraje</span>
            <p className="text-body">
              <span className="font-mono">{vehicle.odometerKm.toLocaleString('es-SV')} km</span>{' '}
              <span className="text-text-faint text-dense">
                · lo actualizan la entrega y la recepción
              </span>
            </p>
          </div>
        </>
      );
    case 'rates':
      return (
        <div className={DIALOG_GRID}>
          <TextField
            id="fleet-daily"
            label="Tarifa diaria ($)"
            className={DIALOG_SPAN}
            {...money('dailyRate')}
          />
          <TextField
            id="fleet-weekly"
            label="Por día, 7+ días ($)"
            {...money('weeklyRate', 'Igual que la diaria')}
          />
          <TextField
            id="fleet-monthly"
            label="Por día, 30+ días ($)"
            {...money(
              'monthlyRate',
              rateFallback({ weeklyRate, monthlyRate: null }, 'monthlyRate') ??
                'Igual que la diaria',
            )}
          />
          {switchField('limitedKm', 'Km limitado', 'Si está apagado, el carro sale con km libre.')}
          {limitedKm ? (
            <>
              <TextField
                id="fleet-free-km"
                label="Km libres por día"
                placeholder="200"
                {...whole('freeKmPerDay')}
              />
              <TextField
                id="fleet-extra-km"
                label="Precio por km adicional ($)"
                {...money('extraKmPrice')}
              />
            </>
          ) : null}
        </div>
      );
    case 'purchase':
      return (
        <div className={DIALOG_GRID}>
          <TextField id="fleet-price" label="Precio de compra ($)" {...money('purchasePrice')} />
          {dateField('purchasedAt', 'Fecha de compra')}
          {switchField('financed', 'Financiado', 'Prima y cuotas entran al costo del carro.')}
          {financed ? (
            <>
              <TextField id="fleet-down" label="Prima ($)" {...money('downPayment')} />
              <TextField
                id="fleet-installment"
                label="Cuota mensual ($)"
                {...money('installment')}
              />
              <TextField
                id="fleet-term"
                label="Plazo (meses)"
                placeholder="48"
                {...whole('termMonths')}
              />
              <div className="flex flex-col gap-1.5">
                {dateField('financingStartedAt', 'Primera cuota')}
                <FieldHelp>Si la dejás vacía, se toma la fecha de compra.</FieldHelp>
              </div>
              {switchField(
                'installmentIncludesExtras',
                'La cuota incluye seguro y GPS',
                'Así no se cuentan dos veces en la rentabilidad.',
              )}
            </>
          ) : null}
        </div>
      );
    case 'fixed': {
      const included = extrasInInstallment(vehicle);

      return (
        <>
          {included ? (
            <NoteLine>
              La cuota ya trae el seguro y el GPS. Si alguno se paga aparte, cambialo en «Compra y
              financiamiento».
            </NoteLine>
          ) : null}
          <div className={DIALOG_GRID}>
            {included ? null : (
              <>
                <TextField id="fleet-insurance" label="Seguro ($)" {...money('insuranceMonthly')} />
                <TextField id="fleet-gps" label="GPS ($)" {...money('gpsMonthly')} />
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <TextField id="fleet-other" label="Otros fijos ($)" {...money('otherFixedMonthly')} />
              <FieldHelp>Parqueo, lavado mensual, lo que se pague cada mes.</FieldHelp>
            </div>
          </div>
        </>
      );
    }
    case 'documents':
      return (
        <div className={DIALOG_GRID}>
          <TextField
            id="fleet-insurer"
            label="Aseguradora"
            placeholder="Seguros del Pacífico"
            {...text('insurer')}
          />
          <TextField
            id="fleet-policy"
            label="Número de póliza"
            placeholder="AU-0000-2026"
            mono
            {...text('policyNumber')}
          />
          {dateField('insuranceExpiresAt', 'Vence el seguro')}
          {dateField('registrationExpiresAt', 'Vence la tarjeta de circulación')}
        </div>
      );
    case 'notes':
      return (
        <TextAreaField
          id="fleet-notes"
          label="Notas"
          placeholder="Lo que haya que recordar de este carro"
          error={errors.notes?.message}
          {...form.register('notes')}
        />
      );
  }
}

/** El tipo de carro, con el `Combobox` del sistema. Sirve al alta y a la tarjeta. */
export function CategoryField<Values extends { category: FleetVehicleCategory }, Output>({
  form,
}: {
  form: UseFormReturn<Values, unknown, Output>;
}) {
  const name = 'category' as Path<Values>;
  const error = form.formState.errors.category?.message;

  return (
    <div className="flex flex-col gap-1.5">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Combobox
            id="fleet-category"
            label="Tipo"
            options={CATEGORY_OPTIONS}
            value={String(field.value)}
            onChange={(value) => field.onChange(value as FleetVehicleCategory)}
            onBlur={field.onBlur}
            invalid={error !== undefined}
          />
        )}
      />
      <FieldError message={typeof error === 'string' ? error : undefined} />
    </div>
  );
}
