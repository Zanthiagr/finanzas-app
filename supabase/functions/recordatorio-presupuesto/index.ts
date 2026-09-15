// Supabase Edge Function: recordatorio-presupuesto
//
// Hermana de recordatorio-nocturno, recordatorio-cierre-semanal y
// recordatorio-tarjetas — mismo patrón exacto (cron de Postgres, secreto
// compartido, mismas llaves VAPID ya configuradas a nivel de proyecto).
//
// Qué hace: una vez al día, revisa los presupuestos de cada usuario con
// notif_presupuesto = true, calcula cuánto han gastado este mes en cada
// categoría, y si alguna llegó al 80% del límite o lo superó, manda UNA
// sola notificación agrupando todas las categorías en ese estado (no una
// por categoría, para no saturar). Se avisa UNA vez por mes por
// presupuesto (columna presupuestos.alerta_mes) — si ya se avisó este
// mes, no se vuelve a avisar aunque el cron corra todos los días,
// aunque el usuario siga gastando más en esa categoría.
//
// Deploy (no requiere secretos nuevos, ya están puestos a nivel de
// proyecto desde recordatorio-nocturno):
//   supabase functions deploy recordatorio-presupuesto --no-verify-jwt
//
// El cron que la dispara vive en la migración SQL asociada
// (notificaciones_tarjetas_presupuesto_migracion.sql).

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
      console.error('recordatorio-presupuesto: secreto inválido o ausente');
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublic || !vapidPrivate) {
      console.error('recordatorio-presupuesto: faltan las llaves VAPID');
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

    // "Hoy" en hora de Colombia (UTC-5 fijo, sin horario de verano).
    const ahoraBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const mesActual = ahoraBogota.getMonth() + 1;
    const anioActual = ahoraBogota.getFullYear();
    const mesActualKey = `${anioActual}-${String(mesActual).padStart(2, '0')}`;

    // 1. Usuarios con el recordatorio de presupuesto activado.
    const { data: perfiles, error: errPerfiles } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .eq('notif_presupuesto', true);
    if (errPerfiles) throw errPerfiles;

    if (!perfiles || perfiles.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'nadie tiene el recordatorio de presupuesto activado' });
    }
    const idsConRecordatorio = perfiles.map((p) => p.id);

    // 2. Presupuestos de esos usuarios que no se hayan avisado este mes.
    const { data: presupuestos, error: errPres } = await supabaseAdmin
      .from('presupuestos')
      .select('id, usuario_id, categoria, monto_limite, alerta_mes')
      .in('usuario_id', idsConRecordatorio)
      .or(`alerta_mes.is.null,alerta_mes.neq.${mesActualKey}`);
    if (errPres) throw errPres;

    if (!presupuestos || presupuestos.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'nada pendiente de avisar este mes' });
    }

    // 3. Gasto real del mes, por usuario y categoría, en un solo query.
    const { data: movs, error: errMovs } = await supabaseAdmin
      .from('movimientos')
      .select('usuario_id, categoria, monto')
      .eq('tipo', 'gasto')
      .eq('mes_num', mesActual)
      .eq('anio_num', anioActual)
      .in('usuario_id', idsConRecordatorio);
    if (errMovs) throw errMovs;

    const gastoPorClave = new Map(); // "usuarioId|categoria" -> total
    for (const m of movs ?? []) {
      const clave = `${m.usuario_id}|${m.categoria}`;
      gastoPorClave.set(clave, (gastoPorClave.get(clave) ?? 0) + parseFloat(m.monto));
    }

    // 4. Clasificar cada presupuesto: excedido / cerca del límite (80%+) / nada.
    const porUsuario = new Map(); // usuario_id -> { excedidos: [], cerca: [], idsParaMarcar: [] }
    for (const p of presupuestos) {
      const gastado = gastoPorClave.get(`${p.usuario_id}|${p.categoria}`) ?? 0;
      const limite = parseFloat(p.monto_limite);
      if (!limite || limite <= 0) continue;
      const pct = gastado / limite;
      if (pct < 0.8) continue;

      if (!porUsuario.has(p.usuario_id)) porUsuario.set(p.usuario_id, { excedidos: [], cerca: [], idsParaMarcar: [] });
      const entry = porUsuario.get(p.usuario_id);
      if (pct >= 1) entry.excedidos.push(p.categoria);
      else entry.cerca.push(p.categoria);
      entry.idsParaMarcar.push(p.id);
    }

    if (porUsuario.size === 0) {
      return jsonResponse({ enviados: 0, motivo: 'ningún presupuesto llegó al 80% este mes (por ahora)' });
    }

    // 5. Suscripciones push de esos usuarios.
    const idsAAvisar = [...porUsuario.keys()];
    const { data: subs, error: errSubs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('usuario_id', idsAAvisar);
    if (errSubs) throw errSubs;

    const subsPorUsuario = new Map();
    for (const s of subs ?? []) {
      if (!subsPorUsuario.has(s.usuario_id)) subsPorUsuario.set(s.usuario_id, []);
      subsPorUsuario.get(s.usuario_id).push(s);
    }

    let enviados = 0;
    const suscripcionesMuertas = [];
    const idsAMarcar = [];

    for (const [usuarioId, { excedidos, cerca, idsParaMarcar }] of porUsuario) {
      idsAMarcar.push(...idsParaMarcar);

      const misSubs = subsPorUsuario.get(usuarioId) ?? [];
      if (misSubs.length === 0) continue; // igual se marca alerta_mes más abajo, no se re-evalúa este mes

      let body;
      if (excedidos.length > 0 && cerca.length > 0) {
        body = `Superaste el límite en ${excedidos.join(', ')} — y estás cerca en ${cerca.join(', ')}`;
      } else if (excedidos.length > 0) {
        body = excedidos.length === 1
          ? `Superaste el límite de tu presupuesto en ${excedidos[0]}`
          : `Superaste el límite en: ${excedidos.join(', ')}`;
      } else {
        body = cerca.length === 1
          ? `Estás cerca del límite (80%+) en ${cerca[0]}`
          : `Estás cerca del límite (80%+) en: ${cerca.join(', ')}`;
      }

      const payload = JSON.stringify({
        title: excedidos.length > 0 ? 'Presupuesto superado 📊' : 'Cerca del límite del presupuesto 📊',
        body,
        url: '/presupuestos',
      });

      for (const sub of misSubs) {
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
            console.error('recordatorio-presupuesto: error enviando a suscripción', sub.id, err);
          }
        }
      }
    }

    // 6. Marcar como avisados este mes — así no se repite mañana aunque
    //    el gasto en esa categoría siga subiendo.
    if (idsAMarcar.length > 0) {
      await supabaseAdmin.from('presupuestos').update({ alerta_mes: mesActualKey }).in('id', idsAMarcar);
    }
    if (suscripcionesMuertas.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', suscripcionesMuertas);
    }

    return jsonResponse({ enviados, usuariosAvisados: porUsuario.size, presupuestosMarcados: idsAMarcar.length, suscripcionesLimpiadas: suscripcionesMuertas.length });
  } catch (e) {
    console.error('recordatorio-presupuesto: error inesperado', e);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
