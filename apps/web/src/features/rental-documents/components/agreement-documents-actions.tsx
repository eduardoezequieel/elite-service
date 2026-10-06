'use client';

import { PERMISSIONS } from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';
import { ChevronDown, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAssignContractNumber } from '@/features/rentals/hooks/use-agreements';
import { usePrintOptions } from '../hooks/use-print-options';
import { PrintOptionsItems } from './print-options-menu';

/** La vista de impresión de una renta (097). `inspection` abre solo esa hoja. */
export function agreementPrintHref(id: string, sheet?: 'inspection'): string {
  const path = `/rentals/agreements/${id}/print`;

  return sheet === 'inspection' ? `${path}?sheet=inspection` : path;
}

/**
 * «Imprimir contrato» en el detalle de una renta (097): el menú con las
 * opciones del juego y la entrada a la vista de impresión. Una renta sin
 * número lo pide antes de abrirla (`POST …/contract-number`), así el papel
 * sale con su número del talonario.
 *
 * Sin número y sin `rentals.manage` (o cancelada) no hay contrato que
 * imprimir: el botón no aparece.
 */
export function AgreementDocumentsActions({ agreement }: { agreement: RentalAgreement }) {
  const router = useRouter();
  const { can } = usePermissions();
  const assign = useAssignContractNumber();
  const [options, setOptions] = usePrintOptions();
  const needsNumber = agreement.contractNumber === null;
  const canAssign = can(PERMISSIONS.rentals.actions.manage.key) && agreement.status !== 'CANCELLED';

  if (needsNumber && !canAssign) return null;

  const open = () => {
    const href = agreementPrintHref(agreement.id);

    if (!needsNumber) {
      router.push(href);
      return;
    }
    assign.mutate(agreement.id, { onSuccess: () => router.push(href) });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" disabled={assign.isPending}>
            <Printer className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
            {assign.isPending ? 'Asignando número…' : 'Imprimir contrato'}
            <ChevronDown className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <PrintOptionsItems options={options} onChange={setOptions} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={open} className="font-semibold">
            <Printer strokeWidth={1.5} aria-hidden />
            {needsNumber ? 'Asignar número y abrir' : 'Abrir para imprimir'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {assign.error === null ? null : (
        <p className="text-danger-text text-dense" role="alert">
          {assign.error.message}
        </p>
      )}
    </div>
  );
}
