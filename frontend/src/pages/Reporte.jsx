import { useState, useEffect, useRef } from 'react';
import { getResumen, getMovimientos, getDeudas, getMetas, getCierres } from '../utils/api';
import { fmt, fmtDate, CATEGORIAS_COLORES } from '../utils/helpers';
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
  const cierresMes = cierres?.filter(c => c.mes_num === mes) || [];

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #reporte-pdf, #reporte-pdf * { visibility: visible; }
          #reporte-pdf { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Controles — no se imprimen */}
      <div className="no-print space-y-4 mb-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-g-900">Reporte mensual</h2>
            <p className="text-sm text-g-400">Descarga tu cierre financiero completo</p>
          </div>
          <button onClick={descargarPDF} disabled={generando}
            className="btn-primary flex items-center gap-2">
            <i className="ti ti-download text-sm"/>
            {generando ? 'Preparando...' : 'Descargar PDF'}
          </button>
        </div>

        {/* Selector mes/año */}
        <div className="card p-4 flex items-center gap-4">
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
          <div className="flex-1 flex items-end">
            <button onClick={cargar} className="btn-secondary w-full flex items-center justify-center gap-2">
              <i className="ti ti-refresh text-sm"/> Actualizar
            </button>
          </div>
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

      {/* REPORTE PDF */}
      <div id="reporte-pdf" ref={reporteRef} style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0F2318', maxWidth: '800px', margin: '0 auto' }}>

        {/* Portada / Header */}
        <div style={{ background: '#1A3A2A', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C9A84C' }}/>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Fintual</span>
              </div>
              <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '500', margin: '0 0 4px 0' }}>
                Reporte mensual
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                {MESES[mes-1]} {anio} · {nombre}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Balance neto</p>
              <p style={{ color: resumen?.balance >= 0 ? '#9ED4B8' : '#F87171', fontSize: '32px', fontWeight: '500', margin: 0 }}>
                {fmt(resumen?.balance || 0)}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: '4px 0 0 0' }}>
                Tasa de ahorro: {tasaAhorro}%
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Ingresos totales', value: fmt(resumen?.ingresos), color: '#2D6B4A', bg: '#EDFAF3' },
            { label: 'Gastos totales',   value: fmt(resumen?.gastos),   color: '#A32D2D', bg: '#FCEBEB' },
            { label: 'Movimientos',      value: movimientos?.length || 0, color: '#185FA5', bg: '#E6F1FB' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.bg, borderRadius: '12px', padding: '16px' }}>
              <p style={{ color: k.color, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px 0' }}>{k.label}</p>
              <p style={{ color: '#0F2318', fontSize: '22px', fontWeight: '500', margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Gastos por categoría */}
        {gastosCategoria.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(26,58,42,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 16px 0' }}>Gastos por categoría</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gastosCategoria.map((c, i) => {
                const pct = Math.round((c.total / resumen.gastos) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#0F2318' }}>{c.categoria}</span>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#0F2318' }}>
                        {fmt(c.total)} <span style={{ color: '#8AA398', fontWeight: '400' }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', background: '#F2F5F2', borderRadius: '20px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: CATEGORIAS_COLORES[c.categoria] || '#4A9E72', borderRadius: '20px' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ingresos por categoría */}
        {ingresosCategoria.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(26,58,42,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 16px 0' }}>Fuentes de ingreso</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ingresosCategoria.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < ingresosCategoria.length-1 ? '0.5px solid rgba(26,58,42,0.08)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: '#4A6357' }}>{c.categoria}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#2D6B4A' }}>+{fmt(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Últimos movimientos */}
        {movimientos?.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(26,58,42,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 16px 0' }}>
              Movimientos del mes ({movimientos.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {movimientos.slice(0, 15).map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < Math.min(movimientos.length, 15)-1 ? '0.5px solid rgba(26,58,42,0.06)' : 'none' }}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '500', margin: '0 0 1px 0' }}>{m.descripcion || m.categoria}</p>
                    <p style={{ fontSize: '11px', color: '#8AA398', margin: 0 }}>{m.categoria} · {fmtDate(m.fecha)}</p>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: m.tipo==='ingreso'?'#2D6B4A':'#0F2318' }}>
                    {m.tipo==='ingreso'?'+':'-'}{fmt(m.monto)}
                  </span>
                </div>
              ))}
              {movimientos.length > 15 && (
                <p style={{ fontSize: '11px', color: '#8AA398', textAlign: 'center', marginTop: '8px' }}>
                  + {movimientos.length - 15} movimientos más
                </p>
              )}
            </div>
          </div>
        )}

        {/* Nueva página para deudas y metas */}
        <div className="page-break"/>

        {/* Deudas */}
        {deudasActivas.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(26,58,42,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Deudas activas</h2>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#E24B4A' }}>Total: {fmt(totalDeuda)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {deudasActivas.map((d, i) => {
                const pendiente = parseFloat(d.monto_total) - parseFloat(d.monto_pagado);
                const pct = Math.round((parseFloat(d.monto_pagado) / parseFloat(d.monto_total)) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '500', margin: '0 0 1px 0' }}>{d.nombre}</p>
                        <p style={{ fontSize: '11px', color: '#8AA398', margin: 0 }}>{d.tipo}{d.tasa_interes>0?` · ${d.tasa_interes}% EA`:''}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: '#E24B4A', margin: '0 0 1px 0' }}>{fmt(pendiente)} pendiente</p>
                        <p style={{ fontSize: '11px', color: '#8AA398', margin: 0 }}>{pct}% pagado</p>
                      </div>
                    </div>
                    <div style={{ height: '5px', background: '#F2F5F2', borderRadius: '20px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#4A9E72', borderRadius: '20px' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metas */}
        {metas?.filter(m=>!m.completada).length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(26,58,42,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 16px 0' }}>Metas de ahorro</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {metas.filter(m=>!m.completada).map((m, i) => {
                const pct = Math.min(Math.round((parseFloat(m.monto_actual)/parseFloat(m.monto_objetivo))*100),100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '500', margin: 0 }}>{m.nombre}</p>
                      <p style={{ fontSize: '13px', color: '#2D6B4A', fontWeight: '500', margin: 0 }}>
                        {fmt(m.monto_actual)} / {fmt(m.monto_objetivo)}
                      </p>
                    </div>
                    <div style={{ height: '5px', background: '#F2F5F2', borderRadius: '20px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#4A9E72', borderRadius: '20px' }}/>
                    </div>
                    <p style={{ fontSize: '11px', color: '#8AA398', margin: '3px 0 0 0' }}>{pct}% logrado</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cierres semanales con reflexiones */}
        {cierresMes?.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(26,58,42,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 16px 0' }}>Cierres semanales</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cierresMes.map((c, i) => (
                <div key={i} style={{ padding: '12px', background: c.balance >= 0 ? '#EDFAF3' : '#FCEBEB', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: c.reflexion ? '8px' : 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: '500', color: '#0F2318', margin: 0 }}>Semana {c.semana_num}</p>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: c.balance>=0?'#2D6B4A':'#E24B4A', margin: 0 }}>
                      {c.balance>=0?'+':''}{fmt(c.balance)}
                    </p>
                  </div>
                  {c.reflexion && (
                    <p style={{ fontSize: '12px', color: '#4A6357', fontStyle: 'italic', margin: 0 }}>
                      "{c.reflexion}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '0.5px solid rgba(26,58,42,0.1)' }}>
          <p style={{ color: '#8AA398', fontSize: '11px', margin: '0 0 2px 0' }}>
            Reporte generado por Fintual · {new Date().toLocaleDateString('es-CO')}
          </p>
          <p style={{ color: '#CBF0DC', fontSize: '10px', margin: 0 }}>Tu camino a la libertad financiera</p>
        </div>

      </div>
    </>
  );
}
