import { isStoredFileMimeType } from '@elite/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  StoredFileRecord,
  StoredFileRepository,
} from '../application/ports/stored-file.repository';

@Injectable()
export class PrismaStoredFileRepository implements StoredFileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(record: StoredFileRecord): Promise<void> {
    await this.prisma.storedFile.create({ data: record });
  }

  async findById(id: string): Promise<StoredFileRecord | null> {
    const row = await this.prisma.storedFile.findUnique({ where: { id } });

    // Un tipo que ya no se acepta no se sirve: se trata como si no existiera.
    if (row === null || !isStoredFileMimeType(row.mimeType)) return null;

    return { ...row, mimeType: row.mimeType };
  }
}
