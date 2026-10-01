'use client';

import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { resizeImage } from '@/features/rentals/resize-image';
import { rentalFileSrc } from '../api';
import { useUploadRentalFile } from '../hooks/use-rental-settings';

/**
 * El logo de la empresa (095): vista previa y subida de PNG o JPG. Sube apenas
 * se elige —reducido a 1600 px— y deja el id en el formulario; se guarda con el
 * resto de los ajustes. Un 413 o 415 del API se dice acá, debajo.
 */
export function LogoField({
  logoFileId,
  logoUrl,
  onChange,
}: {
  logoFileId: string | null;
  /** La url guardada; mientras no se guarde, la del archivo recién subido. */
  logoUrl: string | null;
  onChange: (fileId: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadRentalFile();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const shownUrl = logoFileId === null ? null : (uploadedUrl ?? logoUrl);

  async function pick(file: File): Promise<void> {
    const { blob, name } = await resizeImage(file);

    upload.mutate(
      { kind: 'LOGO', file: blob, name },
      {
        onSuccess: (ref) => {
          setUploadedUrl(ref.url);
          onChange(ref.id);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="border-line bg-surface-2 flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-control border">
          {shownUrl === null ? (
            <span className="text-text-faint text-dense">Sin logo</span>
          ) : (
            // `<img>` y no `next/image`: el archivo lo sirve el API con sesión.
            <img
              src={rentalFileSrc(shownUrl)}
              alt="Logo de la empresa"
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 max-sm:w-full">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Archivo del logo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file !== undefined) void pick(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="max-sm:w-full"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <ImageUp className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
            {shownUrl === null ? 'Subir logo' : 'Cambiar logo'}
          </Button>
          {shownUrl === null ? null : (
            <Button
              type="button"
              variant="ghost"
              className="max-sm:w-full"
              onClick={() => {
                setUploadedUrl(null);
                onChange(null);
              }}
            >
              <Trash2 className="text-danger-text size-icon" strokeWidth={1.5} aria-hidden />
              Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="text-text-faint text-dense">PNG, JPG o WebP de hasta 5 MB.</p>
      {upload.error ? (
        <p className="text-danger-text text-label" role="alert">
          {upload.error.message}
        </p>
      ) : null}
    </div>
  );
}
