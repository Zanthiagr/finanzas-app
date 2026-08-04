import { useState, useEffect, useRef } from 'react';
import { getResumen, getMovimientos, getDeudas, getMetas, getCierres } from '../utils/api';
import { fmt, fmtShort, fmtDate, CATEGORIAS_COLORES } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Reporte() {
  const { user, perfil } = useAuth();
  const [datos, setDatos]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [generando, setGenerando] = useState(false);
  const [mes, setMes]           = useState(new Date().getMonth() + 1);
  const [anio, setAnio]         = useState(new Date().getFullYear());
  const reporteRef              = useRef(null);
  const nombre = perfil?.nombre || user?.user_metadata?.full_name || 'Usuario';

  const cargar = async () => {
    setLoading(true);
    try {
      const [resumen, movimientos, deudas, metas, cierres] = await Promise.all([
        getResumen({ mes, anio }),
        getMovimientos({ mes, anio }),
        getDeudas(),
        getMetas(),
        getCierres(anio),
      ]);
      setDatos({ resumen, movimientos, deudas, metas, cierres });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [mes, anio]);

  const descargarPDF = () => {
    setGenerando(true);
    setTimeout(() => {
      window.print();
      setGenerando(false);
    }, 300);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 flex-col gap-3">
      <i className="ti ti-loader animate-spin text-2xl text-g-400"/>
      <p className="text-sm text-g-400">Cargando datos del reporte...</p>
    </div>
  );

  const { resumen, movimientos, deudas, metas, cierres } = datos || {};
  const gastosCategoria = resumen?.porCategoria?.filter(c => c.tipo === 'gasto') || [];
  const ingresosCategoria = resumen?.porCategoria?.filter(c => c.tipo === 'ingreso') || [];
  const tasaAhorro = resumen?.ingresos > 0 ? Math.round((resumen.balance / resumen.ingresos) * 100) : 0;
  const deudasActivas = deudas?.filter(d => d.activa) || [];
  const totalDeuda = deudasActivas.reduce((a, d) => a + (parseFloat(d.monto_total) - parseFloat(d.monto_pagado)), 0);
  // Los cierres guardan una foto de ingresos/gastos al momento de cerrar
  // la semana (c.total_ingresos/total_gastos/balance) — si después editas
  // un movimiento de esa semana, esa foto NO se actualiza sola. Por eso
  // acá se recalcula en vivo desde resumen.porSemana (misma fuente que
  // usa la pantalla de Cierre Semanal), así el reporte y el cierre nunca
  // se desincronizan entre sí.
  const cierresMes = (cierres?.filter(c => c.mes_num === mes) || []).map(c => {
    const ing = parseFloat(resumen?.porSemana?.find(s => s.semana_num === c.semana_num && s.tipo === 'ingreso')?.total || 0);
    const gas = parseFloat(resumen?.porSemana?.find(s => s.semana_num === c.semana_num && s.tipo === 'gasto')?.total || 0);
    return { ...c, ingresos: ing, gastos: gas, balance: ing - gas };
  });

  return (
    <>
      {/* Estilos de impresión — fuerzan ancho desktop en el PDF sin importar el dispositivo */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #reporte-pdf, #reporte-pdf * { visibility: visible; }
          #reporte-pdf { position: absolute; left: 0; top: 0; width: 800px; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Controles — no se imprimen, totalmente responsive */}
      <div className="no-print space-y-4 mb-6 page-enter">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-medium text-g-900">Reporte mensual</h2>
            <p className="text-sm text-g-400">Descarga tu cierre financiero completo</p>
          </div>
          <button onClick={descargarPDF} disabled={generando}
            className="btn-primary flex items-center gap-2 flex-shrink-0">
            <i className="ti ti-download text-sm"/>
            <span className="hidden sm:inline">{generando ? 'Preparando...' : 'Descargar PDF'}</span>
            <span className="sm:hidden">{generando ? '...' : 'PDF'}</span>
          </button>
        </div>

        {/* Selector mes/año — apilado en móvil */}
        <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="section-label block mb-1">Mes</label>
            <select className="select" value={mes} onChange={e => setMes(+e.target.value)}>
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="section-label block mb-1">Año</label>
            <select className="select" value={anio} onChange={e => setAnio(+e.target.value)}>
              {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={cargar} className="btn-secondary flex items-center justify-center gap-2 sm:w-auto">
            <i className="ti ti-refresh text-sm"/> Actualizar
          </button>
        </div>

        {/* Preview card */}
        <div className="card p-4 bg-g-50 border-dashed">
          <p className="text-xs text-g-500 flex items-center gap-2 mb-1">
            <i className="ti ti-eye text-sm"/> Vista previa del reporte
          </p>
          <p className="text-sm text-g-700">
            {MESES[mes-1]} {anio} · {nombre} · {movimientos?.length || 0} movimientos
          </p>
        </div>
      </div>

      {/* ═══════════ REPORTE — clases responsive, sin estilos en píxeles fijos ═══════════ */}
      <div id="reporte-pdf" ref={reporteRef} className="font-sans text-g-900 max-w-[800px] mx-auto">

        {/* Header */}
        <div className="bg-g-800 rounded-2xl p-5 sm:p-8 mb-5">
          <div className="flex flex-col sm:flex-row justify-between gap-4 sm:gap-0 sm:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <svg viewBox="0 0 24 24" width="14" height="14" className="-rotate-90 flex-shrink-0">
                  <circle cx="12" cy="12" r="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                  <circle cx="12" cy="12" r="8" fill="none" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 8} strokeDashoffset={2 * Math.PI * 8 * 0.28}/>
                </svg>
                <span className="text-white/50 text-[11px] tracking-widest uppercase">Fintual</span>
              </div>
              <h1 className="text-white text-2xl sm:text-3xl font-medium mb-1 leading-tight">Reporte mensual</h1>
              <p className="text-white/50 text-sm truncate">{MESES[mes-1]} {anio} · {nombre}</p>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <p className="text-white/40 text-[11px] uppercase tracking-wider mb-1">Balance neto</p>
              <p className={`text-2xl sm:text-3xl font-medium ${resumen?.balance >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {fmtShort(resumen?.balance || 0)}
              </p>
              <p className="text-white/30 text-xs mt-1">Tasa de ahorro: {tasaAhorro}%</p>
            </div>
          </div>
        </div>

        {/* KPIs — 1 col móvil, 3 cols desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Ingresos totales', value: fmt(resumen?.ingresos), bg: 'bg-emerald-50', txt: 'text-emerald-700' },
            { label: 'Gastos totales',   value: fmt(resumen?.gastos),   bg: 'bg-red-50', txt: 'text-red-700' },
            { label: 'Movimientos',      value: movimientos?.length || 0, bg: 'bg-blue-50', txt: 'text-blue-700' },
          ].map((k, i) => (
            <div key={i} className={`${k.bg} rounded-xl p-4`}>
              <p className={`${k.txt} text-[11px] uppercase tracking-wider mb-1.5`}>{k.label}</p>
              <p className="text-g-900 text-xl font-medium">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Gastos por categoría */}
        {gastosCategoria.length > 0 && (
          <div className="bg-white border border-g-200/40 rounded-xl p-4 sm:p-5 mb-4">
            <h2 className="text-sm font-medium mb-4">Gastos por categoría</h2>
            <div className="flex flex-col gap-3">
              {gastosCategoria.map((c, i) => {
                const pct = Math.round((c.total / resumen.gastos) * 100);
                return (
                  <div key={i} className="min-w-0">
                    <div className="flex justify-between gap-2 mb-1">
                      <span className="text-[13px] text-g-900 truncate">{c.categoria}</span>
                      <span className="text-[13px] font-medium text-g-900 flex-shrink-0">
                        {fmtShort(c.total)} <span className="text-g-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-g-50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORIAS_COLORES[c.categoria] || '#2452FF' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fuentes de ingreso */}
        {ingresosCategoria.length > 0 && (
          <div className="bg-white border border-g-200/40 rounded-xl p-4 sm:p-5 mb-4">
            <h2 className="text-sm font-medium mb-3">Fuentes de ingreso</h2>
            <div className="flex flex-col">
              {ingresosCategoria.map((c, i) => (
                <div key={i} className={`flex justify-between gap-2 py-2 ${i < ingresosCategoria.length-1 ? 'border-b border-g-100' : ''}`}>
                  <span className="text-[13px] text-pos truncate">{c.categoria}</span>
                  <span className="text-[13px] font-medium text-pos flex-shrink-0">+{fmtShort(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Movimientos del mes */}
        {movimientos?.length > 0 && (
          <div className="bg-white border border-g-200/40 rounded-xl p-4 sm:p-5 mb-4">
            <h2 className="text-sm font-medium mb-3">Movimientos del mes ({movimientos.length})</h2>
            <div className="flex flex-col">
              {movimientos.slice(0, 15).map((m, i) => (
                <div key={i} className={`flex justify-between items-center gap-2 py-2 ${i < Math.min(movimientos.length,15)-1 ? 'border-b border-g-100' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{m.descripcion || m.categoria}</p>
                    <p className="text-[11px] text-g-400 truncate">{m.categoria} · {fmtDate(m.fecha)}</p>
                  </div>
                  <span className={`text-[13px] font-medium flex-shrink-0 ${m.tipo==='ingreso'?'text-pos':'text-g-900'}`}>
                    {m.tipo==='ingreso'?'+':'-'}{fmtShort(m.monto)}
                  </span>
                </div>
              ))}
              {movimientos.length > 15 && (
                <p className="text-[11px] text-g-400 text-center mt-2">+ {movimientos.length - 15} movimientos más</p>
              )}
            </div>
          </div>
        )}

        {/* Salto de página solo al imprimir */}
        <div className="page-break"/>

        {/* Deudas activas */}
        {deudasActivas.length > 0 && (
          <div className="bg-white border border-g-200/40 rounded-xl p-4 sm:p-5 mb-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 mb-4">
              <h2 className="text-sm font-medium">Deudas activas</h2>
              <span className="text-sm font-medium text-red-600">Total: {fmtShort(totalDeuda)}</span>
            </div>
            <div className="flex flex-col gap-4">
              {deudasActivas.map((d, i) => {
                const pendiente = parseFloat(d.monto_total) - parseFloat(d.monto_pagado);
                const pct = Math.round((parseFloat(d.monto_pagado) / parseFloat(d.monto_total)) * 100);
                return (
                  <div key={i} className="min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{d.nombre}</p>
                        <p className="text-[11px] text-g-400 truncate">{d.tipo}{d.tasa_interes>0?` · ${d.tasa_interes}% EA`:''}</p>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <p className="text-[13px] font-medium text-red-600">{fmtShort(pendiente)} pendiente</p>
                        <p className="text-[11px] text-g-400">{pct}% pagado</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-g-50 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metas de ahorro */}
        {metas?.filter(m=>!m.completada).length > 0 && (
          <div className="bg-white border border-g-200/40 rounded-xl p-4 sm:p-5 mb-4">
            <h2 className="text-sm font-medium mb-4">Metas de ahorro</h2>
            <div className="flex flex-col gap-4">
              {metas.filter(m=>!m.completada).map((m, i) => {
                const pct = Math.min(Math.round((parseFloat(m.monto_actual)/parseFloat(m.monto_objetivo))*100),100);
                return (
                  <div key={i} className="min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-0.5 mb-1.5">
                      <p className="text-[13px] font-medium truncate">{m.nombre}</p>
                      <p className="text-[13px] text-g-600 font-medium flex-shrink-0">
                        {fmtShort(m.monto_actual)} / {fmtShort(m.monto_objetivo)}
                      </p>
                    </div>
                    <div className="h-1.5 bg-g-50 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                    <p className="text-[11px] text-g-400 mt-1">{pct}% logrado</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cierres semanales */}
        {cierresMes?.length > 0 && (
          <div className="bg-white border border-g-200/40 rounded-xl p-4 sm:p-5 mb-4">
            <h2 className="text-sm font-medium mb-4">Cierres semanales</h2>
            <div className="flex flex-col gap-3">
              {cierresMes.map((c, i) => (
                <div key={i} className={`p-3 rounded-lg ${c.balance >= 0 ? 'bg-g-50' : 'bg-red-50'}`}>
                  <div className="flex justify-between gap-2 mb-1">
                    <p className="text-xs font-medium">Semana {c.semana_num}</p>
                    <p className={`text-[13px] font-medium ${c.balance>=0?'text-pos':'text-red-600'}`}>
                      {c.balance>=0?'+':''}{fmtShort(c.balance)}
                    </p>
                  </div>
                  {c.reflexion && (
                    <p className="text-xs text-g-600 italic break-words">"{c.reflexion}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-5 border-t border-g-200/40">
          <p className="text-g-400 text-[11px]">Reporte generado por Fintual · {new Date().toLocaleDateString('es-CO')}</p>
          <p className="text-g-200 text-[10px] mt-0.5">Tu camino a la libertad financiera</p>
        </div>

      </div>
    </>
  );
}
