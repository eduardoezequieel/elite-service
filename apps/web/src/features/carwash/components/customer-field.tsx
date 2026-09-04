'use client';

import type { Customer } from '@elite/shared';
import { Search, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SUGGESTION_MIN_LENGTH, useCustomerSearch } from '../hooks/use-customer-search';

/**
 * El cliente de una ficha de lavado, en sus tres estados (004).
 *
 * 1. **Buscando** — un solo campo para el nombre o el teléfono, con las
 *    sugerencias debajo como láminas tocables y «Es alguien nuevo» al final.
 * 2. **Elegido** — la lámina del cliente con «Cambiar». Los campos de texto
 *    desaparecen: un cliente que ya existe no se reescribe desde el lavado
 *    (RN-6); si su teléfono está mal, se corrige en Clientes.
 * 3. **Nuevo** — Nombre y Teléfono, como siempre, para el que no es ninguno de
 *    los sugeridos.
 *
 * Nada de `<select>` ni de menú: se elige tocando, en botones de alto
 * `--touch-min` (RN-3, 003 RN-17).
 */
export type CustomerDraft =
  | { kind: 'search'; term: string }
  | { kind: 'chosen'; customer: Customer }
  | { kind: 'new'; fullName: string; phone: string };

/** El estado inicial y el de «Cambiar»: el buscador vacío. */
export const EMPTY_CUSTOMER: CustomerDraft = { kind: 'search', term: '' };

/** Un lavado no se abre sin cliente: o se eligió uno, o se escribió un nombre. */
export function customerIsComplete(draft: CustomerDraft): boolean {
  return draft.kind === 'chosen' || (draft.kind === 'new' && draft.fullName.trim() !== '');
}

/** El nombre del cliente para el resumen, o cadena vacía si todavía no hay. */
export function customerNameOf(draft: CustomerDraft): string {
  if (draft.kind === 'chosen') return draft.customer.fullName;
  if (draft.kind === 'new') return draft.fullName.trim();

  return '';
}

/**
 * Lo escrito en el buscador, aprovechado al pasar a «alguien nuevo»: si son
 * puros números es un teléfono, y si no, un nombre. Quien ya escribió el dato
 * no tiene por qué escribirlo dos veces.
 */
function draftFromTerm(term: string): CustomerDraft {
  const text = term.trim();
  const looksLikePhone = text !== '' && !/\p{L}/u.test(text);

  return {
    kind: 'new',
    fullName: looksLikePhone ? '' : text,
    phone: looksLikePhone ? text : '',
  };
}

export function CustomerField({
  value,
  onChange,
  scope,
  searchCustomers,
}: {
  value: CustomerDraft;
  onChange: (next: CustomerDraft) => void;
  /** De qué API salen las sugerencias: separa la caché de pista y oficina. */
  scope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
}) {
  const term = value.kind === 'search' ? value.term : '';
  const search = useCustomerSearch(scope, term, searchCustomers, value.kind === 'search');

  if (value.kind === 'chosen') {
    return (
      <div className="grid gap-1.5">
        <p className="text-text-faint text-label">Cliente</p>

        <div className="border-line bg-surface-2 min-h-touch flex flex-wrap items-center gap-3 rounded-row border px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="text-text block font-semibold">{value.customer.fullName}</span>
            <span className="text-text-faint block font-mono text-dense">
              {value.customer.phone ?? 'Sin teléfono'}
            </span>
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(EMPTY_CUSTOMER)}
          >
            Cambiar
          </Button>
        </div>

        <p className="text-text-faint text-dense">
          Si el nombre o el teléfono están mal, se corrigen en Clientes.
        </p>
      </div>
    );
  }

  if (value.kind === 'new') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBox>
            <Label htmlFor="ticket-customer-name">Nombre</Label>
            <Input
              id="ticket-customer-name"
              value={value.fullName}
              onChange={(event) => onChange({ ...value, fullName: event.target.value })}
              autoComplete="off"
            />
          </FieldBox>

          <FieldBox>
            <Label htmlFor="ticket-customer-phone">Teléfono</Label>
            <Input
              id="ticket-customer-phone"
              value={value.phone}
              onChange={(event) => onChange({ ...value, phone: event.target.value })}
              inputMode="tel"
              autoComplete="off"
            />
          </FieldBox>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange(EMPTY_CUSTOMER)}
        >
          <Search className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
          Buscar en los clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      <FieldBox>
        <Label htmlFor="ticket-customer">Cliente (nombre o teléfono)</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id="ticket-customer"
            className="min-w-0 flex-1"
            value={value.term}
            onChange={(event) => onChange({ kind: 'search', term: event.target.value })}
            placeholder="Juan Pérez o 7777-8888"
            autoComplete="off"
          />
        </div>
      </FieldBox>

      {search.tooShort ? (
        <p className="text-text-faint text-dense">
          Escribí al menos {SUGGESTION_MIN_LENGTH} letras o números para buscar, o seguí con «Es
          alguien nuevo».
        </p>
      ) : null}

      {search.isPending ? <p className="text-text-dim text-dense">Buscando…</p> : null}

      {search.error === null ? null : (
        <p className="text-danger-text text-dense" role="alert">
          {search.error.message}
        </p>
      )}

      {!search.tooShort &&
      !search.isPending &&
      search.error === null &&
      search.suggestions.length === 0 ? (
        <p className="text-text-faint text-dense">
          Nadie coincide con «{term}». Seguí con «Es alguien nuevo».
        </p>
      ) : null}

      {search.suggestions.map((customer) => (
        <button
          key={customer.id}
          type="button"
          onClick={() => onChange({ kind: 'chosen', customer })}
          className={cn(
            'min-h-touch border-line bg-surface-2 flex w-full cursor-pointer items-center gap-3.5 rounded-row border px-4 py-3 text-left',
            'text-body transition-colors duration-(--duration-state) ease-standard hover:border-flame',
          )}
        >
          <span className="text-text min-w-0 flex-1 truncate font-medium">{customer.fullName}</span>
          <span className="text-text-faint shrink-0 font-mono text-dense">
            {customer.phone ?? 'Sin teléfono'}
          </span>
        </button>
      ))}

      {/* Siempre al final: la salida para cuando no es ninguno de los de arriba. */}
      <button
        type="button"
        onClick={() => onChange(draftFromTerm(value.term))}
        className={cn(
          'min-h-touch border-line text-text-dim flex w-full cursor-pointer items-center gap-3.5 rounded-row border border-dashed px-4 py-3 text-left',
          'text-body transition-colors duration-(--duration-state) ease-standard hover:border-flame hover:text-text',
        )}
      >
        <UserPlus className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
        Es alguien nuevo
      </button>
    </div>
  );
}
