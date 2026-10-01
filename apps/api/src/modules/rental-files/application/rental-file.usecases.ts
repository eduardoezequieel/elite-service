import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import {
  API_ERROR_CODES,
  PERMISSIONS,
  STORED_FILE_MAX_BYTES,
  isStoredFileMimeType,
  storedFileUrl,
} from '@elite/shared';
import type { StoredFileKind, StoredFileMimeType, StoredFileRef } from '@elite/shared';

import {
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../../common/errors/application-error';
import { detectImageType, storedNameOf } from '../domain/stored-file';
import type { FileStorage, StoredFileRepository } from './ports/stored-file.repository';

/** Suben archivos quien maneja rentas (fotos de la inspección) o los ajustes (logo). */
const UPLOADERS = [
  PERMISSIONS.rentals.actions.manage.key,
  PERMISSIONS.rentals.actions.settings.key,
];

/** Lo que llega de la subida, ya leído por multer. */
export interface UploadedBytes {
  bytes: Uint8Array;
  sizeBytes: number;
  /** Lo que dijo el navegador. Se compara, pero manda la firma de los bytes. */
  declaredMimeType: string;
}

/** Quién sube: su id y sus permisos efectivos. */
export interface Uploader {
  id: string;
  permissions: readonly string[];
}

export interface DownloadedFile {
  mimeType: StoredFileMimeType;
  sizeBytes: number;
  stream: Readable;
}

/**
 * Archivos de la rentadora en el disco del servidor (095 RN-7, ADR-014): solo
 * imágenes JPEG, PNG o WebP de hasta 5 MB, servidas solo con sesión.
 */
export class RentalFileUseCases {
  constructor(
    private readonly files: StoredFileRepository,
    private readonly storage: FileStorage,
  ) {}

  async upload(
    kind: StoredFileKind,
    file: UploadedBytes | null,
    uploader: Uploader,
  ): Promise<StoredFileRef> {
    // Un «o» entre dos claves: el guard global no lo expresa, se decide acá.
    if (!UPLOADERS.some((key) => uploader.permissions.includes(key))) {
      throw new ForbiddenError({
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'No tenés permiso para hacer esto.',
      });
    }

    if (file === null || file.sizeBytes === 0) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Elegí un archivo.',
        details: { file: 'Elegí un archivo.' },
      });
    }

    if (file.sizeBytes > STORED_FILE_MAX_BYTES) throw tooLarge();

    const mimeType = detectImageType(file.bytes);

    if (mimeType === null || !isStoredFileMimeType(file.declaredMimeType)) {
      throw new UnsupportedMediaTypeError({
        code: API_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
        message: 'Solo se aceptan imágenes JPG, PNG o WebP.',
      });
    }

    const id = randomUUID();
    const storedName = storedNameOf(id, mimeType);

    // Primero el disco: un archivo sin fila no lo ve nadie; una fila sin
    // archivo sería un logo roto.
    await this.storage.write(storedName, file.bytes);
    await this.files.create({
      id,
      kind,
      mimeType,
      sizeBytes: file.sizeBytes,
      storedName,
      createdByUserId: uploader.id,
    });

    return { id, url: storedFileUrl(id) };
  }

  async download(id: string): Promise<DownloadedFile> {
    const record = await this.files.findById(id);
    const stream = record === null ? null : await this.storage.read(record.storedName);

    if (record === null || stream === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese archivo no existe.',
      });
    }

    return { mimeType: record.mimeType, sizeBytes: record.sizeBytes, stream };
  }
}

/** El mismo 413 lo arma el interceptor de la subida cuando multer corta antes. */
export function tooLarge(): PayloadTooLargeError {
  return new PayloadTooLargeError({
    code: API_ERROR_CODES.FILE_TOO_LARGE,
    message: 'El archivo pasa de 5 MB. Reducilo y probá de nuevo.',
  });
}
