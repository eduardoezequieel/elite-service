import { z } from 'zod';

/**
 * spec 095 — Archivos de la rentadora: el logo de la empresa y las fotos de
 * la inspección de entrega y devolución (096).
 *
 * Se guardan en el disco del servidor y se sirven solo con sesión (RN-7,
 * ADR-014). El cliente reduce la foto a 1600 px antes de subirla.
 */

/** Tope de un archivo: 5 MB (RN-7). Uno más grande responde 413 `FILE_TOO_LARGE`. */
export const STORED_FILE_MAX_BYTES = 5 * 1024 * 1024;

/** Lo único que se acepta (RN-7). Otro tipo responde 415 `FILE_TYPE_NOT_ALLOWED`. */
export const STORED_FILE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type StoredFileMimeType = (typeof STORED_FILE_MIME_TYPES)[number];

/** Extensión en disco de cada tipo: el nombre del archivo es `id` + extensión. */
export const STORED_FILE_EXTENSIONS: Record<StoredFileMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** `true` si el tipo es uno de {@link STORED_FILE_MIME_TYPES}. */
export function isStoredFileMimeType(value: string): value is StoredFileMimeType {
  return (STORED_FILE_MIME_TYPES as readonly string[]).includes(value);
}

/** Para qué es el archivo. */
export const STORED_FILE_KINDS = ['INSPECTION_PHOTO', 'LOGO'] as const;
export type StoredFileKind = (typeof STORED_FILE_KINDS)[number];

/** El campo `kind` del multipart de `POST /rental-files`. */
export const uploadStoredFileSchema = z.object({
  kind: z.enum(STORED_FILE_KINDS, { message: 'Ese tipo de archivo no existe.' }),
});
export type UploadStoredFileInput = z.infer<typeof uploadStoredFileSchema>;

/** Lo que devuelve la subida y lo que guarda quien referencia el archivo. */
export interface StoredFileRef {
  id: string;
  /** Ruta relativa al API (`storedFileUrl`). */
  url: string;
}

/** Ruta del archivo, relativa al API: el web le antepone su base (`/api`). */
export function storedFileUrl(id: string): string {
  return `/rental-files/${id}`;
}

/** Ancho máximo al que el cliente reduce una foto antes de subirla (RN-7). */
export const STORED_FILE_MAX_IMAGE_PX = 1600;
