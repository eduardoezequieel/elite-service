'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PERMISSIONS, fleetVehicleName } from '@elite/shared';
import type { CreateFineInput } from '@elite/shared';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useFleetVehicleOptions } from '@/features/fleet/hooks/use-fleet';
import {
  FieldError,
  FormAlert,
  TextAreaField,
  TextField,
} from '@/features/inventory/components/form-fields';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatMoney } from '@/lib/money';
import { salvadorInstant, salvadorLocalNow } from '../billing-format';
import { fineFormSchema, type FineFormValues } from '../fine-form';
import { useCreateRentalFine, useFineResolution } from '../hooks/use-rental-billing';

/**
 * Registrar una multa de tránsito (098 RN-4). Antes de guardar dice a quién se
 * le cargará: la renta que tenía el carro en esa fecha y hora. Sin renta, la
 * multa queda como gasto del carro y no se le puede cargar a nadie.
 *
 * Desde una renta llega con el carro puesto; desde la caja se elige de la
 * flota, que pide `fleet.read`.
 */
export function FineDialog({
  vehicleId,
  vehicleLabel,
  onClose,
}: {
  /** El carro fijo, cuando se abre desde una renta. */
  vehicleId?: string;
  vehicleLabel?: string;
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const canPickVehicle = vehicleId === undefined && can(PERMISSIONS.fleet.actions.read.key);
  const fleet = useFleetVehicleOptions({}, canPickVehicle);
  const createFine = useCreateRentalFine();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FineFormValues, unknown, CreateFineInput>({
    resolver: zodResolver(fineFormSchema),
    defaultValues: {
      vehicleId: vehicleId ?? '',
      occurredLocal: salvadorLocalNow(),
      amount: '',
      description: '',
      chargeToCustomer: true,
    },
  });
  const errors = form.formState.errors;
  const chosenVehicle = form.watch('vehicleId');
  const occurredLocal = useDebouncedValue(form.watch('occurredLocal'), 300);
  const resolution = useFineResolution(chosenVehicle, salvadorInstant(occurredLocal));
  const holder = resolution.data?.agreement ?? null;
  const vehicleOptions = useMemo(
    () =>
      (fleet.data ?? []).map((vehicle) => ({
        value: vehicle.id,
        label: `${vehicle.plate ?? 'Sin placa'} · ${fleetVehicleName(vehicle)}`,
      })),
    [fleet.data],
  );

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    createFine.mutate(
      { ...input, chargeToCustomer: holder !== null && input.chargeToCustomer },
      {
        onSuccess: (fine) => {
          toast({
            title: 'Multa registrada',
            description:
              fine.chargedToCustomer && fine.agreement !== null
                ? `${formatMoney(fine.amount)} cargada a ${fine.agreement.customerName}`
                : `${formatMoney(fine.amount)} como gasto del carro`,
          });
          onClose();
        },
        onError: (error) => setFormError(error.message),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-lg">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Registrar multa</DialogTitle>
            <DialogDescription>
              Se carga a quien tenía el carro en esa fecha. Si nadie lo tenía, queda como gasto del
              carro.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {vehicleId !== undefined ? (
              <p className="text-text text-body">
                <span className="text-text-faint text-label block">Carro</span>
                {vehicleLabel ?? 'El carro de esta renta'}
              </p>
            ) : canPickVehicle ? (
              <div className="flex flex-col gap-1.5">
                <Controller
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <Combobox
                      id="rental-fine-vehicle"
                      label="Carro"
                      placeholder={fleet.isPending ? 'Cargando la flota…' : 'Elegí el carro'}
                      options={vehicleOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      invalid={errors.vehicleId !== undefined}
                    />
                  )}
                />
                <FieldError message={errors.vehicleId?.message ?? fleet.error?.message} />
              </div>
            ) : (
              <p className="text-danger-text text-body" role="alert">
                Para elegir el carro necesitás ver la flota. Registrala desde la renta.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <FieldBox>
                <Label htmlFor="rental-fine-when">Fecha y hora de la multa</Label>
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
            <TextAreaField
              id="rental-fine-description"
              label="De qué es"
              placeholder="Exceso de velocidad, km 24 carretera al puerto"
              error={errors.description?.message}
              {...form.register('description')}
            />

            <FineHolder
              loading={resolution.isFetching}
              ready={chosenVehicle !== '' && salvadorInstant(occurredLocal) !== null}
              holder={holder}
              error={resolution.error?.message ?? null}
            />

            {holder === null ? null : (
              <Controller
                control={form.control}
                name="chargeToCustomer"
                render={({ field }) => (
                  <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                    <label htmlFor="rental-fine-charge" className="text-body font-semibold">
                      Cargársela al cliente
                      <span className="text-text-faint block text-dense font-normal">
                        Entra al total de la renta. Si no, queda como gasto del carro.
                      </span>
                    </label>
                    <Switch
                      id="rental-fine-charge"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            )}

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createFine.isPending}
              disabled={vehicleId === undefined && !canPickVehicle}
            >
              Registrar multa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A quién se le cargará, dicho antes de guardar. */
function FineHolder({
  loading,
  ready,
  holder,
  error,
}: {
  loading: boolean;
  ready: boolean;
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
    <div className="border-line-soft bg-surface-2 rounded-control border px-(--field-px) py-3">
      <p className="text-text-faint text-label">Se le carga a</p>
      <p className="text-text text-body font-semibold" aria-live="polite">
        {loading
          ? 'Buscando quién tenía el carro…'
          : holder === null
            ? 'Nadie: no hay renta de ese carro en esa fecha. Queda como gasto del carro.'
            : `${holder.customerName} · ${
                holder.contractNumber === null
                  ? 'renta sin contrato'
                  : `contrato #${holder.contractNumber}`
              }`}
      </p>
    </div>
  );
}
