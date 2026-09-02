import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PATH_METADATA } from '@nestjs/common/constants';

import { FLOOR_SESSION_KEY } from './auth.decorators';

/**
 * Toda ruta `/floor/*` tiene que declarar que pertenece a la pista con
 * `@FloorSession()` (spec 003, RN-19).
 *
 * Por que existe este test: los dos guards son globales y excluyentes. Si un
 * controller de pista se olvida del decorador, cae en el guard de oficina, que
 * busca la cookie equivocada y le responde **401 a un empleado con sesion
 * valida**. No hay excepcion, no hay log, y en pantalla se ve como "la tablet
 * no me deja entrar". Es exactamente el tipo de error que nadie encuentra
 * leyendo el diff.
 *
 * Descubre los controllers recorriendo el arbol en vez de listarlos: un test
 * que hay que acordarse de actualizar no protege de un olvido.
 */
describe('rutas de pista (RN-19)', () => {
  const MODULES_DIR = join(__dirname, '..', '..', 'modules');

  /** Todos los `*.controller.ts` bajo `modules/`, sin listarlos a mano. */
  function findControllerFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) return findControllerFiles(path);

      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [path] : [];
    });
  }

  /** Las clases de controller exportadas por un archivo, con su ruta base. */
  function controllersIn(file: string): { name: string; path: string; target: unknown }[] {
    const module = require(file) as Record<string, unknown>;

    return Object.entries(module).flatMap(([name, exported]) => {
      if (typeof exported !== 'function') return [];

      const path: unknown = Reflect.getMetadata(PATH_METADATA, exported);

      return typeof path === 'string' ? [{ name, path, target: exported }] : [];
    });
  }

  const controllers = findControllerFiles(MODULES_DIR).flatMap(controllersIn);

  it('encuentra controllers para revisar', () => {
    expect(controllers.length).toBeGreaterThan(0);
  });

  it.each(controllers.map((controller) => [controller.name, controller]))(
    '%s declara su tipo de sesión de forma coherente con su ruta',
    (_name, controller) => {
      const isFloorPath = controller.path === 'floor' || controller.path.startsWith('floor/');
      const declaresFloor =
        Reflect.getMetadata(FLOOR_SESSION_KEY, controller.target as object) === true;

      // Una ruta de pista sin el decorador cae en el guard de oficina y le
      // responde 401 a un empleado con sesion valida.
      if (isFloorPath) {
        expect(declaresFloor).toBe(true);
      }

      // Y al reves: un controller de oficina que se marque como pista deja de
      // pedir permisos, que es un agujero, no una molestia.
      if (!isFloorPath) {
        expect(declaresFloor).toBe(false);
      }
    },
  );
});
