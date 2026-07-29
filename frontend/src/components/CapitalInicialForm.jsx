import { useState, useEffect } from 'react';
import { getSaldosIniciales, guardarSaldoInicial, eliminarSaldoInicial } from '../utils/api';
import { MEDIOS_PAGO, labelMedioPago, fmt } from '../utils/helpers';
import { confirmToast } from '../utils/confirm';
import toast from 'react-hot-toast';

/**
 * Formulario para registrar el capital que ya se tiene (efectivo + cada
 * banco) ANTES de empezar a registrar movimientos. No cuenta como ingreso,
 * es el punto de partida del saldo real.
 *
 * dark=true → estilo para el fondo oscuro del Onboarding
 * dark=false (default) → estilo para tarjetas claras (Dashboard, Perfil)
 */
export default function CapitalInicialForm({ dark = false, onChange }) {
  const [saldos, setSaldos]     = useState([]);
  const [medio, setMedio]       = useState('efectivo');
  const [monto, setMonto]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [tablaFalta, setTablaFalta] = useState(false);

  const cargar = () => {
    setLoading(true);
    getSaldosIniciales()
      .then(data => { setSaldos(data); setTablaFalta(false); })
      .catch(() => setTablaFalta(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (monto === '' || parseFloat(monto) < 0) return toast.error('Ingresa un monto válido');
    setGuardando(true);
    try {
      await guardarSaldoInicial(medio, monto);
      toast.success('Capital registrado');
      setMonto('');
      cargar();
      onChange && onChange();
    } catch {
      toast.error('No se pudo guardar. Puede que falte crear la tabla en Supabase — revisa CONTEXTO_CHAT_NUEVO.md');
    } finally {
      setGuardando(false);
    }
  };

  const quitar = (medioPago) => {
    confirmToast('¿Quitar este capital inicial?', async () => {
      await eliminarSaldoInicial(medioPago);
      toast.success('Eliminado');
      cargar();
      onChange && onChange();
    });
  };

  const disponibles = MEDIOS_PAGO.filter(m => !saldos.some(s => s.medio_pago === m.value));

  // Si el medio seleccionado deja de estar disponible (porque ya se guardó,
  // o porque se eliminó y la lista cambió), lo realineamos con lo que el
  // <select> realmente está mostrando. Sin esto, el <select> visualmente
  // muestra la primera opción disponible pero el estado sigue apuntando al
  // valor viejo — al guardar, se sobreescribe el registro equivocado en vez
  // de crear uno nuevo (el toast dice "guardado" pero no aparece nada).
  useEffect(() => {
    if (disponibles.length > 0 && !disponibles.some(m => m.value === medio)) {
      setMedio(disponibles[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saldos]);

  const inputCls = dark
    ? 'w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-gold/60'
    : 'input';
  const rowCls = dark ? 'bg-white/8' : 'bg-g-50';
  const textCls = dark ? 'text-white' : 'text-g-800';
  const subCls = dark ? 'text-white/40' : 'text-g-400';

  if (tablaFalta) {
    return (
      <p className={`text-xs ${subCls} leading-relaxed`}>
        Esta función necesita que se cree una tabla en Supabase primero.
        Pídele a quien administra la app técnica que corra la migración
        de <span className="font-mono">saldos_iniciales</span> — está en
        el archivo de contexto del proyecto.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {saldos.length > 0 && (
        <div className="space-y-2">
          {saldos.map(s => (
            <div key={s.medio_pago} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${rowCls}`}>
              <span className={`text-sm ${textCls}`}>{labelMedioPago(s.medio_pago)}</span>
              <div className="flex items-center gap-2.5">
                <span className={`text-sm font-medium ${textCls}`}>{fmt(s.monto)}</span>
                <button onClick={() => quitar(s.medio_pago)} className={subCls}>
                  <i className="ti ti-x text-xs"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && disponibles.length > 0 && (
        <div className="space-y-2">
          <select value={medio} onChange={e => setMedio(e.target.value)} className={inputCls}>
            {disponibles.map(m => <option key={m.value} value={m.value} className="text-g-900 bg-white">{m.label}</option>)}
          </select>
          <input
            type="text" inputMode="decimal"
            className={inputCls}
            placeholder="¿Cuánto tienes ahí ahora?"
            value={monto}
            onChange={e => setMonto(e.target.value.replace(',', '.'))}
          />
          <button onClick={agregar} disabled={guardando}
            className={dark
              ? 'w-full bg-gold text-g-900 font-semibold py-3 rounded-xl text-sm hover:bg-gold-dark transition-colors disabled:opacity-50'
              : 'btn-primary w-full flex items-center justify-center gap-2'}>
            {guardando ? 'Guardando...' : '+ Agregar capital'}
          </button>
        </div>
      )}

      {!loading && disponibles.length === 0 && saldos.length > 0 && (
        <p className={`text-xs ${subCls} text-center`}>Ya registraste todos los medios de pago disponibles.</p>
      )}
    </div>
  );
}
