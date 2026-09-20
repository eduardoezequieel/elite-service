'use client';

import { PIN_LENGTH } from '@elite/shared';
import { Delete } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFloorLogin, useFloorSession } from '../hooks/use-floor';

/** Las teclas, en el orden del teclado de un teléfono. */
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Tecla del PIN. Alto y tipografía crecen con la densidad: en `bahia` son 64px
 * de botón, que es lo que pide un dedo con guante (regla global 9).
 */
const keyClassName = 'h-[calc(var(--control-h)_+_16px)] text-headline font-semibold tabular-nums';

/**
 * Entrada a la pista: **solo el PIN** (spec 044 RN-1).
 *
 * No hay usuario que escribir ni usuario recordado, porque el PIN es único en
 * todo el taller: quien lo teclea queda identificado por eso mismo. El teclado
 * es de la pantalla y no del sistema: en la tablet, de pie, el teclado del
 * aparato tapa media pantalla y aparece tarde.
 *
 * Al sexto dígito entra solo, sin botón: el largo es fijo, así que preguntar
 * «¿ya terminaste?» sobra. Si el PIN sale mal, las casillas se vacían y el
 * renglón del error está reservado, para que nada salte de lugar bajo el dedo.
 *
 * El teclado físico también sirve —el mostrador tiene uno—: dígitos, `Backspace`
 * y `Enter`.
 */
export function FloorLoginForm() {
  const router = useRouter();
  const session = useFloorSession();
  const [pin, setPin] = useState('');
  const login = useFloorLogin();

  const hasSession = session.data != null;
  const showKeypad = !session.isPending && !hasSession;
  const busy = login.isPending;

  useEffect(() => {
    if (hasSession) router.replace('/floor');
  }, [hasSession, router]);

  const submit = useCallback(
    (value: string) => {
      login.mutate(
        { pin: value },
        {
          onSuccess: () => router.replace('/floor'),
          // El PIN equivocado no se corrige: se vuelve a teclear entero. Dejarlo
          // a medias obliga a adivinar cuántos dígitos quedaron.
          onError: () => setPin(''),
        },
      );
    },
    [login, router],
  );

  const press = useCallback(
    (digit: string) => {
      if (busy) return;

      setPin((current) => {
        if (current.length >= PIN_LENGTH) return current;

        const next = current + digit;

        if (next.length === PIN_LENGTH) submit(next);

        return next;
      });
    },
    [busy, submit],
  );

  const erase = useCallback(() => {
    if (!busy) setPin((current) => current.slice(0, -1));
  }, [busy]);

  // El teclado físico escribe lo mismo que el de la pantalla. Va en `window`
  // porque acá no hay campo de texto donde poner el foco.
  useEffect(() => {
    if (!showKeypad) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        press(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        erase();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showKeypad, press, erase]);

  return (
    <div className="relative flex w-full max-w-[380px] flex-col items-center gap-7">
      <Logo size={34} />

      <Card className="w-full gap-5 px-card">
        <div>
          <h1 className="text-text font-display text-headline italic">Lavado</h1>
          <p className="text-text-dim mt-1 text-body">Entrá con tu PIN.</p>
        </div>

        {showKeypad ? (
          <div className="flex flex-col gap-5">
            <div
              className="flex justify-center gap-3"
              role="status"
              aria-label={`${pin.length} de ${PIN_LENGTH} dígitos`}
            >
              {Array.from({ length: PIN_LENGTH }, (_, index) => (
                <span
                  key={index}
                  aria-hidden
                  className={cn(
                    'size-3.5 rounded-full border transition-colors duration-(--duration-state)',
                    index < pin.length ? 'border-flame bg-flame' : 'border-line bg-surface-2',
                  )}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {DIGITS.map((digit) => (
                <Button
                  key={digit}
                  type="button"
                  variant="outline"
                  className={keyClassName}
                  disabled={busy}
                  onClick={() => press(digit)}
                >
                  {digit}
                </Button>
              ))}

              {/* El hueco deja el cero centrado, como en cualquier teclado. */}
              <span aria-hidden />

              <Button
                type="button"
                variant="outline"
                className={keyClassName}
                disabled={busy}
                onClick={() => press('0')}
              >
                0
              </Button>

              <Button
                type="button"
                variant="ghost"
                className={keyClassName}
                aria-label="Borrar el último dígito"
                disabled={busy || pin === ''}
                onClick={erase}
              >
                <Delete strokeWidth={1.5} aria-hidden />
              </Button>
            </div>

            <div className="min-h-5 text-center">
              {busy ? (
                <p className="text-text-dim text-label" role="status">
                  Entrando…
                </p>
              ) : login.error ? (
                <p className="text-danger-text text-label" role="alert">
                  {login.error.message}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-text-dim text-body" role="status">
            {hasSession ? 'Ya tenés la sesión abierta.' : 'Comprobando la sesión…'}
          </p>
        )}
      </Card>
    </div>
  );
}
