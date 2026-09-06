import toast from 'react-hot-toast';

// ── Por qué existe este archivo ──────────────────────────────────────────
// react-hot-toast (v2.4.1) pausa el auto-cierre de TODAS las notificaciones
// activas mientras el "mouse" esté dentro del contenedor del Toaster
// (escucha onMouseEnter/onMouseLeave en el div raíz, pensado para no cerrar
// un toast mientras el usuario lo está leyendo con el cursor encima).
//
// En dispositivos táctiles esto se rompe: al tocar un botón dentro de un
// toast (p. ej. "Eliminar" del confirmToast, o simplemente rozar cualquier
// notificación), el navegador sintetiza un mouseenter — pero casi nunca el
// mouseleave correspondiente, porque con el dedo no existe un "salir" del
// área como sí lo hay moviendo un mouse real. El resultado es que la
// pausa queda activada para siempre, y la librería deja de programar el
// cierre automático de CUALQUIER notificación desde ese momento en
// adelante, no solo la que se tocó. Esto explica el síntoma reportado:
// se queda pegada la de eliminar, y luego también las de registrar.
//
// El fix: dejar de depender del `duration` interno de react-hot-toast (que
// se agenda en un efecto que se cancela mientras la pausa esté activa) y
// programar nosotros mismos el cierre con un setTimeout propio, que no
// consulta en ningún momento el estado interno de pausa de la librería.
// Pasamos duration: Infinity a la llamada real para anular su temporizador
// (potencialmente roto) — el único que manda es el nuestro.

const DEFAULT_DURATION = 1000; // 1s, pedido explícitamente para toda la app

const withAutoDismiss = (create) => (message, opts = {}) => {
  const { duration = DEFAULT_DURATION, ...rest } = opts;
  const id = create(message, { ...rest, duration: Infinity });
  setTimeout(() => toast.dismiss(id), duration);
  return id;
};

export const notifySuccess = withAutoDismiss(toast.success);
export const notifyError = withAutoDismiss(toast.error);
