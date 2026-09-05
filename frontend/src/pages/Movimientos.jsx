import { useEffect, useState, useRef } from 'react';
import { getMovimientos, crearMovimiento, actualizarMovimiento, eliminarMovimiento, getSaldoTotal, getMediosPagoTarjeta, getPrestamos, crearPrestamo, abonarPrestamo } from '../utils/api';
import { fmtDate, fmtShort, todayLocalStr, CATEGORIAS_ICONOS, CATEGORIAS_COLORES, BANCOS, labelMedioPago } from '../utils/helpers';
import PantallaCompleta from '../components/PantallaCompleta';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/confirm';
import Icon from '../utils/icons';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CATS_GASTO   = ['Alimentación','Transporte','Servicios','Salud','Educación','Entretenimiento','Ropa','Vivienda','Deudas','Ahorro','Préstamos','Otro'];
const CATS_INGRESO = ['Salario','Freelance','Negocio','Rendimiento','Préstamos','Otro'];
const initForm = { tipo:'gasto', monto:'', categoria:'Alimentación', descripcion:'', fecha: todayLocalStr(), medio_pago: 'efectivo', banco: '', num_cuotas: '' };

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
    <div className="relative overflow-hidden group">
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-r-xl md:hidden">
        <button onClick={() => onDelete(m.id)} className="text-white flex flex-col items-center gap-0.5">
          <Icon name="trash" className="w-5 h-5"/>
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
          <Icon name={CATEGORIAS_ICONOS[m.categoria]||'ti-tag'} className="w-4 h-4"/>
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
        {/* Borrar en desktop — el swipe táctil de arriba no existe con
            mouse, así que sin esto no había NINGUNA forma de eliminar un
            movimiento desde el PC. Aparece al pasar el mouse por la fila,
            junto al chevron que ya existía. stopPropagation para que no
            dispare también el onClick de editar de la fila. */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
          className="hidden md:flex w-6 h-6 rounded-lg items-center justify-center text-g-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
          title="Eliminar movimiento"
        >
          <Icon name="trash" className="w-3.5 h-3.5"/>
        </button>
        <Icon name="chevron-right" className="w-3 h-3 text-g-300 hidden md:block flex-shrink-0"/>
      </div>
    </div>
  );
}

// ── PANTALLA COMPLETA para crear/editar — NO es un modal flotante.
// Se renderiza como una página normal, sin position:fixed ni overflow
// especiales. Esto evita por completo los bugs de scroll táctil de iOS
// que afectan a los modales superpuestos.
function FormularioMovimiento({ editing, form, setForm, set, onCancel, onSubmit, mediosPagoTarjeta, prestamosActivos, prestamoDestinoId, setPrestamoDestinoId, nombrePrestamo, setNombrePrestamo }) {
  const medioActual = form.medio_pago === 'transferencia' ? form.banco : form.medio_pago;
  const esConTarjeta = form.tipo === 'gasto' && mediosPagoTarjeta?.has(medioActual);
  // La categoría "Préstamos" no es solo una etiqueta más — al elegirla en
  // un movimiento NUEVO (no al editar uno existente), se conecta con el
  // sistema real de préstamos: un gasto crea un préstamo nuevo dado, un
  // ingreso se vincula a uno existente como pago recibido. Así ese
  // movimiento aparece automáticamente en la ventana de Préstamos, en vez
  // de quedar suelto con la categoría pero desconectado de todo.
  const esPrestamoNuevo = !editing && form.categoria === 'Préstamos';
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
        {esPrestamoNuevo && form.tipo === 'gasto' && (
          <div className="card p-3 bg-blue-50 border-blue-100">
            <label className="section-label block mb-1">¿A quién le prestas?</label>
            <input className="input" placeholder="Ej: Juan Pérez" value={nombrePrestamo} onChange={e=>setNombrePrestamo(e.target.value)} required/>
            <p className="text-[11px] text-blue-700/70 mt-1.5">Esto crea un préstamo nuevo — lo vas a ver en la sección Préstamos con su progreso.</p>
          </div>
        )}
        {esPrestamoNuevo && form.tipo === 'ingreso' && (
          <div className="card p-3 bg-blue-50 border-blue-100">
            <label className="section-label block mb-1">¿De cuál préstamo te pagaron?</label>
            {prestamosActivos.length === 0 ? (
              <p className="text-xs text-blue-700/80">No tienes préstamos activos todavía. Primero registra uno como gasto con esta misma categoría.</p>
            ) : (
              <select className="select" value={prestamoDestinoId} onChange={e=>setPrestamoDestinoId(e.target.value)} required>
                <option value="" disabled>Elige el préstamo</option>
                {prestamosActivos.map(p => <option key={p.id} value={p.id}>{p.nombre} (falta {fmtShort(parseFloat(p.monto_total)-parseFloat(p.monto_recibido))})</option>)}
              </select>
            )}
          </div>
        )}
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
        {esConTarjeta && (
          <div className="card p-3 bg-g-50">
            <label className="section-label block mb-1 flex items-center gap-1.5"><Icon name="credit-card" className="w-3.5 h-3.5"/> ¿A cuántas cuotas? <span className="text-g-300">(opcional)</span></label>
            <input type="number" min="1" max="60" className="input" placeholder="1 = de contado"
              value={form.num_cuotas} onChange={set('num_cuotas')}/>
            <p className="text-[11px] text-g-400 mt-1">El total se suma completo a la tarjeta ahora — esto es solo para acordarte en cuántas cuotas quedó.</p>
          </div>
        )}
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
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [resumenMedio, setResumenMedio] = useState(null);
  const [verMedios, setVerMedios] = useState(false);
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mediosPagoTarjeta, setMediosPagoTarjeta] = useState(new Set());
  const [prestamosActivos, setPrestamosActivos] = useState([]);
  const [prestamoDestinoId, setPrestamoDestinoId] = useState('');
  const [nombrePrestamo, setNombrePrestamo] = useState('');

  useEffect(() => { getMediosPagoTarjeta().then(setMediosPagoTarjeta).catch(()=>{}); }, []);

  useEffect(() => {
    if (!editing && form.categoria === 'Préstamos' && form.tipo === 'ingreso') {
      getPrestamos().then(all => setPrestamosActivos(all.filter(p => p.activo))).catch(() => {});
    }
  }, [form.categoria, form.tipo, editing]);

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
    setNombrePrestamo('');
    setPrestamoDestinoId('');
    // Si estamos viendo un mes distinto al actual, la fecha por defecto
    // cae en ese mes (día 1) en vez de "hoy" para no registrar en el mes equivocado
    const fechaDefault = esMesActual
      ? todayLocalStr(hoy)
      : `${anio}-${String(mes).padStart(2,'0')}-01`;
    setForm({ ...initForm, fecha: fechaDefault });
    setModal(true);
  };
  const openEdit = m => {
    setEditing(m.id);
    const esEfectivo = (m.medio_pago || 'efectivo') === 'efectivo';
    setForm({
      tipo: m.tipo, monto: m.monto, categoria: m.categoria, descripcion: m.descripcion || '', fecha: m.fecha,
      medio_pago: esEfectivo ? 'efectivo' : 'transferencia',
      banco: esEfectivo ? '' : m.medio_pago,
      num_cuotas: '',
    });
    setModal(true);
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.monto || parseFloat(form.monto)<=0) return toast.error('El monto debe ser mayor a 0');
    const medioFinal = form.medio_pago === 'transferencia' ? form.banco : form.medio_pago;
    const esPrestamoNuevo = !editing && form.categoria === 'Préstamos';

    try {
      if (esPrestamoNuevo && form.tipo === 'gasto') {
        if (!nombrePrestamo.trim()) return toast.error('Escribe a quién le prestas');
        await crearPrestamo({ nombre: nombrePrestamo.trim(), monto_total: form.monto, fecha: form.fecha, medio_pago: medioFinal });
        toast.success('Préstamo registrado — ya aparece en Préstamos');
      } else if (esPrestamoNuevo && form.tipo === 'ingreso') {
        if (!prestamoDestinoId) return toast.error('Elige a cuál préstamo corresponde este pago');
        const prestamo = prestamosActivos.find(p => p.id === prestamoDestinoId);
        await abonarPrestamo(prestamo, form.monto, medioFinal, form.fecha);
        toast.success('Pago registrado en el préstamo');
      } else {
        editing ? await actualizarMovimiento(editing, form) : await crearMovimiento(form);
        toast.success(editing?'Actualizado':'Registrado');
      }
      setModal(false);
      load();
    } catch { toast.error('Error guardando'); }
  };

  const remove = id => {
    confirmToast('¿Eliminar este movimiento?', async () => {
      await eliminarMovimiento(id);
      toast.success('Eliminado');
      load();
    });
  };

  const totalIngresos = movs.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+parseFloat(m.monto),0);
  const totalGastos   = movs.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+parseFloat(m.monto),0);

  // Búsqueda + categoría se filtran en el cliente sobre lo ya cargado del
  // mes (el tipo sí va al servidor en `load()`, porque cambia la consulta).
  const movsFiltrados = movs.filter(m => {
    if (filtroCategoria && m.categoria !== filtroCategoria) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      if (!(m.descripcion||'').toLowerCase().includes(q) && !m.categoria.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const todasCategorias = [...new Set([...CATS_GASTO, ...CATS_INGRESO])];

  const exportarCSV = () => {
    if (movs.length === 0) return toast.error('No hay movimientos este mes para exportar');
    const headers = 'Fecha,Tipo,Monto,Categoria,Descripcion,Medio de pago\n';
    const rows = movs.map(m =>
      `"${m.fecha}","${m.tipo}","${m.monto}","${m.categoria}","${(m.descripcion||'').replace(/"/g,'""')}","${labelMedioPago(m.medio_pago||'efectivo')}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_${MESES[mes-1].toLowerCase()}_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV descargado');
  };

  return (
    <div className="space-y-4 page-enter">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-g-900">Movimientos</h2>
          <p className="text-sm text-g-400">Historial completo, mes a mes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarCSV} title="Exportar CSV"
            className="btn-secondary w-10 h-10 !p-0 flex-shrink-0">
            <Icon name="download" className="w-3.5 h-3.5"/>
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Icon name="plus" className="w-3.5 h-3.5"/> <span className="hidden md:inline">Registrar</span><span className="md:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Navegador de mes — el listado de abajo siempre es de ESTE mes seleccionado */}
      <div className="card p-2.5 flex items-center justify-between">
        <button onClick={()=>navMes(-1)} className="w-8 h-8 rounded-full bg-g-50 flex items-center justify-center active:scale-90 flex-shrink-0">
          <Icon name="chevron-left" className="w-3.5 h-3.5 text-g-700"/>
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
          <Icon name="chevron-right" className="w-3.5 h-3.5 text-g-700"/>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 md:p-4">
          <p className="section-label flex items-center gap-1"><Icon name="arrow-down" className="w-3 h-3 text-pos"/>Ingresos</p>
          <p className="text-base md:text-xl font-medium text-pos">{fmtShort(totalIngresos)}</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="section-label flex items-center gap-1"><Icon name="arrow-up" className="w-3 h-3 text-red-500"/>Gastos</p>
          <p className="text-base md:text-xl font-medium text-red-500">{fmtShort(totalGastos)}</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="section-label flex items-center gap-1"><Icon name={totalIngresos-totalGastos>=0?'trending-up':'trending-down'} className={`w-3 h-3 ${totalIngresos-totalGastos>=0?'text-pos':'text-red-500'}`}/>Balance</p>
          <p className={`text-base md:text-xl font-medium ${totalIngresos-totalGastos>=0?'text-pos':'text-red-500'}`}>
            {fmtShort(totalIngresos-totalGastos)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="w-3.5 h-3.5 text-g-300 absolute left-3 top-1/2 -translate-y-1/2"/>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            placeholder="Buscar por descripción o categoría..."
            className="input pl-9 text-xs py-2"/>
        </div>
        <select value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)}
          className="select text-xs py-2 w-40 flex-shrink-0">
          <option value="">Todas las categorías</option>
          {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
          <Icon name="wallet" className="w-3 h-3 mr-1"/>Medios
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
          <div className="flex justify-center items-center h-40"><Icon name="loader" className="w-6 h-6 animate-spin text-g-400"/></div>
        ) : movsFiltrados.length===0 ? (
          <div className="text-center py-16">
            <Icon name="inbox" className="w-8 h-8 text-g-200 block mx-auto mb-2"/>
            <p className="text-g-400 text-sm">{movs.length===0 ? 'No hay movimientos' : 'Nada coincide con el filtro'}</p>
            {movs.length===0
              ? <button onClick={openNew} className="text-xs text-g-600 underline mt-2 block mx-auto">Registrar el primero</button>
              : <button onClick={()=>{setBusqueda('');setFiltroCategoria('');}} className="text-xs text-g-600 underline mt-2 block mx-auto">Limpiar filtros</button>}
          </div>
        ) : movsFiltrados.map(m => (
          <MovRow key={m.id} m={m} onEdit={openEdit} onDelete={remove}/>
        ))}
      </div>

      {movsFiltrados.length > 0 && (
        <p className="text-center text-[11px] text-g-400">
          {movsFiltrados.length} {movsFiltrados.length===1?'movimiento':'movimientos'}
          {(busqueda || filtroCategoria) && ` de ${movs.length}`}
          <span className="md:hidden"> · Desliza una fila para eliminar</span>
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
          mediosPagoTarjeta={mediosPagoTarjeta}
          prestamosActivos={prestamosActivos}
          prestamoDestinoId={prestamoDestinoId}
          setPrestamoDestinoId={setPrestamoDestinoId}
          nombrePrestamo={nombrePrestamo}
          setNombrePrestamo={setNombrePrestamo}
        />
      )}
    </div>
  );
}
