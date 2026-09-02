import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PATH_METADATA } from '@nestjs/common/constants';

import { FLOOR_SESSION_KEY } from './auth.decorators';

/**
 * Toda ruta `/floor/*` tiene que declarar que pertenece a la pista con
 * `@FloorSession()`, y ninguna otra puede declararlo (spec 003, RN-19).
 *
 * Por que existe este test: los dos guards son globales y excluyentes. Si un
 * controller de pista se olvida del decorador, cae en el guard de oficina, que
 * busca la cookie equivocada y le responde **401 a un empleado con sesion
 * valida**. No hay excepcion, no hay log, y en pantalla se ve como "la tablet
 * no me deja entrar". Es el tipo de error que nadie encuentra leyendo el diff.
 *
 * Al reves tambien importa: un controller de oficina marcado como pista deja de
 * pasar por el guard de permisos, que es un agujero y no una molestia.
 *
 * Descubre los controllers recorriendo el arbol en vez de listarlos: un test que
 * hay que acordarse de actualizar no protege de un olvido.
 */
describe('rutas de pista (RN-19)', () => {
  const MODULES_DIR = join(__dirname, '..', '..', 'modules');

  interface DiscoveredController {
    name: string;
    path: string;
    declaresFloor: boolean;
  }

  let controllers: DiscoveredController[];

  /** Todos los `*.controller.ts` bajo `modules/`, sin listarlos a mano. */
  function findControllerFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) return findControllerFiles(path);

      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [path] : [];
    });
  }

  beforeAll(async () => {
    const files = findControllerFiles(MODULES_DIR);

    const loaded = await Promise.all(
      files.map(async (file) => (await import(file)) as Record<string, unknown>),
    );

    controllers = loaded.flatMap((module) =>
      Object.entries(module).flatMap(([name, exported]) => {
        if (typeof exported !== 'function') return [];

        const path: unknown = Reflect.getMetadata(PATH_METADATA, exported);

        if (typeof path !== 'string') return [];

        return [
          {
            name,
            path,
            declaresFloor: Reflect.getMetadata(FLOOR_SESSION_KEY, exported) === true,
          },
        ];
      }),
    );
  });

  it('encuentra controllers para revisar', () => {
    expect(controllers.length).toBeGreaterThan(0);
  });

  it('toda ruta /floor/* declara @FloorSession()', () => {
    const olvidados = controllers
      .filter((controller) => isFloorPath(controller.path) && !controller.declaresFloor)
      .map((controller) => `${controller.name} ('${controller.path}')`);

    expect(olvidados).toEqual([]);
  });

  it('ninguna ruta de oficina se declara como pista', () => {
    const impostores = controllers
      .filter((controller) => !isFloorPath(controller.path) && controller.declaresFloor)
      .map((controller) => `${controller.name} ('${controller.path}')`);

    expect(impostores).toEqual([]);
  });
});

function isFloorPath(path: string): boolean {
  return path === 'floor' || path.startsWith('floor/');
}
