import { useState } from 'react';
import toast from 'react-hot-toast';
import Ring from '../components/Ring';
import Icon from '../utils/icons';

const fmt = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);
const fmtPct = v => `${parseFloat(v).toFixed(2)}%`;
const toNum = v => parseFloat(String(v).replace(',','.'));

function CalcCredito() {
  const [f, setF] = useState({ monto:'', tasa:'', meses:'', tipotasa:'mes' });
  const [res, setRes] = useState(null);
  const set = k => e => setF(p=>({...p,[k]:e.target.value.replace(',','.')}));

  const calcular = () => {
    const P = toNum(f.monto), t = toNum(f.tasa)/100, n = parseInt(f.meses);
    if (!P || isNaN(P)) return toast.error('Ingresa el monto del préstamo');
    if (!t || isNaN(t)) return toast.error('Ingresa la tasa de interés');
    if (!n || isNaN(n)) return toast.error('Ingresa el plazo en meses');
    let r = f.tipotasa==='mes' ? t : f.tipotasa==='anio_mv' ? t/12 : Math.pow(1+t,1/12)-1;
    const cuota = (P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    const totalPagado = cuota*n;
    setRes({ cuota, totalPagado, totalIntereses: totalPagado-P, tasaEA: (Math.pow(1+r,12)-1)*100, n, P, r });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="section-label block mb-1">Monto del préstamo (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 10000000" value={f.monto} onChange={set('monto')}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1">Tasa (%)</label>
          <input type="text" inputMode="decimal" className="input" placeholder="Ej: 2.5" value={f.tasa} onChange={set('tasa')}/>
        </div>
        <div>
          <label className="section-label block mb-1">Tipo</label>
          <select className="select" value={f.tipotasa} onChange={set('tipotasa')}>
            <option value="mes">Mensual</option>
            <option value="anio_mv">Anual MV</option>
            <option value="ea">Anual EA</option>
          </select>
        </div>
      </div>
      <div>
        <label className="section-label block mb-1">Plazo (meses)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 24" value={f.meses} onChange={set('meses')}/>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular</button>
      {res && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 bg-g-800 text-white col-span-2">
            <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Cuota mensual</p>
            <p className="text-2xl font-medium">{fmt(res.cuota)}</p>
          </div>
          <div className="card p-3"><p className="section-label">Total a pagar</p><p className="text-lg font-medium text-g-900">{fmt(res.totalPagado)}</p></div>
          <div className="card p-3"><p className="section-label">Total intereses</p><p className="text-lg font-medium text-red-500">{fmt(res.totalIntereses)}</p></div>
          <div className="card p-3 col-span-2"><p className="section-label">Tasa EA equivalente</p><p className="text-lg font-medium text-g-900">{fmtPct(res.tasaEA)}</p></div>
        </div>
      )}
    </div>
  );
}

function CalcInversion() {
  const [f, setF] = useState({ capital:'', aporte:'', tasa:'', tipotasa:'ea', meses:'', compuesto:true });
  const [res, setRes] = useState(null);
  const set = k => e => setF(p=>({...p,[k]:e.target.value.replace(',','.')}));

  const calcular = () => {
    const P = toNum(f.capital)||0, A = toNum(f.aporte)||0, t = toNum(f.tasa)/100, n = parseInt(f.meses);
    if (!P && !A) return toast.error('Ingresa capital inicial o aporte mensual');
    if (!t || isNaN(t)) return toast.error('Ingresa la tasa de rendimiento');
    if (!n || isNaN(n)) return toast.error('Ingresa el plazo en meses');
    let r = f.tipotasa==='mes' ? t : f.tipotasa==='anio_mv' ? t/12 : Math.pow(1+t,1/12)-1;
    const montoFinal = f.compuesto
      ? P*Math.pow(1+r,n) + (A>0 ? A*((Math.pow(1+r,n)-1)/r) : 0)
      : P + P*r*n + A*n;
    const totalAportado = P + A*n;
    const proyeccion = [3,6,12,24,36,60].filter(m=>m<n).concat([n]).map(m => {
      const val = f.compuesto ? P*Math.pow(1+r,m)+(A>0?A*((Math.pow(1+r,m)-1)/r):0) : P+P*r*m+A*m;
      return { mes: m, valor: val };
    });
    setRes({ montoFinal, totalAportado, rendTotal: montoFinal-totalAportado, tasaEA:(Math.pow(1+r,12)-1)*100, proyeccion });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="section-label block mb-1">Capital inicial (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 5000000" value={f.capital} onChange={set('capital')}/>
      </div>
      <div>
        <label className="section-label block mb-1">Aporte mensual (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 500000" value={f.aporte} onChange={set('aporte')}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1">Rendimiento (%)</label>
          <input type="text" inputMode="decimal" className="input" placeholder="Ej: 12" value={f.tasa} onChange={set('tasa')}/>
        </div>
        <div>
          <label className="section-label block mb-1">Tipo</label>
          <select className="select" value={f.tipotasa} onChange={set('tipotasa')}>
            <option value="mes">Mensual</option>
            <option value="anio_mv">Anual MV</option>
            <option value="ea">Anual EA</option>
          </select>
        </div>
      </div>
      <div>
        <label className="section-label block mb-1">Plazo (meses)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 36" value={f.meses} onChange={set('meses')}/>
      </div>
      <div className="flex items-center justify-between card p-3">
        <div>
          <p className="text-xs font-medium text-g-800">Interés compuesto</p>
          <p className="text-[11px] text-g-400">El rendimiento genera más rendimiento</p>
        </div>
        <button type="button" onClick={()=>setF(p=>({...p,compuesto:!p.compuesto}))}
          className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${f.compuesto?'bg-g-600':'bg-g-200'}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${f.compuesto?'left-6':'left-1'}`}/>
        </button>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular</button>
      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 bg-g-800 text-white col-span-2">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Monto final</p>
              <p className="text-2xl font-medium">{fmt(res.montoFinal)}</p>
            </div>
            <div className="card p-3"><p className="section-label">Total aportado</p><p className="text-lg font-medium text-g-900">{fmt(res.totalAportado)}</p></div>
            <div className="card p-3"><p className="section-label">Rendimiento total</p><p className="text-lg font-medium text-pos">+{fmt(res.rendTotal)}</p></div>
          </div>
          <div className="card p-3">
            <p className="text-xs font-medium text-g-700 mb-2">Proyección</p>
            {res.proyeccion.map(p=>(
              <div key={p.mes} className="flex items-center gap-2 text-xs mb-1.5">
                <span className="text-g-500 w-12 flex-shrink-0">Mes {p.mes}</span>
                <div className="flex-1 h-1.5 bg-g-100 rounded-full">
                  <div className="h-full bg-emerald-500 rounded-full" style={{width:`${Math.min((p.valor/res.montoFinal)*100,100)}%`}}/>
                </div>
                <span className="font-medium text-g-800 w-24 text-right flex-shrink-0">{fmt(p.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalcLibertad() {
  const [f, setF] = useState({ gastos:'', tasa:'', patrimonio:'', ahorro:'' });
  const [res, setRes] = useState(null);
  const set = k => e => setF(p=>({...p,[k]:e.target.value.replace(',','.')}));

  const calcular = () => {
    const G = toNum(f.gastos), r = toNum(f.tasa)/100, P = toNum(f.patrimonio)||0, A = toNum(f.ahorro)||0;
    if (!G || isNaN(G)) return toast.error('Ingresa tus gastos mensuales');
    if (!r || isNaN(r)) return toast.error('Ingresa el rendimiento anual esperado');
    const objetivo = G*12/r, faltante = Math.max(objetivo-P,0);
    let meses = null;
    if (A>0&&faltante>0) { const rM=Math.pow(1+r,1/12)-1; meses=Math.log((faltante*rM/A)+1)/Math.log(1+rM); }
    else if (faltante===0) meses=0;
    const pctLogrado = Math.min(Math.round((P/objetivo)*100),100);
    setRes({ objetivo, faltante, meses, G, pctLogrado });
  };

  return (
    <div className="space-y-4">
      <div className="card p-3 bg-g-50 border-g-200">
        <p className="text-xs text-g-600"><Icon name="info-circle" className="w-4 h-4 mr-1"/>Tus inversiones deben generar al año lo suficiente para cubrir todos tus gastos.</p>
      </div>
      <div>
        <label className="section-label block mb-1">Gastos mensuales (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 3000000" value={f.gastos} onChange={set('gastos')}/>
      </div>
      <div>
        <label className="section-label block mb-1">Rendimiento anual esperado (%)</label>
        <input type="text" inputMode="decimal" className="input" placeholder="Ej: 8" value={f.tasa} onChange={set('tasa')}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1">Patrimonio actual</label>
          <input type="text" inputMode="numeric" className="input" placeholder="0" value={f.patrimonio} onChange={set('patrimonio')}/>
        </div>
        <div>
          <label className="section-label block mb-1">Ahorro mensual</label>
          <input type="text" inputMode="numeric" className="input" placeholder="0" value={f.ahorro} onChange={set('ahorro')}/>
        </div>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular</button>
      {res && (
        <div className="space-y-3">
          <div className="relative overflow-hidden card p-4 bg-g-800 text-white flex items-center gap-4">
            <div className="card-premium-glow -top-8 -right-6 w-28 h-28 bg-gold opacity-[0.12]"/>
            <div className="relative flex-shrink-0">
              <Ring pct={res.pctLogrado} size={60} stroke={5.5} trackColor="rgba(255,255,255,0.15)"/>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold">{res.pctLogrado}%</span>
              </div>
            </div>
            <div className="relative min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-g-200 mb-1">Tu número de libertad financiera</p>
              <p className="text-xl font-medium">{fmt(res.objetivo)}</p>
              <p className="text-xs text-g-300 mt-1">Necesitas {fmt(res.G*12)}/año de rendimientos</p>
            </div>
          </div>
          {res.meses !== null && res.meses > 0 && (
            <div className="card p-4 bg-g-50">
              <p className="section-label mb-1">Tiempo estimado</p>
              <p className="text-2xl font-medium text-g-800">{Math.ceil(res.meses)} meses <span className="text-sm font-normal text-g-500">({(res.meses/12).toFixed(1)} años)</span></p>
            </div>
          )}
          {res.meses === 0 && <div className="card p-4 bg-g-50"><p className="text-sm font-medium text-g-700">🎉 ¡Ya alcanzaste la libertad financiera!</p></div>}
          <div className="card p-3"><p className="section-label">Falta para el objetivo</p><p className="text-lg font-medium text-g-900">{fmt(res.faltante)}</p></div>
        </div>
      )}
    </div>
  );
}

function CalcRegla503020() {
  const [ingreso, setIngreso] = useState('');
  const [res, setRes] = useState(null);
  const calcular = () => {
    const ing = toNum(ingreso);
    if (!ing || isNaN(ing)) return toast.error('Ingresa tu ingreso neto mensual');
    setRes({ necesidades: ing*0.5, deseos: ing*0.3, ahorro: ing*0.2 });
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="section-label block mb-1">Ingreso neto mensual (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 4000000" value={ingreso} onChange={e=>setIngreso(e.target.value.replace(',','.'))}/>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular</button>
      {res && (
        <div className="grid grid-cols-1 gap-3">
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/70">
            <p className="text-[10px] uppercase tracking-widest text-blue-700 font-medium mb-1">50% · Necesidades</p>
            <p className="text-xl font-medium text-blue-950 mb-1">{fmt(res.necesidades)}</p>
            <p className="text-[11px] text-blue-800/80 leading-snug">Arriendo, servicios, alimentación básica, salud y transporte indispensable.</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/70">
            <p className="text-[10px] uppercase tracking-widest text-amber-700 font-medium mb-1">30% · Deseos</p>
            <p className="text-xl font-medium text-amber-950 mb-1">{fmt(res.deseos)}</p>
            <p className="text-[11px] text-amber-800/80 leading-snug">Salidas a comer, viajes, compras personales, suscripciones y ocio.</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/70">
            <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-medium mb-1">20% · Ahorro e inversión</p>
            <p className="text-xl font-medium text-emerald-950 mb-1">{fmt(res.ahorro)}</p>
            <p className="text-[11px] text-emerald-800/80 leading-snug">Fondo de emergencia, CDTs, inversiones y abonos extra a deudas.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CalcAceleradorDeuda() {
  const [f, setF] = useState({ monto:'', tasa:'', cuota:'', abono:'' });
  const [res, setRes] = useState(null);
  const set = k => e => setF(p=>({...p,[k]:e.target.value.replace(',','.')}));

  const simular = (saldoInicial, tasaMes, cuotaMensual) => {
    let saldo = saldoInicial, meses = 0, interesesAcum = 0;
    while (saldo > 0 && meses < 360) {
      const interes = saldo * tasaMes;
      interesesAcum += interes;
      const amortizacion = cuotaMensual - interes;
      if (amortizacion <= 0) { meses = 999; break; } // la cuota ni cubre el interés
      saldo -= amortizacion;
      meses++;
    }
    return { meses, interesesAcum };
  };

  const calcular = () => {
    const dTotal = toNum(f.monto), tMes = toNum(f.tasa)/100, cAct = toNum(f.cuota), aExt = toNum(f.abono)||0;
    if (!dTotal || isNaN(dTotal)) return toast.error('Ingresa el saldo pendiente');
    if (!tMes || isNaN(tMes)) return toast.error('Ingresa la tasa de interés mensual');
    if (!cAct || isNaN(cAct)) return toast.error('Ingresa la cuota mínima actual');
    const original = simular(dTotal, tMes, cAct);
    const acelerado = simular(dTotal, tMes, cAct + aExt);
    if (original.meses === 999) return toast.error('Con esa cuota nunca terminas de pagar — la cuota no alcanza a cubrir el interés');
    setRes({
      mesesOriginal: original.meses,
      mesesAcelerado: acelerado.meses === 999 ? original.meses : acelerado.meses,
      mesesAhorrados: acelerado.meses === 999 ? 0 : Math.max(0, original.meses - acelerado.meses),
      dineroAhorrado: acelerado.meses === 999 ? 0 : Math.max(0, original.interesesAcum - acelerado.interesesAcum),
      tieneAbono: aExt > 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-3 bg-g-50 border-g-200">
        <p className="text-xs text-g-600"><Icon name="info-circle" className="w-4 h-4 mr-1"/>Simula cuánto tiempo y dinero ahorras si le metes un abono extra a una deuda además de la cuota mínima.</p>
      </div>
      <div>
        <label className="section-label block mb-1">Saldo pendiente (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 8000000" value={f.monto} onChange={set('monto')}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1">Tasa mensual (%)</label>
          <input type="text" inputMode="decimal" className="input" placeholder="Ej: 2.2" value={f.tasa} onChange={set('tasa')}/>
        </div>
        <div>
          <label className="section-label block mb-1">Cuota mínima actual</label>
          <input type="text" inputMode="numeric" className="input" placeholder="Ej: 450000" value={f.cuota} onChange={set('cuota')}/>
        </div>
      </div>
      <div>
        <label className="section-label block mb-1">Abono extra mensual propuesto (COP)</label>
        <input type="text" inputMode="numeric" className="input" placeholder="Ej: 200000" value={f.abono} onChange={set('abono')}/>
      </div>
      <button onClick={calcular} className="btn-primary w-full py-3.5">Calcular</button>
      {res && (
        <div className="space-y-3">
          <div className="relative overflow-hidden card p-4 bg-g-800 text-white">
            <div className="card-premium-glow -top-8 -right-6 w-28 h-28 bg-gold opacity-[0.12]"/>
            <p className="relative text-[10px] uppercase tracking-widest text-emerald-300 mb-1">Impacto de tu abono extra</p>
            {res.tieneAbono ? (
              <>
                <p className="relative text-xl font-medium mb-1">Te ahorras {fmt(res.dineroAhorrado)}</p>
                <p className="relative text-xs text-white/60">Y terminas {res.mesesAhorrados} meses antes</p>
              </>
            ) : (
              <p className="relative text-sm text-white/70">Agrega un abono extra arriba para ver cuánto te ahorras.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3"><p className="section-label">Tiempo original</p><p className="text-lg font-medium text-g-900">{res.mesesOriginal} meses</p></div>
            <div className="card p-3"><p className="section-label">Tiempo acelerado</p><p className="text-lg font-medium text-pos">{res.mesesAcelerado} meses</p></div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id:'credito',   icon:'ti-credit-card', label:'Crédito' },
  { id:'inversion', icon:'ti-trending-up', label:'Inversión' },
  { id:'libertad',  icon:'ti-flag',         label:'Libertad' },
  { id:'regla',     icon:'ti-scale',        label:'50/30/20' },
  { id:'deuda',     icon:'ti-flame',        label:'Acelerador' },
];

export default function Calculadora() {
  const [tab, setTab] = useState('credito');
  return (
    <div className="space-y-4 page-enter">
      <div>
        <h2 className="text-lg font-medium text-g-900">Calculadoras</h2>
        <p className="text-sm text-g-400">Simula antes de decidir</p>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${tab===t.id?'bg-g-800 text-white border-g-800':'bg-white text-g-600 border-g-200/60'}`}>
            <Icon name={t.icon} className="w-4 h-4"/><span className="text-xs font-medium">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="card p-4">
        {tab==='credito'   && <CalcCredito/>}
        {tab==='inversion' && <CalcInversion/>}
        {tab==='libertad'  && <CalcLibertad/>}
        {tab==='regla'     && <CalcRegla503020/>}
        {tab==='deuda'     && <CalcAceleradorDeuda/>}
      </div>
    </div>
  );
}
