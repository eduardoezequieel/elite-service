import { STORED_FILE_EXTENSIONS } from '@elite/shared';
import type { StoredFileMimeType } from '@elite/shared';

/**
 * Archivos de la rentadora (095 RN-7): reglas puras, sin Nest ni Prisma.
 *
 * El tipo se decide por los **primeros bytes** del archivo, no por lo que dice
 * el navegador: un PDF renombrado `.png` sigue siendo un PDF.
 */

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const ASCII = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/** JPEG, PNG o WebP según su firma; cualquier otra cosa, `null`. */
export function detectImageType(bytes: Uint8Array): StoredFileMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ASCII('RIFF')) && startsWith(bytes, ASCII('WEBP'), 8)) {
    return 'image/webp';
  }

  return null;
}

/** El nombre en disco: `id` + extensión del tipo (RN-7). */
export function storedNameOf(id: string, mimeType: StoredFileMimeType): string {
  return `${id}.${STORED_FILE_EXTENSIONS[mimeType]}`;
}
