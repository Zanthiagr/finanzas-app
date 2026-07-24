import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getMovimientos, getResumen, getPagosProgramados, getSaldoTotal } from '../utils/api';
import { fmt, fmtShort, calcSaludFinanciera, CATEGORIAS_ICONOS, CATEGORIAS_COLORES, labelMedioPago } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import PantallaCompleta from '../components/PantallaCompleta';
import CapitalInicialForm from '../components/CapitalInicialForm';

export default function Dashboard() {
  const { user, perfil } = useAuth();
  const [resumen, setResumen]           = useState(null);
  const [saldo, setSaldo]               = useState(null);
  const [movRecientes, setMovRecientes] = useState([]);
  const [pagosHoy, setPagosHoy]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalCapital, setModalCapital] = useState(false);
  const [ocultarSaldo, setOcultarSaldo] = useState(false);
  const now  = new Date();
  const mes  = now.getMonth() + 1;
  const anio = now.getFullYear();

  const cargarSaldo = () => getSaldoTotal().then(setSaldo).catch(console.error);

  useEffect(() => {
    Promise.all([
      getResumen({ mes, anio }),
      getMovimientos({ mes, anio }),
      getSaldoTotal(),
    ]).then(([r, m, s]) => {
      setResumen(r);
      setMovRecientes(m.slice(0, 5));
      setSaldo(s);
    }).catch(console.error).finally(() => setLoading(false));
    // Pagos de hoy — separado para no bloquear si falla
    getPagosProgramados().then(pagos => {
      const diaHoy = new Date().getDate();
      setPagosHoy((pagos || []).filter(p => p.activo && p.dia_mes === diaHoy));
    }).catch(() => {});
  }, []);

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

      {/* Pagos programados para hoy */}
      {pagosHoy.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className="ti ti-bell-ringing text-amber-600 text-base"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 mb-1">
                {pagosHoy.length === 1 ? 'Pago programado para hoy' : `${pagosHoy.length} pagos programados para hoy`}
              </p>
              {pagosHoy.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-xs text-amber-700 truncate">{p.nombre}</span>
                  <span className="text-xs font-medium text-amber-800 ml-2 flex-shrink-0">
                    {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(p.monto)}
                  </span>
                </div>
              ))}
              <Link to="/calendario" className="text-[11px] text-amber-600 underline mt-1.5 inline-block">Ver calendario →</Link>
            </div>
          </div>
        </div>
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
                {gastosCategoria.map((c, i) => <Cell key={i} fill={CATEGORIAS_COLORES[c.categoria] || '#9ED4B8'}/>)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-1.5 flex-1">
              {gastosCategoria.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORIAS_COLORES[c.categoria] || '#9ED4B8' }}/>
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
                  style={{ background: (CATEGORIAS_COLORES[c.categoria] || '#9ED4B8') + '25', color: CATEGORIAS_COLORES[c.categoria] || '#2D6B4A' }}>
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
                  style={{ background: (CATEGORIAS_COLORES[m.categoria] || '#9ED4B8') + '20', color: CATEGORIAS_COLORES[m.categoria] || '#2D6B4A' }}>
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
