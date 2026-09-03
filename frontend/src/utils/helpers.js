export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export const fmtShort = (n) => {
  if (n === undefined || n === null) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
};

// ── Check-in emocional del cierre semanal (1 toque, sin fricción) ──
// Se guarda como texto plano en cierres_semanales.estado_animo. El valor
// es opcional a propósito: escribir la reflexión ya pide esfuerzo, obligar
// también el mood baja la tasa de cierre. Usar en CierreSemanal.jsx y
// Reporte.jsx para que el emoji/color se vea igual en toda la app.
export const ESTADOS_ANIMO = [
  { valor: 'tranquilo', emoji: '😌', label: 'Tranquilo', color: '#16A34A' },  // = pos
  { valor: 'orgulloso',  emoji: '💪', label: 'Orgulloso', color: '#C9A84C' }, // = gold
  { valor: 'neutral',    emoji: '😐', label: 'Neutral',   color: '#8A93A6' }, // = g-400
  { valor: 'estresado',  emoji: '😣', label: 'Estresado', color: '#E5484D' }, // = neg
];
export const getEstadoAnimo = (valor) => ESTADOS_ANIMO.find(e => e.valor === valor);

// ── Fechas: SIEMPRE en hora local, nunca en UTC ─────────────
// Bug histórico: `new Date("2026-08-01")` se interpreta como medianoche
// UTC. En Colombia (UTC-5) eso cae en "31 jul 19:00" hora local, así que
// cualquier .getMonth()/.getDate()/.toLocaleDateString() sobre ese objeto
// muestra un día antes. Y `new Date().toISOString().split('T')[0]` hace
// lo opuesto: después de las 7pm hora Colombia ya es "mañana" en UTC.
// Estas dos funciones son el único punto de conversión fecha↔string que
// debe usarse en toda la app — nunca construir esas strings a mano.

// String "YYYY-MM-DD" → Date en hora LOCAL (no UTC). Úsala en vez de
// `new Date(dateString)` para cualquier fecha que venga de un <input
// type="date"> o de la base de datos.
export const parseLocalDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  const [y, m, day] = String(d).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day);
};

// Date (o vacío = ahora mismo) → string "YYYY-MM-DD" en hora LOCAL.
// Úsala en vez de `new Date().toISOString().split('T')[0]` para "la
// fecha de hoy" — toISOString() siempre da la fecha en UTC.
export const todayLocalStr = (d = new Date()) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fmtDate = (d) => {
  if (!d) return '';
  return parseLocalDate(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateShort = (d) => {
  if (!d) return '';
  return parseLocalDate(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

// Semana DENTRO DEL MES — SIEMPRE 4 por mes, sin importar cuántos días
// tenga (28 a 31). Semanas 1-3 son de 7 días (1-7, 8-14, 15-21); la
// semana 4 absorbe todo lo que quede (22 hasta el último día del mes:
// entre 6 y 10 días según el mes). Antes se usaba Math.ceil(día/7), que
// daba 5 "semanas" en casi todos los meses, con una 5ª de solo 1-3 días
// — confuso porque nadie piensa el mes en 5 semanas.
export const getSemanaDelMes = (dia) => {
  if (dia <= 7)  return 1;
  if (dia <= 14) return 2;
  if (dia <= 21) return 3;
  return 4;
};

// Último día real de un mes (28-31). mes es 1-12 (no 0-11 como Date nativo).
export const ultimoDiaDelMes = (mes, anio) => new Date(anio, mes, 0).getDate();

// Día en que efectivamente cae un pago programado con día fijo, para UN
// mes concreto. Si el usuario programó "día 31" pero el mes solo tiene
// 30 días (o 28/29 en febrero), el pago se ajusta al último día de ESE
// mes — el mismo comportamiento que usan bancos y plataformas de cobro
// recurrente (Netflix, arriendo, etc.) en vez de saltarse el mes entero.
export const diaEfectivoPago = (diaMes, mes, anio) => Math.min(diaMes, ultimoDiaDelMes(mes, anio));

export const getCurrentWeek = () => getSemanaDelMes(new Date().getDate());

// Día de la semana en que se recomienda hacer el cierre semanal.
// 0=domingo, 1=lunes ... 6=sábado. Se usa en Dashboard para mostrar el
// recordatorio de cierre. Cambiar este único valor ajusta el recordatorio
// en toda la app — domingo por defecto (cierre de la semana que termina).
export const DIA_CIERRE_SEMANAL = 0;

export const calcSaludFinanciera = ({ ingresos, gastos, deudaTotal, balance }) => {
  if (!ingresos) return 0;
  const ahorroPct = Math.min((balance / ingresos) * 100, 40);
  const gastoPct  = Math.min(((ingresos - gastos) / ingresos) * 100, 30);
  const deudaPct  = Math.max(30 - (deudaTotal / ingresos) * 10, 0);
  return Math.min(Math.round(ahorroPct + gastoPct + deudaPct), 100);
};

export const CATEGORIAS_ICONOS = {
  'Salario': 'ti-briefcase',
  'Freelance': 'ti-device-laptop',
  'Negocio': 'ti-building-store',
  'Alimentación': 'ti-shopping-cart',
  'Transporte': 'ti-bus',
  'Servicios': 'ti-wifi',
  'Salud': 'ti-heart-rate-monitor',
  'Educación': 'ti-school',
  'Entretenimiento': 'ti-device-tv',
  'Ropa': 'ti-shirt',
  'Vivienda': 'ti-home',
  'Deudas': 'ti-credit-card',
};

// Antes: 10 hues completamente saturados sin relación entre sí (rojo,
// azul, morado, rosa, café, naranja, verde azulado, gris, rojo oscuro,
// verde) — un "arcoíris" que no tenía nada que ver con la identidad
// navy/dorado del resto de la app. Ahora: Ingresos/Deudas usan los MISMOS
// tokens pos/neg que el resto de la app usa para "dinero entra/sale" (en
// vez de un verde/rojo inventado aparte), y el resto usa la paleta de
// acentos compartida (ver `accent` en tailwind.config.js) — apagada, de
// la misma familia tonal que navy+dorado.
export const CATEGORIAS_COLORES = {
  'Salario': '#16A34A', 'Freelance': '#16A34A', 'Negocio': '#16A34A',
  'Alimentación': '#B8663F', 'Transporte': '#4E7AA8', 'Servicios': '#7C7594',
  'Salud': '#B15C7C', 'Educación': '#A8792E', 'Entretenimiento': '#BC7748',
  'Ropa': '#4F8F76', 'Vivienda': '#5B6472', 'Deudas': '#E5484D',
};

// Bancos/billeteras digitales disponibles como medio de pago.
// Compartido entre Movimientos, Onboarding y el editor de capital inicial.
export const BANCOS = [
  { value: 'bancolombia', label: '🟡 Bancolombia' },
  { value: 'davivienda',  label: '🔴 Davivienda' },
  { value: 'bogota',      label: '🔵 Banco de Bogotá' },
  { value: 'nequi',       label: '🟣 Nequi' },
  { value: 'daviplata',   label: '🟠 Daviplata' },
  { value: 'bbva',        label: '🔷 BBVA' },
  { value: 'occidente',   label: '🟤 Banco de Occidente' },
  { value: 'popular',     label: '⚫ Banco Popular' },
  { value: 'itau',        label: '🔶 Itaú' },
  { value: 'scotiabank',  label: '🔴 Scotiabank' },
  { value: 'falabella',   label: '🟢 Falabella' },
  { value: 'nu',          label: '🟣 Nu (Nubank)' },
  { value: 'lulo',        label: '🟡 Lulo Bank' },
  { value: 'otro_banco',  label: '🏦 Otro banco' },
];

// Todas las claves válidas de medio_pago, incluyendo efectivo — útil para
// mostrar etiquetas legibles a partir de la clave guardada en Supabase.
export const MEDIOS_PAGO = [{ value: 'efectivo', label: '💵 Efectivo' }, ...BANCOS];

export const labelMedioPago = (clave) =>
  MEDIOS_PAGO.find(m => m.value === clave)?.label || clave;
