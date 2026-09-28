'use client';

import {
  BANK_ACCOUNT_TYPE_LABELS,
  BANK_ACCOUNT_TYPES,
  BANKS,
  bankAccountHolderSchema,
  bankAccountNumberSchema,
  bankAccountTypeSchema,
  bankCodeSchema,
  type BankAccount,
} from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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
import type { ApiError } from '@/lib/api';
import { bankAccountErrorView, type BankAccountField } from '../errors';
import { useCreateBankAccount, useUpdateBankAccount } from '../hooks/use-bank-accounts';

/**
 * El formulario usa los schemas de `@elite/shared` tal cual. Banco y tipo
 * entran como texto —vacío mientras no se elige— y salen como su código.
 */
const bankAccountFormSchema = z.object({
  bank: z.string().pipe(bankCodeSchema),
  type: z.string().pipe(bankAccountTypeSchema),
  number: bankAccountNumberSchema,
  holderName: bankAccountHolderSchema,
});

type BankAccountFormValues = z.input<typeof bankAccountFormSchema>;
type BankAccountFormOutput = z.output<typeof bankAccountFormSchema>;

const BANK_OPTIONS: ComboboxOption[] = BANKS.map((bank) => ({
  value: bank.code,
  label: bank.name,
}));

const TYPE_OPTIONS: ComboboxOption[] = BANK_ACCOUNT_TYPES.map((type) => ({
  value: type,
  label: BANK_ACCOUNT_TYPE_LABELS[type],
}));

const FIELDS: readonly BankAccountField[] = ['bank', 'type', 'number', 'holderName'];

/**
 * Alta y edición de una cuenta del negocio (spec 069 RN-2). Activar y
 * desactivar no vive acá: es el verbo de la fila, con su confirmación.
 *
 * `409 BANK_ACCOUNT_DUPLICATE` se planta en el número, que es lo que se
 * corrige; el mensaje general va al pie (convención 16).
 */
export function BankAccountDialog({
  account,
  onClose,
}: {
  account?: BankAccount;
  onClose: () => void;
}) {
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const isNew = account === undefined;
  const form = useForm<BankAccountFormValues, unknown, BankAccountFormOutput>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      bank: account?.bank ?? '',
      type: account?.type ?? '',
      number: account?.number ?? '',
      holderName: account?.holderName ?? '',
    },
  });
  const errors = form.formState.errors;
  const isPending = create.isPending || update.isPending;
  const complete =
    form.watch('bank') !== '' &&
    form.watch('type') !== '' &&
    form.watch('number').trim() !== '' &&
    form.watch('holderName').trim() !== '';

  function onError(error: ApiError): void {
    const view = bankAccountErrorView(error);

    for (const field of FIELDS) {
      const message = view.fields[field];
      if (message !== undefined) form.setError(field, { type: 'server', message });
    }

    setFormError(view.message);
  }

  const submit = form.handleSubmit((values) => {
    setFormError(null);

    if (isNew) {
      create.mutate(values, {
        onSuccess: (saved) => {
          toast({ title: 'Cuenta registrada', description: saved.bankName });
          onClose();
        },
        onError,
      });
      return;
    }

    update.mutate(
      { id: account.id, input: values },
      {
        onSuccess: (saved) => {
          toast({ title: 'Cuenta guardada', description: saved.bankName });
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nueva cuenta' : 'Editar cuenta'}</DialogTitle>
            <DialogDescription>
              Una cuenta del negocio. El cajero la elige al cobrar por transferencia.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="bank"
                render={({ field }) => (
                  <Combobox
                    id="bank-account-bank"
                    label="Banco"
                    placeholder="Elegí el banco"
                    options={BANK_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    onBlur={field.onBlur}
                    invalid={errors.bank !== undefined}
                  />
                )}
              />
              <FieldError message={errors.bank?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Combobox
                    id="bank-account-type"
                    label="Tipo"
                    placeholder="Ahorro o corriente"
                    options={TYPE_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    onBlur={field.onBlur}
                    invalid={errors.type !== undefined}
                  />
                )}
              />
              <FieldError message={errors.type?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldBox>
                <Label htmlFor="bank-account-number">Número de cuenta</Label>
                <Input
                  id="bank-account-number"
                  autoComplete="off"
                  className="font-mono"
                  maxLength={24}
                  aria-invalid={errors.number ? true : undefined}
                  {...form.register('number')}
                />
              </FieldBox>
              {errors.number ? (
                <FieldError message={errors.number.message} />
              ) : (
                <p className="text-text-faint text-dense">
                  Solo dígitos y guiones. Se guarda sin guiones.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldBox>
                <Label htmlFor="bank-account-holder">Titular</Label>
                <Input
                  id="bank-account-holder"
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Elite Service S.A. de C.V."
                  aria-invalid={errors.holderName ? true : undefined}
                  {...form.register('holderName')}
                />
              </FieldBox>
              <FieldError message={errors.holderName?.message} />
            </div>

            {formError === null ? null : (
              <p className="text-danger-text text-body" role="alert">
                {formError}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete} loading={isPending}>
              {isNew ? 'Registrar cuenta' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) return null;

  return (
    <p className="text-danger-text text-label" role="alert">
      {message}
    </p>
  );
}
