import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

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
const NAV_MOBILE_MAIN = [
  { to: '/',            icon: 'ti-layout-dashboard', label: 'Inicio' },
  { to: '/movimientos', icon: 'ti-arrows-exchange',  label: 'Gastos' },
  { to: '/coach',       icon: 'ti-robot',            label: 'Coach' },
  { to: '/mental',      icon: 'ti-brain',            label: 'Mente' },
];

// Secciones en el menú "Más"
const NAV_MOBILE_MAS = [
  { to: '/calendario',   icon: 'ti-calendar-month',   label: 'Calendario',   color: '#185FA5', bg: '#E6F1FB' },
  { to: '/academia',     icon: 'ti-school',           label: 'Academia',     color: '#BA7517', bg: '#FAEEDA' },
  { to: '/calculadora',  icon: 'ti-calculator',       label: 'Calculadoras', color: '#534AB7', bg: '#EEEDFE' },
  { to: '/metas',        icon: 'ti-target',           label: 'Metas',        color: '#0F6E56', bg: '#E1F5EE' },
  { to: '/presupuestos', icon: 'ti-wallet',           label: 'Presupuestos', color: '#C9A84C', bg: '#F5E8C0' },
  { to: '/cierre',       icon: 'ti-calendar-stats',   label: 'Cierre',       color: '#2D6B4A', bg: '#EDFAF3' },
  { to: '/activos',      icon: 'ti-building-bank',    label: 'Activos',      color: '#185FA5', bg: '#E6F1FB' },
  { to: '/deudas',       icon: 'ti-credit-card',      label: 'Deudas',       color: '#A32D2D', bg: '#FCEBEB' },
  { to: '/reporte',      icon: 'ti-file-download',    label: 'Reporte PDF',  color: '#534AB7', bg: '#EEEDFE' },
  { to: '/perfil',       icon: 'ti-user-circle',      label: 'Mi perfil',    color: '#2D6B4A', bg: '#EDFAF3' },
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

  const initials  = (perfil?.nombre || user?.user_metadata?.full_name || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Fintual';

  // Saber si la página actual está en el menú "Más"
  const enMenuMas = NAV_MOBILE_MAS.some(n => n.to === location.pathname);

  const irA = (to) => {
    setMasOpen(false);
    navigate(to);
  };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="hidden md:flex w-52 flex-shrink-0 bg-g-800 flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold"/>
            <span className="text-white font-medium text-base tracking-tight">Fintual</span>
          </div>
          <p className="text-white/30 text-[10px] mt-0.5 ml-4">Tu camino a la libertad</p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {groups.map(g => (
            <div key={g.key} className="mb-1">
              <p className="text-[9px] uppercase tracking-widest text-white/25 px-5 mb-1 mt-3">{g.label}</p>
              {NAV_DESKTOP.filter(n => n.group === g.key).map(n => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-5 py-2 text-[13px] transition-all border-l-2 ${
                      isActive
                        ? 'text-white bg-gold/10 border-gold'
                        : 'text-white/55 border-transparent hover:text-white/85 hover:bg-white/5'
                    }`}>
                  <i className={`ti ${n.icon} text-base`}/>
                  {n.label}
                  {n.to === '/coach' && (
                    <span className="ml-auto text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">IA</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <button onClick={() => navigate('/perfil')} className="flex items-center gap-2.5 w-full text-left hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-g-900 text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{perfil?.nombre || user?.user_metadata?.full_name}</p>
              <p className="text-white/35 text-[10px]">{perfil?.puntos_xp || 0} XP</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar desktop */}
        <header className="hidden md:flex bg-white border-b border-g-200/40 px-6 h-14 items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-medium text-g-800">{pageTitle}</h1>
          <span className="text-xs px-3 py-1.5 rounded-full bg-g-50 text-g-600 border border-g-200/60 font-medium">
            {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </span>
        </header>

        {/* Topbar móvil */}
        <header className="md:hidden bg-g-800 px-4 pt-8 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
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
              <button onClick={() => navigate('/perfil')}
                className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-g-900 text-[11px] font-semibold active:scale-90 transition-transform">
                {initials}
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
        {masOpen && (
          <>
            {/* Overlay */}
            <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMasOpen(false)}/>
            {/* Sheet */}
            <div className="md:hidden fixed left-0 right-0 bg-white rounded-t-2xl z-50 p-5 shadow-2xl"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}>
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-g-200"/>
              </div>
              <p className="text-xs text-g-400 uppercase tracking-widest mb-3">Más secciones</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {NAV_MOBILE_MAS.map(n => (
                  <button key={n.to} onClick={() => irA(n.to)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all active:scale-95 ${
                      location.pathname === n.to ? 'ring-2 ring-g-400' : ''
                    }`}
                    style={{ background: n.bg }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: n.color + '20' }}>
                      <i className={`ti ${n.icon} text-lg`} style={{ color: n.color }}/>
                    </div>
                    <span className="text-xs font-medium text-g-800">{n.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { logout(); navigate('/login'); setMasOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-g-50 text-g-600 text-sm">
                <i className="ti ti-logout text-sm"/>
                Cerrar sesión
              </button>
            </div>
          </>
        )}

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
                        isActive ? 'bg-gold text-g-900' : 'bg-g-800 text-white'}`}>
                    <i className={`ti ${n.icon} text-xl`}/>
                  </NavLink>
                </div>
              );
              return (
                <NavLink key={n.to} to={n.to} end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                      isActive ? 'text-g-700' : 'text-g-400'}`}>
                  <i className={`ti ${n.icon} text-xl`}/>
                  <span className="text-[9px] font-medium">{n.label}</span>
                </NavLink>
              );
            })}

            {/* Tab "Más" */}
            <button onClick={() => setMasOpen(!masOpen)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                enMenuMas || masOpen ? 'text-g-700' : 'text-g-400'}`}>
              <i className={`ti ${masOpen ? 'ti-x' : 'ti-dots'} text-xl`}/>
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
