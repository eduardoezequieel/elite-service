'use client';

import { createVehicleSchema } from '@elite/shared';
import type { VehicleWithOwner } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useBodyTypes } from '@/features/carwash/hooks/use-tickets';
import { useCreateVehicle, useUpdateVehicle } from '../hooks/use-customers';

const vehicleFormSchema = z.object({
  plate: createVehicleSchema.shape.plate,
  bodyTypeId: createVehicleSchema.shape.bodyTypeId,
  make: z.string(),
  color: z.string(),
});

type VehicleFormValues = z.input<typeof vehicleFormSchema>;
type VehicleFormOutput = z.output<typeof vehicleFormSchema>;

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
  const form = useForm<VehicleFormValues, unknown, VehicleFormOutput>({
    resolver: zodResolver(vehicleFormSchema),
    mode: 'onChange',
    defaultValues: {
      plate: vehicle?.plate ?? '',
      bodyTypeId: vehicle?.bodyType.id ?? '',
      make: vehicle?.make ?? '',
      color: vehicle?.color ?? '',
    },
  });
  const plate = form.watch('plate');
  const bodyTypeId = form.watch('bodyTypeId');
  const complete = plate.trim() !== '' && bodyTypeId !== '';
  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  const submit = form.handleSubmit((values) => {
    const make = values.make.trim();
    const color = values.color.trim();

    if (isNew) {
      create.mutate(
        {
          customerId,
          plate: values.plate,
          bodyTypeId: values.bodyTypeId,
          make: make === '' ? undefined : make,
          color: color === '' ? undefined : color,
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
          plate: values.plate,
          bodyTypeId: values.bodyTypeId,
          make,
          color,
        },
      },
      {
        onSuccess: (saved) => {
          toast({ title: 'Carro guardado', description: saved.plate });
          onClose();
        },
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={submit}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>{isNew ? 'Nuevo carro' : 'Editar carro'}</DialogTitle>
              <DialogDescription>Placa, tipo, marca y color de este cliente.</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input
                          id="vehicle-plate"
                          autoComplete="off"
                          className="font-mono"
                          {...field}
                          onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bodyTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <select
                          id="vehicle-type"
                          className="text-text text-body w-full bg-transparent"
                          {...field}
                        >
                          <option value="">Elegí el tipo</option>
                          {(bodyTypes.data ?? []).map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input id="vehicle-make" autoComplete="off" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input id="vehicle-color" autoComplete="off" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
