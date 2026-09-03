import { useEffect } from 'react';
import Icon from '../utils/icons';

export default function PantallaCompleta({ title, onClose, children }) {
  // Bloquear scroll del body mientras el modal está abierto + cerrar con Escape.
  // Al ser el componente compartido por todos los formularios de la app
  // (~20+ pantallas), este único cambio habilita Escape en todos a la vez.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <>
      {/* Overlay oscuro — solo visible en desktop */}
      <div
        className="fixed inset-0 z-[59] bg-black/40 hidden md:block"
        onClick={onClose}
      />

      {/* Contenedor — full screen en móvil, modal centrado en desktop */}
      <div className="fixed z-[60]
        inset-0
        md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
        md:w-[480px] md:max-h-[88vh] md:rounded-2xl md:shadow-2xl
        bg-white flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 border-b border-g-100 flex-shrink-0 bg-white"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)', paddingBottom: '14px' }}>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center flex-shrink-0">
            <Icon name="arrow-left" className="w-4 h-4 text-g-700"/>
          </button>
          <h3 className="font-medium text-g-900 truncate mx-3 flex-1 text-center text-sm">{title}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center flex-shrink-0 md:flex hidden">
            <Icon name="x" className="w-3.5 h-3.5 text-g-700"/>
          </button>
          <div className="w-9 flex-shrink-0 md:hidden"/>
        </div>

        {/* Contenido scrollable */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-5"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="pb-8">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
