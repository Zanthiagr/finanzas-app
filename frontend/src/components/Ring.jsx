// Anillo de progreso circular — el hilo conductor visual de toda la app.
// En Fintual, un círculo SIEMPRE significa "cuánto vas de un total": se
// usa en Salud financiera y Presupuestos (Dashboard), el logo y el
// avatar/nivel del nav (Layout), Metas (Patrimonio), módulos (Academia),
// mensajes restantes (Coach), libertad financiera (Calculadora) y el
// avatar (Perfil).
//
// Antes vivía duplicado como una función local casi idéntica en cada uno
// de esos 7 archivos (mismo patrón que el proyecto ya usaba para
// constantes locales, ej. `DIAS` en Calendario.jsx) — se centralizó aquí
// para poder ajustar el look del ring en toda la app desde un solo lugar.
//
// Los defaults (size=56, stroke=6, color dorado, track claro) cubren el
// caso más común (ring sobre fondo blanco). Para rings sobre fondos
// oscuros (hero cards navy, avatar del nav) o superpuestos con
// `absolute inset-0`, pasar `trackColor`/`className` explícitamente en
// el call site — no cambiar los defaults de este archivo para ajustar un
// solo caso, eso rompe silenciosamente a los demás.
export default function Ring({
  pct,
  size = 56,
  stroke = 6,
  color = '#C9A84C',
  trackColor = '#EEF0F5',
  className = '-rotate-90 flex-shrink-0',
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dash}
        className="transition-all duration-700" />
    </svg>
  );
}
