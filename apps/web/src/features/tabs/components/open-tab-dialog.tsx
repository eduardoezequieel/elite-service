'use client';

import type { TabHolderOption } from '@elite/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { holderQueryKey, useTabHolders } from '../hooks/use-tabs';
import { newSaleHref } from '../tab-format';
import { HolderGroupLabel, HolderOptionRow } from './holder-option-row';

function keyOf(holder: Pick<TabHolderOption, 'kind' | 'id'>): string {
  return `${holder.kind}:${holder.id}`;
}

/**
 * «Abrir cuenta» (105): elegir a la persona. No crea nada —una cuenta nace con
 * su primera línea—: si ya tiene una abierta, el botón lleva a ella («Ir a
 * C-0012»); si no, a «Nueva venta» en «Anotar a cuenta» con la persona puesta.
 *
 * Se monta al abrir, así que cada apertura arranca en blanco.
 */
export function OpenTabDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const holders = useTabHolders(search);
  const [picked, setPicked] = useState<TabHolderOption | null>(null);
  const groups = [
    { label: 'Trabajadores', options: holders.data?.employees ?? [] },
    { label: 'Clientes', options: holders.data?.customers ?? [] },
  ].filter((group) => group.options.length > 0);
  // Lo elegido se relee de la lista si sigue a la vista: su cuenta pudo cambiar.
  const chosen =
    picked === null
      ? null
      : (groups
          .flatMap((group) => group.options)
          .find((option) => keyOf(option) === keyOf(picked)) ?? picked);
  const openTab = chosen?.openTab ?? null;

  function go(): void {
    if (chosen === null) return;

    if (openTab !== null) {
      router.push(`/sales/tabs/${openTab.id}`);
      return;
    }

    queryClient.setQueryData(holderQueryKey(chosen.kind, chosen.id), chosen);
    router.push(newSaleHref({ kind: 'holder', holder: { kind: chosen.kind, id: chosen.id } }));
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg [[data-density=bahia]_&]:md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Abrir cuenta</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <FieldBox>
            <Label htmlFor="open-tab-search">Buscar</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="open-tab-search"
                type="search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          </FieldBox>

          <div
            role="listbox"
            aria-label="Personas"
            className="border-line-soft flex max-h-80 flex-col gap-0.5 overflow-y-auto rounded-row border p-1.5"
          >
            {holders.isPending ? (
              <p className="text-text-faint px-3 py-2 text-dense">Cargando…</p>
            ) : holders.error !== null ? (
              <p className="text-danger-text px-3 py-2 text-dense" role="alert">
                {holders.error.message}
              </p>
            ) : groups.length === 0 ? (
              <p className="text-text-faint px-3 py-2 text-dense">Sin resultados</p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-0.5">
                  <HolderGroupLabel>{group.label}</HolderGroupLabel>
                  {group.options.map((option) => {
                    const selected = chosen !== null && keyOf(option) === keyOf(chosen);

                    return (
                      <HolderOptionRow
                        key={keyOf(option)}
                        role="option"
                        aria-selected={selected}
                        holder={option}
                        selected={selected}
                        onClick={() => setPicked(option)}
                        aside={
                          option.openTab === null ? null : (
                            <Stamp tone="washing" pulse={false} label={option.openTab.number} />
                          )
                        }
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={chosen === null} onClick={go}>
            {openTab === null ? 'Abrir y anotar' : `Ir a ${openTab.number}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
