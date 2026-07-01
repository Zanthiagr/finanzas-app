import { useState } from 'react';
import { crearMovimiento } from '../utils/api';
import toast from 'react-hot-toast';

const PASOS = [
  {
    icon: 'ti-hand-stop',
    color: '#C9A84C',
    titulo: '¡Bienvenido a Fintual!',
    desc: 'No es solo una app de finanzas. Es tu camino a la libertad — sin importar desde dónde empieces hoy.',
  },
  {
    icon: 'ti-arrows-exchange',
    color: '#2D6B4A',
    titulo: 'Registra tu primer movimiento',
    desc: 'Todo empieza con un registro. Un ingreso o un gasto — lo que sea, regístralo ahora para ver tu dashboard cobrar vida.',
    accion: true,
  },
  {
    icon: 'ti-calendar-check',
    color: '#185FA5',
    titulo: 'Cierra tu semana, cada semana',
    desc: 'Cada domingo revisa cómo te fue y reflexiona. La constancia — no la perfección — es lo que genera el cambio real.',
  },
  {
    icon: 'ti-robot',
    color: '#534AB7',
    titulo: 'Tu coach IA te acompaña',
    desc: 'Pregúntale lo que sea sobre tus finanzas. Lee tus datos reales y te da consejos pensados solo para ti.',
  },
];

export default function Onboarding({ onComplete }) {
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState({ tipo: 'ingreso', monto: '', categoria: 'Salario', descripcion: '' });
  const [guardando, setGuardando] = useState(false);

  const actual = PASOS[paso];
  const esUltimo = paso === PASOS.length - 1;

  const siguiente = () => {
    if (esUltimo) { onComplete(); return; }
    setPaso(paso + 1);
  };

  const registrarPrimero = async () => {
    if (!form.monto || parseFloat(form.monto) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    setGuardando(true);
    try {
      await crearMovimiento({ ...form, fecha: new Date().toISOString().split('T')[0] });
      toast.success('¡Tu primer movimiento está registrado! 🎉');
      setPaso(paso + 1);
    } catch {
      toast.error('Hubo un error, intenta de nuevo');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-g-900 z-[100] flex items-center justify-center p-5">
      <div className="w-full max-w-sm">

        {/* Progreso */}
        <div className="flex gap-1.5 mb-8">
          {PASOS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= paso ? 'bg-gold' : 'bg-white/10'}`}/>
          ))}
        </div>

        {/* Icono */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto"
          style={{ background: actual.color + '20' }}>
          <i className={`ti ${actual.icon} text-3xl`} style={{ color: actual.color }}/>
        </div>

        {/* Texto */}
        <h2 className="text-xl font-medium text-white text-center mb-3">{actual.titulo}</h2>
        <p className="text-white/50 text-sm text-center leading-relaxed mb-8">{actual.desc}</p>

        {/* Formulario rápido en el paso de acción */}
        {actual.accion ? (
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-2">
              {['ingreso', 'gasto'].map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: t, categoria: t === 'ingreso' ? 'Salario' : 'Alimentación' }))}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    form.tipo === t ? 'bg-gold/15 border-gold text-gold' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  {t === 'ingreso' ? '↓ Ingreso' : '↑ Gasto'}
                </button>
              ))}
            </div>
            <input
              type="text" inputMode="decimal"
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-lg placeholder-white/30 focus:outline-none focus:border-gold/60"
              placeholder="¿Cuánto?"
              value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value.replace(',', '.') }))}
            />
            <input
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-gold/60"
              placeholder="¿De qué? (ej: salario, mercado)"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            />
            <button onClick={registrarPrimero} disabled={guardando}
              className="w-full bg-gold text-g-900 font-semibold py-3.5 rounded-xl text-sm hover:bg-gold-dark transition-colors disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Registrar y continuar →'}
            </button>
            <button onClick={siguiente} className="w-full text-white/30 text-xs py-1">
              Omitir por ahora
            </button>
          </div>
        ) : (
          <button onClick={siguiente}
            className="w-full bg-gold text-g-900 font-semibold py-3.5 rounded-xl text-sm hover:bg-gold-dark transition-colors mb-3">
            {esUltimo ? 'Empezar ahora →' : 'Siguiente →'}
          </button>
        )}

        {!actual.accion && (
          <button onClick={onComplete} className="w-full text-white/30 text-xs py-1">
            Saltar introducción
          </button>
        )}
      </div>
    </div>
  );
}
