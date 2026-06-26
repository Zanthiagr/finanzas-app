import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { crearMovimiento, actualizarMovimiento } from '../utils/api';
import toast from 'react-hot-toast';

const CATS_GASTO   = ['Alimentación','Transporte','Servicios','Salud','Educación','Entretenimiento','Ropa','Vivienda','Deudas','Otro'];
const CATS_INGRESO = ['Salario','Freelance','Negocio','Rendimiento','Otro'];
const BANCOS = [
  { value: 'bancolombia', label: '🟡 Bancolombia' },
  { value: 'davivienda',  label: '🔴 Davivienda' },
  { value: 'bogota',      label: '🔵 Banco de Bogotá' },
  { value: 'nequi',       label: '🟣 Nequi' },
  { value: 'daviplata',   label: '🟠 Daviplata' },
  { value: 'bbva',        label: '🔷 BBVA' },
  { value: 'occidente',   label: '🟤 Banco de Occidente' },
  { value: 'popular',     label: '⚫ Banco Popular' },
  { value: 'itau',        label: '🔶 Itaú' },
  { value: 'scotiabank',  label: '🔴 Scotiabank Colpatria' },
  { value: 'falabella',   label: '🟢 Banco Falabella' },
  { value: 'nu',          label: '🟣 Nu (Nubank)' },
  { value: 'lulo',        label: '🟡 Lulo Bank' },
  { value: 'otro_banco',  label: '🏦 Otro banco' },
];

// Limpia entrada numérica: acepta coma o punto como decimal
const numInput = v => v.replace(/[^0-9.,]/g, '').replace(',', '.');

export default function NuevoMovimiento() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const editData  = location.state?.editar || null;

  const [form, setForm] = useState(editData ? {
    tipo:       editData.tipo,
    monto:      String(editData.monto),
    categoria:  editData.categoria,
    descripcion:editData.descripcion || '',
    fecha:      editData.fecha,
    medio_pago: editData.medio_pago || 'efectivo',
    banco:      editData.banco || '',
  } : {
    tipo: 'gasto', monto: '', categoria: 'Alimentación',
    descripcion: '', fecha: new Date().toISOString().split('T')[0],
    medio_pago: 'efectivo', banco: '',
  });
  const [saving, setSaving] = useState(false);

  const setTipo = t => setForm(f => ({
    ...f, tipo: t,
    categoria: t === 'ingreso' ? 'Salario' : 'Alimentación',
  }));

  const submit = async e => {
    e.preventDefault();
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    setSaving(true);
    try {
      if (editData) {
        await actualizarMovimiento(editData.id, { ...form, monto });
        toast.success('Movimiento actualizado');
      } else {
        await crearMovimiento({ ...form, monto });
        toast.success('Movimiento registrado');
      }
      navigate('/movimientos', { replace: true });
    } catch (err) {
      toast.error('Error guardando');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-g-50">
      {/* Header */}
      <div className="bg-white border-b border-g-100 px-4 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: '12px' }}>
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-g-50 flex items-center justify-center flex-shrink-0">
          <i className="ti ti-arrow-left text-g-700"/>
        </button>
        <h1 className="font-medium text-g-900">{editData ? 'Editar movimiento' : 'Nuevo movimiento'}</h1>
      </div>

      <form onSubmit={submit} className="px-4 py-4 space-y-4 pb-10">

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {['gasto','ingreso'].map(t => (
            <button key={t} type="button" onClick={() => setTipo(t)}
              className={`py-3 rounded-xl text-sm font-medium border transition-all
                ${form.tipo === t
                  ? t === 'gasto'
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-g-50 border-g-300 text-g-700'
                  : 'bg-white border-g-200/60 text-g-500'}`}>
              {t === 'gasto' ? '↑ Gasto' : '↓ Ingreso'}
            </button>
          ))}
        </div>

        {/* Monto */}
        <div>
          <label className="section-label block mb-1">Monto (COP)</label>
          <input
            type="text" inputMode="numeric"
            className="input text-xl font-medium py-3"
            placeholder="0"
            value={form.monto}
            onChange={e => setForm(f => ({ ...f, monto: numInput(e.target.value) }))}
            required
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="section-label block mb-1">Categoría</label>
          <select className="select" value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
            {(form.tipo === 'ingreso' ? CATS_INGRESO : CATS_GASTO).map(c =>
              <option key={c}>{c}</option>
            )}
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label className="section-label block mb-1">Descripción (opcional)</label>
          <input className="input" placeholder="Ej: mercado del sábado"
            value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}/>
        </div>

        {/* Medio de pago */}
        <div>
          <label className="section-label block mb-2">Medio de pago</label>
          <div className="grid grid-cols-2 gap-2">
            {[{value:'efectivo',label:'💵 Efectivo'},{value:'transferencia',label:'🏦 Transferencia'}].map(m => (
              <button key={m.value} type="button"
                onClick={() => setForm(f => ({ ...f, medio_pago: m.value, banco: m.value==='efectivo'?'':f.banco }))}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-all
                  ${form.medio_pago === m.value ? 'bg-g-50 border-g-400 text-g-700' : 'bg-white border-g-200/60 text-g-500'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {form.medio_pago === 'transferencia' && (
            <div className="mt-3">
              <label className="section-label block mb-2">Banco</label>
              <div className="grid grid-cols-2 gap-2">
                {BANCOS.map(b => (
                  <button key={b.value} type="button"
                    onClick={() => setForm(f => ({ ...f, banco: b.value }))}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-left
                      ${form.banco === b.value ? 'bg-g-50 border-g-400 text-g-700' : 'bg-white border-g-200/60 text-g-500'}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fecha */}
        <div>
          <label className="section-label block mb-1">Fecha</label>
          <input type="date" className="input" value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}/>
        </div>

        {/* Botón */}
        <button type="submit" disabled={saving}
          className="btn-primary w-full py-4 text-base disabled:opacity-60">
          {saving ? 'Guardando...' : editData ? 'Guardar cambios' : 'Registrar movimiento'}
        </button>

      </form>
    </div>
  );
}
