import { useEffect, useRef, useState } from 'react';
import { getMovimientosPorMedio } from '../utils/api';
import { fmt, fmtShort, fmtDate, labelMedioPago, CATEGORIAS_ICONOS, CATEGORIAS_COLORES } from '../utils/helpers';

// La tarjeta "Dinero disponible" del Dashboard, convertida en un carrusel:
// la primera tarjeta es el Total, y le siguen una por cada banco/medio de
// pago con movimiento real. Deslizar (o tocar una pastilla/punto) cambia
// de tarjeta — al entrar a la de un banco, se pueden ver sus movimientos
// más recientes sin salir del Dashboard.
//
// Se mantiene el MISMO estilo premium navy/dorado en todas las tarjetas
// (no un color distinto por banco) — es más consistente con el resto de
// la app y evita meter otra paleta de colores aparte a estas alturas.
export default function CapitalCarousel({ saldo, ocultarSaldo, setOcultarSaldo, onEditarCapital }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [movimientos, setMovimientos] = useState({}); // cache por medio_pago
  const [cargando, setCargando] = useState(false);
  const [mostrarMovs, setMostrarMovs] = useState(false);

  const bancos = Object.entries(saldo?.porMedio || {})
    .filter(([key, d]) => key !== 'transferencia' && d && (d.ingresos !== 0 || d.gastos !== 0));

  const cards = [
    { key: 'total', esTotal: true, label: 'Dinero disponible', monto: saldo?.saldoTotal || 0 },
    ...bancos.map(([key, d]) => ({ key, esTotal: false, label: labelMedioPago(key), monto: d.ingresos - d.gastos })),
  ];

  // Si el saldo cambia (ej. se edita el capital inicial) y el índice activo
  // queda fuera de rango (se borró un banco), vuelve al Total.
  useEffect(() => { if (activeIndex >= cards.length) setActiveIndex(0); }, [cards.length]);

  const irA = (i) => {
    setActiveIndex(i);
    setMostrarMovs(false);
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== activeIndex) { setActiveIndex(i); setMostrarMovs(false); }
  };

  const toggleMovs = async () => {
    const card = cards[activeIndex];
    if (card.esTotal) return;
    if (!mostrarMovs && !movimientos[card.key]) {
      setCargando(true);
      try { setMovimientos(m => ({ ...m, [card.key]: (m[card.key]) || null })); const data = await getMovimientosPorMedio(card.key); setMovimientos(m => ({ ...m, [card.key]: data })); }
      catch { /* silencioso — no es crítico si falla */ }
      finally { setCargando(false); }
    }
    setMostrarMovs(v => !v);
  };

  const cardActiva = cards[activeIndex];
  const movsActivos = cardActiva && !cardActiva.esTotal ? movimientos[cardActiva.key] : null;

  return (
    <div>
      <div ref={scrollRef} onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 pb-1 scroll-hidden"
        style={{ scrollbarWidth: 'none' }}>
        {cards.map((c) => (
          <div key={c.key} className="card-premium flex-shrink-0 w-full snap-center" style={{ scrollSnapStop: 'always' }}>
            <div className="card-premium-glow -top-24 -right-16 w-64 h-64 bg-blue-500 opacity-20" />
            <div className="card-premium-glow -bottom-20 -left-10 w-52 h-52 bg-gold opacity-[0.08]" />

            <div className="relative flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium truncate pr-2">
                {c.label}
              </p>
              <div className="w-8 h-6 rounded-md bg-gradient-to-br from-gold to-gold-dark opacity-90 flex-shrink-0" />
            </div>

            <div className="relative mt-3 flex items-center gap-2">
              <span className={`text-[28px] md:text-[34px] font-semibold tracking-tight tabular-nums ${c.monto < 0 ? 'text-red-300' : 'text-white'}`}>
                {ocultarSaldo ? '••••••••' : fmt(c.monto)}
              </span>
              <button onClick={() => setOcultarSaldo(!ocultarSaldo)} className="text-white/50 hover:text-white/80 transition-colors flex-shrink-0">
                <i className={`ti ${ocultarSaldo ? 'ti-eye' : 'ti-eye-off'} text-lg`} />
              </button>
            </div>
            <p className="relative text-white/40 text-[11px] mt-1">
              {c.esTotal ? 'Total acumulado — no se reinicia por mes' : `Saldo acumulado en ${c.label}`}
            </p>

            {c.esTotal ? (
              <button onClick={onEditarCapital}
                className="relative mt-4 text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1">
                <i className="ti ti-pencil text-[11px]"/> Editar capital inicial
              </button>
            ) : (
              <button onClick={toggleMovs}
                className="relative mt-4 text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1">
                <i className={`ti ${mostrarMovs ? 'ti-chevron-up' : 'ti-receipt'} text-[11px]`}/>
                {mostrarMovs ? 'Ocultar movimientos' : 'Ver movimientos recientes'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Puntos — también sirven para saltar directo a una tarjeta */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {cards.map((c, i) => (
            <button key={c.key} onClick={() => irA(i)}
              aria-label={c.label}
              className={`h-1.5 rounded-full transition-all ${i === activeIndex ? 'w-5 bg-g-700' : 'w-1.5 bg-g-200'}`}/>
          ))}
        </div>
      )}

      {/* Movimientos recientes de la tarjeta activa (si no es el Total) */}
      {mostrarMovs && cardActiva && !cardActiva.esTotal && (
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
