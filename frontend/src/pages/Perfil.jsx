import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Perfil() {
  const { user, perfil, logout } = useAuth();
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    notif_cierre: true,
    notif_diario: false,
  });
  const [saving, setSaving] = useState(false);
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

  return (
    <div className="space-y-5 page-enter max-w-lg mx-auto">
      <div>
        <h2 className="text-lg font-medium text-g-900">Mi perfil</h2>
        <p className="text-sm text-g-400">Configura tu cuenta y notificaciones</p>
      </div>

      {/* Avatar */}
      <div className="card p-6 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-g-700 flex items-center justify-center text-white text-xl font-semibold">
          {initials}
        </div>
        <div className="text-center">
          <p className="font-medium text-g-900">{form.nombre || 'Sin nombre'}</p>
          <p className="text-sm text-g-400">{user?.email}</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-g-50 text-g-600 border border-g-200/60 mt-1 inline-block">
            {perfil?.puntos_xp || 0} XP acumulados
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
          <i className="ti ti-check text-sm"/>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* Cerrar sesión */}
      <div className="card p-4">
        <button onClick={() => { logout(); }} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:text-red-700 py-1">
          <i className="ti ti-logout text-sm"/>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
