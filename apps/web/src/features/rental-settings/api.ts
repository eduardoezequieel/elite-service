import type {
  RentalSettings,
  RentalSettingsInput,
  StoredFileKind,
  StoredFileRef,
} from '@elite/shared';

import { API_BASE_URL, apiFetch } from '@/lib/api';

/** API de los ajustes y archivos de la rentadora (095). */

export function getRentalSettings(): Promise<RentalSettings> {
  return apiFetch<RentalSettings>('/rental-settings');
}

/** Reemplaza la fila entera (RN-8). */
export function saveRentalSettings(input: RentalSettingsInput): Promise<RentalSettings> {
  return apiFetch<RentalSettings>('/rental-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/** Sube una imagen ya reducida (RN-7). Responde `{ id, url }`. */
export function uploadRentalFile(
  kind: StoredFileKind,
  file: Blob,
  name: string,
): Promise<StoredFileRef> {
  const body = new FormData();
  body.append('kind', kind);
  body.append('file', file, name);

  return apiFetch<StoredFileRef>('/rental-files', { method: 'POST', body });
}

/** La URL del navegador para un archivo: la ruta del API con la base de la web (`/api`). */
export function rentalFileSrc(url: string): string {
  return `${API_BASE_URL.replace(/\/+$/, '')}${url}`;
}
