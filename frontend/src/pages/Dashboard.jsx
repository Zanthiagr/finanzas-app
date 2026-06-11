import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getMovimientos, getResumen } from '../utils/api';
import { fmt, fmtShort, calcSaludFinanciera, CATEGORIAS_ICONOS, CATEGORIAS_COLORES } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, perfil } = useAuth();
  const [resumen, setResumen]       = useState(null);
  const [movRecientes, setMovRecientes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const now  = new Date();
  const mes  = now.getMonth() + 1;
  const anio = now.getFullYear();

  useEffect(() => {
    Promise.all([
      getResumen({ mes, anio }),
      getMovimientos({ mes, anio }),
    ]).then(([r, m]) => {
      setResumen(r);
      setMovRecientes(m.slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const salud = resumen ? calcSaludFinanciera({
    ingresos: resumen.ingresos, gastos: resumen.gastos,
    deudaTotal: 0, balance: resumen.balance,
  }) : 0;

  const saludLabel = salud >= 70 ? 'Excelente mes' : salud >= 50 ? 'Vas bien' : salud >= 30 ? 'Atención' : 'Zona de riesgo';
  const saludColor = salud >= 70 ? 'text-g-200' : salud >= 50 ? 'text-gold' : 'text-red-400';
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

      {/* Salud financiera */}
      <div className="bg-g-800 rounded-2xl p-4 md:p-5 flex items-center gap-4 md:gap-6">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Salud financiera</p>
          <p className={`text-base md:text-lg font-medium mb-3 ${saludColor}`}>{saludLabel}</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold to-g-400 transition-all duration-700"
              style={{ width: `${salud}%` }} />
          </div>
          <p className="text-white/30 text-[11px] mt-1.5 hidden md:block">Basado en ahorro, control de gastos y deuda</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-4xl md:text-5xl font-medium text-white">{salud}</p>
          <p className="text-white/30 text-xs mt-0.5">de 100 pts</p>
          {nombre && (
            <p className="text-gold text-xs mt-2 bg-gold/10 px-2.5 py-0.5 rounded-full inline-block">
              Buen trabajo, {nombre}
            </p>
          )}
        </div>
      </div>

      {/* KPIs - 2 columnas en móvil, 4 en desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos', value: fmt(resumen?.ingresos), sub: '✓ Este mes', color: 'text-g-400' },
          { label: 'Gastos', value: fmt(resumen?.gastos),
            sub: resumen?.gastos > resumen?.ingresos ? '⚠ Supera ingresos' : 'Bajo control',
            color: resumen?.gastos > resumen?.ingresos ? 'text-red-500' : 'text-g-400' },
          { label: 'Balance',
            value: <span className={resumen?.balance >= 0 ? 'text-g-600' : 'text-red-500'}>{fmt(resumen?.balance)}</span>,
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-g-400 inline-block"/>Ingresos</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gold inline-block"/>Gastos</span>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} barSize={10} barGap={3}>
              <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#8AA398' }} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
              <Bar dataKey="ingreso" fill="#4A9E72" radius={[3,3,0,0]}/>
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
                <span className={`text-sm font-medium flex-shrink-0 ${m.tipo === 'ingreso' ? 'text-g-600' : 'text-g-900'}`}>
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
        <div className="grid grid-cols-3 gap-3">
          {[
            { to: '/cierre',  icon: 'ti-calendar-stats', label: 'Cierre', color: '#2D6B4A', bg: '#EDFAF3' },
            { to: '/deudas',  icon: 'ti-credit-card',    label: 'Deudas', color: '#A32D2D', bg: '#FCEBEB' },
            { to: '/activos', icon: 'ti-building-bank',  label: 'Activos',color: '#185FA5', bg: '#E6F1FB' },
          ].map(a => (
            <Link key={a.to} to={a.to} className="card p-3 flex flex-col items-center gap-2 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: a.bg }}>
                <i className={`ti ${a.icon} text-lg`} style={{ color: a.color }}/>
              </div>
              <span className="text-xs font-medium text-g-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
