'use client';

import { useEffect, useState } from 'react';

import { LogoPlaceholder } from '@/components/brand/logo-placeholder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rememberedUsername, useFloorLogin } from '../hooks/use-floor';

/**
 * Entrada a la pista: usuario y PIN, no correo y contraseña (RN-18).
 *
 * El usuario queda recordado **en esa tablet** y viene ya escrito, con el foco
 * puesto en el PIN. Es la diferencia entre teclear un correo de pie y con
 * guantes, o solo cuatro dígitos. El PIN no se guarda nunca.
 */
export function FloorLoginForm() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const login = useFloorLogin();

  // El usuario recordado se lee después de montar: en el servidor no existe
  // `localStorage`, y leerlo durante el render rompería la hidratación.
  useEffect(() => {
    setUsername(rememberedUsername());
  }, []);

  const remembered = username !== '' && pin === '';

  return (
    <form
      className="border-rule bg-card w-full max-w-90 rounded-lg border p-plate"
      onSubmit={(event) => {
        event.preventDefault();
        login.mutate({ username: username.trim().toLowerCase(), pin });
      }}
    >
      <LogoPlaceholder label="Logo pendiente" className="min-w-32 px-3" />

      <div className="mt-8 mb-4">
        <h1 className="text-title">Pista</h1>
        <p className="text-muted-foreground text-body">Entrá con tu usuario y tu PIN.</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="floor-username">Usuario</Label>
        <Input
          id="floor-username"
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoCapitalize="none"
          autoComplete="username"
        />
      </div>

      <div className="mt-4 grid gap-1.5">
        <Label htmlFor="floor-pin">PIN</Label>
        <Input
          id="floor-pin"
          name="pin"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          // Teclado numérico en la tablet: el PIN son solo dígitos (RN-18).
          inputMode="numeric"
          autoComplete="off"
          autoFocus={remembered}
        />
      </div>

      {login.error ? (
        <p className="text-stamp-red text-body mt-4" role="alert">
          {login.error.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-6 w-full" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
