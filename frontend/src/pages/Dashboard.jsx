import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { getMovimientos, getResumen, getPagosProgramados, getSaldoTotal, getPresupuestos, getCierres, getDeudas, getMetas, crearDeudaMovimiento, actualizarMeta, marcarPagoUnicoComoPagado } from '../utils/api';
import { fmt, fmtShort, calcSaludFinanciera, CATEGORIAS_ICONOS, CATEGORIAS_COLORES, getCurrentWeek, todayLocalStr, diaEfectivoPago, DIA_CIERRE_SEMANAL } from '../utils/helpers';
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
  const [presupuestos, setPresupuestos] = useState([]);
  const [gastosReales, setGastosReales] = useState({});
  const [cierres, setCierres]           = useState([]);
  const [tarjetas, setTarjetas]         = useState([]);
  const [deudasActivas, setDeudasActivas] = useState([]);
  const [metasActivas, setMetasActivas]   = useState([]);
  const [modalAbono, setModalAbono]       = useState(null); // deuda seleccionada, o null
  const [modalAporte, setModalAporte]     = useState(null); // meta seleccionada, o null
  const [montoRapido, setMontoRapido]     = useState('');
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
  // falla. "Pendiente" = fijo que cae hoy (recordatorio, aunque se
  // auto-registre al visitar Calendario) O único sin pagar con fecha de
  // hoy o vencida. Se recalcula por fecha, no por hora, así que se ve
  // igual sin importar a qué hora del día se abra la app.
  const cargarPagos = () => {
    getPagosProgramados().then(pagos => {
      const diaHoy = now.getDate();
      const mesHoy = now.getMonth() + 1;
      const anioHoy = now.getFullYear();
      const pendientes = (pagos || [])
        .filter(p => {
          if (!p.activo) return false;
          if (p.tipo === 'unico') return !p.pagado && p.fecha && p.fecha <= hoyStr;
          return diaEfectivoPago(p.dia_mes, mesHoy, anioHoy) === diaHoy; // fijo (o sin "tipo" = fijo, compatibilidad)
        })
        .sort((a, b) => (a.tipo === 'unico' ? -1 : 1)); // vencidos/únicos primero
      setPagosPendientes(pendientes);
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
    ]).then(([r, m, s, pres, cierresData, deudasData, metasData]) => {
      setResumen(r);
      setMovRecientes(m.slice(0, 5));
      setSaldo(s);
      setPresupuestos(pres || []);
      setCierres(cierresData || []);
      setTarjetas((deudasData || []).filter(d => d.tipo === 'Tarjeta de crédito' && d.activa));
      setDeudasActivas((deudasData || []).filter(d => d.activa && parseFloat(d.monto_total) > parseFloat(d.monto_pagado)));
      setMetasActivas((metasData || []).filter(m => !m.completada));
      const gastosMap = {};
      r.porCategoria?.filter(c => c.tipo === 'gasto').forEach(c => {
        gastosMap[c.categoria] = parseFloat(c.total);
      });
      setGastosReales(gastosMap);
    }).catch(console.error).finally(() => setLoading(false));
    cargarPagos();
  }, []);

  const recargarDeudasYMetas = () => {
    Promise.all([getDeudas(), getMetas()]).then(([deudasData, metasData]) => {
      setTarjetas((deudasData || []).filter(d => d.tipo === 'Tarjeta de crédito' && d.activa));
      setDeudasActivas((deudasData || []).filter(d => d.activa && parseFloat(d.monto_total) > parseFloat(d.monto_pagado)));
      setMetasActivas((metasData || []).filter(m => !m.completada));
    }).catch(() => {});
  };

  const confirmarAbonoDeuda = async () => {
    const monto = parseFloat(String(montoRapido).replace(',','.'));
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    setGuardandoRapido(true);
    try {
      await crearDeudaMovimiento({ deuda_id: modalAbono.id, tipo: 'abono', monto, fecha: hoyStr });
      toast.success('Abono registrado');
      setModalAbono(null); setMontoRapido('');
      recargarDeudasYMetas();
    } catch { toast.error('Error registrando el abono'); }
    finally { setGuardandoRapido(false); }
  };

  const confirmarAporteMeta = async () => {
    const abono = parseFloat(String(montoRapido).replace(',','.'));
    if (!abono || abono <= 0) return toast.error('Ingresa un monto válido');
    const nuevo = Math.min(parseFloat(modalAporte.monto_actual) + abono, parseFloat(modalAporte.monto_objetivo));
    const seCompleta = nuevo >= modalAporte.monto_objetivo && !modalAporte.completada;
    setGuardandoRapido(true);
    try {
      await actualizarMeta(modalAporte.id, { ...modalAporte, monto_actual: nuevo, completada: nuevo >= modalAporte.monto_objetivo });
      toast.success(seCompleta ? '¡Meta lograda! 🎉' : 'Aporte registrado');
      if (seCompleta) {
        confetti({ particleCount: 120, spread: 75, startVelocity: 38, gravity: 0.9,
          colors: ['#C9A84C', '#E8D9A8', '#2452FF', '#0B1220'], origin: { y: 0.6 } });
      }
      setModalAporte(null); setMontoRapido('');
      recargarDeudasYMetas();
    } catch { toast.error('Error registrando el aporte'); }
    finally { setGuardandoRapido(false); }
  };

  const confirmarPagoPendiente = (p) => {
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

      {/* Pagos pendientes — fijos que caen hoy + únicos sin pagar (hoy o
          vencidos). Se muestra todo el día porque el filtro es por fecha,
          no por hora del reloj. Cada fila lleva un punto de severidad
          (rojo=vencido, ámbar=vence hoy, gris=fijo informativo) en vez de
          un solo bloque de alerta — así se distingue de un vistazo cuál
          urge más. Los únicos se confirman aquí mismo con un toque. */}
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
              const vencido = p.tipo === 'unico' && p.fecha < hoyStr;
              const statusColor = vencido ? '#E5484D' : p.tipo === 'unico' ? '#F59E0B' : '#8A93A6';
              const statusLabel = p.tipo === 'unico' ? (vencido ? 'Vencido' : 'Vence hoy') : 'Fijo · hoy';
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
                    <span title="Se registra automáticamente" className="flex-shrink-0">
                      <Icon name="repeat" className="w-3.5 h-3.5 text-g-300"/>
                    </span>
                  )}
                </div>
              );
            })}
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
                      <button onClick={() => { setModalAbono(d); setMontoRapido(''); }}
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
                      <button onClick={() => { setModalAporte(m); setMontoRapido(''); }}
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

      {/* Salud financiera — gauge circular: es contenido motivacional, no
          "chrome" de navegación, así que se permite ser expresivo. */}
      <Reveal i={4}>
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
        <PantallaCompleta title={`Abonar a: ${modalAbono.nombre}`} onClose={() => { setModalAbono(null); setMontoRapido(''); }}>
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
            <button onClick={confirmarAbonoDeuda} disabled={guardandoRapido} className="btn-primary w-full py-4 disabled:opacity-50">
              {guardandoRapido ? 'Guardando...' : 'Registrar abono'}
            </button>
          </div>
        </PantallaCompleta>
      )}

      {modalAporte && (
        <PantallaCompleta title={`Aportar a: ${modalAporte.nombre}`} onClose={() => { setModalAporte(null); setMontoRapido(''); }}>
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
            <button onClick={confirmarAporteMeta} disabled={guardandoRapido} className="btn-primary w-full py-4 disabled:opacity-50">
              {guardandoRapido ? 'Guardando...' : 'Registrar aporte 🎯'}
            </button>
          </div>
        </PantallaCompleta>
      )}

    </div>
  );
}
