import { useState, useEffect, useCallback } from 'react';
import { getMovimientos, getCierres, getPagosProgramados, crearPagoProgramado, eliminarPagoProgramado, procesarPagosPendientes } from '../utils/api';
import { supabase } from '../utils/supabase';
import { fmt, fmtShort } from '../utils/helpers';
import PantallaCompleta from '../components/PantallaCompleta';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/confirm';

const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CATS   = ['Vivienda','Servicios','Transporte','Salud','Educación','Deudas','Alimentación','Entretenimiento','Otro'];
const MEDIOS = [
  { value:'efectivo', label:'💵 Efectivo' },
  { value:'nequi',    label:'🟣 Nequi' },
  { value:'bancolombia', label:'🟡 Bancolombia' },
  { value:'otro_banco',  label:'🏦 Otro banco' },
];

export default function Calendario() {
  const hoy = new Date();
  const [año, setAño]         = useState(hoy.getFullYear());
  const [mes, setMes]         = useState(hoy.getMonth());
  const [diaSelec, setDiaSelec] = useState(hoy.getDate());
  const [movimientos, setMovimientos] = useState([]);
  const [cierres, setCierres]   = useState([]);
  const [habLogs, setHabLogs]   = useState([]);
  const [pagos, setPagos]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalPago, setModalPago] = useState(false);
  const [formPago, setFormPago] = useState({ nombre:'', monto:'', categoria:'Servicios', dia_mes:1, medio_pago:'bancolombia' });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const mesNum = mes + 1;
      const inicio = `${año}-${String(mesNum).padStart(2,'0')}-01`;
      const fin    = `${año}-${String(mesNum).padStart(2,'0')}-31`;

      const [movs, cierresData, pagosData] = await Promise.all([
        getMovimientos({ mes: mesNum, anio: año }),
        getCierres(año),
        getPagosProgramados(),
      ]);
      setMovimientos(movs);
      setCierres(cierresData.filter(c => c.mes_num === mesNum));
      setPagos(pagosData);

      // Hábitos log — opcional, no rompe si la tabla no tiene la columna
      try {
        const { data: logs } = await supabase
          .from('habitos_log')
          .select('fecha, completado, habito_id')
          .eq('usuario_id', userId)
          .gte('fecha', inicio)
          .lte('fecha', fin)
          .eq('completado', true);
        setHabLogs(logs || []);
      } catch { setHabLogs([]); }

      // Procesar pagos automáticos si es el mes actual
      if (mesNum === hoy.getMonth()+1 && año === hoy.getFullYear()) {
        const procesados = await procesarPagosPendientes();
        if (procesados > 0) {
          toast.success(`${procesados} pago${procesados>1?'s':''} automático${procesados>1?'s':''} registrado${procesados>1?'s':''}`);
          const movNuevos = await getMovimientos({ mes: mesNum, anio: año });
          setMovimientos(movNuevos);
        }
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [mes, año]);

  useEffect(() => { cargar(); }, [cargar]);

  const primerDia = new Date(año, mes, 1).getDay();
  const diasEnMes = new Date(año, mes + 1, 0).getDate();

  const getDiaData = (dia) => {
    const fechaStr = `${año}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const movsDia  = movimientos.filter(m => m.fecha === fechaStr);
    const habsDia  = habLogs.filter(h => h.fecha === fechaStr);
    const semana   = Math.ceil(dia / 7);
    const cierre   = cierres.find(c => c.semana_num === semana);
    const pagosDia = pagos.filter(p => p.dia_mes === dia && p.activo);
    const ingresos = movsDia.filter(m => m.tipo==='ingreso').reduce((a,m)=>a+parseFloat(m.monto),0);
    const gastos   = movsDia.filter(m => m.tipo==='gasto').reduce((a,m)=>a+parseFloat(m.monto),0);
    return { movsDia, habsDia, cierre, pagosDia, ingresos, gastos, semana, fechaStr };
  };

  const getDiaColor = (dia) => {
    const { movsDia, habsDia, ingresos, gastos, pagosDia } = getDiaData(dia);
    if (pagosDia.length > 0 && movsDia.length === 0) return 'bg-amber-50 border-amber-300';
    if (movsDia.length === 0 && habsDia.length === 0) return null;
    if (gastos > ingresos && ingresos === 0) return 'bg-red-50 border-red-200';
    if (ingresos > 0 && gastos <= ingresos) return 'bg-g-50 border-g-300';
    if (gastos > ingresos) return 'bg-amber-50 border-amber-300';
    return 'bg-g-50 border-g-200';
  };

  const navMes = (delta) => {
    let nuevoMes = mes + delta;
    let nuevoAño = año;
    if (nuevoMes < 0)  { nuevoMes = 11; nuevoAño--; }
    if (nuevoMes > 11) { nuevoMes = 0;  nuevoAño++; }
    setMes(nuevoMes); setAño(nuevoAño); setDiaSelec(1);
  };

  const guardarPago = async e => {
    e.preventDefault();
    if (!formPago.nombre || !formPago.monto) return toast.error('Completa todos los campos');
    try {
      await crearPagoProgramado({ ...formPago, activo: true });
      toast.success('Pago programado ✅');
      setModalPago(false);
      setFormPago({ nombre:'', monto:'', categoria:'Servicios', dia_mes:1, medio_pago:'bancolombia' });
      cargar();
    } catch { toast.error('Error guardando pago'); }
  };

  const eliminarPago = (id) => {
    confirmToast('¿Eliminar este pago programado?', async () => {
      await eliminarPagoProgramado(id);
      toast.success('Eliminado');
      cargar();
    });
  };

  const diaData = getDiaData(diaSelec);
  const esHoy   = diaSelec === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();

  // Total pagos programados del mes
  const totalPagosMes = pagos.filter(p=>p.activo).reduce((a,p)=>a+parseFloat(p.monto),0);

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-g-900">Calendario</h2>
          <p className="text-sm text-g-400">Historial y pagos programados</p>
        </div>
        <button onClick={()=>setModalPago(true)} className="btn-primary flex items-center gap-2">
          <i className="ti ti-calendar-plus text-sm"/> Programar
        </button>
      </div>

      {/* Resumen pagos programados */}
      {pagos.filter(p=>p.activo).length > 0 && (
        <div className="card p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-amber-800">Pagos programados este mes</p>
            <span className="text-sm font-medium text-amber-700">{fmt(totalPagosMes)}</span>
          </div>
          <div className="space-y-1.5">
            {pagos.filter(p=>p.activo).map(p=>(
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Día {p.dia_mes}</span>
                  <span className="text-xs text-amber-800">{p.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-amber-700">{fmtShort(p.monto)}</span>
                  <button onClick={()=>eliminarPago(p.id)} className="text-amber-400 hover:text-red-500">
                    <i className="ti ti-x text-xs"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendario */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>navMes(-1)} className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center active:scale-90">
            <i className="ti ti-chevron-left text-g-700"/>
          </button>
          <div className="text-center">
            <p className="font-medium text-g-900">{MESES[mes]}</p>
            <p className="text-xs text-g-400">{año}</p>
          </div>
          <button onClick={()=>navMes(1)} className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center active:scale-90">
            <i className="ti ti-chevron-right text-g-700"/>
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DIAS.map(d=><div key={d} className="text-center text-[11px] text-g-400 font-medium py-1">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({length:primerDia}).map((_,i)=><div key={`v${i}`}/>)}
          {Array.from({length:diasEnMes},(_,i)=>i+1).map(dia=>{
            const color    = getDiaColor(dia);
            const selec    = dia === diaSelec;
            const esDiaHoy = dia===hoy.getDate() && mes===hoy.getMonth() && año===hoy.getFullYear();
            const { movsDia, habsDia, pagosDia } = getDiaData(dia);
            return (
              <button key={dia} onClick={()=>setDiaSelec(dia)}
                className={`relative flex flex-col items-center py-1.5 rounded-xl border transition-all ${
                  selec      ? 'bg-g-700 border-g-700' :
                  color      ? `${color} border` :
                  esDiaHoy   ? 'border-gold border' :
                  'border-transparent hover:bg-g-50'
                }`}>
                <span className={`text-[13px] font-medium ${selec?'text-white':esDiaHoy?'text-gold':'text-g-800'}`}>{dia}</span>
                <div className="flex gap-0.5 mt-0.5 min-h-[6px]">
                  {movsDia.length>0 && <div className={`w-1.5 h-1.5 rounded-full ${selec?'bg-white/70':'bg-g-500'}`}/>}
                  {habsDia.length>0 && <div className={`w-1.5 h-1.5 rounded-full ${selec?'bg-gold/70':'bg-gold'}`}/>}
                  {pagosDia.length>0 && <div className={`w-1.5 h-1.5 rounded-full ${selec?'bg-white/50':'bg-amber-400'}`}/>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 mt-3 flex-wrap">
          {[['bg-g-500','Movimientos'],['bg-gold','Hábitos'],['bg-amber-400','Pagos prog.']].map(([c,l])=>(
            <div key={l} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${c}`}/>
              <span className="text-[11px] text-g-400">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detalle del día */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-g-900">
            {esHoy?'Hoy · ':''}{diaSelec} de {MESES[mes]}
          </p>
          {diaData.cierre && <span className="badge-ok text-[10px]">Semana {diaData.semana} cerrada ✓</span>}
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><i className="ti ti-loader animate-spin text-g-400 text-xl"/></div>
        ) : (
          <>
            {/* Resumen */}
            {(diaData.ingresos>0||diaData.gastos>0) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-g-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase text-g-400 mb-1">Ingresos</p>
                  <p className="text-sm font-medium text-pos">{fmtShort(diaData.ingresos)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase text-g-400 mb-1">Gastos</p>
                  <p className="text-sm font-medium text-red-600">{fmtShort(diaData.gastos)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${diaData.ingresos-diaData.gastos>=0?'bg-g-50':'bg-amber-50'}`}>
                  <p className="text-[10px] uppercase text-g-400 mb-1">Balance</p>
                  <p className={`text-sm font-medium ${diaData.ingresos-diaData.gastos>=0?'text-pos':'text-amber-700'}`}>
                    {fmtShort(diaData.ingresos-diaData.gastos)}
                  </p>
                </div>
              </div>
            )}

            {/* Pagos programados del día */}
            {diaData.pagosDia.length>0 && (
              <div className="mb-4">
                <p className="section-label mb-2">Pagos programados</p>
                {diaData.pagosDia.map((p,i)=>(
                  <div key={i} className="flex justify-between items-center py-2 border-b border-amber-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <i className="ti ti-calendar-event text-amber-500 text-sm"/>
                      <span className="text-sm text-g-700">{p.nombre}</span>
                    </div>
                    <span className="text-sm font-medium text-amber-700">{fmtShort(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Movimientos */}
            {diaData.movsDia.length>0 && (
              <div className="mb-4">
                <p className="section-label mb-2">Movimientos</p>
                {diaData.movsDia.map((m,i)=>(
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-g-100 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-g-700 truncate">{m.descripcion||m.categoria}</p>
                      {m.medio_pago && <p className="text-[10px] text-g-400">{m.medio_pago}</p>}
                    </div>
                    <span className={`text-sm font-medium ml-2 flex-shrink-0 ${m.tipo==='ingreso'?'text-pos':'text-g-900'}`}>
                      {m.tipo==='ingreso'?'+':'-'}{fmtShort(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Hábitos */}
            {diaData.habsDia.length>0 && (
              <div className="mb-4">
                <p className="section-label mb-2">Hábitos completados</p>
                <div className="flex gap-2 flex-wrap">
                  {diaData.habsDia.map((_,i)=>(
                    <span key={i} className="badge-ok flex items-center gap-1 text-[11px]">
                      <i className="ti ti-check text-xs"/> Hábito {i+1}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reflexión */}
            {diaData.cierre?.reflexion && (
              <div className="bg-g-50 rounded-xl p-3">
                <p className="section-label mb-1">Reflexión semana {diaData.semana}</p>
                <p className="text-sm text-g-700 italic">"{diaData.cierre.reflexion}"</p>
              </div>
            )}

            {/* Sin datos */}
            {diaData.movsDia.length===0 && diaData.habsDia.length===0 && !diaData.cierre && diaData.pagosDia.length===0 && (
              <div className="text-center py-6">
                <i className="ti ti-calendar-off text-3xl text-g-200 block mb-2"/>
                <p className="text-sm text-g-400">Sin registros para este día</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pantalla nuevo pago programado */}
      {modalPago && (
        <PantallaCompleta title="Programar pago fijo" onClose={()=>setModalPago(false)}>
          <form onSubmit={guardarPago} className="space-y-4">
            <div>
              <label className="section-label block mb-1">Nombre del pago</label>
              <input className="input" placeholder="Ej: Arriendo, Netflix, Gym"
                value={formPago.nombre} onChange={e=>setFormPago(f=>({...f,nombre:e.target.value}))} required/>
            </div>
            <div>
              <label className="section-label block mb-1">Monto (COP)</label>
              <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
                value={formPago.monto} onChange={e=>setFormPago(f=>({...f,monto:e.target.value}))} required/>
            </div>
            <div>
              <label className="section-label block mb-1">Categoría</label>
              <select className="select" value={formPago.categoria} onChange={e=>setFormPago(f=>({...f,categoria:e.target.value}))}>
                {CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="section-label block mb-1">Día del mes en que se paga</label>
              <input type="text" inputMode="numeric" className="input" placeholder="Ej: 5"
                value={formPago.dia_mes} onChange={e=>{
                  const v = parseInt(e.target.value);
                  setFormPago(f=>({...f,dia_mes:isNaN(v)?'':Math.min(Math.max(v,1),28)}));
                }} required/>
              <p className="text-xs text-g-400 mt-1">Se registrará automáticamente como gasto cada mes ese día</p>
            </div>
            <div>
              <label className="section-label block mb-2">Medio de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {MEDIOS.map(m=>(
                  <button key={m.value} type="button"
                    onClick={()=>setFormPago(f=>({...f,medio_pago:m.value}))}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${formPago.medio_pago===m.value?'bg-g-50 border-g-400 text-g-700':'bg-white border-g-200/60 text-g-500'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-4 mt-2">
              Programar pago ✅
            </button>
            <button type="button" onClick={()=>setModalPago(false)} className="btn-secondary w-full py-3.5">
              Cancelar
            </button>
          </form>
        </PantallaCompleta>
      )}
    </div>
  );
}
