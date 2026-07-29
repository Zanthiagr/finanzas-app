import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getMovimientos, getResumen, getPagosProgramados, getSaldoTotal, getPresupuestos, getCierres, marcarPagoUnicoComoPagado } from '../utils/api';
import { fmt, fmtShort, calcSaludFinanciera, CATEGORIAS_ICONOS, CATEGORIAS_COLORES, labelMedioPago, getCurrentWeek, DIA_CIERRE_SEMANAL } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import PantallaCompleta from '../components/PantallaCompleta';
import CapitalInicialForm from '../components/CapitalInicialForm';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/confirm';

// Anillo de progreso circular — mismo lenguaje visual que el gauge de
// "Salud financiera" (abajo), reutilizado para presupuestos: en Fintual
// el círculo es cómo se representa "cuánto vas de un total".
function Ring({ pct, size = 56, stroke = 6, color, trackColor = '#EEF0F5' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - Math.min(pct, 100) / 100);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90 flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dash}
        className="transition-all duration-700" />
    </svg>
  );
}

const DIAS_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function Dashboard() {
  const { user, perfil } = useAuth();
  const [resumen, setResumen]           = useState(null);
  const [saldo, setSaldo]               = useState(null);
  const [movRecientes, setMovRecientes] = useState([]);
  const [pagosPendientes, setPagosPendientes] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [gastosReales, setGastosReales] = useState({});
  const [cierres, setCierres]           = useState([]);
  const [marcandoPagoId, setMarcandoPagoId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modalCapital, setModalCapital] = useState(false);
  const [ocultarSaldo, setOcultarSaldo] = useState(false);
  const now    = new Date();
  const mes    = now.getMonth() + 1;
  const anio   = now.getFullYear();
  const hoyStr = now.toISOString().split('T')[0];

  const cargarSaldo = () => getSaldoTotal().then(setSaldo).catch(console.error);

  // Pagos pendientes — separado del resto para no bloquear el dashboard si
  // falla. "Pendiente" = fijo que cae hoy (recordatorio, aunque se
  // auto-registre al visitar Calendario) O único sin pagar con fecha de
  // hoy o vencida. Se recalcula por fecha, no por hora, así que se ve
  // igual sin importar a qué hora del día se abra la app.
  const cargarPagos = () => {
    getPagosProgramados().then(pagos => {
      const diaHoy = now.getDate();
      const pendientes = (pagos || [])
        .filter(p => {
          if (!p.activo) return false;
          if (p.tipo === 'unico') return !p.pagado && p.fecha && p.fecha <= hoyStr;
          return p.dia_mes === diaHoy; // fijo (o sin "tipo" = fijo, compatibilidad)
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
    ]).then(([r, m, s, pres, cierresData]) => {
      setResumen(r);
      setMovRecientes(m.slice(0, 5));
      setSaldo(s);
      setPresupuestos(pres || []);
      setCierres(cierresData || []);
      const gastosMap = {};
      r.porCategoria?.filter(c => c.tipo === 'gasto').forEach(c => {
        gastosMap[c.categoria] = parseFloat(c.total);
      });
      setGastosReales(gastosMap);
    }).catch(console.error).finally(() => setLoading(false));
    cargarPagos();
  }, []);

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
      <i className="ti ti-loader animate-spin text-2xl text-g-400" />
    </div>
  );

  return (
    <div className="space-y-4 page-enter">

      {/* Dinero disponible — saldo real acumulado, NUNCA se reinicia por mes.
          Tratado como la "tarjeta física" del producto: es el elemento que
          más se ve cada día, así que lleva el tratamiento más premium. */}
      <div className="card-premium">
        {/* brillos decorativos — puramente atmosféricos, no interactivos */}
        <div className="card-premium-glow -top-24 -right-16 w-64 h-64 bg-blue-500 opacity-20" />
        <div className="card-premium-glow -bottom-20 -left-10 w-52 h-52 bg-gold opacity-[0.08]" />

        <div className="relative flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium">
            Dinero disponible
          </p>
          {/* chip decorativo — guiño a tarjeta física */}
          <div className="w-8 h-6 rounded-md bg-gradient-to-br from-gold to-gold-dark opacity-90" />
        </div>

        <div className="relative mt-3 flex items-center gap-2">
          <span className={`text-[28px] md:text-[34px] font-semibold tracking-tight tabular-nums ${saldo?.saldoTotal < 0 ? 'text-red-300' : 'text-white'}`}>
            {ocultarSaldo ? '••••••••' : fmt(saldo?.saldoTotal || 0)}
          </span>
          <button onClick={() => setOcultarSaldo(!ocultarSaldo)} className="text-white/50 hover:text-white/80 transition-colors flex-shrink-0">
            <i className={`ti ${ocultarSaldo ? 'ti-eye' : 'ti-eye-off'} text-lg`} />
          </button>
        </div>
        <p className="relative text-white/40 text-[11px] mt-1">Total acumulado — no se reinicia por mes</p>

        {saldo?.porMedio && Object.keys(saldo.porMedio).length > 0 && (
          <div className="relative flex gap-2 mt-4 overflow-x-auto pb-0.5">
            {Object.entries(saldo.porMedio)
              .filter(([key, d]) => key !== 'transferencia' && d && (d.ingresos !== 0 || d.gastos !== 0))
              .map(([key, d]) => (
                <div key={key} className="flex-shrink-0 bg-white/10 backdrop-blur rounded-lg px-2.5 py-1.5">
                  <p className="text-[10px] text-white/50 whitespace-nowrap">{labelMedioPago(key)}</p>
                  <p className="text-xs font-medium text-white">{ocultarSaldo ? '••••' : fmtShort(d.ingresos - d.gastos)}</p>
                </div>
              ))}
          </div>
        )}

        <button onClick={() => setModalCapital(true)}
          className="relative mt-4 text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1">
          <i className="ti ti-pencil text-[11px]"/> Editar capital inicial
        </button>
      </div>

      {/* Pagos pendientes — fijos que caen hoy + únicos sin pagar (hoy o
          vencidos). Se muestra todo el día porque el filtro es por fecha,
          no por hora del reloj. Cada fila lleva un punto de severidad
          (rojo=vencido, ámbar=vence hoy, gris=fijo informativo) en vez de
          un solo bloque de alerta — así se distingue de un vistazo cuál
          urge más. Los únicos se confirman aquí mismo con un toque. */}
      {pagosPendientes.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-bell-ringing text-amber-600 text-sm"/>
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
                      <i className={`ti ti-check text-[13px] text-g-300 group-hover:text-white ${marcandoPagoId === p.id ? 'animate-pulse' : ''}`}/>
                    </button>
                  ) : (
                    <i className="ti ti-repeat text-g-300 text-sm flex-shrink-0" title="Se registra automáticamente"/>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recordatorio de cierre semanal — aparece el día designado
          (domingo por defecto, ver DIA_CIERRE_SEMANAL en helpers.js)
          mientras la semana actual siga sin cerrar. La franja de días
          responde visualmente "qué día de la semana toca cerrar": el
          día de cierre queda marcado en dorado todo el tiempo. */}
      {esDiaDeCierre && !semanaYaCerrada && (
        <Link to="/cierre" className="relative overflow-hidden rounded-2xl bg-g-800 p-4 flex items-center gap-4 active:scale-[0.99] transition-transform">
          <div className="card-premium-glow -top-10 -right-10 w-32 h-32 bg-gold opacity-[0.12]"/>
          <div className="relative w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-calendar-check text-gold text-lg"/>
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Hoy toca cerrar la semana {semanaActual}</p>
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
          <i className="ti ti-chevron-right text-white/30 flex-shrink-0 relative"/>
        </Link>
      )}

      {/* Salud financiera — gauge circular: es contenido motivacional, no
          "chrome" de navegación, así que se permite ser expresivo. */}
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
            <p className="text-gold text-xs mt-2 bg-gold/10 px-2.5 py-0.5 rounded-full inline-block">
              Buen trabajo, {nombre}
            </p>
          )}
        </div>
      </div>

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
                        <i className={`ti ${CATEGORIAS_ICONOS[p.categoria] || 'ti-tag'} text-[10px] flex-shrink-0`}
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
            <i className="ti ti-wallet text-g-500 text-base"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-g-900">Crea tu primer presupuesto</p>
            <p className="text-[11px] text-g-400">Define límites por categoría y míralos en vivo aquí</p>
          </div>
          <i className="ti ti-chevron-right text-g-300 flex-shrink-0"/>
        </Link>
      )}

      {/* Gráfica — full width en móvil */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-g-900">Ingresos vs Gastos</p>
          <div className="flex gap-3 text-[11px] text-g-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-600 inline-block"/>Ingresos</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gold inline-block"/>Gastos</span>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} barSize={10} barGap={3}>
              <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#8A93A6' }} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #DCE1EC' }}
                cursor={{ fill: 'rgba(36,82,255,0.06)' }}
                isAnimationActive={false}
                wrapperStyle={{ zIndex: 20 }}
              />
              <Bar dataKey="ingreso" fill="#2452FF" radius={[3,3,0,0]}/>
              <Bar dataKey="gasto"   fill="#C9A84C" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-24 flex items-center justify-center text-g-400 text-sm">
            <i className="ti ti-chart-bar-off mr-2"/> Aún no hay datos este mes
          </div>
        )}
      </div>

      {/* Categorías — solo en desktop */}
      {gastosCategoria.length > 0 && (
        <div className="hidden md:block card p-4">
          <p className="text-sm font-medium text-g-900 mb-3">Gastos por categoría</p>
          <div className="flex items-center gap-3">
            <PieChart width={90} height={90}>
              <Pie data={gastosCategoria} dataKey="total" cx="50%" cy="50%" innerRadius={28} outerRadius={44} paddingAngle={2}>
                {gastosCategoria.map((c, i) => <Cell key={i} fill={CATEGORIAS_COLORES[c.categoria] || '#2452FF'}/>)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-1.5 flex-1">
              {gastosCategoria.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORIAS_COLORES[c.categoria] || '#2452FF' }}/>
                    <span className="text-g-700 truncate max-w-[80px]">{c.categoria}</span>
                  </div>
                  <span className="text-g-500 font-medium">{fmtShort(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Categorías móvil — lista horizontal */}
      {gastosCategoria.length > 0 && (
        <div className="md:hidden">
          <p className="section-label">Top gastos</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {gastosCategoria.map((c, i) => (
              <div key={i} className="card p-3 flex-shrink-0 min-w-[110px]">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: (CATEGORIAS_COLORES[c.categoria] || '#2452FF') + '25', color: CATEGORIAS_COLORES[c.categoria] || '#2452FF' }}>
                  <i className={`ti ${CATEGORIAS_ICONOS[c.categoria] || 'ti-tag'} text-sm`}/>
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
                  <i className={`ti ${CATEGORIAS_ICONOS[m.categoria] || 'ti-tag'}`}/>
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
            <i className="ti ti-arrows-exchange text-2xl text-g-300 block mb-2"/>
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
            { to: '/deudas',       icon: 'ti-credit-card',    label: 'Deudas',       color: '#C0303A', bg: '#FCEBEB' },
            { to: '/activos',      icon: 'ti-building-bank',  label: 'Activos',      color: '#16A34A', bg: '#E9F9EF' },
          ].map(a => (
            <Link key={a.to} to={a.to} className="card p-2.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: a.bg }}>
                <i className={`ti ${a.icon} text-base`} style={{ color: a.color }}/>
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

    </div>
  );
}
