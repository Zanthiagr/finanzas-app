// Supabase Edge Function: recordatorio-nocturno
//
// Disparada una vez al día por un trabajo programado de Postgres
// (pg_cron + pg_net — ver la migración SQL asociada), no por ningún
// usuario desde el navegador. Por eso no valida una sesión de Supabase
// como sí hace coach-chat: en su lugar valida un secreto compartido
// (CRON_SECRET) que solo conoce el propio proyecto.
//
// Qué hace: busca usuarios con el recordatorio nocturno activado
// (perfiles.notif_diario = true) que todavía NO hayan registrado ningún
// movimiento hoy (hora de Colombia), y les manda una notificación push
// real a cada dispositivo/navegador que tengan suscrito.
//
// Deploy:
//   supabase functions deploy recordatorio-nocturno --no-verify-jwt
//   supabase secrets set CRON_SECRET=<el mismo valor que pusiste en la migración SQL>
//   supabase secrets set VAPID_PUBLIC_KEY=<llave pública VAPID>
//   supabase secrets set VAPID_PRIVATE_KEY=<llave privada VAPID>
//   supabase secrets set VAPID_SUBJECT=mailto:tu-correo@tudominio.com
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya están disponibles
// automáticamente en el runtime de Edge Functions. Se usa la
// service_role (no la anon key) porque esta función necesita leer
// datos de TODOS los usuarios, no de uno logueado — por diseño, se
// salta Row Level Security a propósito, igual que cualquier proceso
// de servidor de confianza.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webpush from 'npm:web-push@3.6.7';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  try {
    // 1. Verificar el secreto compartido del cron — no hay usuario logueado
    //    en este flujo, así que no aplica auth.getUser() como en coach-chat.
    const secretRecibido = req.headers.get('x-cron-secret');
    const secretEsperado = Deno.env.get('CRON_SECRET');
    if (!secretEsperado || secretRecibido !== secretEsperado) {
      console.error('recordatorio-nocturno: secreto inválido o ausente');
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublic || !vapidPrivate) {
      console.error('recordatorio-nocturno: faltan las llaves VAPID');
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

    // 2. "Hoy" en hora de Colombia. Colombia es UTC-5 fijo todo el año
    //    (no tiene horario de verano), así que restar 5 horas al UTC
    //    actual y tomar la fecha es exacto y no necesita zonas horarias
    //    de verdad — igual que hace el frontend con todayLocalStr().
    const hoyBogota = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 3. Usuarios con el recordatorio activado.
    const { data: perfiles, error: errPerfiles } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .eq('notif_diario', true);
    if (errPerfiles) throw errPerfiles;

    if (!perfiles || perfiles.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'nadie tiene el recordatorio activado' });
    }

    const idsConRecordatorio = perfiles.map((p) => p.id);

    // 4. De esos, quiénes YA registraron algo hoy — se excluyen, es
    //    exactamente el punto del recordatorio: solo avisar a quien
    //    todavía no ha cerrado su día.
    const { data: yaRegistraron, error: errMovs } = await supabaseAdmin
      .from('movimientos')
      .select('usuario_id')
      .eq('fecha', hoyBogota)
      .in('usuario_id', idsConRecordatorio);
    if (errMovs) throw errMovs;

    const idsYaRegistraron = new Set((yaRegistraron ?? []).map((m) => m.usuario_id));
    const idsAAvisar = idsConRecordatorio.filter((id) => !idsYaRegistraron.has(id));

    if (idsAAvisar.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'todos los que tienen el recordatorio activado ya registraron hoy' });
    }

    // 5. Suscripciones push de esos usuarios (puede haber más de una por
    //    usuario si usa varios dispositivos/navegadores).
    const { data: subs, error: errSubs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('usuario_id', idsAAvisar);
    if (errSubs) throw errSubs;

    const payload = JSON.stringify({
      title: 'No olvides registrar tu día 🌙',
      body: 'Cierra el día registrando los movimientos de hoy en Fintual — toma 30 segundos.',
      url: '/movimientos',
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
        // 404/410 = el navegador o el sistema operativo ya invalidó esta
        // suscripción (usuario desinstaló la PWA, limpió datos, etc.) —
        // la borramos para no seguir intentando en vano cada noche.
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          suscripcionesMuertas.push(sub.id);
        } else {
          console.error('recordatorio-nocturno: error enviando a suscripción', sub.id, err);
        }
      }
    }

    if (suscripcionesMuertas.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', suscripcionesMuertas);
    }

    return jsonResponse({ enviados, suscripcionesLimpiadas: suscripcionesMuertas.length });
  } catch (e) {
    console.error('recordatorio-nocturno: error inesperado', e);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
