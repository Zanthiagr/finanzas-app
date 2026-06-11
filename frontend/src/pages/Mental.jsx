import { useEffect, useState } from 'react';
import { getHabitos, toggleHabito, getDiario, crearEntradaDiario } from '../utils/api';
import toast from 'react-hot-toast';

const FRASES = [
  { txt: '"No es cuánto ganas lo que determina tu riqueza — es cuánto conservas."', autor: 'Robert Kiyosaki' },
  { txt: '"La disciplina es el puente entre las metas y los logros."', autor: 'Jim Rohn' },
  { txt: '"Un peso ahorrado hoy es libertad comprada para mañana."', autor: '' },
  { txt: '"No trabajes por dinero. Haz que el dinero trabaje por ti."', autor: 'Warren Buffett' },
  { txt: '"La mejor inversión que puedes hacer es en ti mismo."', autor: 'Warren Buffett' },
  { txt: '"La riqueza no se mide por lo que tienes, sino por lo que eres capaz de crear."', autor: '' },
];

const AFIRMACIONES = [
  { ico: 'ti-heart', color: '#534AB7', txt: '"Merezco prosperar y vivir con abundancia"' },
  { ico: 'ti-trending-up', color: '#2D6B4A', txt: '"Cada decisión pequeña construye mi libertad"' },
  { ico: 'ti-brain', color: '#BA7517', txt: '"Mi mente crea riqueza con cada pensamiento que elijo"' },
];

const PREGUNTAS = [
  '¿Cómo me sentí con el dinero esta semana?',
  '¿Qué patrón quiero romper?',
  '¿Qué decisión financiera me enorgullece?',
  '¿Qué haría diferente?',
];

export default function Mental() {
  const [habitos, setHabitos]     = useState([]);
  const [entradas, setEntradas]   = useState([]);
  const [fraseIdx, setFraseIdx]   = useState(0);
  const [pregIdx, setPregIdx]     = useState(0);
  const [diario, setDiario]       = useState('');
  const [afirmDone, setAfirmDone] = useState([]);

  useEffect(() => {
    getHabitos().then(setHabitos).catch(console.error);
    getDiario().then(setEntradas).catch(console.error);
  }, []);

  const handleToggle = async (h) => {
    try {
      const r = await toggleHabito(h.id, h.puntos);
      setHabitos(prev => prev.map(x => x.id===h.id ? {...x, completado_hoy: r.completado} : x));
      if (r.completado) toast.success(`+${h.puntos} XP 🎉`);
    } catch { toast.error('Error actualizando hábito'); }
  };

  const guardarDiario = async () => {
    if (!diario.trim()) return;
    try {
      await crearEntradaDiario({ pregunta: PREGUNTAS[pregIdx], respuesta: diario });
      toast.success('Reflexión guardada');
      setDiario('');
      getDiario().then(setEntradas);
    } catch { toast.error('Error guardando'); }
  };

  const done = habitos.filter(h => h.completado_hoy).length;
  const frase = FRASES[fraseIdx];

  return (
    <div className="space-y-5 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Mentalidad financiera</h2>
        <p className="text-sm text-g-400">La riqueza empieza en cómo piensas sobre el dinero</p>
      </div>

      {/* Frase del día */}
      <div className="bg-g-800 rounded-2xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-g-200 mb-3">Frase del día</p>
        <p className="text-white font-serif text-base leading-relaxed mb-3">{frase.txt}</p>
        <div className="flex items-center justify-between">
          <p className="text-white/30 text-xs">{frase.autor ? `— ${frase.autor}` : ''}</p>
          <button onClick={() => setFraseIdx((fraseIdx+1)%FRASES.length)}
            className="text-gold/70 hover:text-gold text-xs flex items-center gap-1">
            <i className="ti ti-refresh text-xs"/> Nueva frase
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Hábitos */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-g-900">Hábitos de hoy</p>
            <span className="text-xs text-g-500">{done}/{habitos.length} completados</span>
          </div>
          <div className="h-1.5 bg-g-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-g-400 rounded-full transition-all"
              style={{width: habitos.length>0 ? `${(done/habitos.length)*100}%` : '0%'}}/>
          </div>
          <div className="space-y-1">
            {habitos.map(h => (
              <button key={h.id} onClick={() => handleToggle(h)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-g-50 transition-colors text-left">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${h.completado_hoy?'bg-g-700 border-g-700':'border-g-300'}`}>
                  {h.completado_hoy && <i className="ti ti-check text-white text-[10px]"/>}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${h.completado_hoy?'line-through text-g-400':'text-g-900 font-medium'}`}>{h.nombre}</p>
                  <p className="text-[10px] text-g-400">{h.momento?.replace('_',' ')}</p>
                </div>
                <span className="text-[11px] text-gold font-medium">+{h.puntos}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Creencias */}
        <div className="card p-4">
          <p className="text-sm font-medium text-g-900 mb-3">Transforma tus creencias</p>
          <div className="space-y-3">
            {[
              {lim:'"El dinero es para los que nacen ricos."', pot:'"El dinero es resultado de valor constante."'},
              {lim:'"Nunca voy a poder ahorrar."', pot:'"Cada peso ahorrado es una decisión de mi yo futuro."'},
              {lim:'"Gastar es vivir el presente."', pot:'"Invertir es regalarme el futuro."'},
            ].map((c,i) => (
              <div key={i} className="space-y-1.5">
                <div className="bg-red-50 rounded-xl p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-red-600 font-medium mb-0.5">Antes</p>
                  <p className="text-xs text-red-800">{c.lim}</p>
                </div>
                <div className="flex items-center gap-1 pl-2"><i className="ti ti-arrow-down text-g-300 text-xs"/></div>
                <div className="bg-g-50 rounded-xl p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-g-600 font-medium mb-0.5">Ahora</p>
                  <p className="text-xs text-g-800">{c.pot}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Afirmaciones */}
      <div>
        <p className="section-label">Afirmaciones de hoy</p>
        <div className="grid grid-cols-3 gap-3">
          {AFIRMACIONES.map((a,i) => (
            <button key={i} onClick={() => setAfirmDone(d => d.includes(i)?d.filter(x=>x!==i):[...d,i])}
              className={`card p-4 text-left transition-all ${afirmDone.includes(i)?'border-g-300 bg-g-50':'hover:border-g-200'}`}>
              <i className={`ti ${a.ico} text-xl mb-2 block`} style={{color:a.color}}/>
              <p className="text-xs text-g-800 font-medium leading-relaxed">{a.txt}</p>
              <p className={`text-[10px] mt-2 ${afirmDone.includes(i)?'text-g-500':'text-g-300'}`}>
                {afirmDone.includes(i)?'✓ Dicha hoy':'Toca para marcar'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Diario */}
      <div className="card p-5">
        <p className="text-sm font-medium text-g-900 mb-3">Diario financiero</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {PREGUNTAS.map((p,i) => (
            <button key={i} onClick={() => setPregIdx(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${pregIdx===i?'bg-g-50 border-g-300 text-g-700':'bg-white border-g-200/60 text-g-400'}`}>
              {p}
            </button>
          ))}
        </div>
        <p className="text-sm text-g-700 font-medium mb-2">{PREGUNTAS[pregIdx]}</p>
        <textarea className="input resize-none h-24" placeholder="Escribe libremente... sin juicio. Este espacio es tuyo."
          value={diario} onChange={e => setDiario(e.target.value)}/>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-g-400">{diario.length} caracteres</span>
          <button onClick={guardarDiario} className="btn-primary text-xs py-1.5">Guardar reflexión</button>
        </div>
      </div>

      {entradas.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-medium text-g-900 mb-3">Reflexiones anteriores</p>
          <div className="space-y-3">
            {entradas.slice(0,3).map(e => (
              <div key={e.id} className="bg-g-50 rounded-xl p-3">
                <p className="text-[11px] text-g-500 mb-1">{e.pregunta}</p>
                <p className="text-sm text-g-800 italic">"{e.respuesta}"</p>
                <p className="text-[10px] text-g-400 mt-1">{new Date(e.created_at).toLocaleDateString('es-CO')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
