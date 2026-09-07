'use client';

import type { Customer, CustomerMatch } from '@elite/shared';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhone } from '@/lib/phone';
import { SUGGESTION_MIN_LENGTH, useCustomerSearch } from '../hooks/use-customer-search';

/**
 * El cliente de una ficha de lavado (028, 030).
 *
 * Un cliente ya registrado se muestra como **pastilla**: se ve distinto de lo
 * que se escribe a mano, así que «elegido» y «nuevo» dejan de ser un estado
 * invisible que hay que aprender. Sus datos se pueden abrir para corregirlos, y
 * entonces el perfil se actualiza al guardar el lavado (028).
 */
export interface CustomerDraft {
  customerId?: string;
  fullName: string;
  phone: string;
  original?: {
    fullName: string;
    phone: string;
  };
}

/** Estado inicial del cliente en el formulario. */
export const EMPTY_CUSTOMER: CustomerDraft = {
  customerId: undefined,
  fullName: '',
  phone: '',
  original: undefined,
};

/** Un lavado no se abre sin nombre de cliente. */
export function customerIsComplete(draft: CustomerDraft): boolean {
  return draft.fullName.trim() !== '';
}

/** El nombre del cliente para el resumen. */
export function customerNameOf(draft: CustomerDraft): string {
  return draft.fullName.trim();
}

/** El borrador de un cliente que ya existe, con su copia original (028). */
export function draftFromCustomer(customer: Customer): CustomerDraft {
  const phone = customer.phone ? formatPhone(customer.phone) : '';

  return {
    customerId: customer.id,
    fullName: customer.fullName,
    phone,
    original: { fullName: customer.fullName, phone },
  };
}

/**
 * El dueño del carro: pastilla si ya existe, campo de texto si es nuevo (030).
 *
 * Mientras se escribe se sugieren clientes; al salir del campo, si lo escrito se
 * parece a alguien que ya existe, la pregunta «¿Es el mismo?» aparece **acá
 * mismo, debajo del campo**, no al pulsar Guardar. Es la diferencia entre
 * resolverlo con el cliente enfrente y descubrirlo cuando ya creíste terminar.
 */
export function OwnerField({
  value,
  onChange,
  scope,
  searchCustomers,
  matchCustomer,
  label = '¿A nombre de quién?',
  idPrefix = 'ticket-customer',
}: {
  value: CustomerDraft;
  onChange: (next: CustomerDraft) => void;
  /** De qué API salen las sugerencias: separa la caché de pista y oficina. */
  scope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
  /** Si viene, se pregunta en línea por el parecido al salir del campo (030). */
  matchCustomer?: (fullName: string, phone?: string) => Promise<CustomerMatch | null>;
  label?: string;
  /** Prefijo de los `id`: dos campos de dueño no pueden compartirlos. */
  idPrefix?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [maybe, setMaybe] = useState<CustomerMatch | null>(null);
  const dismissedRef = useRef<string>('');
  const search = useCustomerSearch(scope, value.fullName, searchCustomers);

  const nameId = `${idPrefix}-name`;
  const phoneId = `${idPrefix}-phone`;

  function handleSelect(customer: Customer): void {
    onChange(draftFromCustomer(customer));
    setMaybe(null);
    setIsEditing(false);
  }

  /** Al salir del campo: ¿hay alguien que ya se llama así? (004 RN-2) */
  async function askAboutMatch(): Promise<void> {
    const name = value.fullName.trim();

    if (
      matchCustomer === undefined ||
      value.customerId !== undefined ||
      name.length < 2 ||
      dismissedRef.current === name.toLowerCase()
    ) {
      return;
    }

    try {
      setMaybe(await matchCustomer(name, value.phone.trim() || undefined));
    } catch {
      // Si la consulta falla, se sigue como cliente nuevo: nunca bloquea.
      setMaybe(null);
    }
  }

  const suggestionOptions = search.suggestions.map((candidate) => ({
    value: candidate.id,
    label: candidate.fullName,
    meta: candidate.phone ? formatPhone(candidate.phone) : 'Sin teléfono',
  }));

  /* Cliente ya registrado: pastilla, y sus datos solo si se piden. */
  if (value.customerId !== undefined && !isEditing) {
    return (
      <div>
        <p className="text-text-faint text-label mb-2">{label}</p>

        <div className="bg-surface-3 border-[color-mix(in_oklab,var(--flame)_45%,var(--line))] min-h-touch flex w-fit max-w-full items-center gap-3 rounded-full border-[1.5px] py-1.5 pr-1.5 pl-4">
          <span className="min-w-0 leading-tight">
            <span className="text-text block truncate font-semibold">{value.fullName}</span>
            <span className="text-text-faint block text-dense">
              Cliente registrado · {value.phone === '' ? 'sin teléfono' : value.phone}
            </span>
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => setIsEditing(true)}
          >
            Editar
          </Button>

          <button
            type="button"
            aria-label="Quitar el cliente"
            onClick={() => {
              onChange({ ...EMPTY_CUSTOMER });
              setMaybe(null);
            }}
            className="text-text-faint hover:bg-surface-2 hover:text-text grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-body transition-colors duration-(--duration-state) ease-standard"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="customer-field-root">
      <p className="text-text-faint text-label mb-2">{label}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Combobox
          mode="search"
          id={nameId}
          label="Nombre"
          placeholder="Juan Pérez"
          options={suggestionOptions}
          value={value.customerId ?? ''}
          query={value.fullName}
          filter="off"
          minQueryLength={SUGGESTION_MIN_LENGTH}
          enterKeyHint="next"
          onQueryChange={(query) => {
            onChange({
              ...value,
              fullName: query,
              customerId: undefined,
              original: undefined,
            });
            setMaybe(null);
          }}
          onChange={(_id, option) => {
            const customer = search.suggestions.find((candidate) => candidate.id === option.value);
            if (customer !== undefined) handleSelect(customer);
          }}
          onFreeText={() => document.getElementById(phoneId)?.focus()}
          onBlur={() => {
            void askAboutMatch();
          }}
        />

        <FieldBox>
          <Label htmlFor={phoneId}>Teléfono</Label>
          <Input
            id={phoneId}
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: formatPhone(event.target.value) })}
            maxLength={9}
            inputMode="tel"
            enterKeyHint="done"
            placeholder="7777-8888"
            autoComplete="off"
          />
        </FieldBox>
      </div>

      {maybe === null ? null : (
        <div className="mt-2.5 border-[color-mix(in_oklab,var(--warn)_45%,var(--line))] flex flex-wrap items-center gap-3 rounded-row border bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface-2))] px-4 py-3">
          <p className="text-text text-dense min-w-[200px] flex-1">
            Ya existe <span className="font-semibold">{maybe.customer.fullName}</span> ·{' '}
            {maybe.customer.phone ?? 'sin teléfono'}.{' '}
            {maybe.on === 'phone' ? 'Tiene el mismo teléfono.' : 'Se llama igual.'} ¿Es el mismo?
          </p>

          <Button type="button" size="sm" onClick={() => handleSelect(maybe.customer)}>
            Sí, es él
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              dismissedRef.current = value.fullName.trim().toLowerCase();
              setMaybe(null);
            }}
          >
            No, es otro
          </Button>
        </div>
      )}
    </div>
  );
}
