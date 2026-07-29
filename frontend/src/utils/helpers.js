export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export const fmtShort = (n) => {
  if (n === undefined || n === null) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
};

export const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateShort = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

// Semana DENTRO DEL MES actual (1 a 5) — coincide con el cálculo de api.js
export const getCurrentWeek = () => {
  const d = new Date();
  return Math.ceil(d.getDate() / 7);
};

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

export const CATEGORIAS_COLORES = {
  'Salario': '#2D6B4A', 'Freelance': '#2D6B4A', 'Negocio': '#2D6B4A',
  'Alimentación': '#E24B4A', 'Transporte': '#378ADD', 'Servicios': '#7F77DD',
  'Salud': '#D4537E', 'Educación': '#BA7517', 'Entretenimiento': '#D85A30',
  'Ropa': '#1D9E75', 'Vivienda': '#5F5E5A', 'Deudas': '#A32D2D',
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
