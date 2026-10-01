import type { Readable } from 'node:stream';

import type { StoredFileKind, StoredFileMimeType } from '@elite/shared';

/** Un archivo guardado, como lo registra la base (`stored_files`). */
export interface StoredFileRecord {
  id: string;
  kind: StoredFileKind;
  mimeType: StoredFileMimeType;
  sizeBytes: number;
  /** El nombre en disco: `id` + extensión (RN-7). */
  storedName: string;
  createdByUserId: string;
}

/** Puerto del registro de archivos en la base (095). */
export interface StoredFileRepository {
  create(record: StoredFileRecord): Promise<void>;
  findById(id: string): Promise<StoredFileRecord | null>;
}

/** Puerto del disco donde viven los bytes (`FILES_DIR`, ADR-014). */
export interface FileStorage {
  write(storedName: string, bytes: Uint8Array): Promise<void>;
  /** `null` si el archivo no está en disco. */
  read(storedName: string): Promise<Readable | null>;
}

export const STORED_FILE_REPOSITORY = Symbol('rental-files.StoredFileRepository');
export const FILE_STORAGE = Symbol('rental-files.FileStorage');
