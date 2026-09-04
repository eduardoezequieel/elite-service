'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { changePasswordSchema } from '@elite/shared';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
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
import { useChangePassword } from '../hooks/use-session';

const formSchema = changePasswordSchema
  .extend({
    confirmPassword: z.string().min(1, { message: 'Repetí la contraseña nueva.' }),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas nuevas no coinciden.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

/**
 * Diálogo para cambiar la clave propia (spec 006).
 *
 * La validación de largo sale de `changePasswordSchema`. «Repetir» es solo del
 * cliente: el API no la pide dos veces. Los errores van al pie; el toast, solo
 * si salió bien.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const change = useChangePassword();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const close = (next: boolean) => {
    if (!next) {
      form.reset();
      change.reset();
    }
    onOpenChange(next);
  };

  const submit = form.handleSubmit((values) => {
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast({ title: 'Contraseña actualizada' });
          close(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            La sesión de ahora sigue. Las demás, en otros navegadores, se cierran.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={submit}
            noValidate
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogBody>
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Contraseña actual</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Contraseña nueva</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Repetir la nueva</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {change.error ? (
                <p className="text-danger-text text-body" role="alert">
                  {change.error.message}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" loading={change.isPending}>
                {change.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
