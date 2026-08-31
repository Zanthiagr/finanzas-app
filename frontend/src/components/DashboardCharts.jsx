import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';

export default function DashboardCharts({
  chartData = [],
  gastosCategoria = [],
  fmt = (n) => `$${n}`,
  fmtShort = (n) => `$${n}`,
  CATEGORIAS_COLORES = {},
}) {
  const tieneDatosGrafica = chartData.some((d) => d.ingreso > 0 || d.gasto > 0);

  return (
    <div className="space-y-4">
      {/* Gráfica Ingresos vs Gastos */}
      <div className="card p-5 bg-white border border-slate-200/60 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-900">Flujo Semanal (Mes)</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#D4AF37] inline-block" />
              Gastos
            </span>
          </div>
        </div>

        {tieneDatosGrafica ? (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={14} barGap={6}>
                <XAxis
                  dataKey="semana"
                  tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value) => [fmt(Number(value)), '']}
                  contentStyle={{
                    backgroundColor: '#090E1A',
                    color: '#ffffff',
                    fontSize: '12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                  }}
                  itemStyle={{ color: '#ffffff', padding: '2px 0' }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                />
                <Bar dataKey="ingreso" fill="#2563EB" radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="gasto" fill="#D4AF37" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5 bg-slate-50 rounded-xl">
            <BarChart3 className="w-6 h-6 stroke-1 text-slate-300" />
            <p className="font-medium">Sin transacciones registradas este mes</p>
          </div>
        )}
      </div>

      {/* Gráfica Distribución por Categorías */}
      <div className="card p-5 bg-white border border-slate-200/60 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-900">Distribución de Gastos</p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">Por categoría</span>
        </div>

        {gastosCategoria.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-40 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gastosCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {gastosCategoria.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORIAS_COLORES[entry.name] || '#94A3B8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [fmt(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#090E1A',
                      color: '#ffffff',
                      fontSize: '12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pr-1 overflow-y-auto max-h-36">
              {gastosCategoria.slice(0, 5).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORIAS_COLORES[c.name] || '#94A3B8' }}
                    />
                    <span className="text-slate-700 font-semibold truncate max-w-[110px]">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-slate-900 font-bold">{fmtShort(c.value)}</span>
                    <span className="text-slate-400 font-medium w-7">{c.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5 bg-slate-50 rounded-xl">
            <PieIcon className="w-6 h-6 stroke-1 text-slate-300" />
            <p className="font-medium">No se han registrado gastos en el mes</p>
          </div>
        )}
      </div>
    </div>
  );
}
