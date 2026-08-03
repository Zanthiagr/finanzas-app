import { useEffect, useState, useRef } from 'react';
import { getMovimientos, crearMovimiento, actualizarMovimiento, eliminarMovimiento, getSaldoTotal } from '../utils/api';
import { fmtDate, fmtShort, todayLocalStr, CATEGORIAS_ICONOS, CATEGORIAS_COLORES, BANCOS, labelMedioPago } from '../utils/helpers';
import PantallaCompleta from '../components/PantallaCompleta';
import toast from 'react-hot-toast';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CATS_GASTO   = ['Alimentación','Transporte','Servicios','Salud','Educación','Entretenimiento','Ropa','Vivienda','Deudas','Otro'];
const CATS_INGRESO = ['Salario','Freelance','Negocio','Rendimiento','Otro'];
const initForm = { tipo:'gasto', monto:'', categoria:'Alimentación', descripcion:'', fecha: todayLocalStr(), medio_pago: 'efectivo', banco: '' };

// Componente fila con swipe para eliminar
function MovRow({ m, onEdit, onDelete }) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(null);
  const startSwipe = useRef(0);

  const onTouchStart = e => {
    startX.current = e.touches[0].clientX;
    startSwipe.current = swipeX; // partimos desde la posición actual, no siempre desde 0
  };
  const onTouchMove = e => {
    if (startX.current === null) return;
    const diff = e.touches[0].clientX - startX.current;
    const next = Math.min(0, Math.max(startSwipe.current + diff, -80));
    setSwipeX(next);
  };
  const onTouchEnd = () => {
    // se abre si quedó pasada la mitad, si no vuelve a cerrar (incluye deslizar de vuelta a la derecha)
    setSwipeX(prev => (prev < -40 ? -80 : 0));
    startX.current = null;
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-r-xl">
        <button onClick={() => onDelete(m.id)} className="text-white flex flex-col items-center gap-0.5">
          <i className="ti ti-trash text-lg"/>
          <span className="text-[10px]">Eliminar</span>
        </button>
      </div>
      <div
        className="relative bg-white flex items-center gap-3 px-4 py-3 transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => swipeX === 0 && onEdit(m)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: (CATEGORIAS_COLORES[m.categoria]||'#2452FF')+'25', color: CATEGORIAS_COLORES[m.categoria]||'#2452FF' }}>
          <i className={`ti ${CATEGORIAS_ICONOS[m.categoria]||'ti-tag'}`}/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-g-900 truncate">{m.descripcion||m.categoria}</p>
          <p className="text-[11px] text-g-400 truncate">
            {m.categoria} · {fmtDate(m.fecha)} · {labelMedioPago(m.medio_pago || 'efectivo')}
          </p>
        </div>
        <span className={`text-sm font-medium flex-shrink-0 ${m.tipo==='ingreso'?'text-pos':'text-g-900'}`}>
          {m.tipo==='ingreso'?'+':'-'}{fmtShort(m.monto)}
        </span>
        <i className="ti ti-chevron-right text-g-300 text-xs hidden md:block"/>
      </div>
    </div>
  );
}

// ── PANTALLA COMPLETA para crear/editar — NO es un modal flotante.
// Se renderiza como una página normal, sin position:fixed ni overflow
// especiales. Esto evita por completo los bugs de scroll táctil de iOS
// que afectan a los modales superpuestos.
function FormularioMovimiento({ editing, form, setForm, set, onCancel, onSubmit }) {
  return (
    <PantallaCompleta title={editing ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onCancel}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {['gasto','ingreso'].map(t=>(
            <button key={t} type="button"
              onClick={()=>setForm(f=>({...f,tipo:t,categoria:t==='ingreso'?'Salario':'Alimentación'}))}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${form.tipo===t?(t==='gasto'?'bg-red-50 border-red-300 text-red-700':'bg-g-50 border-g-300 text-g-700'):'bg-white border-g-200/60 text-g-500'}`}>
              {t==='gasto'?'↑ Gasto':'↓ Ingreso'}
            </button>
          ))}
        </div>
        <div>
          <label className="section-label block mb-1">Monto (COP)</label>
          <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
            value={form.monto} onChange={set('monto')} required/>
        </div>
        <div>
          <label className="section-label block mb-1">Categoría</label>
          <select className="select" value={form.categoria} onChange={set('categoria')}>
            {(form.tipo==='ingreso'?CATS_INGRESO:CATS_GASTO).map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="section-label block mb-1">Descripción (opcional)</label>
          <input className="input" placeholder="Ej: mercado del sábado" value={form.descripcion} onChange={set('descripcion')}/>
        </div>
        <div>
          <label className="section-label block mb-2">Medio de pago</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[{value:'efectivo',label:'💵 Efectivo'},{value:'transferencia',label:'🏦 Transferencia'}].map(m => (
              <button key={m.value} type="button"
                onClick={() => setForm(f => ({...f, medio_pago: m.value, banco: m.value==='efectivo'?'':f.banco}))}
                className={`py-2.5 px-2 rounded-xl text-xs font-medium border transition-all text-center ${form.medio_pago===m.value?'bg-g-50 border-g-400 text-g-700':'bg-white border-g-200/60 text-g-500'}`}>
                {m.label}
              </button>
            ))}
          </div>
          {form.medio_pago==='transferencia' && (
            <div className="grid grid-cols-2 gap-2">
              {BANCOS.map(b => (
                <button key={b.value} type="button"
                  onClick={() => setForm(f => ({...f, banco: b.value}))}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-left ${form.banco===b.value?'bg-g-50 border-g-400 text-g-700':'bg-white border-g-200/60 text-g-500'}`}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="section-label block mb-1">Fecha</label>
          <input type="date" className="input" value={form.fecha} onChange={set('fecha')}/>
        </div>
        <button type="submit" className="btn-primary w-full py-4 text-base">
          {editing ? 'Guardar cambios' : 'Registrar movimiento'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary w-full py-3.5">
          Cancelar
        </button>
      </form>
    </PantallaCompleta>
  );
}

export default function Movimientos() {
  const hoy = new Date();
  const [movs, setMovs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(initForm);
  const [editing, setEditing]   = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [resumenMedio, setResumenMedio] = useState(null);
  const [verMedios, setVerMedios] = useState(false);
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());

  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

  const navMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1)  { m = 12; a--; }
    if (m > 12) { m = 1;  a++; }
    setMes(m); setAnio(a);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMovimientos({ mes, anio, tipo: filtroTipo||undefined });
      setMovs(data);
    } catch { toast.error('Error cargando movimientos'); }
    finally { setLoading(false); }
    // Saldo por medio de pago — TOTAL acumulado, no se reinicia por mes.
    // Separado del listado principal así si falla no bloquea la lista.
    getSaldoTotal()
      .then(s => setResumenMedio(s.porMedio))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [filtroTipo, mes, anio]);

  const set = k => e => {
    const val = e.target.value;
    setForm(f => {
      const next = {...f,[k]:val};
      if (k==='tipo') next.categoria = val==='ingreso'?'Salario':'Alimentación';
      return next;
    });
  };

  const openNew = () => {
    setEditing(null);
    // Si estamos viendo un mes distinto al actual, la fecha por defecto
    // cae en ese mes (día 1) en vez de "hoy" para no registrar en el mes equivocado
    const fechaDefault = esMesActual
      ? todayLocalStr(hoy)
      : `${anio}-${String(mes).padStart(2,'0')}-01`;
    setForm({ ...initForm, fecha: fechaDefault });
    setModal(true);
  };
  const openEdit = m  => { setEditing(m.id); setForm({tipo:m.tipo,monto:m.monto,categoria:m.categoria,descripcion:m.descripcion||'',fecha:m.fecha,medio_pago:m.medio_pago||'efectivo',banco:m.banco||''}); setModal(true); };

  const submit = async e => {
    e.preventDefault();
    if (!form.monto || parseFloat(form.monto)<=0) return toast.error('El monto debe ser mayor a 0');
    try {
      editing ? await actualizarMovimiento(editing, form) : await crearMovimiento(form);
      toast.success(editing?'Actualizado':'Registrado');
      setModal(false);
      load();
    } catch { toast.error('Error guardando'); }
  };

  const remove = async id => {
    await eliminarMovimiento(id);
    toast.success('Eliminado');
    load();
  };

  const totalIngresos = movs.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+parseFloat(m.monto),0);
  const totalGastos   = movs.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+parseFloat(m.monto),0);

  return (
    <div className="space-y-4 page-enter">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-g-900">Movimientos</h2>
          <p className="text-sm text-g-400">Historial completo, mes a mes</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <i className="ti ti-plus text-sm"/> <span className="hidden md:inline">Registrar</span><span className="md:hidden">Nuevo</span>
        </button>
      </div>

      {/* Navegador de mes — el listado de abajo siempre es de ESTE mes seleccionado */}
      <div className="card p-2.5 flex items-center justify-between">
        <button onClick={()=>navMes(-1)} className="w-8 h-8 rounded-full bg-g-50 flex items-center justify-center active:scale-90 flex-shrink-0">
          <i className="ti ti-chevron-left text-g-700 text-sm"/>
        </button>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-g-900 capitalize">{MESES[mes-1]} {anio}</p>
          {!esMesActual && (
            <button onClick={()=>{ setMes(hoy.getMonth()+1); setAnio(hoy.getFullYear()); }}
              className="text-[10px] text-g-600 underline">Hoy</button>
          )}
        </div>
        <button onClick={()=>navMes(1)} disabled={esMesActual}
          className="w-8 h-8 rounded-full bg-g-50 flex items-center justify-center active:scale-90 disabled:opacity-30 flex-shrink-0">
          <i className="ti ti-chevron-right text-g-700 text-sm"/>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 md:p-4">
          <p className="section-label flex items-center gap-1"><i className="ti ti-arrow-down text-pos text-[11px]"/>Ingresos</p>
          <p className="text-base md:text-xl font-medium text-pos">{fmtShort(totalIngresos)}</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="section-label flex items-center gap-1"><i className="ti ti-arrow-up text-red-500 text-[11px]"/>Gastos</p>
          <p className="text-base md:text-xl font-medium text-red-500">{fmtShort(totalGastos)}</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="section-label flex items-center gap-1"><i className={`ti ${totalIngresos-totalGastos>=0?'ti-trending-up text-pos':'ti-trending-down text-red-500'} text-[11px]`}/>Balance</p>
          <p className={`text-base md:text-xl font-medium ${totalIngresos-totalGastos>=0?'text-pos':'text-red-500'}`}>
            {fmtShort(totalIngresos-totalGastos)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {[['','Todos'],['ingreso','Ingresos'],['gasto','Gastos']].map(([v,l])=>(
          <button key={v} onClick={()=>setFiltroTipo(v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filtroTipo===v?'bg-g-700 text-white border-g-700':'bg-white text-g-500 border-g-200/60'}`}>
            {l}
          </button>
        ))}
        <button onClick={()=>setVerMedios(!verMedios)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ml-auto ${verMedios?'bg-g-700 text-white border-g-700':'bg-white text-g-500 border-g-200/60'}`}>
          <i className="ti ti-wallet text-xs mr-1"/>Medios
        </button>
      </div>

      {verMedios && resumenMedio && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-g-900">Saldo por medio de pago</p>
            <span className="text-[10px] text-g-300">Total acumulado</span>
          </div>
          <div className="space-y-2">
            {Object.entries(resumenMedio).map(([key, d]) => {
              if (!d || (d.ingresos === 0 && d.gastos === 0)) return null;
              const saldo = d.ingresos - d.gastos;
              const label = key === 'efectivo' ? '💵 Efectivo'
                : key === 'transferencia' ? '🏦 Transferencia (total)'
                : (BANCOS.find(b=>b.value===key)?.label || key);
              return (
                <div key={key} className="flex items-center justify-between py-2 border-b border-g-100 last:border-0">
                  <span className="text-sm text-g-700">{label}</span>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${saldo >= 0 ? 'text-pos' : 'text-red-600'}`}>
                      {saldo >= 0 ? '+' : ''}{new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(saldo)}
                    </p>
                    <p className="text-[10px] text-g-400">
                      ↓ {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(d.ingresos)} &nbsp; ↑ {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(d.gastos)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card overflow-hidden divide-y divide-g-100/60">
        {loading ? (
          <div className="flex justify-center items-center h-40"><i className="ti ti-loader animate-spin text-2xl text-g-400"/></div>
        ) : movs.length===0 ? (
          <div className="text-center py-16">
            <i className="ti ti-inbox text-4xl text-g-200 block mb-2"/>
            <p className="text-g-400 text-sm">No hay movimientos</p>
            <button onClick={openNew} className="text-xs text-g-600 underline mt-2 block mx-auto">Registrar el primero</button>
          </div>
        ) : movs.map(m => (
          <MovRow key={m.id} m={m} onEdit={openEdit} onDelete={remove}/>
        ))}
      </div>

      {movs.length > 0 && (
        <p className="text-center text-[11px] text-g-400 md:hidden">
          ← Desliza una fila para eliminar
        </p>
      )}

      {/* Pantalla completa, fuera del flujo normal pero SIN modal flotante */}
      {modal && (
        <FormularioMovimiento
          editing={editing}
          form={form}
          setForm={setForm}
          set={set}
          onCancel={() => setModal(false)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
