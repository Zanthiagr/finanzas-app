// Pantalla completa para formularios — reemplaza los modales flotantes.
// Se usa en vez de un overlay con position:fixed + overflow anidado porque
// esos modales tienen un bug irresoluble de scroll táctil en iOS Safari/PWA:
// el contenido queda renderizado pero inalcanzable porque el gesto de
// deslizar no se propaga dentro de overflow-y-auto anidado en fixed.
//
// Esta pantalla en cambio ocupa TODO el viewport (fixed inset-0) pero el
// contenido interno usa scroll normal de documento sin anidamientos
// complejos, garantizando que el botón final SIEMPRE sea alcanzable.
export default function PantallaCompleta({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-g-100 flex-shrink-0 bg-white">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center">
          <i className="ti ti-arrow-left text-g-700"/>
        </button>
        <h3 className="font-medium text-g-900">{title}</h3>
        <div className="w-9"/>
      </div>
      <div className="flex-1 overflow-y-scroll px-5 py-5">
        {children}
      </div>
    </div>
  );
}
