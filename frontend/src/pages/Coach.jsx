import { useState, useEffect, useRef } from 'react';
import { getResumen, getMovimientos, getDeudas, getMetas } from '../utils/api';
import { supabase } from '../utils/supabase';
import { fmt, fmtShort } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const LIMITE_MENSAJES = 15;
const SUGERENCIAS = [
  '¿Cómo voy este mes con mis finanzas?',
  '¿En qué estoy gastando demasiado?',
  '¿Cómo puedo ahorrar más este mes?',
  '¿Qué hago primero: pagar deudas o ahorrar?',
  'Dame un plan para mejorar mi salud financiera',
  '¿Cómo empiezo a invertir con poco dinero?',
];

function MsgBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-g-800 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
          <i className="ti ti-robot text-g-200 text-sm"/>
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-g-700 text-white rounded-tr-sm'
          : 'bg-white border border-g-200/60 text-g-800 rounded-tl-sm shadow-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

function LimiteBanner({ usados, limite, onUpgrade }) {
  const restantes = limite - usados;
  const pct = (usados / limite) * 100;
  const agotado = restantes <= 0;

  return (
    <div className={`rounded-xl p-3 mb-3 flex-shrink-0 ${agotado ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-medium ${agotado ? 'text-red-700' : 'text-amber-700'}`}>
          {agotado
            ? '😔 Agotaste tus mensajes gratis este mes'
            : `💬 ${restantes} mensaje${restantes !== 1 ? 's' : ''} gratis restante${restantes !== 1 ? 's' : ''} este mes`}
        </p>
        <span className={`text-[10px] font-medium ${agotado ? 'text-red-500' : 'text-amber-600'}`}>
          {usados}/{limite}
        </span>
      </div>
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${agotado ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-g-400'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}/>
      </div>
      {agotado && (
        <button onClick={onUpgrade}
          className="w-full bg-g-800 text-white text-xs font-medium py-2 rounded-lg mt-1 hover:bg-g-900 transition-colors">
          ✨ Obtener mensajes ilimitados
        </button>
      )}
    </div>
  );
}

function UpgradeModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50">
      <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl shadow-2xl p-6">
        <div className="flex justify-center pt-1 pb-3 md:hidden">
          <div className="w-10 h-1 rounded-full bg-g-200"/>
        </div>
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gold/15 flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-robot text-gold text-2xl"/>
          </div>
          <h3 className="text-lg font-medium text-g-900 mb-1">Coach ilimitado</h3>
          <p className="text-sm text-g-500">Conversa sin límites con tu coach financiero personal</p>
        </div>

        <div className="bg-g-50 rounded-xl p-4 mb-5 space-y-2">
          {[
            'Mensajes ilimitados con el Coach IA',
            'Análisis profundo de tus finanzas',
            'Planes de ahorro personalizados',
            'Alertas inteligentes de gastos',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-g-400 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-check text-white text-[10px]"/>
              </div>
              <p className="text-sm text-g-700">{f}</p>
            </div>
          ))}
        </div>

        <div className="text-center mb-4">
          <p className="text-3xl font-medium text-g-900">$9.900 <span className="text-base font-normal text-g-400">COP/mes</span></p>
          <p className="text-xs text-g-400 mt-0.5">Menos de un café al mes</p>
        </div>

        <button className="w-full bg-g-800 text-white font-medium py-3 rounded-xl text-sm hover:bg-g-900 transition-colors mb-2">
          Obtener acceso ilimitado
        </button>
        <button onClick={onClose} className="w-full text-g-400 text-sm py-2">
          Seguir con el plan gratis
        </button>
      </div>
    </div>
  );
}

export default function Coach() {
  const { user, perfil } = useAuth();
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [contexto, setContexto]     = useState(null);
  const [cargandoCtx, setCargandoCtx] = useState(true);
  const [mensajesUsados, setMensajesUsados] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const bottomRef = useRef(null);
  const nombre = (perfil?.nombre || user?.user_metadata?.full_name || 'tú').split(' ')[0];

  // Contar mensajes usados este mes
  const cargarContador = async () => {
    if (!user?.id) return;
    const mesActual = new Date().toISOString().slice(0, 7);
    const { count } = await supabase
      .from('coach_mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .gte('created_at', `${mesActual}-01`);
    setMensajesUsados(count || 0);
  };

  // Registrar mensaje usado
  const registrarMensaje = async () => {
    if (!user?.id) return;
    await supabase.from('coach_mensajes').insert({ usuario_id: user.id });
    setMensajesUsados(prev => prev + 1);
  };

  // Cargar datos reales
  useEffect(() => {
    const cargar = async () => {
      try {
        const now  = new Date();
        const mes  = now.getMonth() + 1;
        const anio = now.getFullYear();
        const [resumen, movimientos, deudas, metas] = await Promise.all([
          getResumen({ mes, anio }),
          getMovimientos({ mes, anio }),
          getDeudas(),
          getMetas(),
        ]);
        setContexto({ resumen, movimientos: movimientos.slice(0, 20), deudas, metas });
      } catch (e) { console.error(e); }
      finally { setCargandoCtx(false); }
    };
    cargar();
    cargarContador();
  }, []);

  // Mensaje de bienvenida
  useEffect(() => {
    if (!cargandoCtx) {
      const pctAhorro = contexto?.resumen?.ingresos > 0
        ? Math.round((contexto.resumen.balance / contexto.resumen.ingresos) * 100)
        : null;
      setMessages([{
        role: 'assistant',
        content: `¡Hola ${nombre}! Soy tu coach financiero 🌱\n\nYa leí tus datos de este mes. ${
          contexto?.resumen?.ingresos > 0
            ? `Llevas ${fmt(contexto.resumen.ingresos)} de ingresos y ${fmt(contexto.resumen.gastos)} de gastos — ${
                pctAhorro >= 20
                  ? `¡vas muy bien con un ${pctAhorro}% de ahorro! 💚`
                  : pctAhorro >= 0
                    ? `llevas un ${pctAhorro}% de ahorro, hay espacio para mejorar 📈`
                    : `estás gastando más de lo que ingresas — hablemos de eso 🔍`
              }`
            : 'Aún no tienes movimientos este mes — puedo ayudarte a empezar con un plan.'
        }\n\n¿Sobre qué quieres que hablemos hoy?`,
      }]);
    }
  }, [cargandoCtx]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const construirSistema = () => {
    if (!contexto) return `Eres un coach financiero empático para personas en Colombia. Hablas en español, usas pesos colombianos (COP) y das consejos prácticos y accionables.`;

    const { resumen, movimientos, deudas, metas } = contexto;

    const topGastos = resumen.porCategoria
      ?.filter(c => c.tipo === 'gasto').slice(0, 5)
      .map(c => `${c.categoria}: ${fmt(c.total)}`).join(', ') || 'Sin datos';

    const deudasActivas = deudas.filter(d => d.activa)
      .map(d => `${d.nombre} (${fmt(parseFloat(d.monto_total) - parseFloat(d.monto_pagado))} pendiente al ${d.tasa_interes}% EA)`)
      .join(', ') || 'Sin deudas activas';

    const metasActivas = metas.filter(m => !m.completada)
      .map(m => `${m.nombre}: ${Math.round((m.monto_actual/m.monto_objetivo)*100)}% logrado`)
      .join(', ') || 'Sin metas activas';

    return `Eres un coach financiero empático, directo y motivador para ${nombre}, una persona en Colombia.

DATOS REALES DE ${nombre} ESTE MES:
- Ingresos: ${fmt(resumen.ingresos)}
- Gastos: ${fmt(resumen.gastos)}
- Balance: ${fmt(resumen.balance)}
- Tasa de ahorro: ${resumen.ingresos > 0 ? Math.round((resumen.balance/resumen.ingresos)*100) : 0}%
- Top gastos por categoría: ${topGastos}
- Deudas activas: ${deudasActivas}
- Metas de ahorro: ${metasActivas}
- Total movimientos este mes: ${movimientos.length}

ÚLTIMOS MOVIMIENTOS:
${movimientos.slice(0,10).map(m => `- ${m.tipo==='ingreso'?'+':'-'}${fmt(m.monto)} en ${m.categoria}${m.descripcion?' ('+m.descripcion+')':''}`).join('\n')}

INSTRUCCIONES:
- Habla en español colombiano, cálido y directo
- Usa los datos reales para dar consejos ESPECÍFICOS — menciona cifras exactas
- Máximo 3 párrafos por respuesta
- Sé motivador pero honesto
- Tu misión es ayudar a ${nombre} a lograr libertad financiera desde donde está hoy
- Usa emojis con moderación`;
  };

  const enviar = async (texto) => {
    const msg = (texto || input).trim();
    if (!msg || loading) return;

    // Verificar límite
    if (mensajesUsados >= LIMITE_MENSAJES) {
      setShowUpgrade(true);
      return;
    }

    setInput('');
    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    // Registrar uso
    await registrarMensaje();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: construirSistema(),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const respuesta = data.content?.[0]?.text || 'Hubo un error. Intenta de nuevo.';
      setMessages(prev => [...prev, { role: 'assistant', content: respuesta }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Hubo un problema de conexión. Intenta de nuevo.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const agotado = mensajesUsados >= LIMITE_MENSAJES;
  const mostrarBanner = mensajesUsados >= Math.floor(LIMITE_MENSAJES * 0.6); // Muestra desde 60%

  if (cargandoCtx) return (
    <div className="flex items-center justify-center h-64 flex-col gap-3">
      <i className="ti ti-loader animate-spin text-2xl text-g-400"/>
      <p className="text-sm text-g-400">Leyendo tus datos financieros...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] page-enter">

      {/* Header */}
      <div className="bg-g-800 rounded-2xl p-4 mb-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
          <i className="ti ti-robot text-gold text-lg"/>
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm">Coach financiero IA</p>
          <p className="text-white/40 text-xs">Conoce tus datos reales · Siempre disponible</p>
        </div>
        {contexto?.resumen?.ingresos > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Balance</p>
            <p className={`text-sm font-medium ${contexto.resumen.balance >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
              {fmtShort(contexto.resumen.balance)}
            </p>
          </div>
        )}
      </div>

      {/* Banner límite */}
      {mostrarBanner && (
        <LimiteBanner
          usados={mensajesUsados}
          limite={LIMITE_MENSAJES}
          onUpgrade={() => setShowUpgrade(true)}
        />
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto mb-4 pr-1">
        {messages.map((m, i) => <MsgBubble key={i} msg={m}/>)}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-8 h-8 rounded-full bg-g-800 flex items-center justify-center flex-shrink-0 mr-2">
              <i className="ti ti-robot text-g-200 text-sm"/>
            </div>
            <div className="bg-white border border-g-200/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-g-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Sugerencias */}
      {messages.length <= 1 && !agotado && (
        <div className="mb-3 flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-g-400 mb-2">Preguntas sugeridas</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGERENCIAS.map((s, i) => (
              <button key={i} onClick={() => enviar(s)}
                className="flex-shrink-0 text-xs px-3 py-2 rounded-xl bg-white border border-g-200/60 text-g-700 hover:border-g-400 transition-all whitespace-nowrap active:scale-95">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {agotado ? (
        <div className="flex-shrink-0">
          <button onClick={() => setShowUpgrade(true)}
            className="w-full bg-g-800 text-white font-medium py-3 rounded-xl text-sm hover:bg-g-900 transition-colors flex items-center justify-center gap-2">
            <i className="ti ti-sparkles text-gold"/>
            Obtener mensajes ilimitados para seguir
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-shrink-0">
          <textarea
            className="flex-1 input resize-none text-sm py-3 max-h-28"
            placeholder="Pregúntame sobre tus finanzas..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button onClick={() => enviar()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-g-700 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-g-800 active:scale-95 transition-all self-end">
            <i className="ti ti-send text-sm"/>
          </button>
        </div>
      )}

      {/* Modal upgrade */}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)}/>}
    </div>
  );
}
