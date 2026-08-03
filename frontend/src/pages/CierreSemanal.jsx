import { useEffect, useState } from 'react';
import { getResumen, getCierres, crearCierre } from '../utils/api';
import { fmtShort, getCurrentWeek } from '../utils/helpers';
import toast from 'react-hot-toast';

const PREGUNTAS = [
  '¿Qué gasté de más esta semana?',
  '¿En qué decisión financiera me siento orgulloso?',
  '¿Qué cambiaría la próxima semana?',
  '¿Cómo me sentí con mi dinero esta semana?',
];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CierreSemanal() {
  const now         = new Date();
  const mesHoy      = now.getMonth() + 1;
  const anioHoy     = now.getFullYear();
  const semanaHoy   = getCurrentWeek();

  // Mes que se está viendo — por defecto el actual, pero se puede navegar
  // hacia atrás para cerrar semanas o meses ya pasados que se quedaron sin cerrar.
  const [mesSel, setMesSel]   = useState(mesHoy);
  const [anioSel, setAnioSel] = useState(anioHoy);
  const [semanaSel, setSemanaSel] = useState(null); // se fija tras cargar datos del mes

  const [cierres, setCierres]     = useState([]);
  const [resumen, setResumen]     = useState(null);
  const [reflexion, setReflexion] = useState('');
  const [pregIdx, setPregIdx]     = useState(0);
  const [loading, setLoading]     = useState(true);
  const [cerrando, setCerrando]   = useState(false);

  const esMesActual  = mesSel === mesHoy && anioSel === anioHoy;
  const esMesFuturo  = anioSel > anioHoy || (anioSel === anioHoy && mesSel > mesHoy);
  // Cuántas semanas tiene el mes que se está viendo (4 ó 5)
  const ultimoDiaMes = new Date(anioSel, mesSel, 0).getDate();
  const totalSemanas = Math.ceil(ultimoDiaMes / 7);

  const load = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        getCierres(anioSel),
        getResumen({ mes: mesSel, anio: anioSel }),
      ]);
      setCierres(c);
      setResumen(r);
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [mesSel, anioSel]);

  // Cada vez que cambian mes/cierres, si no hay semana elegida (o la que
  // había quedó fuera de rango al cambiar de mes) se elige automáticamente
  // la primera semana pendiente de cerrar — así el usuario ve de una lo
  // que le falta, sin tener que adivinar cuál tocar.
  useEffect(() => {
    if (loading) return;
    const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1).map(n => ({
      numSemana: n,
      esFutura: esMesFuturo || (esMesActual && n > semanaHoy),
      cerrada: cierres.some(c => c.semana_num === n && c.mes_num === mesSel),
    }));
    const pendiente = semanas.find(s => !s.cerrada && !s.esFutura);
    setSemanaSel(prev =>
      prev && semanas.some(s => s.numSemana === prev) ? prev : (pendiente?.numSemana ?? semanas[semanas.length - 1]?.numSemana ?? 1)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mesSel, anioSel, cierres.length]);

  const cambiarMes = (delta) => {
    let m = mesSel + delta, a = anioSel;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    if (a > anioHoy || (a === anioHoy && m > mesHoy)) return; // no se navega al futuro
    setMesSel(m); setAnioSel(a); setSemanaSel(null);
  };

  const cerrarSemana = async () => {
    if (!reflexion.trim()) return toast.error('Escribe una reflexión antes de cerrar');
    if (!semanaSel) return;
    setCerrando(true);
    try {
      const semDatos = resumen?.porSemana?.filter(s => s.semana_num === semanaSel) || [];
      const ing = semDatos.find(s => s.tipo === 'ingreso')?.total || 0;
      const gas = semDatos.find(s => s.tipo === 'gasto')?.total || 0;

      await crearCierre({
        semana_num: semanaSel, mes_num: mesSel, anio_num: anioSel,
        reflexion, ingresos: ing, gastos: gas,
      });
      toast.success('¡Semana cerrada! 🎉');
      setReflexion('');
      load();
    } catch { toast.error('Error al cerrar la semana'); }
    finally { setCerrando(false); }
  };

  const semanaYaCerrada = cierres.some(c => c.semana_num === semanaSel && c.mes_num === mesSel);

  // Construye los datos de cada semana del mes que se está viendo
  const semanasData = Array.from({ length: totalSemanas }, (_, idx) => {
    const numSemana = idx + 1;
    const ing = resumen?.porSemana?.find(r => r.semana_num === numSemana && r.tipo === 'ingreso')?.total || 0;
    const gas = resumen?.porSemana?.find(r => r.semana_num === numSemana && r.tipo === 'gasto')?.total || 0;
    const cierre = cierres.find(c => c.semana_num === numSemana && c.mes_num === mesSel);
    const tieneMovimientos = parseFloat(ing) > 0 || parseFloat(gas) > 0;
    const esFutura = esMesFuturo || (esMesActual && numSemana > semanaHoy);
    return {
      numSemana,
      ingresos: parseFloat(ing),
      gastos: parseFloat(gas),
      balance: parseFloat(ing) - parseFloat(gas),
      cerrada: !!cierre,
      reflexion: cierre?.reflexion,
      esSeleccionada: numSemana === semanaSel,
      esFutura,
      tieneMovimientos,
    };
  });

  if (loading) return <div className="flex justify-center items-center h-64"><i className="ti ti-loader animate-spin text-2xl text-g-400"/></div>;

  return (
    <div className="space-y-5 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-g-900">Cierre semanal</h2>
          <p className="text-sm text-g-400">{MESES[mesSel - 1]} {anioSel}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => cambiarMes(-1)} title="Mes anterior"
            className="w-8 h-8 rounded-lg border border-g-200/60 flex items-center justify-center text-g-500 hover:bg-g-50 active:scale-95 transition-all">
            <i className="ti ti-chevron-left text-sm"/>
          </button>
          <button onClick={() => cambiarMes(1)} disabled={esMesActual} title="Mes siguiente"
            className="w-8 h-8 rounded-lg border border-g-200/60 flex items-center justify-center text-g-500 hover:bg-g-50 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent">
            <i className="ti ti-chevron-right text-sm"/>
          </button>
        </div>
      </div>

      {/* Tarjetas de semanas — clic en una semana no futura la selecciona
          para cerrarla o ver su reflexión, sin importar si es la semana
          "actual" o una que quedó pendiente de meses anteriores. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {semanasData.map(s => (
          <button key={s.numSemana} onClick={() => !s.esFutura && setSemanaSel(s.numSemana)}
            disabled={s.esFutura}
            className={`card p-3 min-w-0 text-left ${s.esFutura ? 'cursor-default opacity-60' : 'cursor-pointer'} ${s.cerrada ? 'border-g-300' : s.esSeleccionada ? 'border-gold' : ''}`}>
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
                  : <span className="badge-bad text-[10px]">Sin cerrar</span>
              }
            </div>
          </button>
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

      {/* Cerrar la semana seleccionada arriba */}
      {semanaSel && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <i className="ti ti-calendar-check text-g-600"/>
            <p className="text-sm font-medium text-g-900">
              {semanaYaCerrada ? `Semana ${semanaSel} — Ya cerrada` : `Cerrar semana ${semanaSel}`}
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
                {cerrando ? 'Cerrando...' : `Cerrar semana ${semanaSel}`}
              </button>
            </>
          )}

          {semanaYaCerrada && cierres.find(c=>c.semana_num===semanaSel && c.mes_num===mesSel)?.reflexion && (
            <div className="relative overflow-hidden bg-g-50 rounded-xl p-4 border border-g-200/60">
              <i className="ti ti-quote absolute -top-1 -right-1 text-4xl text-g-200/50"/>
              <p className="relative text-sm text-g-700 font-serif italic leading-relaxed">
                "{cierres.find(c=>c.semana_num===semanaSel && c.mes_num===mesSel)?.reflexion}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
