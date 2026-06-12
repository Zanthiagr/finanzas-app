import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_DESKTOP = [
  { to: '/',            icon: 'ti-layout-dashboard', label: 'Resumen',        group: 'principal' },
  { to: '/movimientos', icon: 'ti-arrows-exchange',  label: 'Movimientos',    group: 'principal' },
  { to: '/cierre',      icon: 'ti-calendar-stats',   label: 'Cierre semanal', group: 'principal' },
  { to: '/reporte',     icon: 'ti-file-download',    label: 'Reporte PDF',    group: 'principal' },
  { to: '/activos',     icon: 'ti-building-bank',    label: 'Activos',        group: 'patrimonio' },
  { to: '/deudas',      icon: 'ti-credit-card',      label: 'Deudas',         group: 'patrimonio' },
  { to: '/metas',       icon: 'ti-target',           label: 'Metas',          group: 'patrimonio' },
  { to: '/mental',      icon: 'ti-brain',            label: 'Mentalidad',     group: 'crecimiento' },
  { to: '/academia',    icon: 'ti-school',           label: 'Academia',       group: 'crecimiento' },
  { to: '/coach',       icon: 'ti-robot',            label: 'Coach IA',       group: 'crecimiento' },
];

const NAV_MOBILE = [
  { to: '/',            icon: 'ti-layout-dashboard', label: 'Inicio' },
  { to: '/movimientos', icon: 'ti-arrows-exchange',  label: 'Gastos' },
  { to: '/coach',       icon: 'ti-robot',            label: 'Coach' },
  { to: '/mental',      icon: 'ti-brain',            label: 'Mente' },
  { to: '/academia',    icon: 'ti-school',           label: 'Aprender' },
];

const groups = [
  { key: 'principal',   label: 'Principal' },
  { key: 'patrimonio',  label: 'Patrimonio' },
  { key: 'crecimiento', label: 'Crecimiento' },
];

const PAGE_TITLES = {
  '/':             'Resumen',
  '/movimientos':  'Movimientos',
  '/cierre':       'Cierre semanal',
  '/reporte':      'Reporte PDF',
  '/activos':      'Activos',
  '/deudas':       'Deudas',
  '/metas':        'Metas',
  '/mental':       'Mentalidad',
  '/academia':     'Academia',
  '/coach':        'Coach IA',
};

export default function Layout({ children }) {
  const { user, perfil, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const initials  = (perfil?.nombre || user?.user_metadata?.full_name || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Fintual';

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Sidebar desktop */}
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-g-900 text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{perfil?.nombre || user?.user_metadata?.full_name}</p>
              <p className="text-white/35 text-[10px]">{perfil?.puntos_xp || 0} XP</p>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-white/30 hover:text-white/70 transition-colors">
              <i className="ti ti-logout text-sm"/>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar desktop */}
        <header className="hidden md:flex bg-white border-b border-g-200/40 px-6 h-14 items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-medium text-g-800">{pageTitle}</h1>
          <span className="text-xs px-3 py-1.5 rounded-full bg-g-50 text-g-600 border border-g-200/60 font-medium">
            {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </span>
        </header>

        {/* Topbar móvil */}
        <header className="md:hidden bg-g-800 px-4 pt-12 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs">Hola,</p>
              <p className="text-white font-medium text-base leading-tight">
                {(perfil?.nombre || user?.user_metadata?.full_name || '').split(' ')[0]}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60">
                {new Date().toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
              </span>
              <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-g-900 text-xs font-semibold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 pb-24 md:pb-5 page-enter">
          {children}
        </main>

        {/* Bottom nav móvil */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-g-200/40 z-50">
          <div className="flex items-center">
            {NAV_MOBILE.map((n, i) => {
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
          </div>
        </nav>

        {/* FAB móvil */}
        {!['/movimientos', '/coach', '/reporte'].includes(location.pathname) && (
          <button onClick={() => navigate('/movimientos')}
            className="md:hidden fixed bottom-20 right-4 w-12 h-12 rounded-full bg-g-700 text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform">
            <i className="ti ti-plus text-xl"/>
          </button>
        )}
      </div>
    </div>
  );
}
