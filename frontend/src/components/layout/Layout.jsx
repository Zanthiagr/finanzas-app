import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

// Anillo de progreso — el mismo lenguaje visual que "Salud financiera" y
// "Presupuestos" en el Dashboard. Aquí es lo que convierte el logo y el
// avatar de navegación en parte de la misma identidad, no en elementos
// sueltos: en Fintual, el círculo SIEMPRE significa "cuánto vas de algo".
function Ring({ pct, size = 40, stroke = 3, color, trackColor = 'rgba(255,255,255,0.14)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90 absolute inset-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke}/>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)}
        className="transition-all duration-700"/>
    </svg>
  );
}

// Logomark — un ring dorado al 72% sobre gradiente navy (mismo gradiente
// de card-premium). No es un ícono de billetera genérico de fintech: es
// literalmente la promesa del producto ("ves tu progreso") convertida en
// marca.
function LogoMark({ size = 32 }) {
  return (
    <div className="relative flex items-center justify-center flex-shrink-0 rounded-[9px]"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #10224F 0%, #0B1E4D 55%, #060B18 100%)' }}>
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} className="-rotate-90">
        <circle cx="12" cy="12" r="8" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2.6"/>
        <circle cx="12" cy="12" r="8" fill="none" stroke="#C9A84C" strokeWidth="2.6" strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 8} strokeDashoffset={2 * Math.PI * 8 * 0.28}/>
      </svg>
    </div>
  );
}

const NAV_DESKTOP = [
  { to: '/',             icon: 'ti-layout-dashboard', label: 'Resumen',        group: 'principal' },
  { to: '/movimientos',  icon: 'ti-arrows-exchange',  label: 'Movimientos',    group: 'principal' },
  { to: '/cierre',       icon: 'ti-calendar-stats',   label: 'Cierre semanal', group: 'principal' },
  { to: '/calendario',  icon: 'ti-calendar-month',   label: 'Calendario',     group: 'principal' },
  { to: '/presupuestos', icon: 'ti-wallet',           label: 'Presupuestos',   group: 'principal' },
  { to: '/reporte',      icon: 'ti-file-download',    label: 'Reporte PDF',    group: 'principal' },
  { to: '/activos',      icon: 'ti-building-bank',    label: 'Activos',        group: 'patrimonio' },
  { to: '/deudas',       icon: 'ti-credit-card',      label: 'Deudas',         group: 'patrimonio' },
  { to: '/metas',        icon: 'ti-target',           label: 'Metas',          group: 'patrimonio' },
  { to: '/mental',       icon: 'ti-brain',            label: 'Mentalidad',     group: 'crecimiento' },
  { to: '/academia',     icon: 'ti-school',           label: 'Academia',       group: 'crecimiento' },
  { to: '/calculadora',  icon: 'ti-calculator',       label: 'Calculadoras',   group: 'crecimiento' },
  { to: '/coach',        icon: 'ti-robot',            label: 'Coach IA',       group: 'crecimiento' },
];

// Tabs principales móvil — los 4 más usados + "Más"
// Calendario en el centro: es de uso frecuente (pagos programados,
// historial por día) y no depende de una función externa como el Coach.
const NAV_MOBILE_MAIN = [
  { to: '/',            icon: 'ti-layout-dashboard', label: 'Inicio' },
  { to: '/movimientos', icon: 'ti-arrows-exchange',  label: 'Gastos' },
  { to: '/calendario',  icon: 'ti-calendar-month',   label: 'Calendario' },
  { to: '/mental',      icon: 'ti-brain',            label: 'Mente' },
];

// Secciones del menú "Más" — agrupadas con el mismo criterio que el
// sidebar de escritorio (Patrimonio / Seguimiento / Crecimiento), más un
// grupo de Cuenta. Antes era una sola parrilla plana de 9 iconos sin
// jerarquía; agrupar reduce la carga cognitiva de escanear el menú.
const NAV_MOBILE_MAS_GRUPOS = [
  {
    label: 'Patrimonio',
    items: [
      { to: '/activos',      icon: 'ti-building-bank', label: 'Activos',      color: '#185FA5', bg: '#E6F1FB' },
      { to: '/deudas',       icon: 'ti-credit-card',   label: 'Deudas',       color: '#A32D2D', bg: '#FCEBEB' },
      { to: '/metas',        icon: 'ti-target',        label: 'Metas',        color: '#0F6E56', bg: '#E1F5EE' },
      { to: '/presupuestos', icon: 'ti-wallet',        label: 'Presupuestos', color: '#C9A84C', bg: '#F5E8C0' },
    ],
  },
  {
    label: 'Seguimiento',
    items: [
      { to: '/cierre',  icon: 'ti-calendar-stats', label: 'Cierre',      color: '#2452FF', bg: '#E8EDFF' },
      { to: '/reporte', icon: 'ti-file-download',  label: 'Reporte PDF', color: '#0F6E56', bg: '#E1F5EE' },
    ],
  },
  {
    label: 'Crecimiento',
    items: [
      { to: '/academia',    icon: 'ti-school',     label: 'Academia',     color: '#BA7517', bg: '#FAEEDA' },
      { to: '/calculadora', icon: 'ti-calculator', label: 'Calculadoras', color: '#534AB7', bg: '#EEEDFE' },
      { to: '/coach',       icon: 'ti-robot',      label: 'Coach IA',     color: '#185FA5', bg: '#E6F1FB' },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { to: '/perfil', icon: 'ti-user-circle', label: 'Mi perfil', color: '#151B2E', bg: '#EEF0F5' },
    ],
  },
];

const groups = [
  { key: 'principal',   label: 'Principal' },
  { key: 'patrimonio',  label: 'Patrimonio' },
  { key: 'crecimiento', label: 'Crecimiento' },
];

const PAGE_TITLES = {
  '/':              'Resumen',
  '/movimientos':   'Movimientos',
  '/cierre':        'Cierre semanal',
  '/presupuestos':  'Presupuestos',
  '/reporte':       'Reporte PDF',
  '/activos':       'Activos',
  '/deudas':        'Deudas',
  '/metas':         'Metas',
  '/mental':        'Mentalidad',
  '/academia':      'Academia',
  '/calculadora':   'Calculadoras',
  '/coach':         'Coach IA',
  '/calendario':    'Calendario',
  '/perfil':        'Mi perfil',
};

export default function Layout({ children }) {
  const { user, perfil, logout } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [masOpen, setMasOpen] = useState(false);

  const initials = (perfil?.nombre || user?.user_metadata?.full_name || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Fintual';
  const xp = perfil?.puntos_xp || 0;
  const nivel = Math.floor(xp / 100) + 1;
  const progresoNivel = xp % 100;

  // Saber si la página actual está en el menú "Más" (ahora agrupado)
  const enMenuMas = NAV_MOBILE_MAS_GRUPOS.some(g => g.items.some(n => n.to === location.pathname));

  const irA = (to) => {
    setMasOpen(false);
    navigate(to);
  };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="hidden md:flex w-52 flex-shrink-0 bg-g-800 flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <LogoMark/>
            <div>
              <span className="text-white font-medium text-base tracking-tight block leading-tight">Fintual</span>
              <p className="text-white/30 text-[10px] leading-tight">Tu camino a la libertad</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {groups.map(g => (
            <div key={g.key} className="mb-1">
              <p className="text-[9px] uppercase tracking-widest text-white/25 font-medium px-5 mb-1.5 mt-4">{g.label}</p>
              {NAV_DESKTOP.filter(n => n.group === g.key).map(n => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 mx-3 px-3 py-2 rounded-lg text-[13px] transition-all ${
                      isActive
                        ? 'text-white bg-white/[0.07]'
                        : 'text-white/50 hover:text-white/85 hover:bg-white/5'
                    }`}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gold"/>}
                      <i className={`ti ${n.icon} text-base ${isActive ? 'text-gold' : ''}`}/>
                      {n.label}
                      {n.to === '/coach' && (
                        <span className="ml-auto text-[9px] bg-blue-500/20 text-blue-200 px-1.5 py-0.5 rounded-full">IA</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <button onClick={() => navigate('/perfil')} className="flex items-center gap-2.5 w-full text-left hover:opacity-90 transition-opacity">
            <div className="relative w-9 h-9 flex-shrink-0">
              <Ring pct={progresoNivel} size={36} stroke={2.5} color="#C9A84C"/>
              <div className="absolute inset-[3px] rounded-full bg-gold flex items-center justify-center text-g-900 text-[10px] font-semibold">
                {initials}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/85 text-xs font-medium truncate">{perfil?.nombre || user?.user_metadata?.full_name}</p>
              <p className="text-white/35 text-[10px]">Nivel {nivel} · {xp} XP</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar desktop — hairline azul→dorado en vez de un borde gris
            plano: un acento de marca discreto que aparece en cada pantalla. */}
        <header className="hidden md:flex relative bg-white px-6 h-14 items-center justify-between flex-shrink-0">
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, rgba(36,82,255,0.22), rgba(201,168,76,0.4))' }}/>
          <h1 className="text-sm font-medium text-g-800">{pageTitle}</h1>
          <span className="text-xs px-3 py-1.5 rounded-full bg-g-50 text-g-600 border border-g-200/60 font-medium">
            {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </span>
        </header>

        {/* Topbar móvil */}
        <header className="md:hidden relative overflow-hidden bg-g-800 px-4 pt-8 pb-3 flex-shrink-0">
          <div className="card-premium-glow -top-16 -right-8 w-40 h-40 bg-gold opacity-[0.09]"/>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[11px]">Hola,</p>
              <p className="text-white font-medium text-[15px] leading-tight">
                {(perfil?.nombre || user?.user_metadata?.full_name || '').split(' ')[0]}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-white/55">
                {new Date().toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => navigate('/perfil')} className="relative w-8 h-8 flex-shrink-0 active:scale-90 transition-transform">
                <Ring pct={progresoNivel} size={32} stroke={2.5} color="#C9A84C"/>
                <div className="absolute inset-[3px] rounded-full bg-gold flex items-center justify-center text-g-900 text-[10px] font-semibold">
                  {initials}
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Header secundario móvil — en páginas del menú "Más" da una salida clara al inicio */}
        {enMenuMas && (
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-g-100 flex-shrink-0">
            <button onClick={() => navigate('/')}
              className="w-8 h-8 rounded-full bg-g-50 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform">
              <i className="ti ti-arrow-left text-g-700 text-sm"/>
            </button>
            <p className="text-sm font-medium text-g-900">{pageTitle}</p>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pb-6 page-enter"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
          <div className="max-w-2xl mx-auto md:pb-0">
            {children}
          </div>
        </main>

        {/* ── MENÚ MÁS (sheet desde abajo) ── */}
        {/* Siempre montado (no solo cuando masOpen) para poder animar tanto
            la apertura como el cierre con transform/opacity — antes aparecía
            de golpe sin transición. */}
        <div
          className={`md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
            masOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setMasOpen(false)}
        />
        <div
          className={`md:hidden fixed left-0 right-0 bg-white rounded-t-[28px] z-50 p-5 shadow-2xl
            transition-transform duration-300 ease-out ${masOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)', maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-g-200"/>
          </div>

          <div className="space-y-4 mb-4">
            {NAV_MOBILE_MAS_GRUPOS.map(grupo => (
              <div key={grupo.label}>
                <p className="text-[10px] uppercase tracking-widest text-g-400 font-medium mb-2">{grupo.label}</p>
                <div className="grid grid-cols-4 gap-2.5">
                  {grupo.items.map(n => {
                    const activo = location.pathname === n.to;
                    return (
                      <button key={n.to} onClick={() => irA(n.to)}
                        className="relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all active:scale-95"
                        style={{ background: n.bg }}>
                        {activo && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold"/>}
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: n.color + '20' }}>
                          <i className={`ti ${n.icon} text-base`} style={{ color: n.color }}/>
                        </div>
                        <span className="text-[10px] font-medium text-g-800 text-center leading-tight">{n.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { logout(); navigate('/login'); setMasOpen(false); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-g-50 text-g-600 text-sm">
            <i className="ti ti-logout text-sm"/>
            Cerrar sesión
          </button>
        </div>

        {/* ── BOTTOM NAV MÓVIL ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-g-200/40 z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center h-16">
            {NAV_MOBILE_MAIN.map((n, i) => {
              const isCenter = i === 2;
              if (isCenter) return (
                <div key={n.to} className="flex-1 flex justify-center -mt-5">
                  <NavLink to={n.to}
                    className={({ isActive }) =>
                      `w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg transition-all ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-g-800 text-white'}`}>
                    <i className={`ti ${n.icon} text-xl`}/>
                  </NavLink>
                </div>
              );
              return (
                <NavLink key={n.to} to={n.to} end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                      isActive ? 'text-blue-600' : 'text-g-400'}`}>
                  {({ isActive }) => (
                    <>
                      <span className="relative">
                        <i className={`ti ${n.icon} text-xl`}/>
                        {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold"/>}
                      </span>
                      <span className="text-[9px] font-medium">{n.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}

            {/* Tab "Más" */}
            <button onClick={() => setMasOpen(!masOpen)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                enMenuMas || masOpen ? 'text-blue-600' : 'text-g-400'}`}>
              <span className="relative">
                <i className={`ti ${masOpen ? 'ti-x' : 'ti-dots'} text-xl`}/>
                {enMenuMas && !masOpen && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold"/>}
              </span>
              <span className="text-[9px] font-medium">{masOpen ? 'Cerrar' : 'Más'}</span>
            </button>
          </div>
        </nav>

        {/* FAB móvil — sube sobre la barra + safe area */}
        {!['/movimientos', '/coach', '/reporte'].includes(location.pathname) && !masOpen && (
          <button onClick={() => navigate('/movimientos')}
            className="md:hidden fixed right-4 w-12 h-12 rounded-full bg-g-700 text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
            <i className="ti ti-plus text-xl"/>
          </button>
        )}
      </div>
    </div>
  );
}
