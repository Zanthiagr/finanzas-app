// Se separó de Dashboard.jsx a propósito: `recharts` es la librería más
// pesada del proyecto (~150-250KB) y Dashboard es la única pantalla que
// NO usa lazy() (carga de inmediato porque es lo primero que ve el
// usuario). Si recharts se queda dentro de Dashboard.jsx, se mete en el
// bundle principal y se descarga en TODAS las pantallas, no solo en el
// Dashboard. Aislándolo acá y cargándolo con lazy() desde Dashboard.jsx,
// el resto de la app (nav, layout, todas las demás páginas) deja de
// pagar ese peso.
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '../utils/icons';

export default function DashboardCharts({ chartData, gastosCategoria, fmt, fmtShort, CATEGORIAS_COLORES }) {
  return (
    <>
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
            <Icon name="chart-bar-off" className="w-4 h-4 mr-2"/> Aún no hay datos este mes
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
    </>
  );
}
