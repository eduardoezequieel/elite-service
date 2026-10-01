import { API_ERROR_CODES, STORED_FILE_MAX_BYTES, uploadStoredFileSchema } from '@elite/shared';
import type { StoredFileRef, UploadStoredFileInput } from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalFileUseCases } from '../application/rental-file.usecases';
import { UploadLimitInterceptor } from './upload-limit.interceptor';

/** Un día en caché del navegador: el archivo no cambia nunca (un id, un archivo). */
const CACHE_CONTROL = 'private, max-age=86400';

/**
 * `/api/rental-files` (095 RN-7, ADR-014): subir y leer el logo y las fotos de
 * la inspección. Los dos exigen sesión; subir pide `rentals.manage` o
 * `rentals.settings`, y eso lo decide el caso de uso (un «o» entre dos claves).
 */
@Controller('rental-files')
export class RentalFilesController {
  private static readonly fileId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese archivo no existe.' }),
  });

  constructor(private readonly files: RentalFileUseCases) {}

  @Post()
  @UseInterceptors(
    UploadLimitInterceptor,
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: STORED_FILE_MAX_BYTES, files: 1, fields: 4 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(uploadStoredFileSchema)) input: UploadStoredFileInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoredFileRef> {
    return this.files.upload(
      input.kind,
      file === undefined
        ? null
        : { bytes: file.buffer, sizeBytes: file.size, declaredMimeType: file.mimetype },
      user,
    );
  }

  @Get(':id')
  async download(
    @Param('id', RentalFilesController.fileId) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.files.download(id);

    response.setHeader('Cache-Control', CACHE_CONTROL);
    response.setHeader('X-Content-Type-Options', 'nosniff');

    return new StreamableFile(file.stream, { type: file.mimeType, length: file.sizeBytes });
  }
}
