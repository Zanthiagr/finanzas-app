import { useEffect, useState } from 'react';
import { getHabitos, toggleHabito, getDiario, crearEntradaDiario } from '../utils/api';
import toast from 'react-hot-toast';

const FRASES = [
  { txt: '"No es cuánto ganas lo que determina tu riqueza — es cuánto conservas."', autor: 'Robert Kiyosaki' },
  { txt: '"La disciplina es el puente entre las metas y los logros."', autor: 'Jim Rohn' },
  { txt: '"Un peso ahorrado hoy es libertad comprada para mañana."', autor: '' },
  { txt: '"No trabajes por dinero. Haz que el dinero trabaje por ti."', autor: 'Warren Buffett' },
  { txt: '"La mejor inversión que puedes hacer es en ti mismo."', autor: 'Warren Buffett' },
];

const AFIRMACIONES = [
  { ico: 'ti-heart',       color: '#7C7594', txt: '"Merezco prosperar y vivir con abundancia"' },
  { ico: 'ti-trending-up', color: '#16A34A', txt: '"Cada decisión pequeña construye mi libertad"' },
  { ico: 'ti-brain',       color: '#A8792E', txt: '"Mi mente crea riqueza con cada pensamiento que elijo"' },
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
  const [tab, setTab]             = useState('habitos'); // móvil tabs

  useEffect(() => {
    getHabitos().then(setHabitos).catch(console.error);
    getDiario().then(setEntradas).catch(console.error);
  }, []);

  const handleToggle = async h => {
    // Actualización optimista — el check cambia inmediatamente sin esperar la BD
    const nuevoEstado = !h.completado_hoy;
    setHabitos(prev => prev.map(x => x.id===h.id ? {...x, completado_hoy: nuevoEstado} : x));
    try {
      const r = await toggleHabito(h.id, h.puntos);
      // Sincronizar con el valor real devuelto por la BD
      setHabitos(prev => prev.map(x => x.id===h.id ? {...x, completado_hoy: r.completado} : x));
      if (r.completado) toast.success(`+${h.puntos} XP 🎉`);
    } catch (err) {
      // Revertir si falló
      setHabitos(prev => prev.map(x => x.id===h.id ? {...x, completado_hoy: h.completado_hoy} : x));
      toast.error('Error actualizando hábito');
    }
  };

  const guardarDiario = async () => {
    if (!diario.trim()) return;
    try {
      await crearEntradaDiario({ pregunta: PREGUNTAS[pregIdx], respuesta: diario });
      toast.success('Reflexión guardada ✨');
      setDiario('');
      getDiario().then(setEntradas);
    } catch { toast.error('Error guardando'); }
  };

  const done  = habitos.filter(h=>h.completado_hoy).length;
  const frase = FRASES[fraseIdx];

  const TABS = [
    { id:'habitos',     label:'Hábitos',   icon:'ti-flame' },
    { id:'creencias',   label:'Creencias', icon:'ti-brain' },
    { id:'afirmaciones',label:'Afirmar',   icon:'ti-heart' },
    { id:'diario',      label:'Diario',    icon:'ti-notebook' },
  ];

  return (
    <div className="space-y-4 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Mentalidad financiera</h2>
        <p className="text-sm text-g-400">La riqueza empieza en cómo piensas</p>
      </div>

      {/* Frase del día */}
      <div className="relative overflow-hidden bg-g-800 rounded-2xl p-4 md:p-5">
        <div className="card-premium-glow -top-10 -right-10 w-36 h-36 bg-gold opacity-[0.1]"/>
        <p className="relative text-[10px] uppercase tracking-widest text-g-200 mb-3">Frase del día</p>
        <p className="relative text-white font-serif text-sm md:text-base leading-relaxed mb-3">{frase.txt}</p>
        <div className="relative flex items-center justify-between">
          <p className="text-white/30 text-xs">{frase.autor ? `— ${frase.autor}` : ''}</p>
          <button onClick={()=>setFraseIdx((fraseIdx+1)%FRASES.length)}
            className="text-gold/70 hover:text-gold text-xs flex items-center gap-1">
            <i className="ti ti-refresh text-xs"/> Nueva
          </button>
        </div>
      </div>

      {/* Tabs móvil */}
      <div className="flex gap-1 bg-g-50 rounded-xl p-1 md:hidden">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium transition-all ${tab===t.id?'bg-white text-g-700 shadow-sm':'text-g-400'}`}>
            <i className={`ti ${t.icon} text-sm`}/>
            {t.label}
          </button>
        ))}
      </div>

      {/* Hábitos */}
      <div className={`${tab!=='habitos'?'hidden md:block':''}`}>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-g-900">Hábitos de hoy</p>
            <span className="text-xs text-g-500 bg-g-50 px-2 py-0.5 rounded-full">{done}/{habitos.length}</span>
          </div>
          <div className="h-2 bg-g-100 rounded-full overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all"
              style={{width: habitos.length>0?`${(done/habitos.length)*100}%`:'0%', background: 'linear-gradient(90deg, #C9A84C, #6E93FF)'}}/>
          </div>
          <div className="space-y-1">
            {habitos.map(h=>(
              <button key={h.id} onClick={()=>handleToggle(h)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-g-50 active:bg-g-100 transition-colors text-left">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${h.completado_hoy?'bg-g-700 border-g-700':'border-g-300'}`}>
                  {h.completado_hoy && <i className="ti ti-check text-white text-xs"/>}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${h.completado_hoy?'line-through text-g-400':'text-g-900 font-medium'}`}>{h.nombre}</p>
                  <p className="text-[10px] text-g-400">{h.momento?.replace('_',' ')}</p>
                </div>
                <span className="text-[11px] text-gold font-medium">+{h.puntos} XP</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Creencias */}
      <div className={`${tab!=='creencias'?'hidden md:block':''}`}>
        <div className="card p-4">
          <p className="text-sm font-medium text-g-900 mb-3">Transforma tus creencias</p>
          <div className="space-y-4">
            {[
              {lim:'"El dinero es para los que nacen ricos."',pot:'"El dinero es resultado de valor constante."'},
              {lim:'"Nunca voy a poder ahorrar."',pot:'"Cada peso ahorrado es una decisión de mi yo futuro."'},
              {lim:'"Gastar es vivir el presente."',pot:'"Invertir es regalarme el futuro."'},
            ].map((c,i)=>(
              <div key={i} className="flex gap-3 items-center">
                <div className="flex-1 bg-red-50 rounded-xl p-3">
                  <p className="text-[9px] uppercase tracking-wider text-red-600 font-medium mb-0.5">Antes</p>
                  <p className="text-xs text-red-800">{c.lim}</p>
                </div>
                <i className="ti ti-arrow-right text-gold flex-shrink-0"/>
                <div className="flex-1 bg-gold/8 rounded-xl p-3">
                  <p className="text-[9px] uppercase tracking-wider text-gold-dark font-medium mb-0.5">Ahora</p>
                  <p className="text-xs text-g-800">{c.pot}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Afirmaciones */}
      <div className={`${tab!=='afirmaciones'?'hidden md:block':''}`}>
        <div className="space-y-3">
          {AFIRMACIONES.map((a,i)=>{
            const hecha = afirmDone.includes(i);
            return (
              <button key={i} onClick={()=>setAfirmDone(d=>d.includes(i)?d.filter(x=>x!==i):[...d,i])}
                className={`w-full card p-4 text-left flex items-center gap-3 transition-all active:scale-[0.98] ${hecha?'border-gold/40 bg-gold/5':''}`}>
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{background: a.color+'15'}}>
                  <i className={`ti ${a.ico} text-lg`} style={{color:a.color}}/>
                  {hecha && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                      <i className="ti ti-check text-g-900 text-[9px]"/>
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-g-800 font-medium leading-relaxed">{a.txt}</p>
                  <p className={`text-[10px] mt-1 ${hecha?'text-gold-dark font-medium':'text-g-300'}`}>
                    {hecha?'✓ Dicha hoy':'Toca para marcar'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Diario */}
      <div className={`${tab!=='diario'?'hidden md:block':''}`}>
        <div className="card p-4">
          <p className="text-sm font-medium text-g-900 mb-3">Diario financiero</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {PREGUNTAS.map((p,i)=>(
              <button key={i} onClick={()=>setPregIdx(i)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${pregIdx===i?'bg-g-50 border-g-300 text-g-700':'bg-white border-g-200/60 text-g-400'}`}>
                {p.split(' ').slice(0,3).join(' ')}...
              </button>
            ))}
          </div>
          <p className="text-sm text-g-700 font-medium mb-2">{PREGUNTAS[pregIdx]}</p>
          <textarea className="input resize-none h-28"
            placeholder="Escribe libremente... sin juicio."
            value={diario} onChange={e=>setDiario(e.target.value)}/>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-g-400">{diario.length} caracteres</span>
            <button onClick={guardarDiario} className="btn-primary text-xs py-2">Guardar ✨</button>
          </div>
        </div>
        {entradas.length>0 && (
          <div className="space-y-3 mt-3">
            {entradas.slice(0,3).map(e=>(
              <div key={e.id} className="card p-4 relative overflow-hidden">
                <i className="ti ti-quote absolute -top-1 -right-1 text-4xl text-g-50"/>
                <p className="text-[11px] text-g-500 mb-1.5 relative">{e.pregunta}</p>
                <p className="text-sm text-g-800 font-serif italic leading-relaxed relative">"{e.respuesta}"</p>
                <p className="text-[10px] text-g-400 mt-2 relative">{new Date(e.created_at).toLocaleDateString('es-CO')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
