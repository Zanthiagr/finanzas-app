import { useState } from 'react';
import { getMovimientosPorMedio } from '../utils/api';
import { fmt, fmtShort, fmtDate, labelMedioPago, CATEGORIAS_ICONOS, CATEGORIAS_COLORES } from '../utils/helpers';

// La tarjeta "Dinero disponible" del Dashboard. Muestra SIEMPRE una sola
// tarjeta (Total o un banco puntual) — las pastillas de cada banco viven
// dentro de la misma tarjeta y son el selector: tocar una transforma el
// contenido de la tarjeta a ese banco (con un crossfade corto), tocar
// "Total" vuelve. Nunca hay que deslizar ni salir de la tarjeta.
export default function CapitalCarousel({ saldo, ocultarSaldo, setOcultarSaldo, onEditarCapital }) {
  const [activeKey, setActiveKey] = useState('total');
  const [fade, setFade] = useState('in'); // 'in' | 'out' — crossfade sin librería de animación
  const [movimientos, setMovimientos] = useState({}); // cache por medio_pago
  const [cargando, setCargando] = useState(false);
  const [mostrarMovs, setMostrarMovs] = useState(false);

  const bancos = Object.entries(saldo?.porMedio || {})
    .filter(([key, d]) => key !== 'transferencia' && d && (d.ingresos !== 0 || d.gastos !== 0));

  const cards = [
    { key: 'total', esTotal: true, label: 'Dinero disponible', labelCorto: 'Total', monto: saldo?.saldoTotal || 0 },
    ...bancos.map(([key, d]) => ({ key, esTotal: false, label: labelMedioPago(key), labelCorto: labelMedioPago(key), monto: d.ingresos - d.gastos })),
  ];

  const cardActiva = cards.find(c => c.key === activeKey) || cards[0];

  const cambiarA = (key) => {
    if (key === activeKey) return;
    setFade('out');
    setMostrarMovs(false);
    setTimeout(() => { setActiveKey(key); setFade('in'); }, 150);
  };

  const toggleMovs = async () => {
    if (cardActiva.esTotal) return;
    if (!mostrarMovs && !movimientos[cardActiva.key]) {
      setCargando(true);
      try { const data = await getMovimientosPorMedio(cardActiva.key); setMovimientos(m => ({ ...m, [cardActiva.key]: data })); }
      catch { /* silencioso — no es crítico si falla */ }
      finally { setCargando(false); }
    }
    setMostrarMovs(v => !v);
  };

  const movsActivos = !cardActiva.esTotal ? movimientos[cardActiva.key] : null;

  return (
    <div>
      <div className="card-premium">
        <div className="card-premium-glow -top-24 -right-16 w-64 h-64 bg-blue-500 opacity-20" />
        <div className="card-premium-glow -bottom-20 -left-10 w-52 h-52 bg-gold opacity-[0.08]" />

        <div className={`relative transition-opacity duration-150 ${fade === 'out' ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium truncate pr-2">
              {cardActiva.label}
            </p>
            <div className="w-8 h-6 rounded-md bg-gradient-to-br from-gold to-gold-dark opacity-90 flex-shrink-0" />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className={`text-[28px] md:text-[34px] font-semibold tracking-tight tabular-nums ${cardActiva.monto < 0 ? 'text-red-300' : 'text-white'}`}>
              {ocultarSaldo ? '••••••••' : fmt(cardActiva.monto)}
            </span>
            <button onClick={() => setOcultarSaldo(!ocultarSaldo)} className="text-white/50 hover:text-white/80 transition-colors flex-shrink-0">
              <i className={`ti ${ocultarSaldo ? 'ti-eye' : 'ti-eye-off'} text-lg`} />
            </button>
          </div>
          <p className="text-white/40 text-[11px] mt-1">
            {cardActiva.esTotal ? 'Total acumulado — no se reinicia por mes' : `Saldo acumulado en ${cardActiva.label}`}
          </p>

          {/* Pastillas — siempre visibles, siempre las mismas, la activa
              queda resaltada. Tocar una transforma la tarjeta a ese banco. */}
          {cards.length > 1 && (
            <div className="flex gap-1.5 mt-4 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {cards.map(c => (
                <button key={c.key} onClick={() => cambiarA(c.key)}
                  className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 transition-colors ${c.key === activeKey ? 'bg-white/20' : 'bg-white/8 hover:bg-white/12'}`}>
                  <p className="text-[10px] text-white/50 whitespace-nowrap">{c.labelCorto}</p>
                  <p className="text-xs font-medium text-white">{ocultarSaldo ? '••••' : fmtShort(c.monto)}</p>
                </button>
              ))}
            </div>
          )}

          {cardActiva.esTotal ? (
            <button onClick={onEditarCapital}
              className="mt-4 text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1">
              <i className="ti ti-pencil text-[11px]"/> Editar capital inicial
            </button>
          ) : (
            <button onClick={toggleMovs}
              className="mt-4 text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1">
              <i className={`ti ${mostrarMovs ? 'ti-chevron-up' : 'ti-receipt'} text-[11px]`}/>
              {mostrarMovs ? 'Ocultar movimientos' : 'Ver movimientos recientes'}
            </button>
          )}
        </div>
      </div>

      {/* Movimientos recientes del banco activo */}
      {mostrarMovs && !cardActiva.esTotal && (
        <div className="card p-3 mt-2.5">
          {cargando && !movsActivos ? (
            <div className="flex justify-center py-6"><i className="ti ti-loader animate-spin text-lg text-g-300"/></div>
          ) : movsActivos?.length ? (
            <div className="divide-y divide-g-100">
              {movsActivos.map(m => (
                <div key={m.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: (CATEGORIAS_COLORES[m.categoria]||'#8A93A6') + '1F' }}>
                    <i className={`ti ${CATEGORIAS_ICONOS[m.categoria] || 'ti-dots'} text-xs`} style={{ color: CATEGORIAS_COLORES[m.categoria]||'#8A93A6' }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-g-800 truncate">{m.descripcion || m.categoria}</p>
                    <p className="text-[10px] text-g-400">{fmtDate(m.fecha)}</p>
                  </div>
                  <p className={`text-xs font-medium flex-shrink-0 ${m.tipo==='ingreso'?'text-pos':'text-g-700'}`}>
                    {m.tipo==='ingreso'?'+':'−'}{fmtShort(m.monto)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-g-400 text-center py-4">Sin movimientos todavía en {cardActiva.label}</p>
          )}
        </div>
      )}
    </div>
  );
}
