import { useEffect, useState } from 'react';
import { getActivos, crearActivo, eliminarActivo,
         getDeudas, crearDeuda, actualizarDeuda, eliminarDeuda,
         getDeudaMovimientos, crearDeudaMovimiento, actualizarDeudaMovimiento, eliminarDeudaMovimiento,
         getPagosProgramados, crearPagoProgramado, eliminarPagoProgramado,
         getMetas, crearMeta, actualizarMeta, eliminarMeta,
         registrarRendimientoActivo } from '../utils/api';
import { fmt, fmtDate, fmtShort, todayLocalStr, BANCOS } from '../utils/helpers';
import PantallaCompleta from '../components/PantallaCompleta';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/confirm';
import Ring from '../components/Ring';

const TIPOS_ACTIVO = ['Efectivo','Cuenta bancaria','Inversión','CDT','Vehículo','Inmueble','Negocio','Préstamo otorgado','Otro'];
const TIPOS_DEUDA  = ['Tarjeta de crédito','Crédito bancario','Préstamo personal','Hipoteca','Gota a gota','Otro'];
const ICONOS_META  = ['ti-target','ti-plane','ti-home','ti-device-laptop','ti-car','ti-heart','ti-shield','ti-coin'];
const TIPOS_REND   = [
  { value:'manual',         label:'Manual',               desc:'Actualizo el valor yo mismo' },
  { value:'fija_capital',   label:'Fijo sobre capital',   desc:'Ej: préstamo que paga % fijo del capital inicial' },
  { value:'fija_compuesto', label:'Tasa fija compuesto',  desc:'Ej: CDT, reinversión automática' },
  { value:'variable',       label:'Variable / irregular', desc:'Ingresos variables en fechas distintas' },
];

// Ícono + color por tipo de activo — reemplaza el badge de texto plano
// por un chip visual, mismo patrón que las categorías de gasto en el
// resto de la app (identidad reconocible de un vistazo).
const TIPO_ACTIVO_VISUAL = {
  'Efectivo':           { icon:'ti-cash',           color:'#16A34A' }, // = pos
  'Cuenta bancaria':    { icon:'ti-building-bank',  color:'#4E7AA8' }, // = accent.azul
  'Inversión':          { icon:'ti-trending-up',    color:'#C9A84C' }, // = gold
  'CDT':                { icon:'ti-certificate',    color:'#5B6472' }, // = accent.pizarra
  'Vehículo':           { icon:'ti-car',            color:'#7C7594' }, // = accent.violeta
  'Inmueble':           { icon:'ti-home',           color:'#5B6472' }, // = accent.pizarra (mismo que Vivienda en categorías)
  'Negocio':            { icon:'ti-briefcase',      color:'#A8792E' }, // = accent.bronce
  'Préstamo otorgado':  { icon:'ti-arrow-up-right', color:'#B8663F' }, // = accent.terracota
  'Otro':               { icon:'ti-dots',           color:'#8A93A6' }, // = g-400
};

// Anillo de progreso — ver components/Ring.jsx

// ─── ACTIVOS ────────────────────────────────────────────
export function Activos() {
  const [items, setItems]         = useState([]);
  const [modal, setModal]         = useState(false);
  const [modalRend, setModalRend] = useState(null);
  const [rendMonto, setRendMonto] = useState('');
  const [rendFecha, setRendFecha] = useState(todayLocalStr());
  const [form, setForm] = useState({
    nombre:'', tipo:'Inversión', valor_inicial:'', valor_actual:'',
    fecha_adquisicion:'', descripcion:'', tasa_rendimiento:'', tipo_rendimiento:'manual'
  });
  const set = k => e => setForm(f=>({...f,[k]:String(e.target.value).replace(',','.')}));
  const load = () => getActivos().then(setItems).catch(()=>toast.error('Error cargando activos'));
  useEffect(()=>{ load(); },[]);

  const rendEst = (a) => {
    const tasa = parseFloat(a.tasa_rendimiento);
    if (!tasa) return 0;
    if (a.tipo_rendimiento==='fija_capital')   return parseFloat(a.valor_inicial||a.valor_actual) * (tasa/100);
    if (a.tipo_rendimiento==='fija_compuesto') return parseFloat(a.valor_actual) * (tasa/100/12);
    return 0;
  };

  const submit = async e => {
    e.preventDefault();
    try {
      await crearActivo({
        ...form,
        valor_inicial: parseFloat(String(form.valor_inicial).replace(',','.')),
        valor_actual:  parseFloat(String(form.valor_actual||form.valor_inicial).replace(',','.')),
        tasa_rendimiento: (form.tipo_rendimiento==='manual'||form.tipo_rendimiento==='variable')
          ? null
          : (parseFloat(String(form.tasa_rendimiento).replace(',','.')) || null),
      });
      toast.success('Activo registrado');
      setModal(false);
      setForm({nombre:'',tipo:'Inversión',valor_inicial:'',valor_actual:'',fecha_adquisicion:'',descripcion:'',tasa_rendimiento:'',tipo_rendimiento:'manual'});
      load();
    } catch(err) { toast.error('Error guardando'); console.error(err); }
  };

  const registrarRend = async () => {
    if (!rendMonto || parseFloat(rendMonto)<=0) return toast.error('Ingresa un monto válido');
    try {
      await registrarRendimientoActivo({ activo_id: modalRend.id, rendimiento_monto: parseFloat(String(rendMonto).replace(',','.')), fecha: rendFecha });
      toast.success('Rendimiento registrado 📈');
      setModalRend(null); setRendMonto('');
      load();
    } catch { toast.error('Error registrando rendimiento'); }
  };

  const del = id => {
    confirmToast('¿Eliminar este activo?', async () => {
      await eliminarActivo(id); toast.success('Eliminado'); load();
    });
  };

  const total    = items.reduce((a,i)=>a+parseFloat(i.valor_actual),0);
  const rendTotal = items.reduce((a,i)=>a+rendEst(i),0);

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-medium text-g-900">Activos</h2><p className="text-sm text-g-400">Todo lo que tienes y vale</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-plus text-sm"/> Agregar</button>
      </div>

      <div className="relative overflow-hidden bg-g-800 rounded-2xl p-4 text-white">
        <div className="card-premium-glow -top-10 -right-10 w-36 h-36 bg-gold opacity-[0.12]"/>
        <div className="relative flex justify-between items-start">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Total activos</p>
            <p className="text-3xl font-medium">{fmt(total)}</p>
            <p className="text-white/30 text-xs mt-1">{items.length} activo{items.length!==1?'s':''}</p>
          </div>
          {rendTotal > 0 && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Rend. mensual est.</p>
              <p className="text-xl font-medium text-gold flex items-center gap-1 justify-end">
                <i className="ti ti-trending-up text-sm"/>{fmt(rendTotal)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.length===0 && (
          <div className="card col-span-2 p-12 text-center">
            <i className="ti ti-building-bank text-4xl text-g-200 block mb-2"/>
            <p className="text-g-400 text-sm">No tienes activos registrados</p>
          </div>
        )}
        {items.map(a=>{
          const g    = parseFloat(a.valor_actual)-parseFloat(a.valor_inicial);
          const rend = rendEst(a);
          const tipoRend = TIPOS_REND.find(t=>t.value===a.tipo_rendimiento);
          const visual = TIPO_ACTIVO_VISUAL[a.tipo] || TIPO_ACTIVO_VISUAL['Otro'];
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: visual.color + '18', color: visual.color }}>
                    <i className={`ti ${visual.icon} text-base`}/>
                  </div>
                  <div>
                    <p className="font-medium text-g-900">{a.nombre}</p>
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: visual.color + '18', color: visual.color }}>{a.tipo}</span>
                      {tipoRend && tipoRend.value!=='manual' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold">{tipoRend.label}</span>
                      )}
                      {(a.tipo_rendimiento==='fija_capital'||a.tipo_rendimiento==='fija_compuesto') && a.tasa_rendimiento>0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-g-100 text-g-600">
                          {a.tasa_rendimiento}%{a.tipo_rendimiento==='fija_compuesto'?' EA':'/mes'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={()=>del(a.id)} className="text-g-300 hover:text-red-500 p-1"><i className="ti ti-trash text-sm"/></button>
              </div>
              <p className="text-2xl font-medium text-g-900">{fmt(a.valor_actual)}</p>
              <p className={`text-xs mt-0.5 ${g>=0?'text-g-500':'text-red-500'}`}>{g>=0?'+':''}{fmt(g)} vs capital inicial</p>
              {rend>0 && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-xs text-gold">≈ +{fmt(rend)}/mes</span>
                  {a.tipo_rendimiento==='fija_capital' && <span className="text-[10px] text-g-400">(sobre capital inicial)</span>}
                </div>
              )}
              {a.tipo_rendimiento==='variable' && <p className="text-xs text-g-400 mt-1">Ingresos variables — registra cada rendimiento</p>}
              <button onClick={()=>{ setModalRend(a); setRendMonto(rend>0?Math.round(rend).toString():''); setRendFecha(todayLocalStr()); }}
                className="w-full btn-secondary text-xs py-2 mt-3 flex items-center justify-center gap-1">
                <i className="ti ti-trending-up text-xs"/> Registrar rendimiento
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal rendimiento */}
      {modalRend && (
        <PantallaCompleta title={`Rendimiento: ${modalRend.nombre}`} onClose={()=>{setModalRend(null);setRendMonto('');}}>
          <div className="space-y-4">
            <div className="card p-4 bg-g-50">
              <p className="section-label mb-1">Valor actual</p>
              <p className="text-2xl font-medium text-g-900">{fmt(modalRend.valor_actual)}</p>
              {rendEst(modalRend)>0 && <p className="text-xs text-gold mt-1">Estimado: {fmt(rendEst(modalRend))}/mes</p>}
            </div>
            <div>
              <label className="section-label block mb-1">Monto del rendimiento (COP)</label>
              <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
                value={rendMonto} onChange={e=>setRendMonto(e.target.value.replace(',','.'))}/>
              <p className="text-xs text-g-400 mt-1">Se sumará al valor del activo y se registrará como ingreso</p>
            </div>
            <div>
              <label className="section-label block mb-1">Fecha</label>
              <input type="date" className="input" value={rendFecha} onChange={e=>setRendFecha(e.target.value)}/>
            </div>
            {modalRend.tipo_rendimiento==='variable' && (
              <p className="text-xs text-g-500 card p-3 bg-g-50">Activo con ingresos variables — registra cada vez que lo recibes.</p>
            )}
            <button onClick={registrarRend} className="btn-primary w-full py-4">Registrar rendimiento 📈</button>
            <button onClick={()=>{setModalRend(null);setRendMonto('');}} className="btn-secondary w-full py-3.5">Cancelar</button>
          </div>
        </PantallaCompleta>
      )}

      {/* Modal nuevo activo */}
      {modal && (
        <PantallaCompleta title="Nuevo activo" onClose={()=>setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="section-label block mb-1">Nombre del activo</label>
              <input className="input" placeholder="Ej: CDT Bancolombia, Préstamo a Juan..." value={form.nombre} onChange={set('nombre')} required/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="section-label block mb-1">Tipo</label>
                <select className="select" value={form.tipo} onChange={set('tipo')}>{TIPOS_ACTIVO.map(t=><option key={t}>{t}</option>)}</select>
              </div>
              <div>
                <label className="section-label block mb-1">Fecha adquisición</label>
                <input type="date" className="input" value={form.fecha_adquisicion} onChange={set('fecha_adquisicion')}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="section-label block mb-1">Capital inicial</label>
                <input type="text" inputMode="numeric" className="input" placeholder="0" value={form.valor_inicial} onChange={set('valor_inicial')} required/>
              </div>
              <div>
                <label className="section-label block mb-1">Valor actual</label>
                <input type="text" inputMode="numeric" className="input" placeholder="= capital" value={form.valor_actual} onChange={set('valor_actual')}/>
              </div>
            </div>
            <div>
              <label className="section-label block mb-2">Tipo de rendimiento</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {value:'manual',         icon:'ti-pencil',       label:'Manual',          sub:'Actualizo yo'},
                  {value:'fija_capital',   icon:'ti-coin',         label:'Fijo s/ capital', sub:'% capital inicial'},
                  {value:'fija_compuesto', icon:'ti-trending-up',  label:'Compuesto',       sub:'Reinversión'},
                  {value:'variable',       icon:'ti-arrows-random',label:'Variable',         sub:'Fechas distintas'},
                ].map(t=>(
                  <button key={t.value} type="button"
                    onClick={()=>setForm(f=>({...f,tipo_rendimiento:t.value,tasa_rendimiento:''}))}
                    className={`flex flex-col items-start p-3 rounded-xl border transition-all ${form.tipo_rendimiento===t.value?'bg-g-50 border-g-400':'bg-white border-g-200/60'}`}>
                    <i className={`ti ${t.icon} text-base mb-1 ${form.tipo_rendimiento===t.value?'text-g-700':'text-g-400'}`}/>
                    <p className={`text-xs font-medium leading-tight ${form.tipo_rendimiento===t.value?'text-g-800':'text-g-600'}`}>{t.label}</p>
                    <p className="text-[10px] text-g-400 leading-tight mt-0.5">{t.sub}</p>
                  </button>
                ))}
              </div>
            </div>
            {(form.tipo_rendimiento==='fija_capital'||form.tipo_rendimiento==='fija_compuesto') && (
              <div>
                <label className="section-label block mb-1">
                  {form.tipo_rendimiento==='fija_capital' ? 'Tasa mensual (%)' : 'Tasa anual EA (%)'}
                </label>
                <input type="text" inputMode="decimal" className="input"
                  placeholder={form.tipo_rendimiento==='fija_capital' ? 'Ej: 2.5' : 'Ej: 12.5'}
                  value={form.tasa_rendimiento} onChange={set('tasa_rendimiento')}/>
                {form.tipo_rendimiento==='fija_capital' && form.tasa_rendimiento && form.valor_inicial && (
                  <p className="text-xs text-gold mt-1">= {fmt(parseFloat(form.valor_inicial) * parseFloat(form.tasa_rendimiento)/100)} fijos/mes</p>
                )}
                {form.tipo_rendimiento==='fija_compuesto' && form.tasa_rendimiento && form.valor_inicial && (
                  <p className="text-xs text-gold mt-1">≈ {fmt(parseFloat(form.valor_actual||form.valor_inicial) * parseFloat(form.tasa_rendimiento)/100/12)}/mes</p>
                )}
              </div>
            )}
            <div className="flex gap-2 pb-4">
              <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Guardar activo</button>
            </div>
          </form>
        </PantallaCompleta>
      )}
    </div>
  );
}


// Tipo de movimiento del historial de una deuda → ícono/color/signo.
// Reusa los mismos tokens que el resto de la app: abono = pos (reduce lo
// que debes, igual que cualquier "dinero a favor"), interés/mora = cargos
// que SUMAN a lo que debes.
const MOV_DEUDA_VISUAL = {
  abono:   { label: 'Abono',   icon: 'ti-cash-banknote',   color: '#16A34A', signo: '−' },
  interes: { label: 'Interés', icon: 'ti-percentage',      color: '#A8792E', signo: '+' },
  mora:    { label: 'Mora',    icon: 'ti-alert-triangle',  color: '#E5484D', signo: '+' },
};

export function Deudas() {
  const [items, setItems]       = useState([]);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState({nombre:'',tipo:'Tarjeta de crédito',monto_total:'',tasa_interes:'',fecha_limite:'',interes_mensual_monto:''});
  const set = k => e => setForm(f=>({...f,[k]:String(e.target.value).replace(',','.')}));
  const load = () => getDeudas().then(setItems).catch(()=>toast.error('Error cargando deudas'));
  useEffect(()=>{load();},[]);

  // ── Detalle de una deuda: historial, pago programado, etc. ──
  const [detalle, setDetalle]           = useState(null);   // deuda seleccionada, o null
  const [movimientos, setMovimientos]   = useState([]);
  const [pagoProgramado, setPagoProgramado] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [modalMov, setModalMov]         = useState(null);   // {id?, tipo, monto, fecha, nota}
  const [formEditar, setFormEditar]     = useState(null);   // editar datos de la deuda
  const [modalProgramar, setModalProgramar] = useState(false);
  const [formProgramar, setFormProgramar] = useState({ monto:'', dia_mes:1, medio_pago:'bancolombia' });

  const submit = async e => {
    e.preventDefault();
    try {
      await crearDeuda(form);
      toast.success('Deuda registrada'); setModal(false);
      setForm({nombre:'',tipo:'Tarjeta de crédito',monto_total:'',tasa_interes:'',fecha_limite:'',interes_mensual_monto:''});
      load();
    } catch { toast.error('Error guardando'); }
  };

  const del = id => confirmToast('¿Eliminar esta deuda? También se borra todo su historial.', async () => {
    await eliminarDeuda(id); toast.success('Eliminada');
    if (detalle?.id === id) setDetalle(null);
    load();
  });

  const totalDeuda = items.filter(d=>d.activa).reduce((a,d)=>a+(parseFloat(d.monto_total)-parseFloat(d.monto_pagado)),0);

  const abrirDetalle = async (d) => {
    setDetalle(d); setLoadingDetalle(true);
    try {
      const [movs, pagos] = await Promise.all([getDeudaMovimientos(d.id), getPagosProgramados()]);
      setMovimientos(movs);
      setPagoProgramado(pagos.find(p => p.deuda_id === d.id && p.activo) || null);
    } catch { toast.error('Error cargando el detalle'); }
    finally { setLoadingDetalle(false); }
  };

  const refrescarDetalle = async (deudaId) => {
    const actualizada = await getDeudas();
    setItems(actualizada);
    const d = actualizada.find(x => x.id === deudaId);
    setDetalle(d || null);
    if (d) setMovimientos(await getDeudaMovimientos(d.id));
  };

  const abrirNuevoMov = (tipo) => setModalMov({
    tipo, monto: tipo === 'interes' && detalle.interes_mensual_monto ? String(detalle.interes_mensual_monto) : '',
    fecha: todayLocalStr(), nota: '',
  });
  const abrirEditarMov = (m) => setModalMov({ id: m.id, tipo: m.tipo, monto: String(m.monto), fecha: m.fecha, nota: m.nota || '' });

  const guardarMov = async () => {
    const monto = parseFloat(String(modalMov.monto).replace(',','.'));
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    try {
      if (modalMov.id) {
        await actualizarDeudaMovimiento(modalMov.id, { tipo: modalMov.tipo, monto, fecha: modalMov.fecha, nota: modalMov.nota });
        toast.success('Movimiento actualizado');
      } else {
        await crearDeudaMovimiento({ deuda_id: detalle.id, tipo: modalMov.tipo, monto, fecha: modalMov.fecha, nota: modalMov.nota });
        toast.success(modalMov.tipo === 'abono' ? 'Abono registrado' : 'Movimiento registrado');
      }
      const id = detalle.id;
      setModalMov(null);
      refrescarDetalle(id);
    } catch { toast.error('Error guardando el movimiento'); }
  };

  const borrarMov = (m) => confirmToast('¿Eliminar este movimiento del historial?', async () => {
    const id = detalle.id;
    await eliminarDeudaMovimiento(m.id);
    toast.success('Eliminado');
    refrescarDetalle(id);
  });

  const abrirEditarDeuda = () => setFormEditar({
    nombre: detalle.nombre, tipo: detalle.tipo,
    tasa_interes: detalle.tasa_interes ?? '', fecha_limite: detalle.fecha_limite ?? '',
    interes_mensual_monto: detalle.interes_mensual_monto ?? '',
  });

  const guardarEditarDeuda = async e => {
    e.preventDefault();
    try {
      await actualizarDeuda(detalle.id, formEditar);
      toast.success('Deuda actualizada');
      const id = detalle.id;
      setFormEditar(null);
      refrescarDetalle(id);
    } catch { toast.error('Error actualizando'); }
  };

  const guardarProgramarPago = async e => {
    e.preventDefault();
    const monto = parseFloat(String(formProgramar.monto).replace(',','.'));
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    try {
      await crearPagoProgramado({
        nombre: `Cuota: ${detalle.nombre}`, monto, categoria: 'Deudas',
        dia_mes: formProgramar.dia_mes, medio_pago: formProgramar.medio_pago,
        activo: true, deuda_id: detalle.id,
      });
      toast.success('Pago programado — se abonará solo cada mes 🎉');
      setModalProgramar(false);
      const pagos = await getPagosProgramados();
      setPagoProgramado(pagos.find(p => p.deuda_id === detalle.id && p.activo) || null);
    } catch { toast.error('Error programando el pago'); }
  };

  const cancelarProgramacion = () => confirmToast('¿Cancelar el pago automático de esta deuda?', async () => {
    await eliminarPagoProgramado(pagoProgramado.id);
    setPagoProgramado(null);
    toast.success('Pago automático cancelado');
  });

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-medium text-g-900">Deudas</h2><p className="text-sm text-g-400">Lo que debes y cómo vas pagando</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-plus text-sm"/> Agregar</button>
      </div>
      <div className="relative overflow-hidden bg-red-700 rounded-2xl p-4 text-white">
        <div className="card-premium-glow -top-10 -right-10 w-36 h-36 bg-white opacity-[0.06]"/>
        <p className="relative text-[10px] uppercase tracking-widest text-red-200 mb-1">Deuda total activa</p>
        <p className="relative text-3xl font-medium">{fmt(totalDeuda)}</p>
        <p className="relative text-white/40 text-xs mt-1">{items.filter(d=>d.activa).length} deuda{items.filter(d=>d.activa).length!==1?'s':''} activa{items.filter(d=>d.activa).length!==1?'s':''}</p>
      </div>
      <div className="space-y-3">
        {items.length===0 && <div className="card p-12 text-center"><i className="ti ti-credit-card text-4xl text-g-200 block mb-2"/><p className="text-g-400 text-sm">¡Sin deudas registradas! 🎉</p></div>}
        {items.map(d=>{
          const pendiente = parseFloat(d.monto_total)-parseFloat(d.monto_pagado);
          const pct = Math.round((parseFloat(d.monto_pagado)/parseFloat(d.monto_total))*100);
          const colorProgreso = pct >= 100 ? '#16A34A' : pct >= 66 ? '#4F8F76' : pct >= 33 ? '#C9A84C' : '#8A93A6';
          return (
            <button key={d.id} onClick={()=>abrirDetalle(d)}
              className={`card p-4 w-full text-left active:scale-[0.99] transition-transform ${!d.activa?'opacity-60':''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-g-900">{d.nombre}</p>
                    {!d.activa && <span className="badge-ok text-[10px]">Pagada ✓</span>}
                  </div>
                  <p className="text-[11px] text-g-400">
                    {d.tipo}{d.tasa_interes>0?` · ${d.tasa_interes}% EA`:''}{d.interes_mensual_monto>0?` · +${fmtShort(d.interes_mensual_monto)}/mes`:''}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-g-300">
                  <i className="ti ti-chevron-right text-sm"/>
                </div>
              </div>
              <div className="flex justify-between text-xs text-g-500 mb-2">
                <span>Pagado: {fmtShort(d.monto_pagado)}</span>
                <span className="text-red-600 font-medium">Pendiente: {fmtShort(pendiente)}</span>
              </div>
              <div className="h-2.5 bg-g-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{width:`${pct}%`, background: colorProgreso}}/>
              </div>
              <p className="text-[10px] mt-1 font-medium" style={{ color: colorProgreso }}>{pct}% pagado</p>
            </button>
          );
        })}
      </div>

      {/* Nueva deuda */}
      {modal && (
      <PantallaCompleta title="Nueva deuda" onClose={()=>setModal(false)}>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Nombre de la deuda" value={form.nombre} onChange={set('nombre')} required/>
          <select className="select" value={form.tipo} onChange={set('tipo')}>{TIPOS_DEUDA.map(t=><option key={t}>{t}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Monto total</label><input type="text" inputMode="numeric" className="input" placeholder="0" value={form.monto_total} onChange={set('monto_total')} required/></div>
            <div><label className="section-label block mb-1">Tasa EA (%)</label><input type="text" inputMode="decimal" className="input" placeholder="0" value={form.tasa_interes} onChange={set('tasa_interes')}/></div>
          </div>
          <div>
            <label className="section-label block mb-1">Interés mensual fijo (opcional)</label>
            <input type="text" inputMode="numeric" className="input" placeholder="Ej: 45.000 — si te cobran un interés fijo aparte cada mes" value={form.interes_mensual_monto} onChange={set('interes_mensual_monto')}/>
          </div>
          <input type="date" className="input" value={form.fecha_limite} onChange={set('fecha_limite')}/>
          <div className="flex gap-2 pt-2 pb-4">
            <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </PantallaCompleta>
      )}

      {/* Detalle de una deuda: resumen + historial completo + acciones */}
      {detalle && (
        <PantallaCompleta title={detalle.nombre} onClose={()=>setDetalle(null)}>
          {loadingDetalle ? (
            <div className="flex justify-center py-12"><i className="ti ti-loader animate-spin text-2xl text-g-300"/></div>
          ) : (
          <div className="space-y-4 pb-4">
            {/* Resumen */}
            <div className="card p-4 bg-g-50">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="section-label">Capital original</p>
                  <p className="text-base font-medium text-g-900">{fmt(detalle.capital_original ?? detalle.monto_total)}</p>
                </div>
                <div>
                  <p className="section-label">Total actual</p>
                  <p className="text-base font-medium text-g-900">{fmt(detalle.monto_total)}</p>
                </div>
                <div>
                  <p className="section-label">Pagado</p>
                  <p className="text-base font-medium text-pos">{fmt(detalle.monto_pagado)}</p>
                </div>
                <div>
                  <p className="section-label">Pendiente</p>
                  <p className="text-base font-medium text-red-600">{fmt(parseFloat(detalle.monto_total)-parseFloat(detalle.monto_pagado))}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-g-500 pt-2 border-t border-g-200/60">
                {detalle.tasa_interes>0 && <span><i className="ti ti-percentage mr-1"/>{detalle.tasa_interes}% EA</span>}
                {detalle.interes_mensual_monto>0 && <span><i className="ti ti-calendar-repeat mr-1"/>{fmtShort(detalle.interes_mensual_monto)}/mes fijo</span>}
                {detalle.fecha_limite && <span><i className="ti ti-calendar mr-1"/>Vence {fmtDate(detalle.fecha_limite)}</span>}
              </div>
            </div>

            {/* Acciones */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>abrirNuevoMov('abono')} className="btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5"><i className="ti ti-cash-banknote text-sm"/> Abonar</button>
              <button onClick={()=>abrirNuevoMov('interes')} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5"><i className="ti ti-percentage text-sm"/> Agregar interés</button>
              <button onClick={()=>abrirNuevoMov('mora')} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5"><i className="ti ti-alert-triangle text-sm"/> Agregar mora</button>
              <button onClick={abrirEditarDeuda} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5"><i className="ti ti-pencil text-sm"/> Editar deuda</button>
            </div>

            {/* Pago programado */}
            <div className="card p-4">
              <p className="text-sm font-medium text-g-900 mb-2 flex items-center gap-1.5"><i className="ti ti-calendar-stats text-sm text-g-400"/> Pago automático</p>
              {pagoProgramado ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-g-700">{fmt(pagoProgramado.monto)} el día {pagoProgramado.dia_mes} de cada mes</p>
                    <p className="text-[11px] text-g-400">Se abona sola cuando se procese</p>
                  </div>
                  <button onClick={cancelarProgramacion} className="text-g-300 hover:text-red-500 p-1.5"><i className="ti ti-trash text-sm"/></button>
                </div>
              ) : (
                <button onClick={()=>{ setFormProgramar({ monto: '', dia_mes: 1, medio_pago: 'bancolombia' }); setModalProgramar(true); }}
                  className="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-1.5">
                  <i className="ti ti-plus text-sm"/> Programar pago mensual
                </button>
              )}
            </div>

            {/* Historial */}
            <div>
              <p className="section-label mb-2">Historial ({movimientos.length})</p>
              {movimientos.length===0 && <p className="text-sm text-g-400 py-4 text-center">Sin movimientos todavía</p>}
              <div className="space-y-2">
                {movimientos.map(m => {
                  const v = MOV_DEUDA_VISUAL[m.tipo];
                  return (
                    <div key={m.id} className="card p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${v.color}1F` }}>
                        <i className={`ti ${v.icon} text-sm`} style={{ color: v.color }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-g-900">{v.label}</p>
                          <p className="text-sm font-medium" style={{ color: v.color }}>{v.signo} {fmt(m.monto)}</p>
                        </div>
                        <p className="text-[11px] text-g-400">{fmtDate(m.fecha)}{m.nota ? ` · ${m.nota}` : ''}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={()=>abrirEditarMov(m)} className="text-g-300 hover:text-g-600 p-1"><i className="ti ti-pencil text-xs"/></button>
                        <button onClick={()=>borrarMov(m)} className="text-g-300 hover:text-red-500 p-1"><i className="ti ti-trash text-xs"/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={()=>del(detalle.id)} className="text-red-500 text-xs w-full text-center py-2">Eliminar esta deuda por completo</button>
          </div>
          )}
        </PantallaCompleta>
      )}

      {/* Crear/editar movimiento del historial */}
      {modalMov && (
        <PantallaCompleta title={modalMov.id ? 'Editar movimiento' : `Nuevo: ${MOV_DEUDA_VISUAL[modalMov.tipo].label}`} onClose={()=>setModalMov(null)}>
          <div className="space-y-3 pb-4">
            <div>
              <label className="section-label block mb-1">Tipo</label>
              <div className="flex gap-2">
                {Object.entries(MOV_DEUDA_VISUAL).map(([k,v]) => (
                  <button key={k} type="button" onClick={()=>setModalMov(m=>({...m, tipo:k}))}
                    className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${modalMov.tipo===k ? 'border-current' : 'border-g-200/60 text-g-400'}`}
                    style={modalMov.tipo===k ? { borderColor: v.color, color: v.color, background: `${v.color}14` } : {}}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="section-label block mb-1">Monto</label>
              <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
                value={modalMov.monto} onChange={e=>setModalMov(m=>({...m, monto: e.target.value.replace(',','.')}))}/>
            </div>
            <div>
              <label className="section-label block mb-1">Fecha</label>
              <input type="date" className="input" value={modalMov.fecha} onChange={e=>setModalMov(m=>({...m, fecha: e.target.value}))}/>
            </div>
            <div>
              <label className="section-label block mb-1">Nota (opcional)</label>
              <input type="text" className="input" placeholder="Ej: pago de la cuota de marzo" value={modalMov.nota} onChange={e=>setModalMov(m=>({...m, nota: e.target.value}))}/>
            </div>
            <button onClick={guardarMov} className="btn-primary w-full py-3.5">{modalMov.id ? 'Guardar cambios' : 'Registrar'}</button>
          </div>
        </PantallaCompleta>
      )}

      {/* Editar datos de la deuda */}
      {formEditar && (
        <PantallaCompleta title="Editar deuda" onClose={()=>setFormEditar(null)}>
          <form onSubmit={guardarEditarDeuda} className="space-y-3 pb-4">
            <input className="input" placeholder="Nombre" value={formEditar.nombre} onChange={e=>setFormEditar(f=>({...f, nombre: e.target.value}))} required/>
            <select className="select" value={formEditar.tipo} onChange={e=>setFormEditar(f=>({...f, tipo: e.target.value}))}>
              {TIPOS_DEUDA.map(t=><option key={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="section-label block mb-1">Tasa EA (%)</label><input type="text" inputMode="decimal" className="input" value={formEditar.tasa_interes} onChange={e=>setFormEditar(f=>({...f, tasa_interes: e.target.value.replace(',','.')}))}/></div>
              <div><label className="section-label block mb-1">Interés mensual fijo</label><input type="text" inputMode="numeric" className="input" value={formEditar.interes_mensual_monto} onChange={e=>setFormEditar(f=>({...f, interes_mensual_monto: e.target.value.replace(',','.')}))}/></div>
            </div>
            <div><label className="section-label block mb-1">Fecha límite</label><input type="date" className="input" value={formEditar.fecha_limite} onChange={e=>setFormEditar(f=>({...f, fecha_limite: e.target.value}))}/></div>
            <p className="text-[11px] text-g-400">El monto total y lo pagado no se editan aquí — se calculan solos desde el historial de abonos/intereses/mora.</p>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={()=>setFormEditar(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Guardar</button>
            </div>
          </form>
        </PantallaCompleta>
      )}

      {/* Programar pago mensual ligado a esta deuda */}
      {modalProgramar && (
        <PantallaCompleta title={`Programar pago: ${detalle?.nombre}`} onClose={()=>setModalProgramar(false)}>
          <form onSubmit={guardarProgramarPago} className="space-y-3 pb-4">
            <p className="text-xs text-g-400">Cada mes, en el día que elijas, se registrará el gasto y se abonará esta deuda automáticamente.</p>
            <div>
              <label className="section-label block mb-1">Monto de la cuota</label>
              <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
                value={formProgramar.monto} onChange={e=>setFormProgramar(f=>({...f, monto: e.target.value.replace(',','.')}))} required/>
            </div>
            <div>
              <label className="section-label block mb-1">Día del mes</label>
              <input type="number" min="1" max="31" className="input" value={formProgramar.dia_mes}
                onChange={e=>setFormProgramar(f=>({...f, dia_mes: parseInt(e.target.value)||1}))} required/>
            </div>
            <div>
              <label className="section-label block mb-1">Medio de pago</label>
              <select className="select" value={formProgramar.medio_pago} onChange={e=>setFormProgramar(f=>({...f, medio_pago: e.target.value}))}>
                {BANCOS.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full py-3.5">Programar</button>
          </form>
        </PantallaCompleta>
      )}
    </div>
  );
}

// ─── METAS ────────────────────────────────────────────
export function Metas() {
  const [items, setItems]         = useState([]);
  const [modal, setModal]         = useState(false);
  const [modalAporte, setModalAporte] = useState(null);
  const [aporteMonto, setAporteMonto] = useState('');
  const [form, setForm]           = useState({nombre:'',descripcion:'',monto_objetivo:'',fecha_limite:'',icono:'ti-target'});
  const set = k => e => setForm(f=>({...f,[k]:String(e.target.value).replace(',','.')}));
  const load = () => getMetas().then(setItems).catch(()=>toast.error('Error cargando metas'));
  useEffect(()=>{load();},[]);

  const submit = async e => {
    e.preventDefault();
    try {
      await crearMeta({
        ...form,
        monto_objetivo: parseFloat(String(form.monto_objetivo).replace(',','.')),
      });
      toast.success('Meta creada 🎯'); setModal(false);
      setForm({nombre:'',descripcion:'',monto_objetivo:'',fecha_limite:'',icono:'ti-target'});
      load();
    } catch { toast.error('Error guardando'); }
  };

  const confirmarAporte = async () => {
    const abono = parseFloat(String(aporteMonto).replace(',','.'));
    if (!abono || abono <= 0) return toast.error('Ingresa un monto válido');
    const nuevo = Math.min(parseFloat(modalAporte.monto_actual) + abono, parseFloat(modalAporte.monto_objetivo));
    await actualizarMeta(modalAporte.id, {...modalAporte, monto_actual: nuevo, completada: nuevo >= modalAporte.monto_objetivo});
    toast.success(nuevo >= modalAporte.monto_objetivo ? '¡Meta lograda! 🎉' : 'Aporte registrado');
    setModalAporte(null); setAporteMonto('');
    load();
  };

  const del = id => confirmToast('¿Eliminar esta meta?', async () => { await eliminarMeta(id); toast.success('Eliminada'); load(); });

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-medium text-g-900">Metas de ahorro</h2><p className="text-sm text-g-400">Visualiza hacia dónde va tu dinero</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-plus text-sm"/> Nueva</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.length===0 && <div className="card col-span-2 p-12 text-center"><i className="ti ti-target text-4xl text-g-200 block mb-2"/><p className="text-g-400 text-sm">¡Crea tu primera meta!</p></div>}
        {items.map(m=>{
          const pct = Math.min(Math.round((parseFloat(m.monto_actual)/parseFloat(m.monto_objetivo))*100),100);
          const colorMeta = m.completada ? '#16A34A' : pct >= 66 ? '#4F8F76' : pct >= 33 ? '#C9A84C' : '#8A93A6';
          return (
            <div key={m.id} className={`card p-4 ${m.completada?'border-g-300':''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Ring pct={pct} size={48} stroke={4} color={colorMeta}/>
                    <div className="absolute inset-[6px] rounded-full bg-g-50 flex items-center justify-center">
                      <i className={`ti ${m.icono} text-sm`} style={{ color: colorMeta }}/>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-g-900">{m.nombre}</p>
                    {m.completada ? <span className="badge-ok text-[10px]">Completada 🎉</span>
                      : <span className="text-xs font-medium" style={{ color: colorMeta }}>{pct}% del objetivo</span>}
                  </div>
                </div>
                <button onClick={()=>del(m.id)} className="text-g-300 hover:text-red-500 p-1"><i className="ti ti-trash text-sm"/></button>
              </div>
              <div className="flex justify-between text-xs text-g-500 mb-2">
                <span className="font-medium text-g-700">{fmt(m.monto_actual)}</span><span>de {fmt(m.monto_objetivo)}</span>
              </div>
              <div className="flex items-center justify-between">
                {m.fecha_limite ? <p className="text-[10px] text-g-400">Meta: {fmtDate(m.fecha_limite)}</p> : <span/>}
                {!m.completada && <button onClick={()=>{ setModalAporte(m); setAporteMonto(''); }} className="text-xs btn-secondary py-1.5 px-3">Aportar</button>}
              </div>
            </div>
          );
        })}
      </div>

      {modalAporte && (
        <PantallaCompleta title={`Aportar a: ${modalAporte.nombre}`} onClose={()=>{setModalAporte(null);setAporteMonto('');}}>
          <div className="space-y-4">
            <div className="card p-4 bg-g-50">
              <p className="section-label mb-1">Progreso actual</p>
              <p className="text-2xl font-medium text-g-900">{fmt(modalAporte.monto_actual)}</p>
              <p className="text-xs text-g-400 mt-1">de {fmt(modalAporte.monto_objetivo)}</p>
              <div className="mt-2 h-2 bg-g-100 rounded-full">
                <div className="h-full bg-g-600 rounded-full transition-all"
                  style={{width:`${Math.min((modalAporte.monto_actual/modalAporte.monto_objetivo)*100,100)}%`}}/>
              </div>
            </div>
            <div>
              <label className="section-label block mb-1">Monto del aporte (COP)</label>
              <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
                value={aporteMonto} onChange={e=>setAporteMonto(e.target.value.replace(',','.'))}/>
            </div>
            <button onClick={confirmarAporte} className="btn-primary w-full py-4">Registrar aporte 🎯</button>
            <button onClick={()=>{setModalAporte(null);setAporteMonto('');}} className="btn-secondary w-full py-3.5">Cancelar</button>
          </div>
        </PantallaCompleta>
      )}

      {modal && (
      <PantallaCompleta title="Nueva meta" onClose={()=>setModal(false)}>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Nombre de tu meta" value={form.nombre} onChange={set('nombre')} required/>
          <input className="input" placeholder="Descripción (opcional)" value={form.descripcion} onChange={set('descripcion')}/>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Monto objetivo</label><input type="text" inputMode="numeric" className="input" placeholder="0" value={form.monto_objetivo} onChange={set('monto_objetivo')} required/></div>
            <div><label className="section-label block mb-1">Fecha límite</label><input type="date" className="input" value={form.fecha_limite} onChange={set('fecha_limite')}/></div>
          </div>
          <div>
            <label className="section-label block mb-2">Ícono</label>
            <div className="flex gap-2 flex-wrap">
              {ICONOS_META.map(ic=>(
                <button key={ic} type="button" onClick={()=>setForm(f=>({...f,icono:ic}))}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${form.icono===ic?'bg-g-700 text-white':'bg-g-50 text-g-500'}`}>
                  <i className={`ti ${ic}`}/>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2 pb-4">
            <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Crear meta</button>
          </div>
        </form>
      </PantallaCompleta>
      )}
    </div>
  );
}
