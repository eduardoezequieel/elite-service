import { Injectable } from '@nestjs/common';
import { StoredFileKind } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { LogoFileLookup } from '../application/ports/rental-settings.repository';

/** El logo es una fila de `stored_files` de tipo `LOGO` (095). */
@Injectable()
export class PrismaLogoFileLookup implements LogoFileLookup {
  constructor(private readonly prisma: PrismaService) {}

  async isLogo(fileId: string): Promise<boolean> {
    const count = await this.prisma.storedFile.count({
      where: { id: fileId, kind: StoredFileKind.LOGO },
    });

    return count > 0;
  }
}
