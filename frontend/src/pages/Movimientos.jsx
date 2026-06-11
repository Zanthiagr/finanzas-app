import { useEffect, useState } from 'react';
import { getMovimientos, crearMovimiento, actualizarMovimiento, eliminarMovimiento } from '../utils/api';
import { fmt, fmtDate, CATEGORIAS_ICONOS, CATEGORIAS_COLORES } from '../utils/helpers';
import toast from 'react-hot-toast';

const CATS_GASTO  = ['Alimentación','Transporte','Servicios','Salud','Educación','Entretenimiento','Ropa','Vivienda','Deudas'];
const CATS_INGRESO = ['Salario','Freelance','Negocio'];
const initForm = { tipo:'gasto', monto:'', categoria:'Alimentación', descripcion:'', fecha: new Date().toISOString().split('T')[0] };

export default function Movimientos() {
  const [movs, setMovs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(initForm);
  const [editing, setEditing] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const now = new Date();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMovimientos({ mes: now.getMonth()+1, anio: now.getFullYear(), tipo: filtroTipo || undefined });
      setMovs(data);
    } catch { toast.error('Error cargando movimientos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filtroTipo]);

  const set = k => e => {
    const val = e.target.value;
    setForm(f => {
      const next = { ...f, [k]: val };
      if (k === 'tipo') next.categoria = val === 'ingreso' ? 'Salario' : 'Alimentación';
      return next;
    });
  };

  const openNew  = () => { setEditing(null); setForm(initForm); setModal(true); };
  const openEdit = (m) => {
    setEditing(m.id);
    setForm({ tipo: m.tipo, monto: m.monto, categoria: m.categoria, descripcion: m.descripcion || '', fecha: m.fecha });
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.monto || parseFloat(form.monto) <= 0) return toast.error('El monto debe ser mayor a 0');
    try {
      if (editing) {
        await actualizarMovimiento(editing, form);
        toast.success('Movimiento actualizado');
      } else {
        await crearMovimiento(form);
        toast.success('Movimiento registrado');
      }
      setModal(false);
      load();
    } catch { toast.error('Error guardando'); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await eliminarMovimiento(id);
    toast.success('Eliminado');
    load();
  };

  const totalIngresos = movs.filter(m => m.tipo==='ingreso').reduce((a,m) => a+parseFloat(m.monto),0);
  const totalGastos   = movs.filter(m => m.tipo==='gasto').reduce((a,m) => a+parseFloat(m.monto),0);

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-g-900">Movimientos</h2>
          <p className="text-sm text-g-400">{now.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <i className="ti ti-plus text-sm"/> Registrar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><p className="section-label">Total ingresos</p><p className="text-xl font-medium text-g-600">{fmt(totalIngresos)}</p></div>
        <div className="card p-4"><p className="section-label">Total gastos</p><p className="text-xl font-medium text-red-500">{fmt(totalGastos)}</p></div>
        <div className="card p-4"><p className="section-label">Balance</p>
          <p className={`text-xl font-medium ${totalIngresos-totalGastos>=0?'text-g-600':'text-red-500'}`}>{fmt(totalIngresos-totalGastos)}</p></div>
      </div>

      <div className="flex gap-2">
        {[['','Todos'],['ingreso','Ingresos'],['gasto','Gastos']].map(([v,l]) => (
          <button key={v} onClick={() => setFiltroTipo(v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filtroTipo===v?'bg-g-700 text-white border-g-700':'bg-white text-g-600 border-g-200/60 hover:border-g-400'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-g-100/60">
        {loading ? (
          <div className="flex justify-center items-center h-40"><i className="ti ti-loader animate-spin text-2xl text-g-400"/></div>
        ) : movs.length === 0 ? (
          <div className="text-center py-16">
            <i className="ti ti-inbox text-4xl text-g-200 block mb-2"/>
            <p className="text-g-400 text-sm">No hay movimientos este mes</p>
            <button onClick={openNew} className="text-xs text-g-600 underline mt-2 block mx-auto">Registrar el primero</button>
          </div>
        ) : movs.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-g-50/50 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
              style={{background:(CATEGORIAS_COLORES[m.categoria]||'#9ED4B8')+'25',color:CATEGORIAS_COLORES[m.categoria]||'#2D6B4A'}}>
              <i className={`ti ${CATEGORIAS_ICONOS[m.categoria]||'ti-tag'}`}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-g-900 truncate">{m.descripcion||m.categoria}</p>
              <p className="text-[11px] text-g-400">{m.categoria} · {fmtDate(m.fecha)}</p>
            </div>
            <span className={`text-sm font-medium ${m.tipo==='ingreso'?'text-g-600':'text-g-900'}`}>
              {m.tipo==='ingreso'?'+':'-'}{fmt(m.monto)}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-g-100 text-g-400 hover:text-g-700">
                <i className="ti ti-pencil text-xs"/>
              </button>
              <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-g-400 hover:text-red-600">
                <i className="ti ti-trash text-xs"/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-g-100">
              <h3 className="font-medium text-g-900">{editing?'Editar movimiento':'Nuevo movimiento'}</h3>
              <button onClick={() => setModal(false)}><i className="ti ti-x text-g-400"/></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {['gasto','ingreso'].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({...f, tipo:t, categoria:t==='ingreso'?'Salario':'Alimentación'}))}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${form.tipo===t ? t==='gasto'?'bg-red-50 border-red-300 text-red-700':'bg-g-50 border-g-300 text-g-700' : 'bg-white border-g-200/60 text-g-500'}`}>
                    {t==='gasto'?'↑ Gasto':'↓ Ingreso'}
                  </button>
                ))}
              </div>
              <div>
                <label className="section-label block mb-1">Monto (COP)</label>
                <input type="number" className="input" placeholder="0" value={form.monto} onChange={set('monto')} required min="1"/>
              </div>
              <div>
                <label className="section-label block mb-1">Categoría</label>
                <select className="select" value={form.categoria} onChange={set('categoria')}>
                  {(form.tipo==='ingreso'?CATS_INGRESO:CATS_GASTO).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1">Descripción (opcional)</label>
                <input className="input" placeholder="Ej: mercado del sábado" value={form.descripcion} onChange={set('descripcion')}/>
              </div>
              <div>
                <label className="section-label block mb-1">Fecha</label>
                <input type="date" className="input" value={form.fecha} onChange={set('fecha')}/>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">{editing?'Guardar cambios':'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
