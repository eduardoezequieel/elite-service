import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { FileStorage } from '../application/ports/stored-file.repository';

/** Donde caen los archivos si `FILES_DIR` no está: relativo al API, gitignoreado. */
const DEFAULT_FILES_DIR = './data/files';

/**
 * Los archivos en el disco del servidor (ADR-014). En el VPS, `FILES_DIR` es
 * el volumen `files` de `deploy/compose.yml`; en local, `apps/api/data/files`.
 */
@Injectable()
export class DiskFileStorage implements FileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('FILES_DIR') || DEFAULT_FILES_DIR);
  }

  async write(storedName: string, bytes: Uint8Array): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.pathOf(storedName), bytes, { flag: 'wx' });
  }

  async read(storedName: string): Promise<Readable | null> {
    const file = this.pathOf(storedName);

    try {
      await access(file);
    } catch {
      return null;
    }

    return createReadStream(file);
  }

  /** El nombre lo arma el API (`id.ext`); igual se corta cualquier ruta. */
  private pathOf(storedName: string): string {
    return path.join(this.root, path.basename(storedName));
  }
}
