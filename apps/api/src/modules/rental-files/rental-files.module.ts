import { Module } from '@nestjs/common';

import { FILE_STORAGE, STORED_FILE_REPOSITORY } from './application/ports/stored-file.repository';
import type { FileStorage, StoredFileRepository } from './application/ports/stored-file.repository';
import { RentalFileUseCases } from './application/rental-file.usecases';
import { DiskFileStorage } from './infrastructure/disk-file-storage';
import { PrismaStoredFileRepository } from './infrastructure/prisma-stored-file.repository';
import { RentalFilesController } from './presentation/rental-files.controller';

/** Archivos de la rentadora en disco, servidos con sesión (095, ADR-014). */
@Module({
  controllers: [RentalFilesController],
  providers: [
    { provide: STORED_FILE_REPOSITORY, useClass: PrismaStoredFileRepository },
    { provide: FILE_STORAGE, useClass: DiskFileStorage },
    {
      provide: RentalFileUseCases,
      useFactory: (files: StoredFileRepository, storage: FileStorage) =>
        new RentalFileUseCases(files, storage),
      inject: [STORED_FILE_REPOSITORY, FILE_STORAGE],
    },
  ],
  exports: [RentalFileUseCases],
})
export class RentalFilesModule {}
