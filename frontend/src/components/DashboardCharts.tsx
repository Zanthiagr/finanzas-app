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

interface DashboardChartsProps {
  chartData: { semana: string; ingreso: number; gasto: number }[];
  gastosCategoria: { name: string; value: number; pct: number }[];
  fmt: (n: number) => string;
  fmtShort: (n: number) => string;
  CATEGORIAS_COLORES: Record<string, string>;
}

export default function DashboardCharts({
  chartData,
  gastosCategoria,
  fmt,
  fmtShort,
  CATEGORIAS_COLORES,
}: DashboardChartsProps) {
  const tieneDatosGrafica = chartData.some((d) => d.ingreso > 0 || d.gasto > 0);

  return (
    <div className="space-y-4">
      {/* Gráfica Ingresos vs Gastos */}
      <div className="card p-5 bg-white border border-g-200/50 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-g-500" />
            <p className="text-sm font-semibold text-g-900">Flujo Semanal (Mes)</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-g-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-gold inline-block" />
              Gastos
            </span>
          </div>
        </div>

        {tieneDatosGrafica ? (
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={12} barGap={4}>
                <XAxis
                  dataKey="semana"
                  tick={{ fontSize: 11, fill: '#8A93A6', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value: any) => [fmt(Number(value)), '']}
                  contentStyle={{
                    backgroundColor: '#0B1220',
                    color: '#ffffff',
                    fontSize: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    padding: '8px 12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                  }}
                  itemStyle={{ color: '#ffffff', padding: '2px 0' }}
                  cursor={{ fill: 'rgba(36, 82, 255, 0.05)' }}
                />
                <Bar dataKey="ingreso" fill="#2452FF" radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="gasto" fill="#C9A84C" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-28 flex flex-col items-center justify-center text-g-400 text-xs gap-1">
            <BarChart3 className="w-6 h-6 stroke-1 text-g-300" />
            <p>Aún no hay transacciones registradas este mes</p>
          </div>
        )}
      </div>

      {/* Categorías de gasto */}
      {gastosCategoria.length > 0 && (
        <div className="card p-5 bg-white border border-g-200/50 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-g-500" />
              <p className="text-sm font-semibold text-g-900">Distribución de Gastos</p>
            </div>
            <span className="text-xs text-g-400 font-medium">Este mes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-36 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gastosCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={58}
                    paddingAngle={3}
                  >
                    {gastosCategoria.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORIAS_COLORES[entry.name] || '#8A93A6'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [fmt(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#0B1220',
                      color: '#ffffff',
                      fontSize: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      padding: '8px 12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {gastosCategoria.slice(0, 4).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORIAS_COLORES[c.name] || '#8A93A6' }}
                    />
                    <span className="text-g-700 font-medium truncate max-w-[120px]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-g-900 font-semibold">{fmtShort(c.value)}</span>
                    <span className="text-g-400 w-8">{c.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
