'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createCustomerSchema, updateCustomerSchema } from '@elite/shared';
import type { Customer } from '@elite/shared';

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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/toast-provider';
import { useCreateCustomer, useUpdateCustomer } from '../hooks/use-customers';

/**
 * Alta y edición de un cliente, en el mismo diálogo.
 *
 * La validación no se duplica: los campos salen de `createCustomerSchema` y
 * `updateCustomerSchema` de `@elite/shared`, los mismos con los que el API
 * valida la entrada. «Activo» solo aparece en la edición, porque un cliente
 * nace activo y nadie da de alta a alguien ya dado de baja.
 */
const customerFormSchema = z.object({
  fullName: createCustomerSchema.shape.fullName,
  // Vacío es válido: media agenda del taller no tiene teléfono.
  phone: createCustomerSchema.shape.phone.unwrap(),
  isActive: updateCustomerSchema.shape.isActive.unwrap(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function CustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  /** El cliente que se edita, o `null` para el alta. */
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer === null ? 'Nuevo cliente' : 'Editar cliente'}</DialogTitle>
          <DialogDescription>
            {customer === null
              ? 'Los clientes también se crean solos al anotar un lavado. Acá se dan de alta a mano.'
              : 'Corregí lo que se anotó mal en la pista. Los lavados viejos siguen siendo suyos.'}
          </DialogDescription>
        </DialogHeader>

        {/* Remontar el formulario al cambiar de cliente: cada ficha arranca con
            sus propios valores y sin errores heredados. */}
        <CustomerForm
          key={customer?.id ?? 'nuevo'}
          customer={customer}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomerForm({ customer, onDone }: { customer: Customer | null; onDone: () => void }) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const { toast } = useToast();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      fullName: customer?.fullName ?? '',
      phone: customer?.phone ?? '',
      isActive: customer?.isActive ?? true,
    },
  });

  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  const submit = form.handleSubmit((values) => {
    const fullName = values.fullName.trim();
    const phone = values.phone.trim();

    if (customer === null) {
      create.mutate(
        { fullName, ...(phone === '' ? {} : { phone }) },
        {
          onSuccess: () => {
            toast({ title: 'Cliente creado', description: fullName });
            onDone();
          },
        },
      );
      return;
    }

    // En la edición el teléfono se manda siempre, aun vacío: así se puede
    // borrar el que estaba mal, no solo cambiarlo.
    update.mutate(
      { id: customer.id, input: { fullName, phone, isActive: values.isActive } },
      {
        onSuccess: () => {
          toast({ title: 'Cliente guardado', description: fullName });
          onDone();
        },
      },
    );
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="Nombre y apellido" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input inputMode="tel" autoComplete="off" placeholder="7777-8888" {...field} />
                </FormControl>
                <FormDescription>
                  Opcional, pero es lo que evita darlo de alta dos veces.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {customer === null ? null : (
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <div className="flex min-h-(--touch-min) items-center justify-between gap-4">
                    <FormLabel>Cliente activo</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </div>
                  <FormDescription>
                    Un cliente desactivado deja de sugerirse al anotar un lavado, pero sus lavados
                    viejos lo siguen mostrando.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {error ? (
            <p className="text-danger-text text-body" role="alert">
              {error.message}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {customer === null ? 'Crear cliente' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
