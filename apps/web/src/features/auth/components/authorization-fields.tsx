'use client';

import type { AuthorizationInput } from '@elite/shared';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Punto de partida y reset del bloque. */
export const EMPTY_AUTHORIZATION: AuthorizationInput = { email: '', password: '' };

/** `true` cuando los dos campos tienen algo. El API decide si además sirven. */
export function isAuthorizationFilled(value: AuthorizationInput): boolean {
  return value.email.trim() !== '' && value.password !== '';
}

/**
 * Credenciales de quien autoriza una acción destructiva desde la pantalla de
 * otro (spec 045).
 *
 * No inicia sesión ni cambia el usuario de la pantalla: firma esa llamada y
 * nada más. Por eso no autoenfoca —el foco es del motivo, que se escribe
 * primero— y la contraseña va con `autoComplete="off"`: el navegador no tiene
 * por qué ofrecer la del que está adelante.
 */
export function AuthorizationFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
}: {
  idPrefix: string;
  value: AuthorizationInput;
  onChange: (value: AuthorizationInput) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-text-faint text-label">Autorización de un administrador</p>
      <FieldBox>
        <Label htmlFor={`${idPrefix}-auth-email`}>Correo</Label>
        <Input
          id={`${idPrefix}-auth-email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          disabled={disabled}
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
        />
      </FieldBox>
      <FieldBox>
        <Label htmlFor={`${idPrefix}-auth-password`}>Contraseña</Label>
        <Input
          id={`${idPrefix}-auth-password`}
          type="password"
          autoComplete="off"
          disabled={disabled}
          value={value.password}
          onChange={(event) => onChange({ ...value, password: event.target.value })}
        />
      </FieldBox>
    </div>
  );
}
