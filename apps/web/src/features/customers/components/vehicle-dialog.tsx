'use client';

import type { VehicleWithOwner } from '@elite/shared';
import { useState } from 'react';

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
import { useToast } from '@/components/toast-provider';
import { useBodyTypes } from '@/features/carwash/hooks/use-tickets';
import { useCreateVehicle, useUpdateVehicle } from '../hooks/use-customers';

export function VehicleDialog({
  customerId,
  vehicle,
  onClose,
}: {
  customerId: string;
  vehicle: VehicleWithOwner | null;
  onClose: () => void;
}) {
  const isNew = vehicle === null;
  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  const bodyTypes = useBodyTypes(true);
  const { toast } = useToast();
  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [bodyTypeId, setBodyTypeId] = useState(vehicle?.bodyType.id ?? '');
  const [make, setMake] = useState(vehicle?.make ?? '');
  const [color, setColor] = useState(vehicle?.color ?? '');
  const complete = plate.trim() !== '' && bodyTypeId !== '';
  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete) return;

            const plateValue = plate.trim().toUpperCase();
            const makeValue = make.trim();
            const colorValue = color.trim();

            if (isNew) {
              create.mutate(
                {
                  customerId,
                  plate: plateValue,
                  bodyTypeId,
                  make: makeValue === '' ? undefined : makeValue,
                  color: colorValue === '' ? undefined : colorValue,
                },
                {
                  onSuccess: (saved) => {
                    toast({ title: 'Carro anotado', description: saved.plate });
                    onClose();
                  },
                },
              );
              return;
            }

            update.mutate(
              {
                id: vehicle.id,
                input: {
                  plate: plateValue,
                  bodyTypeId,
                  make: makeValue,
                  color: colorValue,
                },
              },
              {
                onSuccess: (saved) => {
                  toast({ title: 'Carro guardado', description: saved.plate });
                  onClose();
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nuevo carro' : 'Editar carro'}</DialogTitle>
            <DialogDescription>Placa, tipo, marca y color de este cliente.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <FieldBox>
              <Label htmlFor="vehicle-plate">Placa</Label>
              <Input
                id="vehicle-plate"
                value={plate}
                onChange={(event) => setPlate(event.target.value.toUpperCase())}
                autoComplete="off"
                className="font-mono"
              />
            </FieldBox>

            <FieldBox>
              <Label htmlFor="vehicle-type">Tipo</Label>
              <select
                id="vehicle-type"
                value={bodyTypeId}
                onChange={(event) => setBodyTypeId(event.target.value)}
                className="text-text text-body w-full bg-transparent"
              >
                <option value="">Elegí el tipo</option>
                {(bodyTypes.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </FieldBox>

            <FieldBox>
              <Label htmlFor="vehicle-make">Marca</Label>
              <Input
                id="vehicle-make"
                value={make}
                onChange={(event) => setMake(event.target.value)}
                autoComplete="off"
              />
            </FieldBox>

            <FieldBox>
              <Label htmlFor="vehicle-color">Color</Label>
              <Input
                id="vehicle-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                autoComplete="off"
              />
            </FieldBox>

            {error ? (
              <p className="text-danger-text text-body" role="alert">
                {error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete} loading={isPending}>
              {isNew ? 'Crear carro' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
