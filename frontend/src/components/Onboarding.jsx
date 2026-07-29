import { useState } from 'react';
import CapitalInicialForm from './CapitalInicialForm';

// Onboarding reducido a lo esencial: una intro breve y UNA sola acción —
// definir el capital inicial (o posponerlo). Todo lo demás (primer
// movimiento, cierre semanal, coach IA) el usuario lo descubre solo
// navegando la app; no hace falta explicarlo en la bienvenida.
export default function Onboarding({ onComplete }) {
  const [tieneCapital, setTieneCapital] = useState(false);

  return (
    <div className="fixed inset-0 bg-g-900 z-[100] flex items-center justify-center p-5 overflow-y-auto">
      <div className="w-full max-w-sm py-8">

        {/* Intro breve */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto bg-gold/20">
          <i className="ti ti-hand-stop text-3xl text-gold" />
        </div>
        <h2 className="text-xl font-medium text-white text-center mb-2">¡Bienvenido a Fintual!</h2>
        <p className="text-white/50 text-sm text-center leading-relaxed mb-8">
          No es solo una app de finanzas. Es tu camino a la libertad — sin importar desde dónde empieces hoy.
        </p>

        {/* Único paso: capital inicial */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <i className="ti ti-wallet text-gold" />
            <h3 className="text-white font-medium text-sm">¿Con cuánto empiezas?</h3>
          </div>
          <p className="text-white/40 text-xs leading-relaxed mb-4">
            Registra el dinero que ya tienes hoy — en efectivo o en tus cuentas. No se cuenta como ingreso,
            es tu punto de partida real. Puedes hacerlo ahora mismo, o más tarde desde el Dashboard tocando
            "Editar capital inicial".
          </p>
          <CapitalInicialForm dark onChange={() => setTieneCapital(true)} />
        </div>

        {tieneCapital ? (
          <button onClick={onComplete}
            className="w-full bg-gold text-g-900 font-semibold py-3.5 rounded-xl text-sm hover:bg-gold-dark transition-colors mt-5">
            Listo, continuar →
          </button>
        ) : (
          <button onClick={onComplete} className="w-full text-white/40 text-sm py-3 mt-5 hover:text-white/60 transition-colors">
            Lo haré más tarde →
          </button>
        )}
      </div>
    </div>
  );
}
