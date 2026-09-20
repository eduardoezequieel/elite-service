import type { ServiceDetail } from '@elite/shared';

/** Un rubro del catálogo con los servicios activos que cuelgan de él. */
export interface ServiceGroup {
  id: string;
  name: string;
  services: ServiceDetail[];
}

/**
 * Agrupa el catálogo por `service.category`, en el `sortOrder` del rubro (039).
 *
 * Un rubro sin servicios activos no se pinta. El agrupado sale siempre del
 * catálogo: acá no hay ningún nombre de categoría escrito a mano, porque los
 * rubros los crea el taller y cambian sin tocar el código.
 */
export function groupByCategory(services: readonly ServiceDetail[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup & { sortOrder: number }>();

  for (const service of services) {
    if (!service.isActive) continue;

    const existing = groups.get(service.category.id);

    if (existing === undefined) {
      groups.set(service.category.id, {
        id: service.category.id,
        name: service.category.name,
        sortOrder: service.category.sortOrder,
        services: [service],
      });
    } else {
      existing.services.push(service);
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    .map(({ id, name, services: list }) => ({ id, name, services: list }));
}

/**
 * Elige `service` soltando lo que hubiera del mismo rubro, y lo deselecciona
 * si ya estaba elegido (039 RN-2).
 */
export function toggleInCategory(
  selected: readonly string[],
  service: ServiceDetail,
  catalog: readonly ServiceDetail[],
): string[] {
  const categoryOf = new Map(catalog.map((item) => [item.id, item.category.id]));
  const rest = selected.filter(
    (id) => id !== service.id && categoryOf.get(id) !== service.category.id,
  );

  return selected.includes(service.id) ? rest : [...rest, service.id];
}
