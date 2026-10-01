'use client';

import { PERMISSIONS } from '@elite/shared';
import type { RentalAgreement, RentalSettings, Renter } from '@elite/shared';
import { ArrowLeft, ChevronDown, Printer, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GaugeLoader } from '@/components/ui/gauge-loader';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { useAgreement, useAssignContractNumber } from '@/features/rentals/hooks/use-agreements';
import { useRenter } from '@/features/renters/hooks/use-renters';
import { usePrintOptions } from '../hooks/use-print-options';
import { formatContractNumber, pageOrder, type PrintOptions } from '../print-layout';
import { ContractBack, ContractFront } from './contract-sheet';
import { PaperPage } from './document-parts';
import { InspectionSheet } from './inspection-sheet';
import { PrintOptionsItems, sheetCountLabel } from './print-options-menu';

/**
 * Las medidas del papel y la página impresa (097). Viven acá y no en
 * `globals.css` porque son de esta vista sola: la hoja carta, los márgenes de
 * 12 mm y los tamaños de letra del talonario. Impreso, el texto tenue y los
 * filetes pasan a tinta plena: el papel sale en blanco y negro.
 */
const PRINT_CSS = `
[data-slot='rental-print'] {
  --paper-w: 8.5in;
  --paper-h: 11in;
  --paper-pad: 12mm;
  --paper-text: 8.5pt;
  --paper-small: 7.5pt;
  --paper-title: 12pt;
  --paper-logo-h: 18mm;
  --paper-logo-w: 40mm;
  --paper-sign-h: 10mm;
  --paper-blank: 12mm;
  --paper-blank-wide: 30mm;
  --paper-amount-w: 28mm;
  --paper-num-w: 6mm;
  --paper-check-w: 8mm;
  --paper-fuel-label-w: 14mm;
}
@page { size: letter; margin: 12mm; }
@media print {
  html, body { background: none !important; }
  [data-slot='rental-print'] {
    --text-dim: var(--text);
    --text-faint: var(--text);
    --line: var(--text);
    --line-soft: var(--text);
    --surface-2: var(--surface);
    min-height: 0 !important;
    padding: 0 !important;
    background: none !important;
  }
  [data-slot='paper-page']:last-child { break-after: auto; }
}
`;

/** La vista de impresión de una renta (097): contrato, reverso e inspección en el orden elegido. */
export function PrintScreen({ id }: { id: string }) {
  const { can } = usePermissions();
  const agreement = useAgreement(id);
  const settings = useRentalSettings();
  const renterId = agreement.data?.customerId ?? '';
  const canReadRenter = can(PERMISSIONS.renters.actions.read.key);
  const renter = useRenter(renterId, canReadRenter && renterId !== '');
  const [options, setOptions] = usePrintOptions();
  useEnsureContractNumber(agreement.data);

  const renterPending = canReadRenter && renterId !== '' && renter.isPending;
  const loading = agreement.isPending || settings.isPending || renterPending;
  const error = agreement.error ?? settings.error;

  return (
    <div
      data-slot="rental-print"
      data-theme="light"
      className="bg-bg text-text min-h-screen px-4 py-6"
    >
      <style>{PRINT_CSS}</style>

      <Toolbar
        id={id}
        agreement={agreement.data}
        options={options}
        onOptionsChange={setOptions}
        ready={!loading && error === null}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <GaugeLoader label="Armando el contrato" />
        </div>
      ) : error !== null || agreement.data === undefined || settings.data === undefined ? (
        <p className="text-danger-text text-body mx-auto max-w-(--paper-w)" role="alert">
          {error?.message ?? 'No se pudo cargar la renta.'}
        </p>
      ) : (
        <Documents
          agreement={agreement.data}
          settings={settings.data}
          renter={renter.data ?? null}
          options={options}
        />
      )}
    </div>
  );
}

/**
 * Si se entró directo por la URL a una renta sin número, se pide una vez
 * (096 `POST …/contract-number`); sin `rentals.manage` el número queda en
 * blanco para escribirlo a mano.
 */
function useEnsureContractNumber(agreement: RentalAgreement | undefined) {
  const { can } = usePermissions();
  const assign = useAssignContractNumber();
  const asked = useRef<string | null>(null);
  const canAssign = can(PERMISSIONS.rentals.actions.manage.key);
  const { mutate } = assign;

  useEffect(() => {
    if (agreement === undefined || !canAssign) return;
    if (agreement.contractNumber !== null || agreement.status === 'CANCELLED') return;
    if (asked.current === agreement.id) return;

    asked.current = agreement.id;
    mutate(agreement.id);
  }, [agreement, canAssign, mutate]);
}

function Toolbar({
  id,
  agreement,
  options,
  onOptionsChange,
  ready,
}: {
  id: string;
  agreement: RentalAgreement | undefined;
  options: PrintOptions;
  onOptionsChange: (next: PrintOptions) => void;
  ready: boolean;
}) {
  const number = formatContractNumber(agreement?.contractNumber);

  return (
    <div className="mx-auto mb-4 flex w-full max-w-(--paper-w) flex-wrap items-center gap-2 print:hidden">
      <Button asChild variant="outline">
        <Link href={`/rentals/agreements/${id}`}>
          <ArrowLeft className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
          Volver
        </Link>
      </Button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-title truncate">
          {number === '' ? 'Contrato sin número' : `Contrato N° ${number}`}
        </span>
        <span className="text-text-dim text-dense">Tamaño carta · {sheetCountLabel(options)}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline">
            <SlidersHorizontal
              className="size-icon text-text-faint"
              strokeWidth={1.5}
              aria-hidden
            />
            Opciones
            <ChevronDown className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <PrintOptionsItems options={options} onChange={onOptionsChange} />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button type="button" disabled={!ready} onClick={() => window.print()}>
        <Printer className="size-icon" strokeWidth={1.5} aria-hidden />
        Imprimir
      </Button>
    </div>
  );
}

function Documents({
  agreement,
  settings,
  renter,
  options,
}: {
  agreement: RentalAgreement;
  settings: RentalSettings;
  renter: Renter | null;
  options: PrintOptions;
}) {
  return (
    <div className="flex flex-col gap-6 print:block">
      {pageOrder(options).map((page, index) => {
        const key = `${page.copy}-${page.kind}-${index}`;

        switch (page.kind) {
          case 'contract-front':
            return (
              <ContractFront
                key={key}
                agreement={agreement}
                settings={settings}
                renter={renter}
                copy={page.copy}
              />
            );
          case 'contract-back':
            return (
              <ContractBack key={key} agreement={agreement} settings={settings} copy={page.copy} />
            );
          case 'inspection':
            return (
              <InspectionSheet
                key={key}
                agreement={agreement}
                settings={settings}
                copy={page.copy}
              />
            );
          case 'blank':
            return (
              <PaperPage key={key}>
                <p className="text-text-dim m-auto print:invisible">
                  Cara en blanco: deja el juego siguiente en una hoja nueva.
                </p>
              </PaperPage>
            );
        }
      })}
    </div>
  );
}
