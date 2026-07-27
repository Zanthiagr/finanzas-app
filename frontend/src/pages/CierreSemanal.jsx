import { useEffect, useState } from 'react';
import { getResumen, getCierres, crearCierre } from '../utils/api';
import { fmt, fmtShort, getCurrentWeek } from '../utils/helpers';
import toast from 'react-hot-toast';

const PREGUNTAS = [
  '¿Qué gasté de más esta semana?',
  '¿En qué decisión financiera me siento orgulloso?',
  '¿Qué cambiaría la próxima semana?',
  '¿Cómo me sentí con mi dinero esta semana?',
];

export default function CierreSemanal() {
  const [cierres, setCierres]     = useState([]);
  const [resumen, setResumen]     = useState(null);
  const [reflexion, setReflexion] = useState('');
  const [pregIdx, setPregIdx]     = useState(0);
  const [loading, setLoading]     = useState(true);
  const [cerrando, setCerrando]   = useState(false);

  const now = new Date();
  // Semana DENTRO DEL MES actual (1-5) — mismo cálculo que en api.js
  const semanaActual = getCurrentWeek();
  const mesActual     = now.getMonth() + 1;
  const anioActual    = now.getFullYear();
  // Cuántas semanas tiene este mes en total (4 ó 5)
  const ultimoDiaMes  = new Date(anioActual, mesActual, 0).getDate();
  const totalSemanas  = Math.ceil(ultimoDiaMes / 7);

  const load = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        getCierres(anioActual),
        getResumen({ mes: mesActual, anio: anioActual }),
      ]);
      setCierres(c);
      setResumen(r);
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cerrarSemana = async () => {
    if (!reflexion.trim()) return toast.error('Escribe una reflexión antes de cerrar');
    setCerrando(true);
    try {
      const semDatos = resumen?.porSemana?.filter(s => s.semana_num === semanaActual) || [];
      const ing = semDatos.find(s => s.tipo === 'ingreso')?.total || 0;
      const gas = semDatos.find(s => s.tipo === 'gasto')?.total || 0;

      await crearCierre({
        semana_num: semanaActual, mes_num: mesActual, anio_num: anioActual,
        reflexion, ingresos: ing, gastos: gas,
      });
      toast.success('¡Semana cerrada! 🎉');
      setReflexion('');
      load();
    } catch { toast.error('Error al cerrar la semana'); }
    finally { setCerrando(false); }
  };

  const semanaYaCerrada = cierres.some(c => c.semana_num === semanaActual && c.mes_num === mesActual);

  // Construye los datos de cada semana del MES actual (1, 2, 3... hasta totalSemanas)
  const semanasData = Array.from({ length: totalSemanas }, (_, idx) => {
    const numSemana = idx + 1;
    const ing = resumen?.porSemana?.find(r => r.semana_num === numSemana && r.tipo === 'ingreso')?.total || 0;
    const gas = resumen?.porSemana?.find(r => r.semana_num === numSemana && r.tipo === 'gasto')?.total || 0;
    const cierre = cierres.find(c => c.semana_num === numSemana && c.mes_num === mesActual);
    const tieneMovimientos = parseFloat(ing) > 0 || parseFloat(gas) > 0;
    return {
      numSemana,
      ingresos: parseFloat(ing),
      gastos: parseFloat(gas),
      balance: parseFloat(ing) - parseFloat(gas),
      cerrada: !!cierre,
      reflexion: cierre?.reflexion,
      esActual: numSemana === semanaActual,
      esFutura: numSemana > semanaActual,
      tieneMovimientos,
    };
  });

  if (loading) return <div className="flex justify-center items-center h-64"><i className="ti ti-loader animate-spin text-2xl text-g-400"/></div>;

  return (
    <div className="space-y-5 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Cierre semanal</h2>
        <p className="text-sm text-g-400">Semana {semanaActual} de {totalSemanas} · {now.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</p>
      </div>

      {/* Tarjetas de semanas — grid responsive, nunca se cortan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {semanasData.map(s => (
          <div key={s.numSemana}
            className={`card p-3 min-w-0 ${s.cerrada ? 'border-g-300' : s.esActual ? 'border-gold' : ''}`}>
            <p className="section-label truncate">Semana {s.numSemana}</p>

            {!s.tieneMovimientos && !s.cerrada ? (
              <p className="text-sm text-g-300 mt-2">
                {s.esFutura ? 'Aún no llega' : 'Sin datos'}
              </p>
            ) : (
              <>
                <p className={`text-base md:text-lg font-medium mt-1 truncate ${s.balance>=0?'text-pos':'text-red-500'}`}>
                  {s.balance>=0?'+':''}{fmtShort(s.balance)}
                </p>
                <div className="text-[10px] text-g-400 mt-1.5 space-y-0.5">
                  <div className="flex justify-between gap-1">
                    <span className="truncate">Ing.</span>
                    <span className="truncate">{fmtShort(s.ingresos)}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="truncate">Gas.</span>
                    <span className="truncate">{fmtShort(s.gastos)}</span>
                  </div>
                </div>
              </>
            )}

            <div className="mt-2">
              {s.cerrada
                ? <span className="badge-ok text-[10px]">✓ Cerrada</span>
                : s.esFutura
                  ? <span className="text-[10px] text-g-300">—</span>
                  : s.esActual
                    ? <span className="badge-warn text-[10px]">En curso</span>
                    : <span className="badge-bad text-[10px]">Sin cerrar</span>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Resumen acumulado del mes */}
      <div className="card p-5">
        <p className="text-sm font-medium text-g-900 mb-4">Resumen acumulado del mes</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="min-w-0">
            <p className="section-label">Ingresos</p>
            <p className="text-base md:text-xl font-medium text-pos truncate">{fmtShort(resumen?.ingresos)}</p>
          </div>
          <div className="min-w-0">
            <p className="section-label">Gastos</p>
            <p className="text-base md:text-xl font-medium text-red-500 truncate">{fmtShort(resumen?.gastos)}</p>
          </div>
          <div className="min-w-0">
            <p className="section-label">Balance</p>
            <p className={`text-base md:text-xl font-medium truncate ${resumen?.balance>=0?'text-pos':'text-red-500'}`}>
              {fmtShort(resumen?.balance)}
            </p>
          </div>
        </div>
        {resumen?.ingresos > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-g-400 mb-1">
              <span>Tasa de ahorro</span>
              <span>{Math.round((resumen.balance/resumen.ingresos)*100)}%</span>
            </div>
            <div className="h-2 bg-g-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full"
                style={{width:`${Math.min(Math.max(Math.round((resumen.balance/resumen.ingresos)*100),0),100)}%`}}/>
            </div>
          </div>
        )}
      </div>

      {/* Cerrar semana actual */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <i className="ti ti-calendar-check text-g-600"/>
          <p className="text-sm font-medium text-g-900">
            {semanaYaCerrada ? `Semana ${semanaActual} — Ya cerrada` : `Cerrar semana ${semanaActual}`}
          </p>
        </div>
        <p className="text-xs text-g-400 mb-4">
          {semanaYaCerrada ? 'Ya registraste tu reflexión. ¡Sigue así!' : 'Reflexiona antes de cerrar. La constancia genera el cambio.'}
        </p>

        {!semanaYaCerrada && (
          <>
            <div className="flex gap-2 flex-wrap mb-3">
              {PREGUNTAS.map((p,i) => (
                <button key={i} onClick={() => setPregIdx(i)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${pregIdx===i?'bg-g-50 border-g-300 text-g-700':'bg-white border-g-200/60 text-g-400'}`}>
                  {p}
                </button>
              ))}
            </div>
            <p className="text-sm text-g-600 font-medium mb-2">{PREGUNTAS[pregIdx]}</p>
            <textarea className="input resize-none h-28" placeholder="Escribe libremente..."
              value={reflexion} onChange={e => setReflexion(e.target.value)}/>
            <button onClick={cerrarSemana} disabled={cerrando}
              className="btn-primary w-full mt-3 justify-center flex items-center gap-2">
              <i className="ti ti-calendar-check text-sm"/>
              {cerrando ? 'Cerrando...' : `Cerrar semana ${semanaActual}`}
            </button>
          </>
        )}

        {semanaYaCerrada && cierres.find(c=>c.semana_num===semanaActual && c.mes_num===mesActual)?.reflexion && (
          <div className="bg-g-50 rounded-xl p-3 text-sm text-g-700 italic border border-g-200/60">
            "{cierres.find(c=>c.semana_num===semanaActual && c.mes_num===mesActual)?.reflexion}"
          </div>
        )}
      </div>
    </div>
  );
}
