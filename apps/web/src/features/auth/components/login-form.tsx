'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogoPlaceholder } from '@/components/brand/logo-placeholder';
import { Label } from '@/components/ui/label';
import { useLogin, useSession } from '../hooks/use-session';

/** Los campos que el API puede marcar desde `details`. */
const FIELD_NAMES = ['email', 'password'] as const;

type LoginField = (typeof FIELD_NAMES)[number];

function isLoginField(value: string): value is LoginField {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/**
 * Traduce el `details` del API a errores de campo.
 *
 * El pipe de validacion del backend lo emite como `{ campo: mensaje }`; acá se
 * descarta cualquier clave que no sea un campo de este formulario.
 */
function fieldErrorsFrom(details: unknown): [LoginField, string][] {
  if (typeof details !== 'object' || details === null) return [];

  return Object.entries(details as Record<string, unknown>).filter(
    (entry): entry is [LoginField, string] =>
      isLoginField(entry[0]) && typeof entry[1] === 'string',
  );
}

/**
 * Formulario de inicio de sesion.
 *
 * La validacion sale de `loginSchema` de `@elite/shared`: la misma que corre el
 * backend, sin duplicar. El mensaje general va al pie tal cual llega en
 * `ApiError.message` — en credenciales invalidas el API responde a proposito sin
 * decir si fallo el correo o la contrasena, y acá no se reinterpreta.
 */
export function LoginForm() {
  const router = useRouter();
  const fieldId = useId();
  const { data: session, isPending: isSessionPending } = useSession();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const hasSession = session != null;

  // Quien ya entro no vuelve a ver el formulario: la raiz decide su destino.
  useEffect(() => {
    if (hasSession) {
      router.replace('/');
    }
  }, [hasSession, router]);

  const emailId = `${fieldId}-email`;
  const passwordId = `${fieldId}-password`;
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;
  const formErrorId = `${fieldId}-error`;

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        router.replace('/');
      },
      onError: (error) => {
        for (const [field, message] of fieldErrorsFrom(error.details)) {
          setError(field, { type: 'server', message });
        }
      },
    });
  });

  const formError = loginMutation.error;
  const isSubmitting = loginMutation.isPending;

  return (
    <div className="border-rule bg-card w-full max-w-90 rounded-lg border p-plate">
      <LogoPlaceholder label="Logo pendiente" className="min-w-32 px-3" />

      <div className="mt-8 mb-4">
        <h1 className="text-title">Iniciar sesión</h1>
        <p className="text-muted-foreground text-body">
          Entrá con tu correo y tu contraseña.
        </p>
      </div>

      {isSessionPending || hasSession ? (
        <p className="text-muted-foreground text-body" role="status">
          {hasSession ? 'Ya tenés la sesión abierta.' : 'Comprobando la sesión…'}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>Correo</Label>
            <Input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? emailErrorId : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p id={emailErrorId} className="text-stamp-red text-label font-normal">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={passwordId}>Contraseña</Label>
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? passwordErrorId : undefined}
              {...register('password')}
            />
            {errors.password ? (
              <p id={passwordErrorId} className="text-stamp-red text-label font-normal">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            aria-describedby={formError ? formErrorId : undefined}
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>

          {/* El mensaje general vive al pie, donde ocurre el error: este sistema
           * no usa toasts (spec 001 → Errores y confirmaciones). */}
          {formError ? (
            <p id={formErrorId} role="alert" className="text-stamp-red text-label">
              {formError.message}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
