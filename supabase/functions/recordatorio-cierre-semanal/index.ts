// Supabase Edge Function: recordatorio-cierre-semanal
//
// Hermana de recordatorio-nocturno — mismo patrón exacto (cron de
// Postgres, secreto compartido, mismas llaves VAPID ya configuradas
// como secretos a nivel de proyecto, así que no hace falta configurar
// nada nuevo para desplegar esta función). Lo único que cambia es CUÁNDO
// dispara y A QUIÉN: cada domingo a las 7pm hora de Colombia, a quien
// tenga notif_cierre=true y todavía no haya hecho el cierre semanal de
// esta semana.
//
// "Esta semana" usa el mismo esquema que ya usa el resto de la app (no
// es una semana calendario real): semana 1 = días 1-7 del mes, semana 2 =
// 8-14, semana 3 = 15-21, semana 4 = 22 en adelante — ver getSemanaDelMes
// en frontend/src/utils/helpers.js. Se replica aquí para que "ya cerró
// esta semana" signifique exactamente lo mismo que en la app.
//
// Deploy (no requiere secretos nuevos, ya están puestos a nivel de
// proyecto desde recordatorio-nocturno):
//   supabase functions deploy recordatorio-cierre-semanal --no-verify-jwt
//
// El cron que la dispara vive en la migración SQL asociada (domingo
// 7pm Colombia = lunes 00:00 UTC).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webpush from 'npm:web-push@3.6.7';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  try {
    const secretRecibido = req.headers.get('x-cron-secret');
    const secretEsperado = Deno.env.get('CRON_SECRET');
    if (!secretEsperado || secretRecibido !== secretEsperado) {
      console.error('recordatorio-cierre-semanal: secreto inválido o ausente');
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublic || !vapidPrivate) {
      console.error('recordatorio-cierre-semanal: faltan las llaves VAPID');
      return jsonResponse({ error: 'Push no configurado en el servidor' }, 500);
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@fintual.app',
      vapidPublic,
      vapidPrivate,
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // "Ahora" en hora de Colombia (UTC-5 fijo, sin horario de verano),
    // igual que en recordatorio-nocturno.
    const ahoraBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const dia = ahoraBogota.getUTCDate();
    const mesNum = ahoraBogota.getUTCMonth() + 1;
    const anioNum = ahoraBogota.getUTCFullYear();
    const semanaNum = dia <= 7 ? 1 : dia <= 14 ? 2 : dia <= 21 ? 3 : 4;

    // Usuarios con el recordatorio de cierre semanal activado.
    const { data: perfiles, error: errPerfiles } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .eq('notif_cierre', true);
    if (errPerfiles) throw errPerfiles;

    if (!perfiles || perfiles.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'nadie tiene el recordatorio activado' });
    }

    const idsConRecordatorio = perfiles.map((p) => p.id);

    // De esos, quiénes YA cerraron esta semana — se excluyen.
    const { data: yaCerraron, error: errCierres } = await supabaseAdmin
      .from('cierres_semanales')
      .select('usuario_id')
      .eq('semana_num', semanaNum)
      .eq('mes_num', mesNum)
      .eq('anio_num', anioNum)
      .in('usuario_id', idsConRecordatorio);
    if (errCierres) throw errCierres;

    const idsYaCerraron = new Set((yaCerraron ?? []).map((c) => c.usuario_id));
    const idsAAvisar = idsConRecordatorio.filter((id) => !idsYaCerraron.has(id));

    if (idsAAvisar.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'todos los que tienen el recordatorio activado ya cerraron esta semana' });
    }

    const { data: subs, error: errSubs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('usuario_id', idsAAvisar);
    if (errSubs) throw errSubs;

    const payload = JSON.stringify({
      title: '¿Ya cerraste tu semana? 📊',
      body: 'Reflexiona sobre esta semana antes de que empiece la siguiente — toma unos minutos.',
      url: '/cierre',
    });

    let enviados = 0;
    const suscripcionesMuertas = [];

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        );
        enviados++;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          suscripcionesMuertas.push(sub.id);
        } else {
          console.error('recordatorio-cierre-semanal: error enviando a suscripción', sub.id, err);
        }
      }
    }

    if (suscripcionesMuertas.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', suscripcionesMuertas);
    }

    return jsonResponse({ enviados, suscripcionesLimpiadas: suscripcionesMuertas.length });
  } catch (e) {
    console.error('recordatorio-cierre-semanal: error inesperado', e);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
