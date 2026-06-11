import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/',          icon: 'ti-layout-dashboard',  label: 'Resumen',         group: 'principal' },
  { to: '/movimientos', icon: 'ti-arrows-exchange',  label: 'Movimientos',     group: 'principal' },
  { to: '/cierre',    icon: 'ti-calendar-stats',     label: 'Cierre semanal',  group: 'principal' },
  { to: '/activos',   icon: 'ti-building-bank',      label: 'Activos',         group: 'patrimonio' },
  { to: '/deudas',    icon: 'ti-credit-card',        label: 'Deudas',          group: 'patrimonio' },
  { to: '/metas',     icon: 'ti-target',             label: 'Metas',           group: 'patrimonio' },
  { to: '/mental',    icon: 'ti-brain',              label: 'Mentalidad',      group: 'crecimiento' },
  { to: '/academia',  icon: 'ti-school',             label: 'Academia',        group: 'crecimiento' },
];

const groups = [
  { key: 'principal',   label: 'Principal' },
  { key: 'patrimonio',  label: 'Patrimonio' },
  { key: 'crecimiento', label: 'Crecimiento' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-g-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-white font-medium text-base tracking-tight">Fintual</span>
          </div>
          <p className="text-white/30 text-[10px] mt-0.5 ml-4">Tu camino a la libertad</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {groups.map(g => (
            <div key={g.key} className="mb-1">
              <p className="text-[9px] uppercase tracking-widest text-white/25 px-5 mb-1 mt-3">{g.label}</p>
              {NAV.filter(n => n.group === g.key).map(n => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-5 py-2 text-[13px] transition-all border-l-2 ${
                      isActive
                        ? 'text-white bg-gold/10 border-gold'
                        : 'text-white/55 border-transparent hover:text-white/85 hover:bg-white/5'
                    }`
                  }
                >
                  <i className={`ti ${n.icon} text-base`} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-g-900 text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{user?.nombre}</p>
              <p className="text-white/35 text-[10px]">{user?.puntos_xp || 0} XP</p>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} title="Cerrar sesión"
              className="text-white/30 hover:text-white/70 transition-colors">
              <i className="ti ti-logout text-sm" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-g-200/40 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-medium text-g-800">
            {NAV.find(n => n.to === window.location.pathname)?.label || 'Resumen'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1.5 rounded-full bg-g-50 text-g-600 border border-g-200/60 font-medium">
              {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
