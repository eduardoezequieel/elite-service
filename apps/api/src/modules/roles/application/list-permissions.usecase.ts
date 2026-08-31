import { listPermissionGroups, type PermissionGroup } from '@elite/shared';

/**
 * Devuelve el catalogo de permisos agrupado por modulo, que es lo que consume
 * la matriz de la pantalla de roles.
 *
 * Sale del registro tipado de `@elite/shared`, NUNCA de la base: el codigo es
 * la fuente de verdad y el seed solo lo sincroniza (RN-2).
 */
export class ListPermissionsUseCase {
  execute(): PermissionGroup[] {
    return listPermissionGroups();
  }
}
