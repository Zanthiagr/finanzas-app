import { useEffect, useState } from 'react';
import { getResumen, getCierres, crearCierre } from '../utils/api';
import { fmt, getCurrentWeek } from '../utils/helpers';
import toast from 'react-hot-toast';

const PREGUNTAS = [
  '¿Qué gasté de más esta semana?',
  '¿En qué decisión financiera me siento orgulloso?',
  '¿Qué cambiaría la próxima semana?',
  '¿Cómo me sentí con mi dinero esta semana?',
];

export default function CierreSemanal() {
  const [cierres, setCierres]   = useState([]);
  const [resumen, setResumen]   = useState(null);
  const [reflexion, setReflexion] = useState('');
  const [pregIdx, setPregIdx]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [cerrando, setCerrando] = useState(false);

  const now = new Date();
  const semanaActual = getCurrentWeek();
  const mesActual    = now.getMonth() + 1;
  const anioActual   = now.getFullYear();

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
      const semMovs = resumen?.porSemana?.filter(s => s.semana_num === semanaActual) || [];
      const ing = semMovs.find(s => s.tipo==='ingreso')?.total || 0;
      const gas = semMovs.find(s => s.tipo==='gasto')?.total || 0;

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

  const semanaYaCerrada = cierres.some(c => c.semana_num === semanaActual);

  const semanasData = [1,2,3,4].map(s => {
    const semReal = semanaActual - 3 + (s - 1);
    const ing  = resumen?.porSemana?.find(r => r.semana_num===semReal && r.tipo==='ingreso')?.total || 0;
    const gas  = resumen?.porSemana?.find(r => r.semana_num===semReal && r.tipo==='gasto')?.total || 0;
    const cierre = cierres.find(c => c.semana_num===semReal);
    return { semana: s, semReal, ingresos: parseFloat(ing), gastos: parseFloat(gas),
      balance: parseFloat(ing)-parseFloat(gas), cerrada: !!cierre, reflexion: cierre?.reflexion };
  });

  if (loading) return <div className="flex justify-center items-center h-64"><i className="ti ti-loader animate-spin text-2xl text-g-400"/></div>;

  return (
    <div className="space-y-5 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Cierre semanal</h2>
        <p className="text-sm text-g-400">Semana {semanaActual} · {now.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {semanasData.map(s => (
          <div key={s.semana} className={`card p-4 ${s.cerrada?'border-g-300':''}`}>
            <p className="section-label">Semana {s.semana}</p>
            {s.ingresos===0 && s.gastos===0 && !s.cerrada ? (
              <p className="text-sm text-g-300 mt-2">Sin datos</p>
            ) : (
              <>
                <p className={`text-lg font-medium mt-1 ${s.balance>=0?'text-g-600':'text-red-500'}`}>
                  {s.balance>=0?'+':''}{fmt(s.balance)}
                </p>
                <div className="text-[11px] text-g-400 mt-1.5 space-y-0.5">
                  <div className="flex justify-between"><span>Ingresos</span><span>{fmt(s.ingresos)}</span></div>
                  <div className="flex justify-between"><span>Gastos</span><span>{fmt(s.gastos)}</span></div>
                </div>
              </>
            )}
            <div className="mt-2">
              {s.cerrada ? <span className="badge-ok text-[10px]">✓ Cerrada</span>
                : s.semana===4 ? <span className="badge-warn text-[10px]">En curso</span>
                : <span className="badge-bad text-[10px]">Pendiente</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium text-g-900 mb-4">Resumen acumulado del mes</p>
        <div className="grid grid-cols-3 gap-4">
          <div><p className="section-label">Ingresos</p><p className="text-xl font-medium text-g-600">{fmt(resumen?.ingresos)}</p></div>
          <div><p className="section-label">Gastos</p><p className="text-xl font-medium text-red-500">{fmt(resumen?.gastos)}</p></div>
          <div><p className="section-label">Balance neto</p>
            <p className={`text-xl font-medium ${resumen?.balance>=0?'text-g-600':'text-red-500'}`}>{fmt(resumen?.balance)}</p>
          </div>
        </div>
        {resumen?.ingresos > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-g-400 mb-1">
              <span>Tasa de ahorro</span>
              <span>{Math.round((resumen.balance/resumen.ingresos)*100)}%</span>
            </div>
            <div className="h-2 bg-g-100 rounded-full overflow-hidden">
              <div className="h-full bg-g-400 rounded-full"
                style={{width:`${Math.min(Math.max(Math.round((resumen.balance/resumen.ingresos)*100),0),100)}%`}}/>
            </div>
          </div>
        )}
      </div>

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

        {semanaYaCerrada && cierres.find(c=>c.semana_num===semanaActual)?.reflexion && (
          <div className="bg-g-50 rounded-xl p-3 text-sm text-g-700 italic border border-g-200/60">
            "{cierres.find(c=>c.semana_num===semanaActual)?.reflexion}"
          </div>
        )}
      </div>
    </div>
  );
}
