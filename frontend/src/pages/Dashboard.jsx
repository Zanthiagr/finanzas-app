import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { getMovimientos, getResumen, getPagosProgramados, getPagosFijosDelMes, pagarPagoFijo, saltarPagoFijoEsteMes, getSaldoTotal, getPresupuestos, getCierres, getDeudas, getMetas, getPrestamos, abonarDeuda, aportarMeta, abonarPrestamo, marcarPagoUnicoComoPagado } from '../utils/api';
import { fmt, fmtShort, calcSaludFinanciera, CATEGORIAS_ICONOS, CATEGORIAS_COLORES, getCurrentWeek, todayLocalStr, DIA_CIERRE_SEMANAL, BANCOS } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import PantallaCompleta from '../components/PantallaCompleta';
import CapitalInicialForm from '../components/CapitalInicialForm';
import CapitalCarousel from '../components/CapitalCarousel';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/confirm';
import confetti from 'canvas-confetti';

const DashboardCharts = lazy(() => import('../components/DashboardCharts'));
import Ring from '../components/Ring';
import Icon from '../utils/icons';
import { motion } from 'motion/react';

const DIAS_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// Mismo selector plano que en Patrimonio.jsx — se define localmente para
// no crear una dependencia circular entre páginas por un componente tan
// chico; si en el futuro se necesita en un tercer lugar, vale la pena
// moverlo a components/.
const MEDIOS_PAGO_FLAT = [{ value: 'efectivo', label: '💵 Efectivo' }, ...BANCOS];
function SelectorMedioPagoRapido({ value, onChange, label = '¿Con qué medio de pago?' }) {
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

// Envoltorio de entrada — pequeño desvanecido + deslizamiento hacia
// arriba, escalonado por índice de sección. Puramente decorativo: no
// toca ningún dato ni lógica, solo cómo aparece cada bloque al cargar.
function Reveal({ children, i = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: i * 0.05, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

export default function Dashboard() {
  const { user, perfil } = useAuth();
  const [resumen, setResumen]           = useState(null);
  const [saldo, setSaldo]               = useState(null);
  const [movRecientes, setMovRecientes] = useState([]);
  const [pagosPendientes, setPagosPendientes] = useState([]);
  const [pagosProximos, setPagosProximos]     = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [gastosReales, setGastosReales] = useState({});
  const [cierres, setCierres]           = useState([]);
  const [tarjetas, setTarjetas]         = useState([]);
  const [deudasActivas, setDeudasActivas] = useState([]);
  const [metasActivas, setMetasActivas]   = useState([]);
  const [prestamosActivos, setPrestamosActivos] = useState([]);
  const [modalAbono, setModalAbono]       = useState(null); // deuda seleccionada, o null
  const [modalAporte, setModalAporte]     = useState(null); // meta seleccionada, o null
  const [modalAbonoPrestamo, setModalAbonoPrestamo] = useState(null); // préstamo seleccionado, o null
  const [montoRapido, setMontoRapido]     = useState('');
  const [medioRapido, setMedioRapido]     = useState('');
  const [guardandoRapido, setGuardandoRapido] = useState(false);
  const [marcandoPagoId, setMarcandoPagoId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modalCapital, setModalCapital] = useState(false);
  const [ocultarSaldo, setOcultarSaldo] = useState(false);
  const now    = new Date();
  const mes    = now.getMonth() + 1;
  const anio   = now.getFullYear();
  const hoyStr = todayLocalStr(now);

  const cargarSaldo = () => getSaldoTotal().then(setSaldo).catch(console.error);

  // Pagos pendientes — separado del resto para no bloquear el dashboard si
  // falla. Tres categorías, cada una con su propio tratamiento:
  // - "unico" vencido/pendiente: siempre accionable, como antes.
  // - "fijo" accionable: es hoy (o ya pasó) su día efectivo y no se ha
  //   resuelto este mes → pide una decisión (pagar o correr).
  // - "fijo" próximo: faltan 1-2 días y no se ha resuelto → aviso
  //   informativo, sin botones de acción (para eso está Calendario, donde
  //   ya se puede pagar cualquier día si el usuario quiere adelantarlo).
  const cargarPagos = () => {
    Promise.all([getPagosProgramados(), getPagosFijosDelMes()]).then(([pagos, fijos]) => {
      const unicosPendientes = (pagos || [])
        .filter(p => p.tipo === 'unico' && p.activo && !p.pagado && p.fecha && p.fecha <= hoyStr);
      const fijosAccionables = (fijos || []).filter(p => p.estado === 'accionable');
      const fijosProximos    = (fijos || []).filter(p => p.estado === 'proximo');

      setPagosPendientes(unicosPendientes.concat(fijosAccionables));
      setPagosProximos(fijosProximos);
    }).catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      getResumen({ mes, anio }),
      getMovimientos({ mes, anio }),
      getSaldoTotal(),
      getPresupuestos(),
      getCierres(anio),
      getDeudas(),
      getMetas(),
      getPrestamos(),
    ]).then(([r, m, s, pres, cierresData, deudasData, metasData, prestamosData]) => {
      setResumen(r);
      setMovRecientes(m.slice(0, 5));
      setSaldo(s);
      setPresupuestos(pres || []);
      setCierres(cierresData || []);
      setTarjetas((deudasData || []).filter(d => d.tipo === 'Tarjeta de crédito' && d.activa));
      setDeudasActivas((deudasData || []).filter(d => d.activa && parseFloat(d.monto_total) > parseFloat(d.monto_pagado)));
      setMetasActivas((metasData || []).filter(m => !m.completada));
      setPrestamosActivos((prestamosData || []).filter(p => p.activo));
      const gastosMap = {};
      r.porCategoria?.filter(c => c.tipo === 'gasto').forEach(c => {
        gastosMap[c.categoria] = parseFloat(c.total);
      });
      setGastosReales(gastosMap);
    }).catch(console.error).finally(() => setLoading(false));
    cargarPagos();
  }, []);

  const recargarDeudasYMetas = () => {
    Promise.all([getDeudas(), getMetas(), getPrestamos()]).then(([deudasData, metasData, prestamosData]) => {
      setTarjetas((deudasData || []).filter(d => d.tipo === 'Tarjeta de crédito' && d.activa));
      setDeudasActivas((deudasData || []).filter(d => d.activa && parseFloat(d.monto_total) > parseFloat(d.monto_pagado)));
      setMetasActivas((metasData || []).filter(m => !m.completada));
      setPrestamosActivos((prestamosData || []).filter(p => p.activo));
    }).catch(() => {});
  };

  const confirmarAbonoDeuda = async () => {
    const monto = parseFloat(String(montoRapido).replace(',','.'));
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    if (!medioRapido) return toast.error('Elige el medio de pago con el que abonaste');
    setGuardandoRapido(true);
    try {
      await abonarDeuda(modalAbono, monto, medioRapido, hoyStr);
      toast.success('Abono registrado — ya se descontó de tu saldo');
      setModalAbono(null); setMontoRapido(''); setMedioRapido('');
      recargarDeudasYMetas();
    } catch { toast.error('Error registrando el abono'); }
    finally { setGuardandoRapido(false); }
  };

  const confirmarAporteMeta = async () => {
    const abono = parseFloat(String(montoRapido).replace(',','.'));
    if (!abono || abono <= 0) return toast.error('Ingresa un monto válido');
    if (!medioRapido) return toast.error('Elige el medio de pago con el que aportaste');
    setGuardandoRapido(true);
    try {
      const r = await aportarMeta(modalAporte, abono, medioRapido, hoyStr);
      toast.success(r.seCompleta ? '¡Meta lograda! 🎉' : 'Aporte registrado — ya se descontó de tu saldo');
      if (r.seCompleta) {
        confetti({ particleCount: 120, spread: 75, startVelocity: 38, gravity: 0.9,
          colors: ['#C9A84C', '#E8D9A8', '#2452FF', '#0B1220'], origin: { y: 0.6 } });
      }
      setModalAporte(null); setMontoRapido(''); setMedioRapido('');
      recargarDeudasYMetas();
    } catch { toast.error('Error registrando el aporte'); }
    finally { setGuardandoRapido(false); }
  };

  const confirmarAbonoPrestamo = async () => {
    const monto = parseFloat(String(montoRapido).replace(',','.'));
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    if (!medioRapido) return toast.error('Elige a qué cuenta llegó el pago');
    setGuardandoRapido(true);
    try {
      const r = await abonarPrestamo(modalAbonoPrestamo, monto, medioRapido, hoyStr);
      toast.success(r.seCompleta ? '¡Préstamo pagado por completo! 🎉' : 'Pago registrado — ya se sumó a tu saldo');
      if (r.seCompleta) {
        confetti({ particleCount: 100, spread: 70, startVelocity: 35, gravity: 0.95,
          colors: ['#2452FF', '#C9A84C', '#0B1220'], origin: { y: 0.55 } });
      }
      setModalAbonoPrestamo(null); setMontoRapido(''); setMedioRapido('');
      recargarDeudasYMetas();
    } catch { toast.error('Error registrando el pago'); }
    finally { setGuardandoRapido(false); }
  };

  const confirmarPagoPendiente = (p) => {
    // Los únicos y los fijos comparten esta misma lista (pagosPendientes),
    // pero se resuelven con funciones distintas — se distingue por tipo.
    if (p.tipo === 'unico') {
      confirmToast(`¿Confirmas que ya pagaste "${p.nombre}" (${fmt(p.monto)})?`, async () => {
        setMarcandoPagoId(p.id);
        try {
          await marcarPagoUnicoComoPagado(p);
          toast.success('Pago confirmado y registrado ✅');
          cargarPagos();
          cargarSaldo();
        } catch (err) {
          toast.error(err?.message || 'Error confirmando el pago');
        } finally {
          setMarcandoPagoId(null);
        }
      }, { confirmLabel: 'Ya pagué' });
    } else {
      confirmToast(`¿Registrar el pago de "${p.nombre}" (${fmt(p.monto)}) hoy?`, async () => {
        setMarcandoPagoId(p.id);
        try {
          await pagarPagoFijo(p);
          toast.success('Pago registrado ✅');
          cargarPagos();
          cargarSaldo();
        } catch (err) {
          toast.error(err?.message || 'Error registrando el pago');
        } finally {
          setMarcandoPagoId(null);
        }
      }, { confirmLabel: 'Sí, pagar' });
    }
  };

  // "Correr" un pago fijo este mes — no crea ningún movimiento ni toca el
  // día programado, solo marca que este mes en particular se salta. El
  // próximo mes vuelve a aparecer normal.
  const correrPagoEsteMes = (p) => {
    confirmToast(`¿Correr "${p.nombre}" este mes? No se registrará ningún gasto — el próximo mes vuelve a aparecer normal.`, async () => {
      setMarcandoPagoId(p.id);
      try {
        await saltarPagoFijoEsteMes(p);
        toast.success('Pago corrido este mes');
        cargarPagos();
      } catch (err) {
        toast.error(err?.message || 'Error');
      } finally {
        setMarcandoPagoId(null);
      }
    }, { confirmLabel: 'Sí, correr' });
  };

  const semanaActual     = getCurrentWeek();
  const semanaYaCerrada  = cierres.some(c => c.semana_num === semanaActual && c.mes_num === mes);
  const esDiaDeCierre    = now.getDay() === DIA_CIERRE_SEMANAL;

  const salud = resumen ? calcSaludFinanciera({
    ingresos: resumen.ingresos, gastos: resumen.gastos,
    deudaTotal: 0, balance: resumen.balance,
  }) : 0;
  const tasaAhorro = resumen?.ingresos > 0 ? Math.round((resumen.balance / resumen.ingresos) * 100) : 0;

  const saludLabel = salud >= 70 ? 'Excelente mes' : salud >= 50 ? 'Vas bien' : salud >= 30 ? 'Atención' : 'Zona de riesgo';
  const saludColor = salud >= 70 ? 'text-blue-100' : salud >= 50 ? 'text-gold' : 'text-red-400';
  const gastosCategoria = resumen?.porCategoria?.filter(c => c.tipo === 'gasto').slice(0, 5) || [];
  const chartData = (resumen?.porSemana || []).reduce((acc, r) => {
    const s = acc.find(a => a.semana === `S${r.semana_num}`);
    if (s) s[r.tipo] = r.total;
    else acc.push({ semana: `S${r.semana_num}`, [r.tipo]: r.total });
    return acc;
  }, []);

  // Presupuestos — ring agregado (todos los límites vs. todo lo gastado)
  // + las 3 categorías más "calientes" (mayor % consumido primero, no
  // orden de creación) para que lo más urgente se vea sin scrollear.
  const totalLimite    = presupuestos.reduce((a, p) => a + parseFloat(p.monto_limite), 0);
  const totalGastadoPr = presupuestos.reduce((a, p) => a + (gastosReales[p.categoria] || 0), 0);
  const pctPresupAgg   = totalLimite > 0 ? Math.min(Math.round((totalGastadoPr / totalLimite) * 100), 150) : 0;
  const excedidoAgg    = totalGastadoPr > totalLimite;
  const alertaAgg      = pctPresupAgg >= 80 && !excedidoAgg;
  const colorPresupAgg = excedidoAgg ? '#E5484D' : alertaAgg ? '#F59E0B' : '#16A34A';
  const presupuestosTop = [...presupuestos].sort((a, b) => {
    const pa = (gastosReales[a.categoria] || 0) / parseFloat(a.monto_limite);
    const pb = (gastosReales[b.categoria] || 0) / parseFloat(b.monto_limite);
    return pb - pa;
  }).slice(0, 3);

  const nombre = (perfil?.nombre || user?.user_metadata?.full_name || '').split(' ')[0];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Icon name="loader" className="w-6 h-6 animate-spin text-g-400"/>
    </div>
  );

  return (
    <div className="space-y-4 page-enter">

      {/* Dinero disponible — ahora un carrusel: Total + una tarjeta por
          cada banco/medio de pago con movimiento real. Antes las
          pastillas de bancos debajo del total eran decorativas; ahora
          cada una es su propia tarjeta deslizable con sus movimientos
          recientes al entrar. */}
      <Reveal i={0}>
        <CapitalCarousel
          saldo={saldo}
          ocultarSaldo={ocultarSaldo}
          setOcultarSaldo={setOcultarSaldo}
          onEditarCapital={() => setModalCapital(true)}
        />
      </Reveal>

      {/* Resumen del mes — antes había que bajar hasta la grilla de KPIs
          para ver ingresos/gastos/balance, y la tasa de ahorro estaba
          escondida como subtexto chiquito dentro de la tarjeta Balance.
          Ahora es lo primero que se ve tras el capital: de un vistazo,
          sin scrollear. La meta de ahorro (≥20%) es un umbral común de
          finanzas personales (regla 50/30/20) — no es un dato del
          usuario, es una referencia fija para orientar. */}
      {resumen?.ingresos > 0 && (
        <Reveal i={1}>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50">
                <Icon name="arrow-up-right" className="w-3 h-3 text-emerald-600"/>
                <span className="text-xs font-medium text-emerald-700">+{fmtShort(resumen.ingresos)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50">
                <Icon name="arrow-down" className="w-3 h-3 text-red-500"/>
                <span className="text-xs font-medium text-red-600">−{fmtShort(resumen.gastos)}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ml-auto ${resumen.balance>=0?'bg-blue-50':'bg-red-50'}`}>
                <span className={`text-xs font-medium ${resumen.balance>=0?'text-blue-700':'text-red-600'}`}>
                  Neto: {resumen.balance>=0?'+':''}{fmtShort(resumen.balance)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-g-500">Tasa de ahorro: <span className="font-medium text-g-800">{tasaAhorro}%</span></span>
              <span className="text-g-400">Meta: ≥ 20%</span>
            </div>
            <div className="h-2 bg-g-100 rounded-full overflow-hidden relative">
              <div className="absolute top-0 bottom-0 w-px bg-g-300" style={{ left: '20%' }}/>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.max(0, Math.min(tasaAhorro, 100))}%`,
                background: tasaAhorro >= 20 ? 'linear-gradient(90deg,#16A34A,#4F8F76)' : 'linear-gradient(90deg,#E5484D,#F59E0B)',
              }}/>
            </div>
          </div>
        </Reveal>
      )}

      {/* Pagos pendientes — fijos que llegaron a su día (o ya pasó) sin
          resolver, + únicos sin pagar (hoy o vencidos). Cada fila lleva un
          punto de severidad (rojo=vencido, ámbar=vence hoy, gris=fijo) en
          vez de un solo bloque de alerta — así se distingue de un vistazo
          cuál urge más. Nada se registra solo: todo pide una acción
          explícita, incluso los fijos — "Registrar" o "Correr este mes". */}
      {pagosPendientes.length > 0 && (
        <Reveal i={2}>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Icon name="bell-ringing" className="w-3.5 h-3.5 text-amber-600"/>
              </div>
              <p className="text-sm font-medium text-g-900">
                {pagosPendientes.length === 1 ? '1 pago pendiente' : `${pagosPendientes.length} pagos pendientes`}
              </p>
            </div>
            <Link to="/calendario" className="text-xs text-g-600 hover:text-g-800 flex-shrink-0">Calendario →</Link>
          </div>
          <div className="divide-y divide-g-100/70 mt-1">
            {pagosPendientes.map(p => {
              const vencido = p.tipo === 'unico' ? p.fecha < hoyStr : p.diasHasta < 0;
              const statusColor = vencido ? '#E5484D' : '#F59E0B';
              const statusLabel = p.tipo === 'unico'
                ? (vencido ? 'Vencido' : 'Vence hoy')
                : (vencido ? 'Fijo · atrasado' : 'Fijo · hoy');
              return (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-g-800 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-g-400">{statusLabel} · {fmtShort(p.monto)}</p>
                  </div>
                  {p.tipo === 'unico' ? (
                    <button onClick={() => confirmarPagoPendiente(p)} disabled={marcandoPagoId === p.id}
                      title="Marcar como pagado"
                      className="w-7 h-7 rounded-full border-2 border-g-200 hover:border-g-800 hover:bg-g-800
                                 flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 group">
                      <Icon name="check" className={`w-3.5 h-3.5 text-g-300 group-hover:text-white ${marcandoPagoId === p.id ? 'animate-pulse' : ''}`}/>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => correrPagoEsteMes(p)} disabled={marcandoPagoId === p.id}
                        title="Correr este mes — no registra nada, el próximo mes vuelve normal"
                        className="text-[11px] px-2 py-1.5 rounded-lg text-g-500 hover:bg-g-50 disabled:opacity-40">
                        Correr
                      </button>
                      <button onClick={() => confirmarPagoPendiente(p)} disabled={marcandoPagoId === p.id}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-g-800 text-white disabled:opacity-40 active:scale-95 transition-transform">
                        {marcandoPagoId === p.id ? '...' : 'Registrar'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </Reveal>
      )}

      {/* Pagos próximos — fijos a 1-2 días de su fecha, todavía sin
          resolver. Solo informativo (sin botones): el usuario ya sabe qué
          se viene, y si quiere adelantarlo puede hacerlo desde Calendario
          en cualquier momento. Evita que el primer aviso de un pago sea
          el mismo día que toca pagarlo. */}
      {pagosProximos.length > 0 && (
        <Reveal i={2}>
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Icon name="calendar-event" className="w-3.5 h-3.5 text-blue-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-900">
              {pagosProximos.length === 1 ? 'Pago próximo' : 'Pagos próximos'}
            </p>
            <p className="text-[11px] text-blue-700/80 truncate">
              {pagosProximos.map(p => `${p.nombre} (${p.diasHasta === 0 ? 'hoy' : p.diasHasta === 1 ? 'mañana' : `en ${p.diasHasta} días`})`).join(' · ')}
            </p>
          </div>
        </div>
        </Reveal>
      )}

      {/* Recordatorio de cierre semanal — antes solo aparecía el día
          designado (domingo por defecto) y desaparecía el lunes aunque la
          semana siguiera sin cerrar, dejando al usuario sin forma de
          acordarse. Ahora se queda visible TODOS los días mientras la
          semana actual siga pendiente; el texto distingue si es el día
          sugerido de cierre o si ya se pasó. La franja de días marca en
          dorado cuál es el día designado. */}
      {!semanaYaCerrada && (
        <Reveal i={3}>
        <Link to="/cierre" className="relative overflow-hidden rounded-2xl bg-g-800 p-4 flex items-center gap-4 active:scale-[0.99] transition-transform">
          <div className="card-premium-glow -top-10 -right-10 w-32 h-32 bg-gold opacity-[0.12]"/>
          <div className="relative w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
            <Icon name="calendar-check" className="w-5 h-5 text-gold"/>
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {esDiaDeCierre ? `Hoy toca cerrar la semana ${semanaActual}` : `Semana ${semanaActual} sin cerrar todavía`}
            </p>
            <p className="text-[11px] text-white/40 mb-2.5">Reflexiona sobre tu dinero — toma menos de 1 minuto</p>
            <div className="flex gap-1.5">
              {DIAS_CORTO.map((d, i) => (
                <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0
                  ${i === DIA_CIERRE_SEMANAL ? 'bg-gold text-g-900' : 'bg-white/10 text-white/40'}`}>
                  {d}
                </span>
              ))}
            </div>
          </div>
          <Icon name="chevron-right" className="w-4 h-4 text-white/30 flex-shrink-0 relative"/>
        </Link>
        </Reveal>
      )}

      {/* Tarjetas de crédito — un vistazo rápido sin tener que entrar a
          Deudas. Siempre muestra "% pagado" (no depende de tener cupo
          configurado, que es opcional) — antes, sin cupo, solo se veía
          el nombre y un número suelto sin ninguna etiqueta que dijera
          qué era. El cupo, si está configurado, se muestra como info
          extra debajo, no como la única fuente de la barra de progreso. */}
      {tarjetas.length > 0 && (
        <div className="space-y-2">
          <p className="section-label px-1">Tarjetas de crédito</p>
          {tarjetas.map(t => {
            const total = parseFloat(t.monto_total) || 0;
            const pendiente = total - parseFloat(t.monto_pagado || 0);
            const pctPagado = total > 0 ? Math.min(Math.round(((total - pendiente) / total) * 100), 100) : 0;
            const cupo = parseFloat(t.cupo_total) || 0;
            const cupoDisponible = cupo > 0 ? Math.max(cupo - pendiente, 0) : null;
            const colorBarra = pctPagado >= 100 ? '#16A34A' : pctPagado >= 50 ? '#4F8F76' : pctPagado >= 20 ? '#C9A84C' : '#E5484D';
            return (
              <Link key={t.id} to="/deudas" className="card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${colorBarra}1F` }}>
                  <Icon name="credit-card" className="w-4 h-4" style={{ color: colorBarra }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-medium text-g-900 truncate">{t.nombre}</p>
                    <p className="text-sm font-medium text-red-600 flex-shrink-0">{fmtShort(pendiente)}</p>
                  </div>
                  <p className="text-[10px] text-g-400 mb-1.5">Pendiente por pagar</p>
                  <div className="h-1.5 bg-g-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pctPagado}%`, background: colorBarra }}/>
                  </div>
                  <p className="text-[10px] text-g-400 mt-1">
                    {pctPagado}% pagado
                    {cupo > 0 && ` · ${fmtShort(cupoDisponible)} de cupo disponible`}
                    {cupo === 0 && t.dia_corte && ` · Corte el día ${t.dia_corte}`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Deudas y metas — antes había que ir hasta Patrimonio para abonar
          o aportar. Acá se puede hacer directo, sin salir del Dashboard.
          Se muestran máximo 3 de cada una (las más urgentes/cercanas —
          igual orden que ya trae getDeudas/getMetas) para no saturar la
          pantalla principal; "Ver todas" lleva al detalle completo. */}
      {(deudasActivas.length > 0 || metasActivas.length > 0) && (
        <Reveal i={5}>
        <div className="space-y-3">
          {deudasActivas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="section-label">Deudas</p>
                {deudasActivas.length > 3 && <Link to="/deudas" className="text-[11px] text-g-500 font-medium">Ver todas</Link>}
              </div>
              {deudasActivas.slice(0, 3).map(d => {
                const total = parseFloat(d.monto_total) || 0;
                const pagado = parseFloat(d.monto_pagado) || 0;
                const pendiente = total - pagado;
                const pct = total > 0 ? Math.min(Math.round((pagado / total) * 100), 100) : 0;
                const color = pct >= 100 ? '#16A34A' : pct >= 50 ? '#4F8F76' : pct >= 20 ? '#C9A84C' : '#E5484D';
                return (
                  <div key={d.id} className="card p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1F` }}>
                        <Icon name="credit-card" className="w-4 h-4" style={{ color }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-medium text-g-900 truncate">{d.nombre}</p>
                          <p className="text-sm font-medium text-red-600 flex-shrink-0">{fmtShort(pendiente)}</p>
                        </div>
                        <div className="h-1.5 bg-g-100 rounded-full overflow-hidden mb-1">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                        </div>
                        <p className="text-[10px] text-g-400">{pct}% pagado</p>
                      </div>
                      <button onClick={() => { setModalAbono(d); setMontoRapido(''); setMedioRapido(''); }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-g-800 text-white flex-shrink-0 active:scale-95 transition-transform">
                        Abonar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {metasActivas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="section-label">Metas</p>
                {metasActivas.length > 3 && <Link to="/metas" className="text-[11px] text-g-500 font-medium">Ver todas</Link>}
              </div>
              {metasActivas.slice(0, 3).map(m => {
                const objetivo = parseFloat(m.monto_objetivo) || 0;
                const actual = parseFloat(m.monto_actual) || 0;
                const pct = objetivo > 0 ? Math.min(Math.round((actual / objetivo) * 100), 100) : 0;
                const color = pct >= 66 ? '#4F8F76' : pct >= 33 ? '#C9A84C' : '#8A93A6';
                return (
                  <div key={m.id} className="card p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1F` }}>
                        <Icon name={m.icono || 'target'} className="w-4 h-4" style={{ color }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-medium text-g-900 truncate">{m.nombre}</p>
                          <p className="text-sm font-medium text-g-700 flex-shrink-0">{pct}%</p>
                        </div>
                        <div className="h-1.5 bg-g-100 rounded-full overflow-hidden mb-1">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                        </div>
                        <p className="text-[10px] text-g-400">{fmtShort(actual)} de {fmtShort(objetivo)}</p>
                      </div>
                      <button onClick={() => { setModalAporte(m); setMontoRapido(''); setMedioRapido(''); }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-g-800 text-white flex-shrink-0 active:scale-95 transition-transform">
                        Aportar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </Reveal>
      )}

      {/* Préstamos — capital propio que está fuera de tus cuentas porque
          se lo prestaste a alguien. Es su propia sección (no mezclada con
          Deudas/Metas) porque conceptualmente es plata que SIGUE siendo
          tuya, solo que no está líquida ahora mismo — vale la pena verla
          de un vistazo, separada de lo que debes o de tus metas de ahorro. */}
      {prestamosActivos.length > 0 && (
        <Reveal i={5}>
        <div className="space-y-2">
          <div className="rounded-2xl bg-g-800 p-4 flex items-center justify-between relative overflow-hidden">
            <div className="card-premium-glow -top-8 -right-6 w-28 h-28 bg-blue-400 opacity-[0.10]"/>
            <div className="relative">
              <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Fuera de tus cuentas (préstamos)</p>
              <p className="text-xl font-medium text-white">
                {fmt(prestamosActivos.reduce((a,p)=>a+(parseFloat(p.monto_total)-parseFloat(p.monto_recibido)),0))}
              </p>
            </div>
            <Link to="/prestamos" className="relative text-[11px] text-white/60 flex-shrink-0">Ver todos →</Link>
          </div>
          {prestamosActivos.slice(0, 3).map(p => {
            const total = parseFloat(p.monto_total) || 0;
            const recibido = parseFloat(p.monto_recibido) || 0;
            const pendiente = total - recibido;
            const pct = total > 0 ? Math.min(Math.round((recibido/total)*100), 100) : 0;
            return (
              <div key={p.id} className="card p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                    <Icon name="arrows-exchange" className="w-4 h-4 text-blue-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-medium text-g-900 truncate">{p.nombre}</p>
                      <p className="text-sm font-medium text-blue-700 flex-shrink-0">{fmtShort(pendiente)}</p>
                    </div>
                    <div className="h-1.5 bg-g-100 rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }}/>
                    </div>
                    <p className="text-[10px] text-g-400">{pct}% cobrado</p>
                  </div>
                  <button onClick={() => { setModalAbonoPrestamo(p); setMontoRapido(''); setMedioRapido(''); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-g-800 text-white flex-shrink-0 active:scale-95 transition-transform">
                    Me pagaron
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </Reveal>
      )}

      {/* Salud financiera — gauge circular: es contenido motivacional, no
          "chrome" de navegación, así que se permite ser expresivo. */}
      <Reveal i={6}>
      <div className="bg-g-800 rounded-2xl p-4 md:p-5 flex items-center gap-4 md:gap-6">
        <div className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="url(#saludGradient)" strokeWidth="9"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - salud / 100)}`}
              className="transition-all duration-700" />
            <defs>
              <linearGradient id="saludGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C9A84C" />
                <stop offset="100%" stopColor="#6E93FF" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl md:text-2xl font-semibold text-white tabular-nums">{salud}</span>
            <span className="text-[9px] text-white/40 -mt-0.5">de 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Salud financiera</p>
          <p className={`text-base md:text-lg font-medium ${saludColor}`}>{saludLabel}</p>
          <p className="text-white/30 text-[11px] mt-1 hidden md:block">Basado en ahorro, control de gastos y deuda</p>
          {nombre && (
            <p className={`text-xs mt-2 px-2.5 py-0.5 rounded-full inline-block ${
              salud >= 50 ? 'text-gold bg-gold/10' : 'text-red-300 bg-red-500/10'
            }`}>
              {salud >= 70 ? `Buen trabajo, ${nombre}`
                : salud >= 50 ? `Vas bien, ${nombre} — sigue así`
                : salud >= 30 ? `${nombre}, hay espacio para mejorar`
                : resumen?.ingresos ? `${nombre}, este mes necesita atención`
                : `${nombre}, aún no registras ingresos este mes`}
            </p>
          )}
        </div>
      </div>
      </Reveal>

      {/* KPIs - 2 columnas en móvil, 4 en desktop */}
      <p className="section-label -mb-1">Este mes</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos', value: fmt(resumen?.ingresos), sub: 'registrados', color: 'text-g-400' },
          { label: 'Gastos', value: fmt(resumen?.gastos),
            sub: resumen?.gastos > resumen?.ingresos ? '⚠ Supera ingresos' : 'Bajo control',
            color: resumen?.gastos > resumen?.ingresos ? 'text-red-500' : 'text-g-400' },
          { label: 'Balance',
            value: <span className={resumen?.balance >= 0 ? 'text-pos' : 'text-neg'}>{fmt(resumen?.balance)}</span>,
            sub: resumen?.ingresos > 0 ? `${Math.round((resumen.balance / resumen.ingresos) * 100)}% ahorrado` : '',
            color: 'text-g-400' },
          { label: 'Movimientos',
            value: resumen?.porCategoria?.reduce((a, c) => a + parseInt(c.cantidad), 0) || 0,
            sub: 'registrados', color: 'text-g-400' },
        ].map((k, i) => (
          <div key={i} className="card p-3 md:p-4">
            <p className="section-label">{k.label}</p>
            <p className="text-lg md:text-xl font-medium text-g-900 mt-0.5">{k.value}</p>
            <p className={`text-[11px] mt-1 ${k.color}`}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Presupuestos — interactivo: un ring agregado (mismo lenguaje
          visual que el gauge de Salud financiera) muestra de un vistazo
          cuánto llevas del total, y debajo las 3 categorías más "calientes"
          (mayor % consumido, no orden de creación) con barra en vivo.
          Solo se muestra si hay presupuestos creados. */}
      {presupuestos.length > 0 ? (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-g-900">Presupuestos</p>
            <Link to="/presupuestos" className="text-xs text-g-600 hover:text-g-800">Ver todos →</Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <Ring pct={pctPresupAgg} color={colorPresupAgg}/>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-g-900">{pctPresupAgg}%</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
              {presupuestosTop.map(p => {
                const gastado  = gastosReales[p.categoria] || 0;
                const limite   = parseFloat(p.monto_limite);
                const pct      = Math.min(Math.round((gastado / limite) * 100), 150);
                const excedido = gastado > limite;
                const enAlerta = pct >= 80 && !excedido;
                return (
                  <Link key={p.id} to="/presupuestos" className="block group">
                    <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
                      <span className="flex items-center gap-1.5 text-g-600 font-medium truncate min-w-0">
                        <Icon name={CATEGORIAS_ICONOS[p.categoria] || 'ti-tag'} className="w-2.5 h-2.5 flex-shrink-0"
                          style={{ color: CATEGORIAS_COLORES[p.categoria] || '#2452FF' }}/>
                        <span className="truncate">{p.categoria}</span>
                      </span>
                      <span className={`flex-shrink-0 ${excedido ? 'text-red-600 font-medium' : enAlerta ? 'text-amber-600 font-medium' : 'text-g-400'}`}>
                        {fmtShort(gastado)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-g-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all group-active:opacity-70 ${excedido ? 'bg-red-500' : enAlerta ? 'bg-amber-400' : 'bg-g-700'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}/>
                    </div>
                  </Link>
                );
              })}
              {presupuestos.length > 3 && (
                <Link to="/presupuestos" className="text-[10px] text-g-400 hover:text-g-600 block">
                  +{presupuestos.length - 3} más
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Link to="/presupuestos" className="card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
          <div className="w-9 h-9 rounded-xl bg-g-50 flex items-center justify-center flex-shrink-0">
            <Icon name="wallet" className="w-4 h-4 text-g-500"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-g-900">Crea tu primer presupuesto</p>
            <p className="text-[11px] text-g-400">Define límites por categoría y míralos en vivo aquí</p>
          </div>
          <Icon name="chevron-right" className="w-4 h-4 text-g-300 flex-shrink-0"/>
        </Link>
      )}

      {/* Gráficas (recharts) — lazy: se descargan aparte, después del
          resto del Dashboard, para no bloquear el bundle principal que
          se carga en TODAS las pantallas. El skeleton evita el salto
          brusco de layout mientras llega. */}
      <Suspense fallback={
        <div className="card p-4 h-[158px] flex items-center justify-center">
          <Icon name="loader" className="w-5 h-5 animate-spin text-g-300"/>
        </div>
      }>
        <DashboardCharts
          chartData={chartData}
          gastosCategoria={gastosCategoria}
          fmt={fmt}
          fmtShort={fmtShort}
          CATEGORIAS_COLORES={CATEGORIAS_COLORES}
        />
      </Suspense>

      {/* Categorías móvil — lista horizontal */}
      {gastosCategoria.length > 0 && (
        <div className="md:hidden">
          <p className="section-label">Top gastos</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {gastosCategoria.map((c, i) => (
              <div key={i} className="card p-3 flex-shrink-0 min-w-[110px]">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: (CATEGORIAS_COLORES[c.categoria] || '#2452FF') + '25', color: CATEGORIAS_COLORES[c.categoria] || '#2452FF' }}>
                  <Icon name={CATEGORIAS_ICONOS[c.categoria] || 'ti-tag'} className="w-3.5 h-3.5"/>
                </div>
                <p className="text-xs font-medium text-g-700 truncate">{c.categoria}</p>
                <p className="text-sm font-medium text-g-900 mt-0.5">{fmtShort(c.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos recientes */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-g-900">Recientes</p>
          <Link to="/movimientos" className="text-xs text-g-600 hover:text-g-800">Ver todos →</Link>
        </div>
        {movRecientes.length > 0 ? (
          <div className="divide-y divide-g-100/60">
            {movRecientes.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: (CATEGORIAS_COLORES[m.categoria] || '#2452FF') + '20', color: CATEGORIAS_COLORES[m.categoria] || '#2452FF' }}>
                  <Icon name={CATEGORIAS_ICONOS[m.categoria] || 'ti-tag'} className="w-4 h-4"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-g-900 truncate">{m.descripcion || m.categoria}</p>
                  <p className="text-[11px] text-g-400">{m.categoria}</p>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ${m.tipo === 'ingreso' ? 'text-pos' : 'text-g-900'}`}>
                  {m.tipo === 'ingreso' ? '+' : '-'}{fmtShort(m.monto)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Icon name="arrows-exchange" className="w-6 h-6 text-g-300 block mb-2"/>
            <p className="text-sm text-g-400">Aún no hay movimientos</p>
            <Link to="/movimientos" className="text-xs text-g-600 underline mt-1 inline-block">Registrar el primero</Link>
          </div>
        )}
      </div>

      {/* Accesos rápidos móvil */}
      <div className="md:hidden">
        <p className="section-label">Accesos rápidos</p>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { to: '/cierre',       icon: 'ti-calendar-stats', label: 'Cierre',       color: '#2452FF', bg: '#E8EDFF' },
            { to: '/presupuestos', icon: 'ti-wallet',         label: 'Presupuestos', color: '#9A7530', bg: '#F5E8C0' },
            { to: '/deudas',       icon: 'ti-credit-card',    label: 'Deudas',       color: '#E5484D', bg: '#FCEBEB' },
            { to: '/activos',      icon: 'ti-building-bank',  label: 'Activos',      color: '#16A34A', bg: '#E9F9EF' },
          ].map(a => (
            <Link key={a.to} to={a.to} className="card p-2.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: a.bg }}>
                <Icon name={a.icon} className="w-4 h-4" style={{ color: a.color }}/>
              </div>
              <span className="text-[11px] font-medium text-g-700 text-center leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {modalCapital && (
        <PantallaCompleta title="Capital inicial" onClose={() => setModalCapital(false)}>
          <CapitalInicialForm onChange={cargarSaldo} />
        </PantallaCompleta>
      )}

      {modalAbono && (
        <PantallaCompleta title={`Abonar a: ${modalAbono.nombre}`} onClose={() => { setModalAbono(null); setMontoRapido(''); setMedioRapido(''); }}>
          <div className="space-y-4">
            <div className="card p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest text-g-400 mb-1">Pendiente por pagar</p>
              <p className="text-2xl font-medium text-g-900">
                {fmt(parseFloat(modalAbono.monto_total) - parseFloat(modalAbono.monto_pagado))}
              </p>
            </div>
            <div>
              <label className="section-label block mb-1">Monto a abonar</label>
              <input type="text" inputMode="numeric" className="input" placeholder="Ej: 200000" autoFocus
                value={montoRapido} onChange={e => setMontoRapido(e.target.value.replace(',', '.'))}/>
            </div>
            <SelectorMedioPagoRapido value={medioRapido} onChange={setMedioRapido}/>
            <button onClick={confirmarAbonoDeuda} disabled={guardandoRapido} className="btn-primary w-full py-4 disabled:opacity-50">
              {guardandoRapido ? 'Guardando...' : 'Registrar abono'}
            </button>
          </div>
        </PantallaCompleta>
      )}

      {modalAporte && (
        <PantallaCompleta title={`Aportar a: ${modalAporte.nombre}`} onClose={() => { setModalAporte(null); setMontoRapido(''); setMedioRapido(''); }}>
          <div className="space-y-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-medium text-g-900">{fmt(modalAporte.monto_actual)}</p>
              <p className="text-xs text-g-400 mt-1">de {fmt(modalAporte.monto_objetivo)}</p>
              <div className="h-2 bg-g-100 rounded-full overflow-hidden mt-3">
                <div className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min((modalAporte.monto_actual / modalAporte.monto_objetivo) * 100, 100)}%` }}/>
              </div>
            </div>
            <div>
              <label className="section-label block mb-1">Monto a aportar</label>
              <input type="text" inputMode="numeric" className="input" placeholder="Ej: 100000" autoFocus
                value={montoRapido} onChange={e => setMontoRapido(e.target.value.replace(',', '.'))}/>
            </div>
            <SelectorMedioPagoRapido value={medioRapido} onChange={setMedioRapido}/>
            <button onClick={confirmarAporteMeta} disabled={guardandoRapido} className="btn-primary w-full py-4 disabled:opacity-50">
              {guardandoRapido ? 'Guardando...' : 'Registrar aporte 🎯'}
            </button>
          </div>
        </PantallaCompleta>
      )}

      {modalAbonoPrestamo && (
        <PantallaCompleta title={`Pago recibido: ${modalAbonoPrestamo.nombre}`} onClose={() => { setModalAbonoPrestamo(null); setMontoRapido(''); setMedioRapido(''); }}>
          <div className="space-y-4">
            <div className="card p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest text-g-400 mb-1">Pendiente por cobrar</p>
              <p className="text-2xl font-medium text-g-900">
                {fmt(parseFloat(modalAbonoPrestamo.monto_total) - parseFloat(modalAbonoPrestamo.monto_recibido))}
              </p>
            </div>
            <div>
              <label className="section-label block mb-1">Monto que te pagaron</label>
              <input type="text" inputMode="numeric" className="input" placeholder="Ej: 200000" autoFocus
                value={montoRapido} onChange={e => setMontoRapido(e.target.value.replace(',', '.'))}/>
            </div>
            <SelectorMedioPagoRapido value={medioRapido} onChange={setMedioRapido} label="¿A qué cuenta llegó el pago?"/>
            <button onClick={confirmarAbonoPrestamo} disabled={guardandoRapido} className="btn-primary w-full py-4 disabled:opacity-50">
              {guardandoRapido ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </PantallaCompleta>
      )}

    </div>
  );
}
