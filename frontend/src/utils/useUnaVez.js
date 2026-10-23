import { useRef } from 'react';

// Protección contra el doble toque en acciones que guardan datos.
//
// Cuando la red va lenta, la gente vuelve a tocar "Guardar" porque no ve
// que pase nada — y cada toque lanzaba otro guardado completo (movimientos
// o pagos duplicados). Con esto, mientras un guardado está en curso, los
// toques siguientes se ignoran; al terminar (bien o mal) se libera.
//
// Usa un ref (no un estado) para que el bloqueo sea inmediato y sobreviva
// a los re-renders del componente mientras se espera la respuesta.
//
//   const unaVez = useUnaVez();
//   const guardar = unaVez(async (e) => { ... });
export default function useUnaVez() {
  const enCurso = useRef(false);
  return (fn) => async (...args) => {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      return await fn(...args);
    } finally {
      enCurso.current = false;
    }
  };
}
