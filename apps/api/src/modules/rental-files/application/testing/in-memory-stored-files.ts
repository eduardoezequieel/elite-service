import { Readable } from 'node:stream';

import type {
  FileStorage,
  StoredFileRecord,
  StoredFileRepository,
} from '../ports/stored-file.repository';

/** El registro de archivos en memoria. */
export class InMemoryStoredFileRepository implements StoredFileRepository {
  readonly rows: StoredFileRecord[] = [];

  create(record: StoredFileRecord): Promise<void> {
    this.rows.push({ ...record });

    return Promise.resolve();
  }

  findById(id: string): Promise<StoredFileRecord | null> {
    const row = this.rows.find((candidate) => candidate.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }
}

/** El disco en memoria: nombre → bytes. */
export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Uint8Array>();

  write(storedName: string, bytes: Uint8Array): Promise<void> {
    this.files.set(storedName, bytes);

    return Promise.resolve();
  }

  read(storedName: string): Promise<Readable | null> {
    const bytes = this.files.get(storedName);

    return Promise.resolve(bytes === undefined ? null : Readable.from([Buffer.from(bytes)]));
  }
}
