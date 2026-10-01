'use client';

import { RENTER_IMPORT_MAX_ROWS, renterFromImportRow, renterImportFieldOf } from '@elite/shared';
import type { RenterImportResult } from '@elite/shared';
import { FileUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stamp } from '@/components/ui/stamp';
import { FormAlert, TextAreaField } from '@/features/inventory/components/form-fields';
import { parseCsv } from '../csv';
import { useImportRenters } from '../hooks/use-renters';

/** Una fila de la vista previa, con lo que el API va a hacer con ella. */
interface PreviewRow {
  row: number;
  fullName: string;
  documentId: string;
  reason: string | null;
}

/**
 * Importar clientes de renta desde un CSV (095 RN-9): se sube el archivo que
 * exporta Excel o se pega el texto, se ve qué filas entran y cuáles no, y al
 * importar se muestra el resultado del API. Las columnas se reconocen por
 * nombre: «Nombre», «DUI», «Licencia», «Celular», «Teléfono», «Email»…
 */
export function RenterImportDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<RenterImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importRenters = useImportRenters();
  const { toast } = useToast();

  const parsed = useMemo(() => parseCsv(text), [text]);
  const recognized = parsed.headers.filter((header) => renterImportFieldOf(header) !== null);
  const preview = useMemo<PreviewRow[]>(
    () =>
      parsed.rows.map((row, index) => {
        const outcome = renterFromImportRow(row);
        const named = 'input' in outcome ? outcome.input : null;

        return {
          row: index + 2,
          fullName: named?.fullName ?? '—',
          documentId: named?.documentId ?? '',
          reason: 'reason' in outcome ? outcome.reason : null,
        };
      }),
    [parsed.rows],
  );
  const valid = preview.filter((row) => row.reason === null).length;
  const tooMany = parsed.rows.length > RENTER_IMPORT_MAX_ROWS;

  async function readFile(file: File): Promise<void> {
    setResult(null);
    setText(await file.text());
  }

  function submit(): void {
    importRenters.mutate(
      { rows: parsed.rows },
      {
        onSuccess: (outcome) => {
          setResult(outcome);
          toast({
            title: 'Importación lista',
            description:
              outcome.created === 1 ? '1 cliente creado' : `${outcome.created} clientes creados`,
          });
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>
            Guardá tu Excel como CSV y subilo, o pegá el texto. La primera fila son los encabezados;
            sin nombre, la fila no entra.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {result === null ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Archivo CSV"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file !== undefined) void readFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="max-sm:w-full"
                  onClick={() => fileInput.current?.click()}
                >
                  <FileUp className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
                  Elegir archivo CSV
                </Button>
                <span className="text-text-faint text-dense">o pegalo abajo</span>
              </div>

              <TextAreaField
                id="renter-import-text"
                label="Contenido del CSV"
                rows={5}
                className="font-mono"
                placeholder={'Nombre;DUI;Celular\nAna López;01234567-8;7777-8888'}
                value={text}
                onChange={(event) => {
                  setResult(null);
                  setText(event.target.value);
                }}
              />

              {parsed.rows.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-body">
                    <span className="font-semibold">{valid}</span> de {parsed.rows.length} filas
                    entran.{' '}
                    <span className="text-text-dim">
                      Columnas reconocidas:{' '}
                      {recognized.length > 0 ? recognized.join(', ') : 'ninguna'}.
                    </span>
                  </p>
                  {tooMany ? (
                    <p className="text-danger-text text-body" role="alert">
                      Son más de {RENTER_IMPORT_MAX_ROWS} filas: partí el archivo en dos.
                    </p>
                  ) : null}
                  <DataTable
                    rows={preview}
                    rowKey={(row) => String(row.row)}
                    reference={(row) => row.row}
                    pageSize={8}
                    emptyMessage="El archivo no trae filas."
                    columns={[
                      {
                        key: 'name',
                        header: 'Nombre',
                        stack: 'title',
                        headerClassName: 'w-full',
                        cell: (row) => <span className="font-semibold">{row.fullName}</span>,
                      },
                      {
                        key: 'document',
                        header: 'Documento',
                        className: 'whitespace-nowrap',
                        cell: (row) => (
                          <span className="text-text-dim font-mono text-dense">
                            {row.documentId || '—'}
                          </span>
                        ),
                      },
                      {
                        key: 'outcome',
                        header: 'Resultado',
                        stack: 'aside',
                        className: 'whitespace-normal',
                        cell: (row) =>
                          row.reason === null ? (
                            <Stamp label="Entra" tone="green" />
                          ) : (
                            <span className="text-danger-text text-dense">{row.reason}</span>
                          ),
                      },
                    ]}
                  />
                </div>
              ) : null}

              <FormAlert message={importRenters.error?.message ?? null} />
            </>
          ) : (
            <div className="flex flex-col gap-3" role="status">
              <p className="text-body">
                <span className="font-semibold">
                  {result.created === 1 ? '1 cliente creado' : `${result.created} clientes creados`}
                </span>
                {result.skipped.length > 0
                  ? `, ${result.skipped.length} ${result.skipped.length === 1 ? 'fila omitida' : 'filas omitidas'}.`
                  : '.'}
              </p>
              {result.skipped.length > 0 ? (
                <DataTable
                  rows={result.skipped}
                  rowKey={(skip) => String(skip.row)}
                  reference={(skip) => skip.row}
                  pageSize={8}
                  emptyMessage="No se omitió ninguna fila."
                  columns={[
                    {
                      key: 'reason',
                      header: 'Por qué no entró',
                      stack: 'title',
                      headerClassName: 'w-full',
                      className: 'whitespace-normal',
                      cell: (skip) => <span className="text-danger-text">{skip.reason}</span>,
                    },
                  ]}
                />
              ) : null}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {result === null ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={valid === 0 || tooMany}
                loading={importRenters.isPending}
                onClick={submit}
              >
                {valid === 1 ? 'Importar 1 cliente' : `Importar ${valid} clientes`}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onClose}>
              Listo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
