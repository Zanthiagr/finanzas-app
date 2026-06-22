import { useEffect, useState } from 'react';
import { getActivos, crearActivo, eliminarActivo, actualizarActivo,
         getDeudas, crearDeuda, actualizarDeuda, eliminarDeuda,
         getMetas, crearMeta, actualizarMeta, eliminarMeta,
         registrarRendimientoActivo } from '../utils/api';
import { fmt, fmtDate, fmtShort } from '../utils/helpers';
import CalculadoraLibertad from '../components/CalculadoraLibertad';
import PantallaCompleta from '../components/PantallaCompleta';
import toast from 'react-hot-toast';

const TIPOS_ACTIVO = ['Efectivo','Cuenta bancaria','Inversión','Vehículo','Inmueble','Negocio','Otro'];
const TIPOS_DEUDA  = ['Tarjeta de crédito','Crédito bancario','Préstamo personal','Hipoteca','Gota a gota','Otro'];
const ICONOS_META  = ['ti-target','ti-plane','ti-home','ti-device-laptop','ti-car','ti-heart','ti-shield','ti-coin'];

// ─── ACTIVOS ────────────────────────────────────────────
export function Activos() {
  const [items, setItems]         = useState([]);
  const [modal, setModal]         = useState(false);
  const [modalRend, setModalRend] = useState(null); // activo seleccionado para rendimiento
  const [rendMonto, setRendMonto] = useState('');
  const [form, setForm]           = useState({nombre:'',tipo:'Inversión',valor_inicial:'',valor_actual:'',fecha_adquisicion:'',descripcion:'',tasa_rendimiento:'',tipo_rendimiento:'manual'});
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const load = () => getActivos().then(setItems).catch(()=>toast.error('Error cargando activos'));
  useEffect(()=>{ load(); },[]);

  // Calcular rendimiento automático para activos con tasa fija
  const rendimientoMensual = (a) => {
    if (a.tipo_rendimiento !== 'fija' || !a.tasa_rendimiento) return 0;
    const tasaMensual = parseFloat(a.tasa_rendimiento) / 100 / 12;
    return parseFloat(a.valor_actual) * tasaMensual;
  };

  const submit = async e => {
    e.preventDefault();
    try {
      await crearActivo({...form, valor_actual: form.valor_actual||form.valor_inicial});
      toast.success('Activo registrado');
      setModal(false);
      setForm({nombre:'',tipo:'Inversión',valor_inicial:'',valor_actual:'',fecha_adquisicion:'',descripcion:'',tasa_rendimiento:'',tipo_rendimiento:'manual'});
      load();
    } catch { toast.error('Error guardando'); }
  };

  const registrarRend = async () => {
    if (!rendMonto || parseFloat(rendMonto) <= 0) return toast.error('Ingresa un monto válido');
    try {
      await registrarRendimientoActivo({ activo_id: modalRend.id, rendimiento_monto: parseFloat(rendMonto) });
      toast.success('Rendimiento registrado 📈');
      setModalRend(null);
      setRendMonto('');
      load();
    } catch { toast.error('Error registrando rendimiento'); }
  };

  const del = async id => {
    if (!confirm('¿Eliminar este activo?')) return;
    await eliminarActivo(id); toast.success('Eliminado'); load();
  };

  const total = items.reduce((a,i)=>a+parseFloat(i.valor_actual),0);
  const rendTotal = items.reduce((a,i)=>a+rendimientoMensual(i),0);

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-medium text-g-900">Activos</h2><p className="text-sm text-g-400">Todo lo que tienes y vale</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-plus text-sm"/> Agregar</button>
      </div>

      <div className="bg-g-800 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Total activos</p>
            <p className="text-3xl font-medium">{fmt(total)}</p>
            <p className="text-white/30 text-xs mt-1">{items.length} activo{items.length!==1?'s':''}</p>
          </div>
          {rendTotal > 0 && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Rend. mensual est.</p>
              <p className="text-xl font-medium text-gold">+{fmt(rendTotal)}</p>
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
          const rend = rendimientoMensual(a);
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-g-900">{a.nombre}</p>
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    <span className="badge-ok text-[10px]">{a.tipo}</span>
                    {a.tipo_rendimiento==='fija' && a.tasa_rendimiento > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold">{a.tasa_rendimiento}% EA</span>
                    )}
                  </div>
                </div>
                <button onClick={()=>del(a.id)} className="text-g-300 hover:text-red-500 p-1"><i className="ti ti-trash text-sm"/></button>
              </div>
              <p className="text-2xl font-medium text-g-900">{fmt(a.valor_actual)}</p>
              <p className={`text-xs mt-0.5 ${g>=0?'text-g-500':'text-red-500'}`}>{g>=0?'+':''}{fmt(g)} total</p>
              {rend > 0 && <p className="text-xs text-gold mt-0.5">≈ +{fmt(rend)}/mes</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={()=>{ setModalRend(a); setRendMonto(rend>0?Math.round(rend).toString():''); }}
                  className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1">
                  <i className="ti ti-trending-up text-xs"/> Registrar rendimiento
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pantalla registrar rendimiento */}
      {modalRend && (
        <PantallaCompleta title={`Rendimiento: ${modalRend.nombre}`} onClose={()=>{setModalRend(null);setRendMonto('');}}>
          <div className="space-y-4">
            <div className="card p-4 bg-g-50">
              <p className="section-label mb-1">Valor actual del activo</p>
              <p className="text-2xl font-medium text-g-900">{fmt(modalRend.valor_actual)}</p>
              {rendimientoMensual(modalRend) > 0 && (
                <p className="text-xs text-gold mt-1">Rendimiento estimado: {fmt(rendimientoMensual(modalRend))}/mes</p>
              )}
            </div>
            <div>
              <label className="section-label block mb-1">Monto del rendimiento este mes (COP)</label>
              <input type="number" inputMode="numeric" className="input text-lg" placeholder="0"
                value={rendMonto} onChange={e=>setRendMonto(e.target.value)}/>
              <p className="text-xs text-g-400 mt-1">Se sumará al valor del activo y se registrará como ingreso</p>
            </div>
            <div className="card p-3 bg-amber-50 border-amber-200">
              <p className="text-xs text-amber-700">
                <i className="ti ti-info-circle mr-1"/>
                Si el activo bajó de valor, deja el monto en 0 y actualiza el valor manualmente.
              </p>
            </div>
            <button onClick={registrarRend} className="btn-primary w-full py-4">
              Registrar rendimiento 📈
            </button>
            <button onClick={()=>{setModalRend(null);setRendMonto('');}} className="btn-secondary w-full py-3.5">
              Cancelar
            </button>
          </div>
        </PantallaCompleta>
      )}

      {modal && (
      <PantallaCompleta title="Nuevo activo" onClose={()=>setModal(false)}>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Nombre del activo" value={form.nombre} onChange={set('nombre')} required/>
          <select className="select" value={form.tipo} onChange={set('tipo')}>{TIPOS_ACTIVO.map(t=><option key={t}>{t}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Valor inicial</label><input type="number" inputMode="numeric" className="input" placeholder="0" value={form.valor_inicial} onChange={set('valor_inicial')} required/></div>
            <div><label className="section-label block mb-1">Valor actual</label><input type="number" inputMode="numeric" className="input" placeholder="0" value={form.valor_actual} onChange={set('valor_actual')}/></div>
          </div>
          <input type="date" className="input" value={form.fecha_adquisicion} onChange={set('fecha_adquisicion')}/>
          <div>
            <label className="section-label block mb-1">Tipo de rendimiento</label>
            <div className="grid grid-cols-2 gap-2">
              {[['manual','Manual (actualizo yo)'],['fija','Tasa fija (CDT, etc.)']].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,tipo_rendimiento:v}))}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${form.tipo_rendimiento===v?'bg-g-50 border-g-400 text-g-700':'bg-white border-g-200/60 text-g-500'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {form.tipo_rendimiento==='fija' && (
            <div>
              <label className="section-label block mb-1">Tasa de rendimiento anual (%)</label>
              <input type="number" inputMode="decimal" className="input" placeholder="Ej: 12.5" value={form.tasa_rendimiento} onChange={set('tasa_rendimiento')} step="0.1"/>
            </div>
          )}
          <div className="flex gap-2 pt-2 pb-4">
            <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </PantallaCompleta>
      )}
    </div>
  );
}


export function Deudas() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({nombre:'',tipo:'Tarjeta de crédito',monto_total:'',tasa_interes:'',fecha_limite:''});
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const load = () => getDeudas().then(setItems).catch(()=>toast.error('Error cargando deudas'));
  useEffect(()=>{load();},[]);

  const submit = async e => {
    e.preventDefault();
    try { await crearDeuda(form); toast.success('Deuda registrada'); setModal(false); setForm({nombre:'',tipo:'Tarjeta de crédito',monto_total:'',tasa_interes:'',fecha_limite:''}); load(); }
    catch { toast.error('Error guardando'); }
  };

  const pagar = async d => {
    const abono = prompt(`¿Cuánto abonas a "${d.nombre}"?`);
    if (!abono) return;
    const nuevo = Math.min(parseFloat(d.monto_pagado)+parseFloat(abono), parseFloat(d.monto_total));
    await actualizarDeuda(d.id, {...d, monto_pagado:nuevo, activa: nuevo<d.monto_total});
    toast.success('Abono registrado'); load();
  };

  const del = async id => { if (!confirm('¿Eliminar?')) return; await eliminarDeuda(id); toast.success('Eliminada'); load(); };
  const totalDeuda = items.filter(d=>d.activa).reduce((a,d)=>a+(parseFloat(d.monto_total)-parseFloat(d.monto_pagado)),0);

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-medium text-g-900">Deudas</h2><p className="text-sm text-g-400">Lo que debes y cómo vas pagando</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-plus text-sm"/> Agregar</button>
      </div>
      <div className="bg-red-700 rounded-2xl p-4 text-white">
        <p className="text-[10px] uppercase tracking-widest text-red-200 mb-1">Deuda total activa</p>
        <p className="text-3xl font-medium">{fmt(totalDeuda)}</p>
        <p className="text-white/40 text-xs mt-1">{items.filter(d=>d.activa).length} deuda{items.filter(d=>d.activa).length!==1?'s':''} activa{items.filter(d=>d.activa).length!==1?'s':''}</p>
      </div>
      <div className="space-y-3">
        {items.length===0 && <div className="card p-12 text-center"><i className="ti ti-credit-card text-4xl text-g-200 block mb-2"/><p className="text-g-400 text-sm">¡Sin deudas registradas! 🎉</p></div>}
        {items.map(d=>{
          const pendiente = parseFloat(d.monto_total)-parseFloat(d.monto_pagado);
          const pct = Math.round((parseFloat(d.monto_pagado)/parseFloat(d.monto_total))*100);
          return (
            <div key={d.id} className={`card p-4 ${!d.activa?'opacity-60':''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-g-900">{d.nombre}</p>
                    {!d.activa && <span className="badge-ok text-[10px]">Pagada ✓</span>}
                  </div>
                  <p className="text-[11px] text-g-400">{d.tipo}{d.tasa_interes>0?` · ${d.tasa_interes}% EA`:''}</p>
                </div>
                <div className="flex gap-2">
                  {d.activa && <button onClick={()=>pagar(d)} className="text-xs btn-secondary py-1.5 px-3">Abonar</button>}
                  <button onClick={()=>del(d.id)} className="text-g-300 hover:text-red-500 p-1.5"><i className="ti ti-trash text-sm"/></button>
                </div>
              </div>
              <div className="flex justify-between text-xs text-g-500 mb-2">
                <span>Pagado: {fmtShort(d.monto_pagado)}</span>
                <span className="text-red-600 font-medium">Pendiente: {fmtShort(pendiente)}</span>
              </div>
              <div className="h-2.5 bg-g-100 rounded-full overflow-hidden">
                <div className="h-full bg-g-400 rounded-full transition-all" style={{width:`${pct}%`}}/>
              </div>
              <p className="text-[10px] text-g-400 mt-1">{pct}% pagado</p>
            </div>
          );
        })}
      </div>
      {modal && (
      <PantallaCompleta title="Nueva deuda" onClose={()=>setModal(false)}>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Nombre de la deuda" value={form.nombre} onChange={set('nombre')} required/>
          <select className="select" value={form.tipo} onChange={set('tipo')}>{TIPOS_DEUDA.map(t=><option key={t}>{t}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Monto total</label><input type="number" inputMode="numeric" className="input" placeholder="0" value={form.monto_total} onChange={set('monto_total')} required/></div>
            <div><label className="section-label block mb-1">Tasa EA (%)</label><input type="number" className="input" placeholder="0" value={form.tasa_interes} onChange={set('tasa_interes')} step="0.1"/></div>
          </div>
          <input type="date" className="input" value={form.fecha_limite} onChange={set('fecha_limite')}/>
          <div className="flex gap-2 pt-2 pb-4">
            <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </PantallaCompleta>
      )}
    </div>
  );
}

// ─── METAS ────────────────────────────────────────────
export function Metas() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({nombre:'',descripcion:'',monto_objetivo:'',fecha_limite:'',icono:'ti-target'});
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const load = () => getMetas().then(setItems).catch(()=>toast.error('Error cargando metas'));
  useEffect(()=>{load();},[]);

  const submit = async e => {
    e.preventDefault();
    try { await crearMeta(form); toast.success('Meta creada 🎯'); setModal(false); setForm({nombre:'',descripcion:'',monto_objetivo:'',fecha_limite:'',icono:'ti-target'}); load(); }
    catch { toast.error('Error guardando'); }
  };

  const abonar = async m => {
    const abono = prompt(`¿Cuánto aportas a "${m.nombre}"?`);
    if (!abono) return;
    const nuevo = Math.min(parseFloat(m.monto_actual)+parseFloat(abono), parseFloat(m.monto_objetivo));
    await actualizarMeta(m.id, {...m, monto_actual:nuevo, completada: nuevo>=m.monto_objetivo});
    toast.success(nuevo>=m.monto_objetivo?'¡Meta lograda! 🎉':'Aporte registrado'); load();
  };

  const del = async id => { if (!confirm('¿Eliminar?')) return; await eliminarMeta(id); toast.success('Eliminada'); load(); };

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
          return (
            <div key={m.id} className={`card p-4 ${m.completada?'border-g-300':''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-g-50 flex items-center justify-center flex-shrink-0">
                    <i className={`ti ${m.icono} text-g-600 text-lg`}/>
                  </div>
                  <div>
                    <p className="font-medium text-g-900">{m.nombre}</p>
                    {m.completada && <span className="badge-ok text-[10px]">Completada 🎉</span>}
                  </div>
                </div>
                <button onClick={()=>del(m.id)} className="text-g-300 hover:text-red-500 p-1"><i className="ti ti-trash text-sm"/></button>
              </div>
              <div className="flex justify-between text-xs text-g-500 mb-2">
                <span>{fmt(m.monto_actual)}</span><span>{fmt(m.monto_objetivo)}</span>
              </div>
              <div className="h-3 bg-g-100 rounded-full overflow-hidden">
                <div className="h-full bg-g-400 rounded-full transition-all" style={{width:`${pct}%`}}/>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm font-medium text-g-700">{pct}%</p>
                {!m.completada && <button onClick={()=>abonar(m)} className="text-xs btn-secondary py-1.5 px-3">Aportar</button>}
              </div>
              {m.fecha_limite && <p className="text-[10px] text-g-400 mt-1">Meta: {fmtDate(m.fecha_limite)}</p>}
            </div>
          );
        })}
      </div>

      <CalculadoraLibertad/>

      {modal && (
      <PantallaCompleta title="Nueva meta" onClose={()=>setModal(false)}>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Nombre de tu meta" value={form.nombre} onChange={set('nombre')} required/>
          <input className="input" placeholder="Descripción (opcional)" value={form.descripcion} onChange={set('descripcion')}/>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Monto objetivo</label><input type="number" inputMode="numeric" className="input" placeholder="0" value={form.monto_objetivo} onChange={set('monto_objetivo')} required/></div>
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
