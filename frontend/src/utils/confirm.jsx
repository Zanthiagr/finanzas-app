import toast from 'react-hot-toast';

/**
 * Reemplazo de confirm() nativo — no funciona bien en PWA/Safari pantalla completa.
 * Muestra un toast con dos botones (Cancelar / Eliminar) y ejecuta onConfirm si se acepta.
 *
 * Uso:
 *   confirmToast('¿Eliminar este activo?', async () => {
 *     await eliminarActivo(id);
 *     notifySuccess('Eliminado'); // ver utils/notify.js
 *     load();
 *   });
 */
export const confirmToast = (message, onConfirm, opts = {}) => {
  const { confirmLabel = 'Eliminar', cancelLabel = 'Cancelar', id, duration = 8000 } = opts;

  // Id estable (derivado del mensaje si no se pasa uno explícito) — si el
  // mismo evento se dispara dos veces seguidas (pasa en iOS/PWA por el
  // doble disparo touchend+click sintético en botones dentro de filas con
  // swipe), react-hot-toast actualiza la notificación existente en vez de
  // apilar una segunda. Antes cada llamada generaba un id aleatorio nuevo,
  // así que un doble disparo dejaba dos confirmaciones superpuestas: se
  // resolvía una y la otra se quedaba "pegada" en pantalla.
  const toastId = id || `confirm:${message}`;

  // duration: Infinity anula el auto-cierre interno de react-hot-toast, que
  // deja de dispararse en cuanto la pausa global de la librería queda
  // atascada por interacción táctil (ver utils/notify.js para el detalle).
  // Programamos nosotros mismos el cierre de respaldo con setTimeout, que
  // no depende de ese estado interno. Los botones Cancelar/Eliminar siguen
  // cerrando el toast al instante como siempre, tocando toast.dismiss
  // directamente — esto solo es la red de seguridad si nadie toca nada.
  toast((t) => (
    <div className="flex flex-col gap-3 min-w-[220px]">
      <p className="text-sm text-g-900 font-medium leading-snug">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-g-50 text-g-600 active:scale-95 transition"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            toast.dismiss(t.id);
            onConfirm();
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 text-white active:scale-95 transition"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  ), { duration: Infinity, id: toastId });

  setTimeout(() => toast.dismiss(toastId), duration);
};
