import { useState } from 'react';
import { fmt, fmtShort } from '../utils/helpers';

export default function CalculadoraLibertad() {
  const [gastoMensual, setGastoMensual] = useState(2000000);
  const [ahorroActual, setAhorroActual] = useState(1000000);
  const [ahorroMensual, setAhorroMensual] = useState(500000);
  const [rentabilidad, setRentabilidad] = useState(10);

  // Regla del 4% — necesitas 25x tu gasto anual invertido para vivir de los rendimientos
  const gastoAnual = gastoMensual * 12;
  const metaLibertad = gastoAnual * 25;
  const faltante = Math.max(metaLibertad - ahorroActual, 0);

  // Calcular años para llegar a la meta con interés compuesto
  const calcularAnios = () => {
    if (ahorroMensual <= 0 && rentabilidad <= 0) return null;
    let capital = ahorroActual;
    const tasaMensual = rentabilidad / 100 / 12;
    let meses = 0;
    const maxMeses = 600; // tope de 50 años

    while (capital < metaLibertad && meses < maxMeses) {
      capital = capital * (1 + tasaMensual) + ahorroMensual;
      meses++;
    }
    return meses >= maxMeses ? null : meses;
  };

  const meses = calcularAnios();
  const anios = meses ? Math.floor(meses / 12) : null;
  const mesesRestantes = meses ? meses % 12 : null;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <i className="ti ti-flag text-gold"/>
        <p className="text-sm font-medium text-g-900">Calculadora de libertad financiera</p>
      </div>
      <p className="text-xs text-g-400 mb-4">Basada en la regla del 4%: necesitas 25 veces tu gasto anual invertido para vivir de los rendimientos, sin trabajar.</p>

      <div className="space-y-4 bg-g-50 rounded-xl p-4">
        <div>
          <div className="flex justify-between text-xs text-g-500 mb-1.5">
            <span>Tu gasto mensual actual</span>
            <span className="font-medium text-g-800">{fmt(gastoMensual)}</span>
          </div>
          <input type="range" min="500000" max="10000000" step="100000" value={gastoMensual}
            onChange={e => setGastoMensual(+e.target.value)} className="w-full accent-g-600"/>
        </div>

        <div>
          <div className="flex justify-between text-xs text-g-500 mb-1.5">
            <span>Lo que ya tienes ahorrado/invertido</span>
            <span className="font-medium text-g-800">{fmt(ahorroActual)}</span>
          </div>
          <input type="range" min="0" max="50000000" step="500000" value={ahorroActual}
            onChange={e => setAhorroActual(+e.target.value)} className="w-full accent-g-600"/>
        </div>

        <div>
          <div className="flex justify-between text-xs text-g-500 mb-1.5">
            <span>Cuánto puedes ahorrar al mes</span>
            <span className="font-medium text-g-800">{fmt(ahorroMensual)}</span>
          </div>
          <input type="range" min="0" max="5000000" step="50000" value={ahorroMensual}
            onChange={e => setAhorroMensual(+e.target.value)} className="w-full accent-g-600"/>
        </div>

        <div>
          <div className="flex justify-between text-xs text-g-500 mb-1.5">
            <span>Rentabilidad anual esperada</span>
            <span className="font-medium text-g-800">{rentabilidad}%</span>
          </div>
          <input type="range" min="0" max="20" step="1" value={rentabilidad}
            onChange={e => setRentabilidad(+e.target.value)} className="w-full accent-g-600"/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-white border border-g-200/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-g-400 mb-1">Meta de libertad</p>
          <p className="text-lg font-medium text-g-900">{fmtShort(metaLibertad)}</p>
          <p className="text-[11px] text-g-400 mt-0.5">25x tu gasto anual</p>
        </div>
        <div className="bg-g-800 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-g-200 mb-1">Te falta</p>
          <p className="text-lg font-medium text-white">{fmtShort(faltante)}</p>
          <p className="text-[11px] text-white/30 mt-0.5">para ser libre</p>
        </div>
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mt-3 text-center">
        {meses !== null ? (
          <>
            <p className="text-xs text-g-600 mb-1">A este ritmo, serás financieramente libre en</p>
            <p className="text-2xl font-medium text-g-900">
              {anios} {anios === 1 ? 'año' : 'años'}
              {mesesRestantes > 0 && ` y ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-g-600">Aumenta tu ahorro mensual o rentabilidad para ver una proyección realista.</p>
        )}
      </div>
    </div>
  );
}
