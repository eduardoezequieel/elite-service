'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { fleetVehicleName } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import type { z } from 'zod';

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
import { FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { useCreateFleetVehicle } from '../hooks/use-fleet';
import {
  EMPTY_FLEET_VEHICLE_CREATE,
  createFleetVehicleFormSchema,
  type FleetVehicleCreateValues,
} from '../vehicle-form';
import {
  CategoryField,
  DIALOG_GRID,
  FieldHelp,
  FleetVehicleSectionDialog,
  applyApiError,
} from './fleet-vehicle-section-dialog';

/**
 * «Nuevo carro» (103): lo justo para rentarlo —identificación, tarifa diaria y
 * kilometraje al recibirlo—. Lo demás se llena en la ficha, a la que navega al
 * crear.
 */
export function FleetVehicleCreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateFleetVehicle();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<
    FleetVehicleCreateValues,
    unknown,
    z.output<typeof createFleetVehicleFormSchema>
  >({
    resolver: zodResolver(createFleetVehicleFormSchema),
    defaultValues: EMPTY_FLEET_VEHICLE_CREATE,
  });
  const errors = form.formState.errors;
  const text = (name: Path<FleetVehicleCreateValues>) => ({
    error: errors[name]?.message,
    ...form.register(name),
  });

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (saved) => {
        toast({ title: 'Carro creado', description: fleetVehicleName(saved) });
        onClose();
        router.push(`/rentals/fleet/${saved.id}`);
      },
      onError: (error) =>
        setFormError(applyApiError(error, EMPTY_FLEET_VEHICLE_CREATE, form.setError)),
    });
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nuevo carro</DialogTitle>
            <DialogDescription>
              Con esto ya se puede rentar. Tarifas por semana, compra, seguro y vencimientos se
              llenan en la ficha.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
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
              <TextField
                id="fleet-year"
                label="Año"
                placeholder="2022"
                inputMode="numeric"
                {...text('year')}
              />
              <TextField id="fleet-color" label="Color" placeholder="Gris" {...text('color')} />
              <CategoryField form={form} />
              <TextField
                id="fleet-daily"
                label="Tarifa diaria ($)"
                placeholder="0.00"
                inputMode="decimal"
                mono
                {...text('dailyRate')}
              />
              <div className="flex flex-col gap-1.5">
                <TextField
                  id="fleet-odometer"
                  label="Kilometraje al recibirlo"
                  placeholder="48000"
                  inputMode="numeric"
                  {...text('odometerKm')}
                />
                <FieldHelp>Después lo actualizan solas la entrega y la recepción.</FieldHelp>
              </div>
            </div>
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              Crear carro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lo que abre la lista de la flota: el alta, o —desde el «Editar» de una
 * fila— la tarjeta de identificación de ese carro. El resto se edita en la
 * ficha, tarjeta por tarjeta (103).
 */
export function FleetVehicleDialog({
  vehicle,
  onClose,
}: {
  vehicle?: FleetVehicle;
  onClose: () => void;
}) {
  return vehicle === undefined ? (
    <FleetVehicleCreateDialog onClose={onClose} />
  ) : (
    <FleetVehicleSectionDialog vehicle={vehicle} card="identity" onClose={onClose} />
  );
}
