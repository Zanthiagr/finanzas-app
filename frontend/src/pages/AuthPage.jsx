import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { loginConGoogle, loginConEmail, registrarConEmail } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submitEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginConEmail(form.email, form.password);
        navigate('/');
      } else {
        if (!form.nombre) return toast.error('Tu nombre es requerido');
        await registrarConEmail(form.nombre, form.email, form.password);
        toast.success('¡Cuenta creada! Revisa tu email para confirmar.');
      }
    } catch (err) {
      const msg = err.message || 'Error al ingresar';
      if (msg.includes('Invalid login')) toast.error('Email o contraseña incorrectos');
      else if (msg.includes('already registered')) toast.error('Este email ya tiene cuenta');
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginConGoogle();
    } catch {
      toast.error('Error al conectar con Google');
    }
  };

  return (
    <div className="min-h-screen bg-g-800 flex">
      {/* Panel izquierdo */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 bg-g-900">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-2.5 h-2.5 rounded-full bg-gold" />
            <span className="text-white font-medium text-lg">Fintual</span>
          </div>
          <h2 className="text-3xl font-medium text-white leading-snug mb-4">
            No es una app de finanzas.<br />
            <span className="text-gold">Es tu camino a la libertad.</span>
          </h2>
          <p className="text-white/45 text-sm leading-relaxed">
            Diseñada para personas que ya decidieron crecer — sin importar desde dónde empiecen.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { icon: 'ti-chart-line', text: 'Control total de ingresos, gastos y deudas' },
            { icon: 'ti-brain',      text: 'Reprogramación mental y hábitos financieros' },
            { icon: 'ti-school',     text: 'Academia con conocimiento real y calculadoras' },
            { icon: 'ti-target',     text: 'Metas visuales y cierre semanal guiado' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-g-700 flex items-center justify-center">
                <i className={`ti ${f.icon} text-g-200 text-sm`} />
              </div>
              <span className="text-white/60 text-sm">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-white font-medium">Fintual</span>
          </div>

          <h3 className="text-xl font-medium text-white mb-1">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Empieza tu camino'}
          </h3>
          <p className="text-white/40 text-sm mb-6">
            {mode === 'login' ? 'Ingresa a tu cuenta' : 'Crea tu cuenta gratuita'}
          </p>

          {/* Botón Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continuar con Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/25 text-xs">o con email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={submitEmail} className="space-y-3">
            {mode === 'register' && (
              <input
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-gold/60"
                placeholder="Tu nombre"
                value={form.nombre}
                onChange={set('nombre')}
              />
            )}
            <input
              type="email"
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-gold/60"
              placeholder="Email"
              value={form.email}
              onChange={set('email')}
              required
            />
            <input
              type="password"
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-gold/60"
              placeholder="Contraseña (mínimo 6 caracteres)"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-g-900 font-semibold py-3 rounded-xl text-sm hover:bg-gold-dark transition-colors disabled:opacity-60"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-5">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-gold hover:text-gold-light transition-colors underline underline-offset-2"
            >
              {mode === 'login' ? 'Regístrate gratis' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
