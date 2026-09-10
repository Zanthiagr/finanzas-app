import { useState } from 'react';
import Icon from '../utils/icons';
import { supabase } from '../utils/supabase';
import { activarRecordatorioNocturno, pushSoportado } from '../utils/push';
import { notifyError } from '../utils/notify';

// Se muestra UNA sola vez por cuenta, apenas la persona entra a la app —
// tanto a quien se acaba de registrar (después del Onboarding) como a
// cualquier cuenta existente que todavía no haya respondido a este aviso
// (perfiles.recordatorio_prompt_visto = false, que es el valor por
// defecto tanto para cuentas nuevas como para todas las que ya existían
// antes de esta actualización — así es como este mismo mecanismo cubre
// ambos casos sin necesitar lógica separada).
//
// Por qué existe como modal aparte en vez de solo el toggle en Perfil:
// pedirle a la persona que busque una pantalla de configuración para
// activar esto reduce muchísimo cuántas personas terminan activándolo.
// Ningún navegador permite "activar" el permiso de notificaciones sin un
// clic real — así que este modal es lo más cerca que se puede llegar a
// un permiso "automático": aparece solo, sin que nadie tenga que ir a
// buscarlo, y el permiso real se pide en el mismo instante del primer
// clic dentro de él.
export default function RecordatorioNocturnoOnboarding({ userId, onDone }) {
  const [activando, setActivando] = useState(false);

  const marcarComoVisto = async () => {
    await supabase.from('perfiles').update({ recordatorio_prompt_visto: true }).eq('id', userId);
  };

  const activar = async () => {
    setActivando(true);
    try {
      await activarRecordatorioNocturno();
      await supabase
        .from('perfiles')
        .update({ notif_diario: true, recordatorio_prompt_visto: true })
        .eq('id', userId);
      onDone(true);
    } catch (err) {
      // Permiso rechazado, o navegador sin soporte — no forzamos nada,
      // solo avisamos y dejamos que decida qué hacer. El toggle sigue
      // disponible en Perfil si cambia de opinión más tarde.
      notifyError(err.message || 'No se pudo activar el recordatorio');
      await marcarComoVisto();
      onDone(false);
    } finally {
      setActivando(false);
    }
  };

  const ahoraNo = async () => {
    await marcarComoVisto();
    onDone(false);
  };

  return (
    <div className="fixed inset-0 bg-g-900 z-[100] flex items-center justify-center p-5 overflow-y-auto">
      <div className="w-full max-w-sm py-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto bg-gold/20">
          <Icon name="moon" className="w-7 h-7 text-gold"/>
        </div>
        <h2 className="text-xl font-medium text-white text-center mb-2">No dejes tu día a medias</h2>
        <p className="text-white/50 text-sm text-center leading-relaxed mb-8">
          Actívalo y cada noche, a las 8pm, te avisamos solo si todavía no has registrado
          los movimientos de hoy — nada más. Puedes desactivarlo cuando quieras desde Perfil.
        </p>

        {!pushSoportado() && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
            <p className="text-white/60 text-xs leading-relaxed">
              Tu navegador no soporta esto todavía. En iPhone: agrega Fintual a tu pantalla de
              inicio (Compartir → Agregar a inicio) y vuelve a intentarlo desde ahí.
            </p>
          </div>
        )}

        <button onClick={activar} disabled={activando || !pushSoportado()}
          className="w-full bg-gold text-g-900 font-semibold py-3.5 rounded-xl text-sm hover:bg-gold-dark transition-colors disabled:opacity-50">
          {activando ? 'Activando...' : 'Activar recordatorio'}
        </button>
        <button onClick={ahoraNo} disabled={activando}
          className="w-full text-white/40 text-sm py-3 mt-2 hover:text-white/60 transition-colors disabled:opacity-50">
          Ahora no
        </button>
      </div>
    </div>
  );
}
