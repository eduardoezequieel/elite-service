'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createCustomerSchema } from '@elite/shared';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/toast-provider';
import { formatPhone } from '@/lib/phone';
import { useHeldWhileOpen } from '@/lib/use-held-while-open';
import { useCreateCustomer, useUpdateCustomer } from '../hooks/use-customers';

/**
 * Alta y edición de un cliente, en el mismo diálogo.
 *
 * La validación no se duplica: los campos salen de `createCustomerSchema` de
 * `@elite/shared`, el mismo con el que el API valida la entrada. Nombre y
 * teléfono es todo lo que tiene un cliente: no es un actor del sistema, así que
 * no se desactiva (048).
 */
const customerFormSchema = z.object({
  fullName: createCustomerSchema.shape.fullName,
  // Vacío es válido: media agenda del taller no tiene teléfono.
  phone: createCustomerSchema.shape.phone.unwrap(),
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
  const shown = useHeldWhileOpen(customer, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shown === null ? 'Nuevo cliente' : 'Editar cliente'}</DialogTitle>
          <DialogDescription className="sr-only">
            {shown === null ? 'Crear cliente' : 'Editar cliente'}
          </DialogDescription>
        </DialogHeader>

        {/* Remontar el formulario al cambiar de cliente: cada ficha arranca con
            sus propios valores y sin errores heredados. El id es el mostrado,
            no el prop crudo: si el padre limpia al cerrar, el saliente no
            pasa a «Nuevo cliente». */}
        <CustomerForm
          key={shown?.id ?? 'nuevo'}
          customer={shown}
          open={open}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomerForm({
  customer,
  open,
  onDone,
}: {
  customer: Customer | null;
  open: boolean;
  onDone: () => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const { toast } = useToast();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: customer?.fullName ?? '',
      phone: customer?.phone ? formatPhone(customer.phone) : '',
    },
  });

  const wasOpen = useRef(open);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;

    form.reset({
      fullName: customer?.fullName ?? '',
      phone: customer?.phone ? formatPhone(customer.phone) : '',
    });
    create.reset();
    update.reset();
  }, [open, customer, form, create, update]);

  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  function persist(values: CustomerFormValues): void {
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
      { id: customer.id, input: { fullName, phone } },
      {
        onSuccess: () => {
          toast({ title: 'Cliente guardado', description: fullName });
          onDone();
        },
      },
    );
  }

  const submit = form.handleSubmit(persist);

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FieldBox>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Nombre y apellido" {...field} />
                  </FormControl>
                </FieldBox>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FieldBox>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="tel"
                      autoComplete="off"
                      maxLength={9}
                      placeholder="7777-8888"
                      {...field}
                      onChange={(event) => field.onChange(formatPhone(event.target.value))}
                    />
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
