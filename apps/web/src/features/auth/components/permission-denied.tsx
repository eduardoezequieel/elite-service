/**
 * Mensaje cuando la ruta se abrió sin el permiso. Blanco no es una respuesta:
 * hay que decir que la pantalla no es de este usuario y cómo salir (el riel).
 */
export function PermissionDenied({ screen }: { screen: string }) {
  return (
    <div className="flex flex-col gap-2 py-6">
      <p className="text-body text-text" role="status">
        No tenés permiso para ver {screen}.
      </p>
      <p className="text-text-dim text-dense">
        Si debería ser tuyo, pedile el permiso a quien administra. El riel a la
        izquierda (o abajo) te saca de acá.
      </p>
    </div>
  );
}
