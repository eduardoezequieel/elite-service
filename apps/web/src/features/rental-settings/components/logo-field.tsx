'use client';

import { ImageUp, Trash2 } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { resizeImage } from '@/features/rentals/resize-image';
import { rentalFileSrc } from '../api';
import { useUploadRentalFile } from '../hooks/use-rental-settings';

/**
 * El logo de la empresa (095): vista previa y subida de PNG, JPG o WebP. Sube
 * apenas se elige —reducido a 1600 px— y deja el id en el formulario; se guarda
 * con el resto de los ajustes. La url sube a la pantalla para que la hoja de la
 * vista previa (120) lo muestre antes de guardar. Un 413 o 415 se dice acá.
 */
export function LogoField({
  logoUrl,
  onChange,
  disabled = false,
}: {
  /** La url que se ve: la guardada, o la del archivo recién subido. `null` sin logo. */
  logoUrl: string | null;
  onChange: (fileId: string | null, url: string | null) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadRentalFile();

  async function pick(file: File): Promise<void> {
    const { blob, name } = await resizeImage(file);

    upload.mutate(
      { kind: 'LOGO', file: blob, name },
      { onSuccess: (ref) => onChange(ref.id, ref.url) },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="border-line bg-surface-2 flex h-15 w-24 shrink-0 items-center justify-center overflow-hidden rounded-control border">
          {logoUrl === null ? (
            <ImageUp className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
          ) : (
            // `<img>` y no `next/image`: el archivo lo sirve el API con sesión.
            <img
              src={rentalFileSrc(logoUrl)}
              alt="Logo de la empresa"
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        {disabled ? null : (
          <>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Archivo del logo"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file !== undefined) void pick(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {logoUrl === null ? 'Subir logo' : 'Cambiar'}
            </Button>
            {logoUrl === null ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null, null)}>
                <Trash2 className="text-danger-text size-icon" strokeWidth={1.5} aria-hidden />
                Quitar
              </Button>
            )}
          </>
        )}
      </div>
      {upload.error ? (
        <p className="text-danger-text text-label" role="alert">
          {upload.error.message}
        </p>
      ) : null}
    </div>
  );
}
