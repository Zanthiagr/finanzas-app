import { useState } from 'react';

const fmt = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
const fmtPct = v => `${parseFloat(v).toFixed(2)}%`;

// ── Calculadora de crédito / préstamo ────────────────────────
function CalcCredito() {
  const [monto, setMonto]   = useState('');
  const [tasa, setTasa]     = useState('');
  const [meses, setMeses]   = useState('');
  const [tipotasa, setTipoTasa] = useState('mes'); // mes | anio_mv | ea
  const [res, setRes]       = useState(null);

  const calcular = () => {
    const P = parseFloat(monto);
    let r;
    const t = parseFloat(tasa) / 100;
    if (tipotasa === 'mes')     r = t;
    else if (tipotasa === 'anio_mv') r = t / 12;
    else r = Math.pow(1 + t, 1/12) - 1; // EA → mes
    const n = parseInt(meses);
    if (!P || !r || !n) return;
    const cuota = (P * r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
    const totalPagado = cuota * n;
    const totalIntereses = totalPagado - P;
    const tasaEfectivaAnual = (Math.pow(1 + r, 12) - 1) * 100;
    const tabla = Array.from({length: Math.min(n, 60)}, (_, i) => {
      const saldo = P * Math.pow(1+r, i+1) - cuota * ((Math.pow(1+r, i+1) - 1) / r);
      const interes = i === 0 ? P * r : null; // just for display
      return { mes: i+1, saldo: Math.max(saldo, 0) };
    });
    setRes({ cuota, totalPagado, totalIntereses, tasaEfectivaAnual, r, tabla, n, P });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="section-label block mb-1">Monto del préstamo (COP)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 10000000"
            value={monto} onChange={e => setMonto(e.target.value)}/>
        </div>
        <div>
          <label className="section-label block mb-1">Tasa de interés (%)</label>
          <input type="number" inputMode="decimal" className="input" placeholder="Ej: 2.5"
            value={tasa} onChange={e => setTasa(e.target.value)} step="0.01"/>
        </div>
        <div>
          <label className="section-label block mb-1">Tipo de tasa</label>
          <select className="select" value={tipotasa} onChange={e => setTipoTasa(e.target.value)}>
            <option value="mes">Mensual</option>
            <option value="anio_mv">Anual MV</option>
            <option value="ea">Anual EA</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="section-label block mb-1">Plazo (meses)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 24"
            value={meses} onChange={e => setMeses(e.target.value)}/>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full">Calcular cuota</button>

      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 bg-g-800 text-white">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Cuota mensual</p>
              <p className="text-xl font-medium">{fmt(res.cuota)}</p>
            </div>
            <div className="card p-3 bg-red-50 border-red-100">
              <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Total intereses</p>
              <p className="text-xl font-medium text-red-600">{fmt(res.totalIntereses)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Total a pagar</p>
              <p className="text-lg font-medium text-g-900">{fmt(res.totalPagado)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Tasa EA equivalente</p>
              <p className="text-lg font-medium text-g-900">{fmtPct(res.tasaEfectivaAnual)}</p>
            </div>
          </div>
          <div className="card p-3">
            <p className="text-xs font-medium text-g-700 mb-2">Saldo proyectado (primeros meses)</p>
            <div className="space-y-1.5">
              {res.tabla.slice(0, 6).map(r => (
                <div key={r.mes} className="flex justify-between text-xs">
                  <span className="text-g-500">Mes {r.mes}</span>
                  <span className="font-medium text-g-800">{fmt(r.saldo)}</span>
                </div>
              ))}
              {res.n > 6 && (
                <div className="flex justify-between text-xs">
                  <span className="text-g-400">Mes {res.n}</span>
                  <span className="font-medium text-g-500">{fmt(0)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calculadora de inversión / ahorro ────────────────────────
function CalcInversion() {
  const [tipo, setTipo]       = useState('final'); // final | mensual
  const [capital, setCapital] = useState('');
  const [aporte, setAporte]   = useState('');
  const [tasa, setTasa]       = useState('');
  const [tipotasa, setTipoTasa] = useState('mes');
  const [meses, setMeses]     = useState('');
  const [compuesto, setCompuesto] = useState(true);
  const [res, setRes]         = useState(null);

  const calcular = () => {
    const P = parseFloat(capital) || 0;
    const A = parseFloat(aporte)  || 0;
    const t = parseFloat(tasa) / 100;
    let r;
    if (tipotasa === 'mes')     r = t;
    else if (tipotasa === 'anio_mv') r = t / 12;
    else r = Math.pow(1 + t, 1/12) - 1;
    const n = parseInt(meses);
    if ((!P && !A) || !r || !n) return;

    let montoFinal, rendTotal, montoFinalSinCompuesto;
    if (compuesto) {
      montoFinal = P * Math.pow(1+r, n) + (A > 0 ? A * ((Math.pow(1+r,n)-1)/r) : 0);
    } else {
      montoFinal = P + P * r * n + A * n;
    }
    rendTotal = montoFinal - P - A * n;
    const totalAportado = P + A * n;

    const proyeccion = [1,3,6,12,24,36,60].filter(m=>m<=n).map(m=>{
      let val;
      if (compuesto) val = P * Math.pow(1+r,m) + (A>0 ? A*((Math.pow(1+r,m)-1)/r) : 0);
      else val = P + P*r*m + A*m;
      return { mes: m, valor: val };
    });
    if (!proyeccion.find(p=>p.mes===n)) proyeccion.push({ mes: n, valor: montoFinal });
    const tasaEA = (Math.pow(1+r,12)-1)*100;
    setRes({ montoFinal, rendTotal, totalAportado, proyeccion, tasaEA });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 mb-1">
        {[['final','Capital inicial'],['mensual','Ahorro mensual']].map(([v,l])=>(
          <button key={v} type="button" onClick={()=>setTipo(v)}
            className={`py-2 rounded-xl text-xs font-medium border transition-all ${tipo===v?'bg-g-50 border-g-400 text-g-700':'bg-white border-g-200/60 text-g-500'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="section-label block mb-1">Capital inicial (COP)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 5000000"
            value={capital} onChange={e=>setCapital(e.target.value)}/>
        </div>
        <div className="col-span-2">
          <label className="section-label block mb-1">Aporte mensual (COP)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 500000"
            value={aporte} onChange={e=>setAporte(e.target.value)}/>
        </div>
        <div>
          <label className="section-label block mb-1">Tasa rendimiento (%)</label>
          <input type="number" inputMode="decimal" className="input" placeholder="Ej: 12"
            value={tasa} onChange={e=>setTasa(e.target.value)} step="0.01"/>
        </div>
        <div>
          <label className="section-label block mb-1">Tipo de tasa</label>
          <select className="select" value={tipotasa} onChange={e=>setTipoTasa(e.target.value)}>
            <option value="mes">Mensual</option>
            <option value="anio_mv">Anual MV</option>
            <option value="ea">Anual EA</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="section-label block mb-1">Plazo (meses)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 36"
            value={meses} onChange={e=>setMeses(e.target.value)}/>
        </div>
        <div className="col-span-2 flex items-center justify-between card p-3">
          <div>
            <p className="text-xs font-medium text-g-800">Interés compuesto</p>
            <p className="text-[11px] text-g-400">El rendimiento también genera rendimiento</p>
          </div>
          <button type="button" onClick={()=>setCompuesto(!compuesto)}
            className={`w-11 h-6 rounded-full transition-all relative ${compuesto?'bg-g-600':'bg-g-200'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${compuesto?'left-6':'left-1'}`}/>
          </button>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full">Calcular inversión</button>

      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 bg-g-800 text-white">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Monto final</p>
              <p className="text-xl font-medium">{fmt(res.montoFinal)}</p>
            </div>
            <div className="card p-3 bg-g-50 border-g-200">
              <p className="text-[10px] uppercase tracking-widest text-g-400 mb-1">Rendimiento total</p>
              <p className="text-xl font-medium text-g-600">+{fmt(res.rendTotal)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Total aportado</p>
              <p className="text-lg font-medium text-g-900">{fmt(res.totalAportado)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Tasa EA equiv.</p>
              <p className="text-lg font-medium text-g-900">{fmtPct(res.tasaEA)}</p>
            </div>
          </div>
          <div className="card p-3">
            <p className="text-xs font-medium text-g-700 mb-2">Proyección de crecimiento</p>
            <div className="space-y-1.5">
              {res.proyeccion.map(p=>(
                <div key={p.mes} className="flex justify-between items-center text-xs">
                  <span className="text-g-500">Mes {p.mes}</span>
                  <div className="flex-1 mx-3">
                    <div className="h-1.5 bg-g-100 rounded-full">
                      <div className="h-full bg-g-400 rounded-full" style={{width:`${Math.min((p.valor/res.montoFinal)*100,100)}%`}}/>
                    </div>
                  </div>
                  <span className="font-medium text-g-800 text-right min-w-[80px]">{fmt(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calculadora de libertad financiera ───────────────────────
function CalcLibertad() {
  const [gastos, setGastos] = useState('');
  const [tasa, setTasa]     = useState('');
  const [ahorroMes, setAhorroMes] = useState('');
  const [patrimonioActual, setPatrimonioActual] = useState('');
  const [res, setRes]       = useState(null);

  const calcular = () => {
    const G = parseFloat(gastos);
    const r = parseFloat(tasa) / 100;
    const A = parseFloat(ahorroMes) || 0;
    const P = parseFloat(patrimonioActual) || 0;
    if (!G || !r) return;
    const objetivo = G * 12 / r; // Regla del 4% / tasa personalizada
    const faltante = Math.max(objetivo - P, 0);
    let mesesFaltantes = null;
    if (A > 0) {
      const rMes = Math.pow(1+r, 1/12) - 1;
      mesesFaltantes = Math.log((faltante * rMes / A) + 1) / Math.log(1 + rMes);
    }
    setRes({ objetivo, faltante, mesesFaltantes, G, r, regla: `${(r*100).toFixed(1)}%` });
  };

  return (
    <div className="space-y-4">
      <div className="card p-3 bg-g-50 border-g-200">
        <p className="text-xs text-g-600">
          <i className="ti ti-info-circle mr-1"/>
          La libertad financiera llega cuando tus inversiones generan al año lo suficiente para cubrir tus gastos.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="section-label block mb-1">Gastos mensuales actuales (COP)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 3000000"
            value={gastos} onChange={e=>setGastos(e.target.value)}/>
        </div>
        <div className="col-span-2">
          <label className="section-label block mb-1">Rendimiento anual esperado (%)</label>
          <input type="number" inputMode="decimal" className="input" placeholder="Ej: 8 (regla del 4% usa 4%)"
            value={tasa} onChange={e=>setTasa(e.target.value)} step="0.1"/>
        </div>
        <div>
          <label className="section-label block mb-1">Patrimonio actual (COP)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 50000000"
            value={patrimonioActual} onChange={e=>setPatrimonioActual(e.target.value)}/>
        </div>
        <div>
          <label className="section-label block mb-1">Ahorro mensual (COP)</label>
          <input type="number" inputMode="numeric" className="input" placeholder="Ej: 1000000"
            value={ahorroMes} onChange={e=>setAhorroMes(e.target.value)}/>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full">Calcular</button>

      {res && (
        <div className="space-y-3">
          <div className="card p-4 bg-g-800 text-white">
            <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Tu número de libertad financiera</p>
            <p className="text-2xl font-medium">{fmt(res.objetivo)}</p>
            <p className="text-xs text-g-300 mt-1">Necesitas generar {fmt(res.G*12)}/año para ser libre</p>
          </div>
          {res.mesesFaltantes && (
            <div className="card p-4 bg-g-50 border-g-200">
              <p className="section-label mb-1">Tiempo estimado para lograrlo</p>
              <p className="text-2xl font-medium text-g-800">
                {Math.ceil(res.mesesFaltantes)} meses
                <span className="text-sm font-normal text-g-500 ml-2">
                  ({Math.round(res.mesesFaltantes/12 * 10)/10} años)
                </span>
              </p>
              <p className="text-xs text-g-400 mt-1">Ahorrando {fmt(parseFloat(ahorroMes))}/mes con {res.regla} de rendimiento anual</p>
            </div>
          )}
          <div className="card p-3">
            <p className="section-label">Falta para el objetivo</p>
            <p className="text-lg font-medium text-g-900">{fmt(res.faltante)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
const TABS = [
  { id: 'credito',   icon: 'ti-credit-card',   label: 'Crédito / Deuda' },
  { id: 'inversion', icon: 'ti-trending-up',    label: 'Inversión' },
  { id: 'libertad',  icon: 'ti-flag',            label: 'Libertad financiera' },
];

export default function CalculadoraFinanciera() {
  const [tab, setTab] = useState('credito');

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-g-800 flex items-center justify-center">
          <i className="ti ti-calculator text-white text-sm"/>
        </div>
        <div>
          <p className="text-sm font-medium text-g-900">Calculadoras financieras</p>
          <p className="text-[11px] text-g-400">Simula antes de decidir</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all flex-shrink-0 ${tab===t.id?'bg-g-800 text-white border-g-800':'bg-white text-g-600 border-g-200/60'}`}>
            <i className={`ti ${t.icon} text-xs`}/>{t.label}
          </button>
        ))}
      </div>

      {tab === 'credito'   && <CalcCredito/>}
      {tab === 'inversion' && <CalcInversion/>}
      {tab === 'libertad'  && <CalcLibertad/>}
    </div>
  );
}
