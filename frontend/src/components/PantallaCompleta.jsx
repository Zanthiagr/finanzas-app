export default function PantallaCompleta({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col" style={{maxWidth:'100vw',overflowX:'hidden'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b border-g-100 flex-shrink-0 bg-white"
        style={{paddingTop:'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom:'16px'}}>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center flex-shrink-0">
          <i className="ti ti-arrow-left text-g-700"/>
        </button>
        <h3 className="font-medium text-g-900 truncate mx-3 flex-1 text-center">{title}</h3>
        <div className="w-9 flex-shrink-0"/>
      </div>
      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full" style={{WebkitOverflowScrolling:'touch'}}>
        <div className="px-4 py-5 pb-10 w-full box-border">
          {children}
        </div>
      </div>
    </div>
  );
}
