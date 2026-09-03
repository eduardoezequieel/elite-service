'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rememberedUsername, useFloorLogin } from '../hooks/use-floor';

/**
 * Entrada a la pista: usuario y PIN, no correo y contraseña (RN-18).
 *
 * El usuario queda recordado **en esa tablet** y viene ya escrito, con el foco
 * puesto en el PIN. Es la diferencia entre teclear un correo de pie y con
 * guantes, o solo cuatro dígitos. El PIN no se guarda nunca.
 *
 * Igual que en oficina, el renglón del error está reservado: el botón no se
 * mueve bajo el dedo cuando el PIN sale mal.
 */
export function FloorLoginForm() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const login = useFloorLogin();

  // El usuario recordado se lee después de montar: en el servidor no existe
  // `localStorage`, y leerlo durante el render rompería la hidratación.
  useEffect(() => {
    setUsername(rememberedUsername());
  }, []);

  const remembered = username !== '' && pin === '';

  return (
    <div className="relative flex w-full max-w-[380px] flex-col items-center gap-7">
      <Logo size={34} />

      <Card className="w-full px-card">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate({ username: username.trim().toLowerCase(), pin });
          }}
        >
          <div>
            <h1 className="text-text font-display text-headline italic">Pista</h1>
            <p className="text-text-dim mt-1 text-body">Entrá con tu usuario y tu PIN.</p>
          </div>

          <FieldBox>
            <Label htmlFor="floor-username">Usuario</Label>
            <Input
              id="floor-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoComplete="username"
            />
          </FieldBox>

          {/* Mostrar/ocultar solo cambia el `type`: el campo es el mismo. */}
          <FieldBox>
            <Label htmlFor="floor-pin">PIN</Label>
            <div className="flex items-center gap-1">
              <Input
                id="floor-pin"
                name="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="min-w-0 flex-1"
                // Teclado numérico en la tablet: el PIN son solo dígitos (RN-18).
                inputMode="numeric"
                autoComplete="off"
                autoFocus={remembered}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-pressed={showPin}
                aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                onClick={() => setShowPin((visible) => !visible)}
              >
                {showPin ? (
                  <EyeOff strokeWidth={1.5} aria-hidden />
                ) : (
                  <Eye strokeWidth={1.5} aria-hidden />
                )}
              </Button>
            </div>
          </FieldBox>

          <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>

          <div className="min-h-5">
            {login.error ? (
              <p className="text-danger-text text-label" role="alert">
                {login.error.message}
              </p>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
