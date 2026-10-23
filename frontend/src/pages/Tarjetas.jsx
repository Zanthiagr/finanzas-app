import { useEffect, useState } from 'react';
import {
  getTarjetas, crearTarjeta, actualizarTarjeta, eliminarTarjeta, cerrarTarjeta, reactivarTarjeta,
  getTarjetaMovimientos, crearTarjetaMovimiento, actualizarTarjetaMovimiento, eliminarTarjetaMovimiento,
  pagarTarjeta, getPagosProgramados, crearPagoProgramado, eliminarPagoProgramado,
  crearMovimiento, eliminarMovimiento,
} from '../utils/api';
import { fmt, fmtDate, fmtShort, todayLocalStr, parseLocalDate, BANCOS, proximaFechaDia, diasHasta, CATEGORIA_PAGO_TARJETA } from '../utils/helpers';
import PantallaCompleta from '../components/PantallaCompleta';
import { notifySuccess, notifyError } from '../utils/notify';
import { confirmToast } from '../utils/confirm';
import Ring from '../components/Ring';
import Icon from '../utils/icons';
import confetti from 'canvas-confetti';

// Selector plano de medio de pago — mismo patrón que en Patrimonio.jsx y
// Dashboard.jsx (duplicado a propósito, no vale la pena una dependencia
// compartida por un componente tan chico — ver comentario en Dashboard.jsx).
const MEDIOS_PAGO_FLAT = [{ value: 'efectivo', label: '💵 Efectivo' }, ...BANCOS];
function SelectorMedioPago({ value, onChange, label = '¿Con qué medio de pago?' }) {
  return (
    <div>
      <label className="section-label block mb-1">{label}</label>
      <select className="select" value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Elige un medio de pago</option>
        {MEDIOS_PAGO_FLAT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
  );
}

// Mismo vocabulario visual que MOV_DEUDA_VISUAL en Patrimonio.jsx (mismos
// colores/íconos para "cargo/interés/mora" — es el mismo lenguaje en toda
// la app), pero el abono se llama "Pago" acá — así habla la gente de una
// tarjeta ("pagué la tarjeta"), no "aboné la tarjeta".
const MOV_TARJETA_VISUAL = {
  abono:   { label: 'Pago',    icon: 'cash-banknote',  color: '#16A34A', signo: '−' },
  cargo:   { label: 'Compra',  icon: 'credit-card',    color: '#B8663F', signo: '+' },
  interes: { label: 'Interés', icon: 'percentage',     color: '#A8792E', signo: '+' },
  mora:    { label: 'Mora',    icon: 'alert-triangle', color: '#E5484D', signo: '+' },
};

// Color según qué tanto cupo está usado — al revés que el progreso de una
// deuda: acá ALTO es la señal de alerta (uso >90% del cupo), no de logro.
// Buena práctica financiera de sobra conocida: mantenerse bajo 30%.
const colorUtilizacion = (pct) => pct === null ? '#5B6472' : pct >= 90 ? '#E5484D' : pct >= 60 ? '#B8663F' : pct >= 30 ? '#C9A84C' : '#16A34A';

// Categorías que tienen sentido para una compra con tarjeta (no incluye
// Deudas/Préstamos/Ahorro: pagar una deuda con la tarjeta se hace desde
// Movimientos eligiendo la deuda).
const CATS_COMPRA = ['Alimentación','Transporte','Servicios','Salud','Educación','Entretenimiento','Ropa','Vivienda','Otro'];

const initFormTarjeta = {
  nombre: '', banco: '', ultimos_digitos: '', medio_pago_vinculado: '',
  cupo_total: '', dia_corte: '', dia_pago: '', tasa_interes: '', pago_minimo_pct: '', saldo_inicial: '',
};

export default function Tarjetas() {
  const [items, setItems]   = useState([]);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(initFormTarjeta);
  const set = k => e => setForm(f => ({ ...f, [k]: String(e.target.value).replace(',', '.') }));
  const load = () => getTarjetas().then(setItems).catch(() => notifyError('Error cargando tarjetas'));
  useEffect(() => { load(); }, []);

  // ── Detalle de una tarjeta ──
  const [detalle, setDetalle]       = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [pagoProgramado, setPagoProgramado] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [modalMov, setModalMov]     = useState(null);
  const [formEditar, setFormEditar] = useState(null);
  const [modalPagar, setModalPagar] = useState(false);
  const [pagoForm, setPagoForm]     = useState({ monto: '', medio_pago: '', fecha: todayLocalStr() });
  const [modalProgramar, setModalProgramar] = useState(false);
  const [formProgramar, setFormProgramar]   = useState({ monto: '', dia_mes: 1, medio_pago: 'bancolombia' });

  const activas = items.filter(t => t.activa);
  const cerradas = items.filter(t => !t.activa);
  const saldoTotal = activas.reduce((a, t) => a + parseFloat(t.saldo_actual || 0), 0);
  const cupoTotalSuma = activas.reduce((a, t) => a + parseFloat(t.cupo_total || 0), 0);

  const submitNueva = async e => {
    e.preventDefault();
    if (!form.medio_pago_vinculado) {
      // Sin vincular es válido (llevarla manual), pero lo confirmamos
      // implícitamente dejando pasar — el aviso visual ya está en el form.
    }
    try {
      await crearTarjeta(form);
      notifySuccess('Tarjeta agregada 🎉');
      setModal(false); setForm(initFormTarjeta);
      load();
    } catch (err) {
      if (err?.code === '23505') notifyError('Ese medio de pago ya está vinculado a otra tarjeta activa');
      else notifyError('Error guardando la tarjeta');
    }
  };

  const abrirDetalle = async (t) => {
    setDetalle(t); setLoadingDetalle(true);
    try {
      const [movs, pagos] = await Promise.all([getTarjetaMovimientos(t.id), getPagosProgramados()]);
      setMovimientos(movs);
      setPagoProgramado(pagos.find(p => p.tarjeta_id === t.id && p.activo) || null);
    } catch { notifyError('Error cargando el detalle'); }
    finally { setLoadingDetalle(false); }
  };

  const refrescarDetalle = async (tarjetaId) => {
    const actualizada = await getTarjetas();
    setItems(actualizada);
    const t = actualizada.find(x => x.id === tarjetaId);
    setDetalle(t || null);
    if (t) setMovimientos(await getTarjetaMovimientos(t.id));
  };

  const abrirNuevoMov = (tipo) => setModalMov({
    tipo, monto: '', fecha: todayLocalStr(), nota: '', num_cuotas: '', categoria: 'Alimentación',
  });
  const abrirEditarMov = (m) => setModalMov({ id: m.id, tipo: m.tipo, monto: String(m.monto), fecha: m.fecha, nota: m.nota || '', num_cuotas: m.num_cuotas || '' });

  const guardarMov = async () => {
    const monto = parseFloat(String(modalMov.monto).replace(',', '.'));
    if (!monto || monto <= 0) return notifyError('Ingresa un monto válido');
    try {
      if (modalMov.id) {
        await actualizarTarjetaMovimiento(modalMov.id, { tipo: modalMov.tipo, monto, fecha: modalMov.fecha, nota: modalMov.nota, num_cuotas: modalMov.num_cuotas });
        notifySuccess('Movimiento actualizado');
      } else if (modalMov.tipo === 'cargo') {
        // Una compra es un gasto real: se crea como movimiento (categoría,
        // aparece en Movimientos, cuenta en el presupuesto del mes) pagado
        // con ESTA tarjeta — crearMovimiento suma solo el cargo a la tarjeta
        // y lo deja fuera del dinero disponible.
        await crearMovimiento({
          tipo: 'gasto', monto, categoria: modalMov.categoria,
          descripcion: modalMov.nota || modalMov.categoria, fecha: modalMov.fecha,
          medio_pago: 'tarjeta', tarjeta_id: detalle.id, num_cuotas: modalMov.num_cuotas,
        });
        notifySuccess(`Compra registrada — cuenta en tu presupuesto de ${modalMov.categoria}`);
      } else {
        await crearTarjetaMovimiento({ tarjeta_id: detalle.id, tipo: modalMov.tipo, monto, fecha: modalMov.fecha, nota: modalMov.nota, num_cuotas: modalMov.num_cuotas });
        notifySuccess('Movimiento registrado');
      }
      const id = detalle.id;
      setModalMov(null);
      refrescarDetalle(id);
    } catch { notifyError('Error guardando el movimiento'); }
  };

  const borrarMov = (m) => confirmToast(m.movimiento_id ? '¿Eliminar este movimiento? También se quita de Movimientos y de tu presupuesto.' : '¿Eliminar este movimiento del historial?', async () => {
    const id = detalle.id;
    // Si viene de un movimiento real (compra o pago), se borra el movimiento:
    // eso limpia también el cargo/abono de la tarjeta y recalcula el saldo.
    if (m.movimiento_id) await eliminarMovimiento(m.movimiento_id);
    else await eliminarTarjetaMovimiento(m.id);
    notifySuccess('Eliminado');
    refrescarDetalle(id);
  });

  const abrirPagar = () => setModalPagar(true) || setPagoForm({ monto: '', medio_pago: '', fecha: todayLocalStr() });

  const confirmarPago = async () => {
    const monto = parseFloat(String(pagoForm.monto).replace(',', '.'));
    if (!monto || monto <= 0) return notifyError('Ingresa un monto válido');
    if (!pagoForm.medio_pago) return notifyError('Elige el medio de pago con el que pagaste');
    try {
      await pagarTarjeta(detalle, monto, pagoForm.medio_pago, pagoForm.fecha);
      notifySuccess('Pago registrado — ya se descontó de tu saldo 🎉');
      confetti({ particleCount: 60, spread: 65, origin: { y: 0.7 } });
      setModalPagar(false);
      refrescarDetalle(detalle.id);
    } catch { notifyError('Error registrando el pago'); }
  };

  const abrirEditarTarjeta = () => setFormEditar({
    nombre: detalle.nombre, banco: detalle.banco || '', ultimos_digitos: detalle.ultimos_digitos || '',
    medio_pago_vinculado: detalle.medio_pago_vinculado || '', cupo_total: detalle.cupo_total ?? '',
    dia_corte: detalle.dia_corte ?? '', dia_pago: detalle.dia_pago ?? '',
    tasa_interes: detalle.tasa_interes ?? '', pago_minimo_pct: detalle.pago_minimo_pct ?? '',
  });

  const guardarEditarTarjeta = async e => {
    e.preventDefault();
    try {
      await actualizarTarjeta(detalle.id, formEditar);
      notifySuccess('Tarjeta actualizada');
      const id = detalle.id;
      setFormEditar(null);
      refrescarDetalle(id);
    } catch (err) {
      if (err?.code === '23505') notifyError('Ese medio de pago ya está vinculado a otra tarjeta activa');
      else notifyError('Error actualizando');
    }
  };

  const cerrar = () => confirmToast('¿Cerrar esta tarjeta? Se mantiene todo el historial, pero deja de contar como activa.', async () => {
    await cerrarTarjeta(detalle.id); notifySuccess('Tarjeta cerrada');
    refrescarDetalle(detalle.id);
  });
  const reactivar = () => reactivarTarjeta(detalle.id).then(() => { notifySuccess('Tarjeta reactivada'); refrescarDetalle(detalle.id); });
  const eliminar = () => confirmToast('¿Eliminar esta tarjeta? También se borra todo su historial. Esta acción no se puede deshacer.', async () => {
    await eliminarTarjeta(detalle.id); notifySuccess('Eliminada');
    setDetalle(null); load();
  });

  const guardarProgramarPago = async e => {
    e.preventDefault();
    const monto = parseFloat(String(formProgramar.monto).replace(',', '.'));
    if (!monto || monto <= 0) return notifyError('Ingresa un monto válido');
    try {
      await crearPagoProgramado({
        nombre: `Pago: ${detalle.nombre}`, monto, categoria: CATEGORIA_PAGO_TARJETA,
        dia_mes: formProgramar.dia_mes, medio_pago: formProgramar.medio_pago,
        activo: true, tarjeta_id: detalle.id,
      });
      notifySuccess('Pago programado — se hará solo cada mes 🎉');
      setModalProgramar(false);
      const pagos = await getPagosProgramados();
      setPagoProgramado(pagos.find(p => p.tarjeta_id === detalle.id && p.activo) || null);
    } catch { notifyError('Error programando el pago'); }
  };

  const cancelarProgramacion = () => confirmToast('¿Cancelar el pago automático de esta tarjeta?', async () => {
    await eliminarPagoProgramado(pagoProgramado.id);
    setPagoProgramado(null);
    notifySuccess('Pago automático cancelado');
  });

  // ── Fechas del ciclo (informativas — el saldo mostrado es siempre uno
  // solo, el real, nunca se parte en dos cálculos paralelos que podrían
  // desincronizarse) ──
  const fechaCorte = detalle?.dia_corte ? proximaFechaDia(detalle.dia_corte) : null;
  const fechaPago  = detalle?.dia_pago  ? proximaFechaDia(detalle.dia_pago)  : null;

  return (
    <div className="space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-medium text-g-900">Tarjetas de crédito</h2><p className="text-sm text-g-400">Tus cuentas de crédito, con cupo y fechas al día</p></div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2"><Icon name="plus" className="w-3.5 h-3.5"/> Agregar</button>
      </div>

      {activas.length > 0 && (
        <div className="relative overflow-hidden card-premium">
          <div className="card-premium-glow -top-24 -right-16 w-64 h-64 bg-blue-500 opacity-20"/>
          <div className="card-premium-glow -bottom-20 -left-10 w-52 h-52 bg-gold opacity-[0.08]"/>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium">Saldo total en tarjetas</p>
            <p className="text-3xl font-semibold text-white mt-2">{fmt(saldoTotal)}</p>
            <p className="text-white/40 text-[11px] mt-1">
              {activas.length} tarjeta{activas.length !== 1 ? 's' : ''} activa{activas.length !== 1 ? 's' : ''}
              {cupoTotalSuma > 0 && ` · ${fmt(Math.max(cupoTotalSuma - saldoTotal, 0))} de cupo disponible`}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card p-12 text-center">
            <Icon name="credit-card" className="w-4 h-4 text-4xl text-g-200 block mb-2"/>
            <p className="text-g-400 text-sm">Sin tarjetas registradas todavía</p>
          </div>
        )}
        {activas.map(t => {
          const saldo = parseFloat(t.saldo_actual) || 0;
          const cupo = parseFloat(t.cupo_total) || 0;
          const pctUso = cupo > 0 ? Math.min(Math.round((saldo / cupo) * 100), 100) : null;
          const color = colorUtilizacion(pctUso);
          const cupoDisponible = cupo > 0 ? Math.max(cupo - saldo, 0) : null;
          const fPago = t.dia_pago ? proximaFechaDia(t.dia_pago) : null;
          const dPago = fPago ? diasHasta(fPago) : null;
          return (
            <button key={t.id} onClick={() => abrirDetalle(t)}
              className="card p-4 w-full text-left active:scale-[0.99] transition-transform flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1F` }}>
                <Icon name="credit-card" className="w-5 h-5" style={{ color }}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-g-900 truncate">{t.nombre}</p>
                  <p className="text-sm font-medium text-g-900 flex-shrink-0">{fmtShort(saldo)}</p>
                </div>
                <p className="text-[11px] text-g-400 truncate">
                  {t.banco || 'Tarjeta de crédito'}{t.ultimos_digitos ? ` ···· ${t.ultimos_digitos}` : ''}
                </p>
                {cupo > 0 ? (
                  <>
                    <div className="h-1.5 bg-g-100 rounded-full overflow-hidden mt-2 mb-1">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pctUso}%`, background: color }}/>
                    </div>
                    <p className="text-[10px]" style={{ color }}>
                      {pctUso}% del cupo usado · {fmtShort(cupoDisponible)} disponible
                      {dPago !== null && dPago >= 0 && dPago <= 5 ? ` · Pago en ${dPago === 0 ? 'hoy' : `${dPago}d`}` : ''}
                    </p>
                  </>
                ) : (
                  dPago !== null && dPago >= 0 && dPago <= 5 && (
                    <p className="text-[10px] text-g-400 mt-1">Pago en {dPago === 0 ? 'hoy' : `${dPago} día${dPago !== 1 ? 's' : ''}`}</p>
                  )
                )}
              </div>
              <Icon name="chevron-right" className="w-3.5 h-3.5 text-g-300 flex-shrink-0"/>
            </button>
          );
        })}
        {cerradas.length > 0 && (
          <div className="pt-1">
            <p className="section-label px-1 mb-2">Cerradas</p>
            {cerradas.map(t => (
              <button key={t.id} onClick={() => abrirDetalle(t)}
                className="card p-3.5 w-full text-left active:scale-[0.99] transition-transform flex items-center gap-3 opacity-60 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-g-100">
                  <Icon name="credit-card" className="w-4 h-4 text-g-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-g-700 truncate">{t.nombre}</p>
                  <p className="text-[11px] text-g-400">Cerrada</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nueva tarjeta */}
      {modal && (
      <PantallaCompleta title="Nueva tarjeta" onClose={() => setModal(false)}>
        <form onSubmit={submitNueva} className="space-y-3">
          <input className="input" placeholder="Nombre (ej: Visa Bancolombia)" value={form.nombre} onChange={set('nombre')} required/>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Banco (opcional)" value={form.banco} onChange={set('banco')}/>
            <input className="input" placeholder="Últimos 4 dígitos" maxLength={4} value={form.ultimos_digitos} onChange={set('ultimos_digitos')}/>
          </div>
          <div>
            <label className="section-label block mb-1">¿Ya tienes saldo pendiente hoy? (opcional)</label>
            <input type="text" inputMode="numeric" className="input" placeholder="0 — si es una tarjeta nueva, déjalo así" value={form.saldo_inicial} onChange={set('saldo_inicial')}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Cupo total</label><input type="text" inputMode="numeric" className="input" placeholder="Opcional" value={form.cupo_total} onChange={set('cupo_total')}/></div>
            <div><label className="section-label block mb-1">Tasa EA (%)</label><input type="text" inputMode="decimal" className="input" placeholder="Opcional" value={form.tasa_interes} onChange={set('tasa_interes')}/></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="section-label block mb-1">Día de corte</label><input type="number" min="1" max="31" className="input" placeholder="Ej: 15" value={form.dia_corte} onChange={set('dia_corte')}/></div>
            <div><label className="section-label block mb-1">Día de pago</label><input type="number" min="1" max="31" className="input" placeholder="Ej: 5" value={form.dia_pago} onChange={set('dia_pago')}/></div>
          </div>
          <div>
            <label className="section-label block mb-1">Pago mínimo (% estimado)</label>
            <input type="text" inputMode="decimal" className="input" placeholder="Ej: 10 — confirma siempre en tu extracto" value={form.pago_minimo_pct} onChange={set('pago_minimo_pct')}/>
          </div>
          <div className="flex gap-2 pt-2 pb-4">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </PantallaCompleta>
      )}

      {/* Detalle de una tarjeta */}
      {detalle && (
        <PantallaCompleta title={detalle.nombre} onClose={() => setDetalle(null)}>
          {loadingDetalle ? (
            <div className="flex justify-center py-12"><Icon name="loader" className="w-6 h-6 animate-spin text-g-300"/></div>
          ) : (
          <div className="space-y-4 pb-4">
            {/* Resumen — tarjeta oscura, misma identidad que "dinero disponible" del Dashboard */}
            <div className="relative overflow-hidden card-premium">
              <div className="card-premium-glow -top-16 -right-10 w-44 h-44 bg-blue-500 opacity-20"/>
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium">Saldo actual</p>
                  <p className="text-2xl font-semibold text-white mt-1">{fmt(detalle.saldo_actual)}</p>
                </div>
                {parseFloat(detalle.cupo_total) > 0 && (() => {
                  const pctUso = Math.min(Math.round((parseFloat(detalle.saldo_actual) / parseFloat(detalle.cupo_total)) * 100), 100);
                  return (
                    <div className="relative flex-shrink-0">
                      <Ring pct={pctUso} size={64} stroke={7} color={colorUtilizacion(pctUso)} trackColor="rgba(255,255,255,0.15)"/>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xs font-medium">{pctUso}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {parseFloat(detalle.cupo_total) > 0 && (
                <p className="relative text-white/40 text-[11px] mt-3">
                  {fmt(Math.max(parseFloat(detalle.cupo_total) - parseFloat(detalle.saldo_actual), 0))} disponibles de {fmt(detalle.cupo_total)} de cupo
                </p>
              )}
            </div>

            {/* Fechas del ciclo */}
            {(fechaCorte || fechaPago || detalle.tasa_interes > 0 || detalle.pago_minimo_pct > 0) && (
              <div className="card p-4 grid grid-cols-2 gap-3">
                {fechaCorte && (
                  <div>
                    <p className="section-label">Próximo corte</p>
                    <p className="text-sm font-medium text-g-900">{fmtDate(fechaCorte)}</p>
                    <p className="text-[10px] text-g-400">en {diasHasta(fechaCorte)} días</p>
                  </div>
                )}
                {fechaPago && (
                  <div>
                    <p className="section-label">Próximo pago</p>
                    <p className="text-sm font-medium text-g-900">{fmtDate(fechaPago)}</p>
                    <p className="text-[10px] text-g-400">en {diasHasta(fechaPago)} días</p>
                  </div>
                )}
                {detalle.tasa_interes > 0 && (
                  <div><p className="section-label">Tasa EA</p><p className="text-sm font-medium text-g-900">{detalle.tasa_interes}%</p></div>
                )}
                {detalle.pago_minimo_pct > 0 && (
                  <div>
                    <p className="section-label">Pago mínimo (estimado)</p>
                    <p className="text-sm font-medium text-g-900">{fmt(parseFloat(detalle.saldo_actual) * parseFloat(detalle.pago_minimo_pct) / 100)}</p>
                  </div>
                )}
              </div>
            )}

            {detalle.medio_pago_vinculado && (
              <p className="text-[11px] text-g-500 flex items-center gap-1.5 px-1">
                <Icon name="link" className="w-3.5 h-3.5"/> Vinculada a {BANCOS.find(b => b.value === detalle.medio_pago_vinculado)?.label || detalle.medio_pago_vinculado}
              </p>
            )}

            {/* Acciones */}
            {detalle.activa && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={abrirPagar} className="btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5"><Icon name="cash-banknote" className="w-3.5 h-3.5"/> Pagar</button>
                <button onClick={() => abrirNuevoMov('cargo')} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5"><Icon name="credit-card" className="w-3.5 h-3.5"/> Registrar compra</button>
                <button onClick={() => abrirNuevoMov('interes')} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5"><Icon name="percentage" className="w-3.5 h-3.5"/> Agregar interés</button>
                <button onClick={() => abrirNuevoMov('mora')} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5"><Icon name="alert-triangle" className="w-3.5 h-3.5"/> Agregar mora</button>
                <button onClick={abrirEditarTarjeta} className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-1.5 col-span-2"><Icon name="pencil" className="w-3.5 h-3.5"/> Editar tarjeta</button>
              </div>
            )}
            {!detalle.activa && (
              <button onClick={reactivar} className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-1.5"><Icon name="refresh" className="w-3.5 h-3.5"/> Reactivar tarjeta</button>
            )}

            {/* Pago programado */}
            {detalle.activa && (
              <div className="card p-4">
                <p className="text-sm font-medium text-g-900 mb-2 flex items-center gap-1.5"><Icon name="calendar-stats" className="w-3.5 h-3.5 text-g-400"/> Pago automático</p>
                {pagoProgramado ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-g-700">{fmt(pagoProgramado.monto)} el día {pagoProgramado.dia_mes} de cada mes</p>
                      <p className="text-[11px] text-g-400">Se paga solo cuando se procese</p>
                    </div>
                    <button onClick={cancelarProgramacion} className="text-g-300 hover:text-red-500 p-1.5"><Icon name="trash" className="w-3.5 h-3.5"/></button>
                  </div>
                ) : (
                  <button onClick={() => { setFormProgramar({ monto: '', dia_mes: detalle.dia_pago || 1, medio_pago: 'bancolombia' }); setModalProgramar(true); }}
                    className="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-1.5">
                    <Icon name="plus" className="w-3.5 h-3.5"/> Programar pago mensual
                  </button>
                )}
              </div>
            )}

            {/* Historial */}
            <div>
              <p className="section-label mb-2">Historial ({movimientos.length})</p>
              {movimientos.length === 0 && <p className="text-sm text-g-400 py-4 text-center">Sin movimientos todavía</p>}
              <div className="space-y-2">
                {movimientos.map(m => {
                  const v = MOV_TARJETA_VISUAL[m.tipo];
                  const infoCuota = m.tipo === 'cargo' && m.num_cuotas > 1 ? (() => {
                    const f = parseLocalDate(m.fecha);
                    const hoy = new Date();
                    const mesesTranscurridos = (hoy.getFullYear() - f.getFullYear()) * 12 + (hoy.getMonth() - f.getMonth()) + 1;
                    const cuotaActual = Math.min(Math.max(mesesTranscurridos, 1), m.num_cuotas);
                    return { cuotaActual, valorCuota: parseFloat(m.monto) / m.num_cuotas, terminada: cuotaActual >= m.num_cuotas };
                  })() : null;
                  return (
                    <div key={m.id} className="card p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${v.color}1F` }}>
                        <Icon name={v.icon} className="w-3.5 h-3.5" style={{ color: v.color }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-g-900">{v.label}</p>
                          <p className="text-sm font-medium" style={{ color: v.color }}>{v.signo} {fmt(m.monto)}</p>
                        </div>
                        <p className="text-[11px] text-g-400">{fmtDate(m.fecha)}{m.nota ? ` · ${m.nota}` : ''}</p>
                        {infoCuota && (
                          <p className="text-[11px] mt-0.5" style={{ color: v.color }}>
                            {infoCuota.terminada ? 'Cuotas terminadas' : `Cuota ${infoCuota.cuotaActual}/${m.num_cuotas} · ${fmtShort(infoCuota.valorCuota)}/mes`}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!m.movimiento_id && <button onClick={() => abrirEditarMov(m)} className="text-g-300 hover:text-g-600 p-1"><Icon name="pencil" className="w-3 h-3"/></button>}
                        <button onClick={() => borrarMov(m)} className="text-g-300 hover:text-red-500 p-1"><Icon name="trash" className="w-3 h-3"/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zona de riesgo */}
            <div className="pt-2 flex gap-2">
              {detalle.activa && <button onClick={cerrar} className="text-xs text-g-400 hover:text-g-600 flex-1 text-center py-2">Cerrar tarjeta</button>}
              <button onClick={eliminar} className="text-xs text-red-400 hover:text-red-600 flex-1 text-center py-2">Eliminar definitivamente</button>
            </div>
          </div>
          )}
        </PantallaCompleta>
      )}

      {/* Modal: pagar */}
      {modalPagar && (
        <PantallaCompleta title="Pagar tarjeta" onClose={() => setModalPagar(false)}>
          <div className="space-y-3">
            <div><label className="section-label block mb-1">Monto</label>
              <input type="text" inputMode="numeric" className="input" placeholder="0" autoFocus
                value={pagoForm.monto} onChange={e => setPagoForm(f => ({ ...f, monto: String(e.target.value).replace(',', '.') }))}/>
            </div>
            <SelectorMedioPago value={pagoForm.medio_pago} onChange={v => setPagoForm(f => ({ ...f, medio_pago: v }))} label="¿Con qué cuenta pagaste?"/>
            <input type="date" className="input" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({ ...f, fecha: e.target.value }))}/>
            <div className="flex gap-2 pt-2 pb-4">
              <button onClick={() => setModalPagar(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmarPago} className="btn-primary flex-1">Registrar pago</button>
            </div>
          </div>
        </PantallaCompleta>
      )}

      {/* Modal: nuevo/editar movimiento (compra, interés, mora) */}
      {modalMov && (
        <PantallaCompleta title={modalMov.id ? 'Editar movimiento' : modalMov.tipo === 'cargo' ? 'Registrar compra' : modalMov.tipo === 'interes' ? 'Agregar interés' : 'Agregar mora'} onClose={() => setModalMov(null)}>
          <div className="space-y-3">
            <div><label className="section-label block mb-1">Monto</label>
              <input type="text" inputMode="numeric" className="input" placeholder="0" autoFocus
                value={modalMov.monto} onChange={e => setModalMov(m => ({ ...m, monto: String(e.target.value).replace(',', '.') }))}/>
            </div>
            <input type="date" className="input" value={modalMov.fecha} onChange={e => setModalMov(m => ({ ...m, fecha: e.target.value }))}/>
            {modalMov.tipo === 'cargo' && !modalMov.id && (
              <div>
                <label className="section-label block mb-1">Categoría</label>
                <select className="select" value={modalMov.categoria} onChange={e => setModalMov(m => ({ ...m, categoria: e.target.value }))}>
                  {CATS_COMPRA.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-[11px] text-g-400 mt-1">Cuenta en tu presupuesto de esta categoría, pero no baja tu dinero disponible.</p>
              </div>
            )}
            {modalMov.tipo === 'cargo' && (
              <div>
                <label className="section-label block mb-1 flex items-center gap-1.5"><Icon name="credit-card" className="w-3.5 h-3.5"/> ¿A cuántas cuotas? <span className="text-g-300">(opcional)</span></label>
                <input type="number" min="1" max="60" className="input" placeholder="1" value={modalMov.num_cuotas} onChange={e => setModalMov(m => ({ ...m, num_cuotas: e.target.value }))}/>
              </div>
            )}
            <input className="input" placeholder="Nota (opcional)" value={modalMov.nota} onChange={e => setModalMov(m => ({ ...m, nota: e.target.value }))}/>
            <div className="flex gap-2 pt-2 pb-4">
              <button onClick={() => setModalMov(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarMov} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </PantallaCompleta>
      )}

      {/* Modal: editar tarjeta */}
      {formEditar && (
        <PantallaCompleta title="Editar tarjeta" onClose={() => setFormEditar(null)}>
          <form onSubmit={guardarEditarTarjeta} className="space-y-3">
            <input className="input" placeholder="Nombre" value={formEditar.nombre} onChange={e => setFormEditar(f => ({ ...f, nombre: e.target.value }))} required/>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Banco" value={formEditar.banco} onChange={e => setFormEditar(f => ({ ...f, banco: e.target.value }))}/>
              <input className="input" placeholder="Últimos 4 dígitos" maxLength={4} value={formEditar.ultimos_digitos} onChange={e => setFormEditar(f => ({ ...f, ultimos_digitos: e.target.value }))}/>
            </div>
            {formEditar.medio_pago_vinculado && (
              <div className="card p-3 bg-g-50 space-y-2">
                <p className="text-[11px] text-g-500">Esta tarjeta está vinculada a un banco (método anterior): todo lo que pagues con ese banco se suma aquí. Ahora puedes registrar compras eligiendo <strong>Tarjeta</strong> como medio de pago — desvincúlala si la usas así.</p>
                <select className="select" value={formEditar.medio_pago_vinculado} onChange={e => setFormEditar(f => ({ ...f, medio_pago_vinculado: e.target.value }))}>
                  <option value="">Sin vincular</option>
                  {BANCOS.filter(b => b.value !== 'otro_banco').map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="section-label block mb-1">Cupo total</label><input type="text" inputMode="numeric" className="input" value={formEditar.cupo_total} onChange={e => setFormEditar(f => ({ ...f, cupo_total: String(e.target.value).replace(',', '.') }))}/></div>
              <div><label className="section-label block mb-1">Tasa EA (%)</label><input type="text" inputMode="decimal" className="input" value={formEditar.tasa_interes} onChange={e => setFormEditar(f => ({ ...f, tasa_interes: String(e.target.value).replace(',', '.') }))}/></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="section-label block mb-1">Día de corte</label><input type="number" min="1" max="31" className="input" value={formEditar.dia_corte} onChange={e => setFormEditar(f => ({ ...f, dia_corte: e.target.value }))}/></div>
              <div><label className="section-label block mb-1">Día de pago</label><input type="number" min="1" max="31" className="input" value={formEditar.dia_pago} onChange={e => setFormEditar(f => ({ ...f, dia_pago: e.target.value }))}/></div>
            </div>
            <div>
              <label className="section-label block mb-1">Pago mínimo (% estimado)</label>
              <input type="text" inputMode="decimal" className="input" value={formEditar.pago_minimo_pct} onChange={e => setFormEditar(f => ({ ...f, pago_minimo_pct: String(e.target.value).replace(',', '.') }))}/>
            </div>
            <div className="flex gap-2 pt-2 pb-4">
              <button type="button" onClick={() => setFormEditar(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Guardar</button>
            </div>
          </form>
        </PantallaCompleta>
      )}

      {/* Modal: programar pago automático */}
      {modalProgramar && (
        <PantallaCompleta title="Programar pago mensual" onClose={() => setModalProgramar(false)}>
          <form onSubmit={guardarProgramarPago} className="space-y-3">
            <div><label className="section-label block mb-1">Monto</label>
              <input type="text" inputMode="numeric" className="input" placeholder="0" value={formProgramar.monto} onChange={e => setFormProgramar(f => ({ ...f, monto: String(e.target.value).replace(',', '.') }))}/>
            </div>
            <div><label className="section-label block mb-1">Día del mes</label>
              <input type="number" min="1" max="31" className="input" value={formProgramar.dia_mes} onChange={e => setFormProgramar(f => ({ ...f, dia_mes: parseInt(e.target.value) || 1 }))}/>
            </div>
            <SelectorMedioPago value={formProgramar.medio_pago} onChange={v => setFormProgramar(f => ({ ...f, medio_pago: v }))} label="¿Con qué cuenta se pagará?"/>
            <div className="flex gap-2 pt-2 pb-4">
              <button type="button" onClick={() => setModalProgramar(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Programar</button>
            </div>
          </form>
        </PantallaCompleta>
      )}
    </div>
  );
}
