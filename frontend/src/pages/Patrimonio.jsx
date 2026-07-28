import { useEffect, useState } from 'react';
import { getPresupuestos, guardarPresupuesto, eliminarPresupuesto, getResumen } from '../utils/api';
import { fmt, fmtShort, CATEGORIAS_ICONOS, CATEGORIAS_COLORES } from '../utils/helpers';
import PantallaCompleta from '../components/PantallaCompleta';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/confirm';

const CATEGORIAS_GASTO = ['Alimentación','Transporte','Servicios','Salud','Educación','Entretenimiento','Ropa','Vivienda','Deudas'];

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [gastosReales, setGastosReales] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState({ categoria: 'Alimentación', monto_limite: '' });

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [pres, resumen] = await Promise.all([
        getPresupuestos(),
        getResumen({ mes: now.getMonth() + 1, anio: now.getFullYear() }),
      ]);
      setPresupuestos(pres);
      const gastosMap = {};
      resumen.porCategoria?.filter(c => c.tipo === 'gasto').forEach(c => {
        gastosMap[c.categoria] = parseFloat(c.total);
      });
      setGastosReales(gastosMap);
    } catch { toast.error('Error cargando presupuestos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const [guardando, setGuardando] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (guardando) return; // evita doble clic mientras guarda (apilaba notificaciones)
    if (!form.monto_limite || parseFloat(form.monto_limite) <= 0) return toast.error('Ingresa un monto válido');
    setGuardando(true);
    try {
      await guardarPresupuesto(form);
      toast.success('Presupuesto guardado');
      setModal(false);
      setForm({ categoria: 'Alimentación', monto_limite: '' });
      load();
    } catch (err) {
      toast.error(err?.message || 'Error guardando el presupuesto');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (id) => {
    confirmToast('¿Eliminar este presupuesto?', async () => {
      await eliminarPresupuesto(id);
      toast.success('Eliminado');
      load();
    });
  };

  const categoriasConPresupuesto = presupuestos.map(p => p.categoria);
  const categoriasDisponibles = CATEGORIAS_GASTO.filter(c => !categoriasConPresupuesto.includes(c));

  if (loading) return <div className="flex justify-center items-center h-64"><i className="ti ti-loader animate-spin text-2xl text-g-400"/></div>;

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-g-900">Presupuestos</h2>
          <p className="text-sm text-g-400">Define límites por categoría y mantente bajo control</p>
        </div>
        {categoriasDisponibles.length > 0 && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <i className="ti ti-plus text-sm"/> <span className="hidden md:inline">Nuevo</span>
          </button>
        )}
      </div>

      {presupuestos.length === 0 ? (
        <div className="card p-12 text-center">
          <i className="ti ti-wallet text-4xl text-g-200 block mb-3"/>
          <p className="text-g-700 font-medium mb-1">Aún no tienes presupuestos</p>
          <p className="text-g-400 text-sm mb-4">Define cuánto quieres gastar máximo en cada categoría y la app te avisará cuando te acerques al límite.</p>
          <button onClick={() => setModal(true)} className="btn-primary">Crear mi primer presupuesto</button>
        </div>
      ) : (
        <div className="space-y-3">
          {presupuestos.map(p => {
            const gastado = gastosReales[p.categoria] || 0;
            const limite  = parseFloat(p.monto_limite);
            const pct     = Math.min(Math.round((gastado / limite) * 100), 150);
            const excedido = gastado > limite;
            const enAlerta  = pct >= 80 && !excedido;

            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: (CATEGORIAS_COLORES[p.categoria]||'#2452FF')+'25', color: CATEGORIAS_COLORES[p.categoria]||'#2452FF' }}>
                      <i className={`ti ${CATEGORIAS_ICONOS[p.categoria]||'ti-tag'}`}/>
                    </div>
                    <div>
                      <p className="font-medium text-g-900">{p.categoria}</p>
                      <p className="text-xs text-g-400">Límite: {fmt(limite)}</p>
                    </div>
                  </div>
                  <button onClick={() => eliminar(p.id)} className="text-g-300 hover:text-red-500 p-1.5">
                    <i className="ti ti-trash text-sm"/>
                  </button>
                </div>

                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-g-500">Gastado: <span className="font-medium text-g-700">{fmt(gastado)}</span></span>
                  <span className={`font-medium ${excedido ? 'text-red-600' : enAlerta ? 'text-amber-600' : 'text-g-500'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="h-2.5 bg-g-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${excedido ? 'bg-red-500' : enAlerta ? 'bg-amber-400' : 'bg-g-400'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}/>
                </div>

                {excedido && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <i className="ti ti-alert-triangle text-xs"/> Superaste el límite por {fmtShort(gastado - limite)}
                  </p>
                )}
                {enAlerta && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <i className="ti ti-alert-circle text-xs"/> Te acercas al límite — quedan {fmtShort(limite - gastado)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <PantallaCompleta title="Nuevo presupuesto" onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="section-label block mb-1">Categoría</label>
              <select className="select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {categoriasDisponibles.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="section-label block mb-1">Límite mensual (COP)</label>
              <input type="text" inputMode="numeric" className="input text-lg" placeholder="0"
                value={form.monto_limite} onChange={e => setForm(f => ({ ...f, monto_limite: e.target.value }))} required/>
            </div>
            <div className="flex gap-2 pt-2 pb-4">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </PantallaCompleta>
      )}
    </div>
  );
}
