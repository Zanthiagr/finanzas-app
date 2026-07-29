import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const { loginConGoogle } = useAuth();

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginConGoogle();
      // Google redirige a Supabase y de vuelta — no hay más que hacer aquí.
    } catch {
      toast.error('Error al conectar con Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-g-800 flex">
      {/* Panel izquierdo */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 bg-g-900">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
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

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-white font-medium">Fintual</span>
          </div>

          <h3 className="text-xl font-medium text-white mb-1">Bienvenido a Fintual</h3>
          <p className="text-white/40 text-sm mb-8">
            Ingresa o crea tu cuenta con Google — es lo único que necesitas.
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-medium py-3.5 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <i className="ti ti-loader animate-spin text-lg" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
            )}
            {loading ? 'Conectando...' : 'Continuar con Google'}
          </button>

          <p className="text-center text-white/30 text-xs mt-6 leading-relaxed">
            Si es tu primera vez, se crea tu cuenta automáticamente.<br/>
            Si ya tienes una, simplemente ingresas.
          </p>
        </div>
      </div>
    </div>
  );
}
