import { useState } from 'react';
import toast from 'react-hot-toast';
import CalculadoraFinanciera from '../components/CalculadoraFinanciera';

const MODULOS = [
  {
    id: 'tarjetas', icon: 'ti-credit-card', color: '#E24B4A', bg: '#FCEBEB',
    titulo: 'Tarjetas de crédito', subtitulo: 'Úsalas a tu favor, no al revés',
    lecciones: [
      {
        titulo: 'Anatomía de tu tarjeta',
        contenido: () => <TarjetaLesson />,
      },
      {
        titulo: 'Las 3 reglas de oro',
        contenido: () => (
          <div className="space-y-3">
            {[
              ['1', 'Nunca uses más del 30% del cupo', 'Usar más daña tu historial crediticio y te acerca a la deuda perpetua.'],
              ['2', 'Paga siempre el total, no el mínimo', 'El pago mínimo está diseñado para que siempre debas. El total te libera.'],
              ['3', 'Úsala solo para lo que ya tienes en efectivo', 'Si no tienes el dinero hoy, no lo pongas en la tarjeta.'],
            ].map(([n, t, d]) => (
              <div key={n} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-g-800 text-g-200 flex items-center justify-center text-sm font-medium flex-shrink-0">{n}</div>
                <div><p className="text-sm font-medium text-g-900">{t}</p><p className="text-xs text-g-500 mt-0.5">{d}</p></div>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    id: 'deuda', icon: 'ti-scale', color: '#854F0B', bg: '#FAEEDA',
    titulo: 'Deuda buena y mala', subtitulo: 'No toda deuda te destruye',
    lecciones: [
      {
        titulo: 'La diferencia clave',
        contenido: () => (
          <div className="grid grid-cols-2 gap-3">
            {[
              { tipo: 'Deuda buena', items: ['Crédito para curso que aumenta ingresos', 'Herramienta de trabajo productiva', 'Hipoteca en propiedad que valoriza'], ok: true },
              { tipo: 'Deuda mala', items: ['Tarjeta para caprichos o impulsos', 'Gota a gota o préstamos informales', 'Crédito para bienes que se deprecian'], ok: false },
            ].map(c => (
              <div key={c.tipo} className={`rounded-xl p-3 ${c.ok ? 'bg-g-50' : 'bg-red-50'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-medium mb-2 ${c.ok ? 'text-g-600' : 'text-red-600'}`}>{c.tipo}</p>
                {c.items.map((it, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1.5">
                    <i className={`ti ${c.ok ? 'ti-check text-g-500' : 'ti-x text-red-500'} text-xs mt-0.5`} />
                    <p className="text-xs text-g-800">{it}</p>
                  </div>
                ))}
              </div>
            ))}
            <div className="col-span-2 bg-g-50 rounded-xl p-3 border border-g-200/60">
              <p className="text-xs text-g-800"><span className="font-medium">La pregunta clave:</span> ¿Este dinero va a generarme más valor del que me va a costar en intereses?</p>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: 'inversiones', icon: 'ti-chart-candle', color: '#185FA5', bg: '#E6F1FB',
    titulo: 'Inversiones', subtitulo: 'Dónde poner tu dinero en Colombia',
    lecciones: [
      {
        titulo: 'Opciones reales para Colombia',
        contenido: () => (
          <div className="space-y-2">
            {[
              { n: 'CDT bancario', r: '10–13% EA', min: '$500.000', p: '30–360 días', riesgo: 'bajo' },
              { n: 'Fondos de inversión', r: '12–18% EA', min: '$50.000', p: 'Flexible', riesgo: 'medio' },
              { n: 'Acciones (BVC)', r: 'Variable', min: '$100.000', p: 'Largo plazo', riesgo: 'alto' },
              { n: 'Finca raíz digital', r: '8–14% EA', min: '$1.000.000', p: '12–36 meses', riesgo: 'medio' },
            ].map(inv => (
              <div key={inv.n} className="flex items-center gap-3 p-3 bg-g-50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-g-900">{inv.n}</p>
                  <p className="text-xs text-g-500">{inv.r} · desde {inv.min}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.riesgo === 'bajo' ? 'badge-ok' : inv.riesgo === 'medio' ? 'badge-warn' : 'badge-bad'}`}>
                  Riesgo {inv.riesgo}
                </span>
              </div>
            ))}
          </div>
        ),
      },
      { titulo: 'Interés compuesto', contenido: () => <ICLesson /> },
    ],
  },
  {
    id: 'activos-pasivos', icon: 'ti-building-bank', color: '#0F6E56', bg: '#E1F5EE',
    titulo: 'Activos y pasivos', subtitulo: 'La regla que cambia todo',
    lecciones: [
      {
        titulo: 'Qué es un activo real',
        contenido: () => (
          <div className="space-y-3">
            <div className="bg-g-50 rounded-xl p-4 border-l-2 border-g-400">
              <p className="text-sm font-semibold text-g-900 mb-1">Activo = algo que pone dinero en tu bolsillo</p>
              <p className="text-xs text-g-600">Casa en arriendo, negocio, inversión, regalías, dividendos.</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border-l-2 border-red-400">
              <p className="text-sm font-semibold text-g-900 mb-1">Pasivo = algo que saca dinero de tu bolsillo</p>
              <p className="text-xs text-g-600">Tu carro (si no produce), créditos, deudas de consumo.</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs text-g-800"><span className="font-medium">El gran error:</span> Creer que tu casa propia es un activo cuando en realidad te cuesta mes a mes. Solo es activo si genera ingreso.</p>
            </div>
          </div>
        ),
      },
    ],
  },
];

function TarjetaLesson() {
  const [deuda, setDeuda] = useState(3200000);
  const [tasa, setTasa]   = useState(28);
  const intAnual = Math.round(deuda * (tasa / 100));

  return (
    <div className="space-y-4">
      <div className="bg-g-800 rounded-xl p-4 flex gap-4">
        <div className="w-20 h-12 bg-gold rounded-lg flex flex-col justify-end p-1.5 flex-shrink-0">
          <div className="w-4 h-3 bg-gold-light/60 rounded-sm mb-1" />
          <p className="text-[7px] text-g-900 font-medium">**** 4821</p>
        </div>
        <div className="flex-1 space-y-1">
          {[['Cupo usado','$3.200.000','text-amber-300'],['Tasa EA','27.9%','text-red-400'],['Pago mínimo','$96.000 ← trampa','text-red-400'],['Pago total','$3.200.000 ← poder','text-g-200']].map(([k,v,c]) => (
            <div key={k} className="flex justify-between">
              <span className="text-[11px] text-white/40">{k}</span>
              <span className={`text-[11px] font-medium ${c}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-g-900 mb-3">Calculadora: el costo real del mínimo</p>
        <div className="space-y-4 bg-g-50 p-4 rounded-xl">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-g-500">Deuda actual</span>
              <span className="text-sm font-medium text-g-900">${(deuda/1000000).toFixed(1)}M</span>
            </div>
            <input type="range" min="500000" max="10000000" step="100000" value={deuda}
              onChange={e => setDeuda(+e.target.value)} className="w-full accent-g-600" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-g-500">Tasa EA</span>
              <span className="text-sm font-medium text-g-900">{tasa}%</span>
            </div>
            <input type="range" min="15" max="35" step="1" value={tasa}
              onChange={e => setTasa(+e.target.value)} className="w-full accent-g-600" />
          </div>
          <div className="bg-g-800 rounded-lg p-3 flex flex-col gap-1">
            <p className="text-xs text-white/40">Si solo pagas el mínimo, en 1 año habrás pagado en intereses</p>
            <p className="text-lg font-medium text-red-400">${(intAnual).toLocaleString('es-CO')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ICLesson() {
  const [cap, setCap]     = useState(1000000);
  const [rate, setRate]   = useState(12);
  const [years, setYears] = useState(5);

  const total = Math.round(cap * Math.pow(1 + rate / 100, years));
  const ganancia = total - cap;

  const bars = Array.from({ length: Math.min(years, 8) }, (_, i) => {
    const y = Math.round((i + 1) * (years / Math.min(years, 8)));
    return { y, v: Math.round(cap * Math.pow(1 + rate / 100, y)) };
  });
  const maxV = bars[bars.length - 1]?.v || 1;

  return (
    <div className="space-y-4">
      <p className="text-xs text-g-600">Mueve los sliders y ve crecer tu dinero.</p>
      <div className="space-y-3 bg-g-50 p-4 rounded-xl">
        {[
          { label: 'Capital inicial', val: `$${(cap/1000000).toFixed(1)}M`, min: 100000, max: 5000000, step: 100000, v: cap, set: setCap },
          { label: 'Tasa anual', val: `${rate}%`, min: 5, max: 25, step: 1, v: rate, set: setRate },
          { label: 'Años', val: `${years} años`, min: 1, max: 20, step: 1, v: years, set: setYears },
        ].map(s => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-g-500">{s.label}</span>
              <span className="text-sm font-medium text-g-900">{s.val}</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={s.v}
              onChange={e => s.set(+e.target.value)} className="w-full accent-g-600" />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1 h-16">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full bg-g-400 rounded-t-sm transition-all" style={{ height: `${Math.round(52 * b.v / maxV) + 6}px` }} />
            <span className="text-[9px] text-g-400">A{b.y}</span>
          </div>
        ))}
      </div>
      <div className="bg-g-800 rounded-xl p-3 flex justify-between items-center">
        <div>
          <p className="text-xs text-white/40">Tu dinero en {years} años</p>
          <p className="text-[11px] text-white/30">Ganancia: ${ganancia.toLocaleString('es-CO')}</p>
        </div>
        <p className="text-xl font-medium text-g-200">${(total/1000000).toFixed(2)}M</p>
      </div>
    </div>
  );
}

const QUIZ = [
  {
    q: '¿Qué conviene hacer con $3.000.000 de deuda al 28% EA?',
    opts: ['Pagar el mínimo cada mes', 'Pagar el total o la mayor cantidad posible', 'Ignorar la deuda y ahorrar primero'],
    correcta: 1,
    fb: 'Correcto. El mínimo solo cubre intereses. Pagar el total te ahorra cientos de miles.',
    fbMal: 'No es la mejor opción. El pago mínimo está diseñado para que siempre debas más.',
  },
  {
    q: 'Comprar un carro a crédito para ir al trabajo, ¿es deuda buena o mala?',
    opts: ['Deuda buena, porque es necesario', 'Depende: si produce ingreso, buena; si es solo gasto, mala', 'Siempre es deuda mala'],
    correcta: 1,
    fb: 'Exacto. Si el carro genera más ingreso del que cuesta, es buena. Si solo te cuesta, es mala.',
    fbMal: 'Hay que analizar si el carro genera ingreso o solo gastos. El contexto define el tipo de deuda.',
  },
];

export default function Academia() {
  const [moduloActivo, setModuloActivo]   = useState('tarjetas');
  const [leccionIdx, setLeccionIdx]       = useState(0);
  const [quizResp, setQuizResp]           = useState({});
  const [completadas, setCompletadas]     = useState(new Set());

  const modulo = MODULOS.find(m => m.id === moduloActivo);
  const leccion = modulo?.lecciones[leccionIdx];

  const MODULOS_IDS = MODULOS.map(m => m.id);

  const completarLeccion = () => {
    const key = `${moduloActivo}-${leccionIdx}`;
    setCompletadas(c => new Set([...c, key]));

    if (leccionIdx < modulo.lecciones.length - 1) {
      setLeccionIdx(leccionIdx + 1);
      setQuizResp({});
    } else {
      toast.success('¡Módulo completado! 🎓');
      const idxActual = MODULOS_IDS.indexOf(moduloActivo);
      const siguiente = MODULOS_IDS[idxActual + 1];
      if (siguiente) {
        setTimeout(() => {
          setModuloActivo(siguiente);
          setLeccionIdx(0);
          setQuizResp({});
        }, 800);
      }
    }
  };

  const responder = (qi, oi) => {
    if (quizResp[qi] !== undefined) return;
    setQuizResp(r => ({ ...r, [qi]: oi }));
  };

  return (
    <div className="space-y-4 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Academia financiera</h2>
        <p className="text-sm text-g-400">Conocimiento real, con ejemplos de tu vida en Colombia</p>
      </div>

      {/* Módulos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {MODULOS.map(m => {
          const hecho = m.lecciones.filter((_, i) => completadas.has(`${m.id}-${i}`)).length;
          return (
            <button key={m.id} onClick={() => { setModuloActivo(m.id); setLeccionIdx(0); }}
              className={`card p-3 text-left transition-all ${moduloActivo === m.id ? 'border-g-400 bg-g-50' : 'hover:border-g-200'}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: m.bg }}>
                <i className={`ti ${m.icon} text-sm`} style={{ color: m.color }} />
              </div>
              <p className="text-xs font-medium text-g-900">{m.titulo}</p>
              <p className="text-[10px] text-g-400 mt-0.5">{hecho}/{m.lecciones.length} lecciones</p>
              <div className="h-1 bg-g-100 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-g-400 rounded-full" style={{ width: `${(hecho / m.lecciones.length) * 100}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Lección activa */}
      {leccion && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-g-100" style={{ borderLeftWidth: 3, borderLeftColor: modulo.color }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: modulo.bg }}>
              <i className={`ti ${modulo.icon}`} style={{ color: modulo.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-g-900">{leccion.titulo}</p>
              <p className="text-xs text-g-400">{modulo.titulo}</p>
            </div>
            <div className="flex items-center gap-2">
              {modulo.lecciones.map((_, i) => (
                <button key={i} onClick={() => setLeccionIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === leccionIdx ? 'bg-g-700' : completadas.has(`${moduloActivo}-${i}`) ? 'bg-g-400' : 'bg-g-200'}`} />
              ))}
            </div>
          </div>
          <div className="p-5">
            {leccion.contenido()}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-g-100">
              <button disabled={leccionIdx === 0} onClick={() => setLeccionIdx(leccionIdx - 1)}
                className="btn-secondary text-xs disabled:opacity-40">← Anterior</button>
              <button onClick={completarLeccion} className="btn-primary text-xs">
                {leccionIdx < modulo.lecciones.length - 1 ? 'Continuar →' : 'Completar módulo ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz */}
      <div>
        <p className="section-label">Pon a prueba lo que aprendiste</p>
        <div className="space-y-4">
          {QUIZ.map((q, qi) => (
            <div key={qi} className="card p-4">
              <p className="text-sm font-medium text-g-900 mb-3">{q.q}</p>
              <div className="space-y-2">
                {q.opts.map((op, oi) => {
                  const resp = quizResp[qi];
                  const answered = resp !== undefined;
                  const isCorrect = oi === q.correcta;
                  const isSelected = resp === oi;
                  return (
                    <button key={oi} onClick={() => responder(qi, oi)} disabled={answered}
                      className={`w-full text-left text-sm px-4 py-2.5 rounded-xl border transition-all ${
                        !answered ? 'hover:bg-g-50 border-g-200/60 text-g-700'
                        : isSelected && isCorrect ? 'bg-g-50 border-g-300 text-g-800'
                        : isSelected && !isCorrect ? 'bg-red-50 border-red-200 text-red-800'
                        : isCorrect && answered ? 'bg-g-50 border-g-300 text-g-600'
                        : 'border-g-100 text-g-400'}`}>
                      {op}
                    </button>
                  );
                })}
              </div>
              {quizResp[qi] !== undefined && (
                <p className={`text-xs mt-3 p-2.5 rounded-lg ${quizResp[qi] === q.correcta ? 'bg-g-50 text-g-700' : 'bg-red-50 text-red-700'}`}>
                  {quizResp[qi] === q.correcta ? q.fb : q.fbMal}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Calculadoras financieras */}
      <CalculadoraFinanciera/>

    </div>
  );
}
