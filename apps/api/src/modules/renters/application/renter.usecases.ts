import { API_ERROR_CODES, renterFromImportRow } from '@elite/shared';
import type {
  CreateRenterInput,
  ImportRentersInput,
  Renter,
  RenterImportResult,
  RenterImportSkip,
  RentersQuery,
  UpdateRenterInput,
} from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import type { RenterRepository } from './ports/renter.repository';

/** La primera fila de datos de una planilla es la 2: la 1 es el encabezado. */
const FIRST_DATA_ROW = 2;

/**
 * Clientes de renta (095). Se crean, se editan, se bloquean («No rentar») y se
 * importan desde una planilla; nunca se borran (RN-6).
 */
export class RenterUseCases {
  constructor(private readonly renters: RenterRepository) {}

  list(query: RentersQuery): Promise<Renter[]> {
    return this.renters.list(query);
  }

  async get(id: string): Promise<Renter> {
    const renter = await this.renters.findById(id);

    if (renter === null) throw notFound();

    return renter;
  }

  create(input: CreateRenterInput): Promise<Renter> {
    return this.renters.create(withBlockReason(input));
  }

  async update(id: string, input: UpdateRenterInput): Promise<Renter> {
    if ((await this.renters.findById(id)) === null) throw notFound();

    return this.renters.update(id, withBlockReason(input));
  }

  /**
   * Importa una planilla (RN-9): crea las filas válidas y devuelve, de cada
   * omitida, su número de fila y el motivo. Las inválidas no se crean.
   */
  async import(input: ImportRentersInput): Promise<RenterImportResult> {
    const valid: CreateRenterInput[] = [];
    const skipped: RenterImportSkip[] = [];

    input.rows.forEach((row, index) => {
      const parsed = renterFromImportRow(row);

      if ('reason' in parsed) skipped.push({ row: index + FIRST_DATA_ROW, reason: parsed.reason });
      else valid.push(parsed.input);
    });

    const created = valid.length === 0 ? 0 : await this.renters.createMany(valid);

    return { created, skipped };
  }
}

/** Desbloquear borra el motivo: un motivo sin bloqueo confunde a quien lo lee. */
function withBlockReason<T extends UpdateRenterInput>(input: T): T {
  return input.isBlocked === false ? { ...input, blockReason: null } : input;
}

function notFound(): NotFoundError {
  return new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese cliente no existe.' });
}
