import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { eliminarCuentaCompleta } from '../utils/api';
import toast from 'react-hot-toast';
import Ring from '../components/Ring';
import Icon from '../utils/icons';

export default function Perfil() {
  const { user, perfil, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    notif_cierre: true,
    notif_diario: false,
  });
  const [saving, setSaving] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [confirmTexto, setConfirmTexto] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const nombre = (perfil?.nombre || user?.user_metadata?.full_name || '').split(' ')[0];

  useEffect(() => {
    if (perfil || user) {
      setForm({
        nombre: perfil?.nombre || user?.user_metadata?.full_name || '',
        email: perfil?.email || user?.email || '',
        notif_cierre: perfil?.notif_cierre ?? true,
        notif_diario: perfil?.notif_diario ?? false,
      });
    }
  }, [perfil, user]);

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          nombre: form.nombre,
          email: form.email,
          notif_cierre: form.notif_cierre,
          notif_diario: form.notif_diario,
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Perfil actualizado ✓');
    } catch { toast.error('Error guardando'); }
    finally { setSaving(false); }
  };

  const initials = form.nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || 'U';

  const eliminarCuenta = async () => {
    if (confirmTexto !== 'ELIMINAR') return;
    setEliminando(true);
    try {
      const { cuentaAuthEliminada } = await eliminarCuentaCompleta();
      toast.success(
        cuentaAuthEliminada
          ? 'Tu cuenta y todos tus datos fueron eliminados'
          : 'Tus datos fueron eliminados. Sesión cerrada.',
        { duration: 4000 }
      );
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Error eliminando la cuenta. Intenta de nuevo.');
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-5 page-enter max-w-lg mx-auto">
      <div>
        <h2 className="text-lg font-medium text-g-900">Mi perfil</h2>
        <p className="text-sm text-g-400">Configura tu cuenta y notificaciones</p>
      </div>

      {/* Avatar */}
      <div className="card p-6 flex flex-col items-center gap-3">
        <div className="relative w-16 h-16">
          <Ring pct={(perfil?.puntos_xp || 0) % 100} size={64} stroke={4} className="-rotate-90 absolute inset-0"/>
          <div className="absolute inset-[5px] rounded-full bg-gold flex items-center justify-center text-g-900 text-lg font-semibold">
            {initials}
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium text-g-900">{form.nombre || 'Sin nombre'}</p>
          <p className="text-sm text-g-400">{user?.email}</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gold/10 text-gold-dark border border-gold/20 mt-1 inline-block">
            Nivel {Math.floor((perfil?.puntos_xp || 0) / 100) + 1} · {perfil?.puntos_xp || 0} XP
          </span>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={guardar} className="space-y-4">
        <div className="card p-5 space-y-4">
          <p className="text-sm font-medium text-g-900 mb-1">Información personal</p>
          <div>
            <label className="section-label block mb-1">Nombre</label>
            <input className="input" placeholder="Tu nombre"
              value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))}/>
          </div>
          <div>
            <label className="section-label block mb-1">Email para notificaciones</label>
            <input type="email" className="input" placeholder="tu@email.com"
              value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}/>
            <p className="text-xs text-g-400 mt-1">Aquí recibirás los recordatorios semanales y diarios</p>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="card p-5 space-y-4">
          <p className="text-sm font-medium text-g-900 mb-1">Notificaciones por email</p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-g-900 font-medium">Cierre semanal</p>
              <p className="text-xs text-g-400 mt-0.5">Domingo a las 7pm — te recuerda cerrar la semana si no lo has hecho</p>
            </div>
            <button type="button"
              onClick={() => setForm(f => ({...f, notif_cierre: !f.notif_cierre}))}
              className={`w-12 h-6 rounded-full transition-all flex-shrink-0 relative ${form.notif_cierre ? 'bg-g-600' : 'bg-g-200'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.notif_cierre ? 'left-6' : 'left-0.5'}`}/>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-g-900 font-medium">Recordatorio diario</p>
              <p className="text-xs text-g-400 mt-0.5">Cada mañana a las 8am — solo si no has registrado nada ese día</p>
            </div>
            <button type="button"
              onClick={() => setForm(f => ({...f, notif_diario: !f.notif_diario}))}
              className={`w-12 h-6 rounded-full transition-all flex-shrink-0 relative ${form.notif_diario ? 'bg-g-600' : 'bg-g-200'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.notif_diario ? 'left-6' : 'left-0.5'}`}/>
            </button>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Icon name="check" className="w-3.5 h-3.5"/>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* Cerrar sesión */}
      <div className="card p-4">
        <button onClick={() => { logout(); }} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:text-red-700 py-1">
          <Icon name="logout" className="w-3.5 h-3.5"/>
          Cerrar sesión
        </button>
      </div>

      {/* Zona de peligro */}
      <div className="card p-5 border-red-200">
        <p className="text-sm font-medium text-red-700 mb-1">Zona de peligro</p>
        <p className="text-xs text-g-400 mb-3 leading-relaxed">
          Elimina tu cuenta y todos tus datos: movimientos, deudas, activos, metas, hábitos, presupuestos y más.
          Esta acción no se puede deshacer.
        </p>
        <button onClick={() => setModalEliminar(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-red-600 border border-red-200 rounded-xl py-2.5 hover:bg-red-50 transition-colors">
          <Icon name="trash" className="w-3.5 h-3.5"/>
          Eliminar mi cuenta
        </button>
      </div>

      {modalEliminar && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Icon name="alert-triangle" className="w-5 h-5 text-red-600"/>
            </div>
            <h3 className="text-lg font-medium text-g-900 mb-2">¿Eliminar tu cuenta?</h3>
            <p className="text-sm text-g-500 mb-4 leading-relaxed">
              Se borrarán <strong>todos</strong> tus movimientos, deudas, activos, metas, hábitos,
              presupuestos, cierres semanales y tu perfil. No hay vuelta atrás.
            </p>
            <label className="section-label block mb-1.5">
              Escribe <span className="font-mono text-red-600">ELIMINAR</span> para confirmar
            </label>
            <input
              className="input mb-4"
              value={confirmTexto}
              onChange={e => setConfirmTexto(e.target.value)}
              placeholder="ELIMINAR"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setModalEliminar(false); setConfirmTexto(''); }}
                className="btn-secondary flex-1" disabled={eliminando}>
                Cancelar
              </button>
              <button onClick={eliminarCuenta}
                disabled={confirmTexto !== 'ELIMINAR' || eliminando}
                className="flex-1 bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-red-700 transition-colors">
                {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
