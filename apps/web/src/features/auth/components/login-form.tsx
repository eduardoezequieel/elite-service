'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/brand/logo';
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
 *
 * El sitio del mensaje general está **reservado** aunque no haya error: si
 * apareciera de la nada, el botón se correría bajo el dedo justo cuando el
 * cajero vuelve a intentarlo.
 */
export function LoginForm() {
  const router = useRouter();
  const fieldId = useId();
  const { data: session, isPending: isSessionPending } = useSession();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="relative flex w-full max-w-[380px] flex-col items-center gap-7">
      <Logo size={34} />

      <Card className="w-full gap-5 px-card">
        <div>
          <h1 className="text-text font-display text-headline italic">Iniciar sesión</h1>
          <p className="text-text-dim mt-1 text-body">Entrá con tu correo y tu contraseña.</p>
        </div>

        {isSessionPending || hasSession ? (
          <p className="text-text-dim text-body" role="status">
            {hasSession ? 'Ya tenés la sesión abierta.' : 'Comprobando la sesión…'}
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldBox>
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
              </FieldBox>
              {errors.email ? (
                <p id={emailErrorId} className="text-danger-text text-label font-normal">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              {/* Mostrar/ocultar cambia el `type` y nada más: el campo, su
                  registro en RHF y su `autoComplete` son los mismos. */}
              <FieldBox>
                <Label htmlFor={passwordId}>Contraseña</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="min-w-0 flex-1"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? passwordErrorId : undefined}
                    {...register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? (
                      <EyeOff strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Eye strokeWidth={1.5} aria-hidden />
                    )}
                  </Button>
                </div>
              </FieldBox>
              {errors.password ? (
                <p id={passwordErrorId} className="text-danger-text text-label font-normal">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isSubmitting}
              aria-describedby={formError ? formErrorId : undefined}
            >
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>

            {/* El mensaje general vive al pie, donde ocurre el error, y su
             * renglón está reservado para que el formulario no salte. */}
            <div className="min-h-5">
              {formError ? (
                <p id={formErrorId} role="alert" className="text-danger-text text-label">
                  {formError.message}
                </p>
              ) : null}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
