import { useState } from 'react';

const fmt = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
const fmtPct = v => `${parseFloat(v).toFixed(2)}%`;

// Convierte input con coma o punto a número
const toNum = v => parseFloat(String(v).replace(',', '.'));

// ── Calculadora de crédito / préstamo ──────────────────────
function CalcCredito() {
  const [monto, setMonto]     = useState('');
  const [tasa, setTasa]       = useState('');
  const [meses, setMeses]     = useState('');
  const [tipotasa, setTipoTasa] = useState('mes');
  const [res, setRes]         = useState(null);

  const calcular = () => {
    const P = toNum(monto);
    const t = toNum(tasa) / 100;
    const n = parseInt(meses);
    let r;
    if (tipotasa === 'mes')      r = t;
    else if (tipotasa === 'anio_mv') r = t / 12;
    else r = Math.pow(1 + t, 1/12) - 1;
    if (!P || !r || !n) return;
    const cuota = (P * r * Math.pow(1+r,n)) / (Math.pow(1+r,n) - 1);
    const totalPagado = cuota * n;
    const totalIntereses = totalPagado - P;
    const tasaEA = (Math.pow(1+r,12) - 1) * 100;
    const tabla = Array.from({length: n}, (_, i) => {
      const saldo = P * Math.pow(1+r,i+1) - cuota * ((Math.pow(1+r,i+1)-1)/r);
      return { mes: i+1, saldo: Math.max(saldo, 0) };
    });
    setRes({ cuota, totalPagado, totalIntereses, tasaEA, tabla, n, P });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="section-label block mb-1">Monto del préstamo (COP)</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 10000000"
            value={monto} onChange={e=>setMonto(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-label block mb-1">Tasa (%)</label>
            <input type="text" inputMode="decimal" className="input" placeholder="Ej: 2.5"
              value={tasa} onChange={e=>setTasa(e.target.value)}/>
          </div>
          <div>
            <label className="section-label block mb-1">Tipo de tasa</label>
            <select className="select" value={tipotasa} onChange={e=>setTipoTasa(e.target.value)}>
              <option value="mes">Mensual</option>
              <option value="anio_mv">Anual MV</option>
              <option value="ea">Anual EA</option>
            </select>
          </div>
        </div>
        <div>
          <label className="section-label block mb-1">Plazo (meses)</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 24"
            value={meses} onChange={e=>setMeses(e.target.value)}/>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular cuota</button>

      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 bg-g-800 text-white">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Cuota mensual</p>
              <p className="text-lg font-medium">{fmt(res.cuota)}</p>
            </div>
            <div className="card p-3 bg-red-50 border-red-100">
              <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Total intereses</p>
              <p className="text-lg font-medium text-red-600">{fmt(res.totalIntereses)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Total a pagar</p>
              <p className="text-base font-medium text-g-900">{fmt(res.totalPagado)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Tasa EA equiv.</p>
              <p className="text-base font-medium text-g-900">{fmtPct(res.tasaEA)}</p>
            </div>
          </div>
          <div className="card p-3">
            <p className="text-xs font-medium text-g-700 mb-2">Saldo proyectado</p>
            <div className="space-y-1.5">
              {res.tabla.filter((_,i)=> i===0||i===2||i===5||i===11||(i+1)===res.n).map(r=>(
                <div key={r.mes} className="flex justify-between text-xs">
                  <span className="text-g-500">Mes {r.mes}</span>
                  <span className="font-medium text-g-800">{fmt(r.saldo)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calculadora de inversión ────────────────────────────────
function CalcInversion() {
  const [capital, setCapital]   = useState('');
  const [aporte, setAporte]     = useState('');
  const [tasa, setTasa]         = useState('');
  const [tipotasa, setTipoTasa] = useState('ea');
  const [meses, setMeses]       = useState('');
  const [compuesto, setCompuesto] = useState(true);
  const [res, setRes]           = useState(null);

  const calcular = () => {
    const P = toNum(capital) || 0;
    const A = toNum(aporte)  || 0;
    const t = toNum(tasa) / 100;
    const n = parseInt(meses);
    let r;
    if (tipotasa === 'mes')      r = t;
    else if (tipotasa === 'anio_mv') r = t / 12;
    else r = Math.pow(1+t, 1/12) - 1;
    if ((!P && !A) || !r || !n) return;
    let montoFinal;
    if (compuesto) montoFinal = P * Math.pow(1+r,n) + (A>0 ? A*((Math.pow(1+r,n)-1)/r) : 0);
    else           montoFinal = P + P*r*n + A*n;
    const totalAportado = P + A*n;
    const rendTotal = montoFinal - totalAportado;
    const tasaEA = (Math.pow(1+r,12)-1)*100;
    const hitos = [3,6,12,24,36,60].filter(m=>m<n);
    if (!hitos.includes(n)) hitos.push(n);
    const proyeccion = hitos.map(m=>{
      let val;
      if (compuesto) val = P*Math.pow(1+r,m) + (A>0?A*((Math.pow(1+r,m)-1)/r):0);
      else           val = P+P*r*m+A*m;
      return { mes: m, valor: val };
    });
    setRes({ montoFinal, rendTotal, totalAportado, proyeccion, tasaEA });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="section-label block mb-1">Capital inicial (COP)</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 5000000"
            value={capital} onChange={e=>setCapital(e.target.value)}/>
        </div>
        <div>
          <label className="section-label block mb-1">Aporte mensual (COP)</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 500000"
            value={aporte} onChange={e=>setAporte(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-label block mb-1">Rendimiento (%)</label>
            <input type="text" inputMode="decimal" className="input" placeholder="Ej: 12"
              value={tasa} onChange={e=>setTasa(e.target.value)}/>
          </div>
          <div>
            <label className="section-label block mb-1">Tipo de tasa</label>
            <select className="select" value={tipotasa} onChange={e=>setTipoTasa(e.target.value)}>
              <option value="mes">Mensual</option>
              <option value="anio_mv">Anual MV</option>
              <option value="ea">Anual EA</option>
            </select>
          </div>
        </div>
        <div>
          <label className="section-label block mb-1">Plazo (meses)</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 36"
            value={meses} onChange={e=>setMeses(e.target.value)}/>
        </div>
        <div className="flex items-center justify-between card p-3">
          <div>
            <p className="text-xs font-medium text-g-800">Interés compuesto</p>
            <p className="text-[11px] text-g-400">El rendimiento también genera rendimiento</p>
          </div>
          <button type="button" onClick={()=>setCompuesto(!compuesto)}
            className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${compuesto?'bg-g-600':'bg-g-200'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${compuesto?'left-6':'left-1'}`}/>
          </button>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular inversión</button>

      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 bg-g-800 text-white">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Monto final</p>
              <p className="text-lg font-medium">{fmt(res.montoFinal)}</p>
            </div>
            <div className="card p-3 bg-g-50">
              <p className="section-label">Rendimiento total</p>
              <p className="text-lg font-medium text-g-600">+{fmt(res.rendTotal)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Total aportado</p>
              <p className="text-base font-medium text-g-900">{fmt(res.totalAportado)}</p>
            </div>
            <div className="card p-3">
              <p className="section-label">Tasa EA equiv.</p>
              <p className="text-base font-medium text-g-900">{fmtPct(res.tasaEA)}</p>
            </div>
          </div>
          <div className="card p-3">
            <p className="text-xs font-medium text-g-700 mb-2">Proyección de crecimiento</p>
            <div className="space-y-2">
              {res.proyeccion.map(p=>(
                <div key={p.mes} className="flex items-center gap-2 text-xs">
                  <span className="text-g-500 w-12 flex-shrink-0">Mes {p.mes}</span>
                  <div className="flex-1">
                    <div className="h-1.5 bg-g-100 rounded-full">
                      <div className="h-full bg-g-400 rounded-full" style={{width:`${Math.min((p.valor/res.montoFinal)*100,100)}%`}}/>
                    </div>
                  </div>
                  <span className="font-medium text-g-800 text-right w-24 flex-shrink-0">{fmt(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calculadora libertad financiera ────────────────────────
function CalcLibertad() {
  const [gastos, setGastos]               = useState('');
  const [tasa, setTasa]                   = useState('');
  const [patrimonioActual, setPatrimonio] = useState('');
  const [ahorroMes, setAhorro]            = useState('');
  const [res, setRes]                     = useState(null);

  const calcular = () => {
    const G = toNum(gastos);
    const r = toNum(tasa) / 100;
    const P = toNum(patrimonioActual) || 0;
    const A = toNum(ahorroMes) || 0;
    if (!G || !r) return;
    const objetivo = G * 12 / r;
    const faltante = Math.max(objetivo - P, 0);
    let mesesFaltantes = null;
    if (A > 0 && faltante > 0) {
      const rMes = Math.pow(1+r, 1/12) - 1;
      mesesFaltantes = Math.log((faltante * rMes / A) + 1) / Math.log(1 + rMes);
    } else if (faltante === 0) {
      mesesFaltantes = 0;
    }
    setRes({ objetivo, faltante, mesesFaltantes, G, r });
  };

  return (
    <div className="space-y-4">
      <div className="card p-3 bg-g-50 border-g-200">
        <p className="text-xs text-g-600">
          <i className="ti ti-info-circle mr-1"/>
          Libertad financiera = tus inversiones generan al año lo suficiente para cubrir tus gastos sin trabajar.
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="section-label block mb-1">Gastos mensuales (COP)</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 3000000"
            value={gastos} onChange={e=>setGastos(e.target.value)}/>
        </div>
        <div>
          <label className="section-label block mb-1">Rendimiento anual esperado (%)</label>
          <input type="text" inputMode="decimal" className="input" placeholder="Ej: 8"
            value={tasa} onChange={e=>setTasa(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-label block mb-1">Patrimonio actual</label>
            <input type="text" inputMode="numeric" className="input" placeholder="Ej: 50000000"
              value={patrimonioActual} onChange={e=>setPatrimonio(e.target.value)}/>
          </div>
          <div>
            <label className="section-label block mb-1">Ahorro mensual</label>
            <input type="text" inputMode="numeric" className="input" placeholder="Ej: 1000000"
              value={ahorroMes} onChange={e=>setAhorro(e.target.value)}/>
          </div>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular</button>

      {res && (
        <div className="space-y-3">
          <div className="card p-4 bg-g-800 text-white">
            <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Tu número de libertad financiera</p>
            <p className="text-2xl font-medium">{fmt(res.objetivo)}</p>
            <p className="text-xs text-g-300 mt-1">Necesitas generar {fmt(res.G*12)}/año para ser libre</p>
          </div>
          {res.mesesFaltantes !== null && res.mesesFaltantes > 0 && (
            <div className="card p-4 bg-g-50">
              <p className="section-label mb-1">Tiempo estimado</p>
              <p className="text-2xl font-medium text-g-800">
                {Math.ceil(res.mesesFaltantes)} meses
                <span className="text-sm font-normal text-g-500 ml-2">
                  ({(res.mesesFaltantes/12).toFixed(1)} años)
                </span>
              </p>
            </div>
          )}
          {res.mesesFaltantes === 0 && (
            <div className="card p-4 bg-g-50 border-g-300">
              <p className="text-sm font-medium text-g-700">🎉 ¡Ya alcanzaste la libertad financiera!</p>
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

// ── Página principal ────────────────────────────────────────
const TABS = [
  { id: 'credito',   icon: 'ti-credit-card',  label: 'Crédito' },
  { id: 'inversion', icon: 'ti-trending-up',  label: 'Inversión' },
  { id: 'libertad',  icon: 'ti-flag',          label: 'Libertad' },
];

export default function Calculadora() {
  const [tab, setTab] = useState('credito');

  return (
    <div className="space-y-4 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Calculadoras</h2>
        <p className="text-sm text-g-400">Simula antes de decidir</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${tab===t.id?'bg-g-800 text-white border-g-800':'bg-white text-g-600 border-g-200/60'}`}>
            <i className={`ti ${t.icon} text-base`}/>
            <span className="text-xs font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="card p-4">
        {tab === 'credito'   && <CalcCredito/>}
        {tab === 'inversion' && <CalcInversion/>}
        {tab === 'libertad'  && <CalcLibertad/>}
      </div>
    </div>
  );
}
