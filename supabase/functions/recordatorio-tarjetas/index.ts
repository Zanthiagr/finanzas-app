// Supabase Edge Function: recordatorio-tarjetas
//
// Hermana de recordatorio-nocturno y recordatorio-cierre-semanal — mismo
// patrón exacto (cron de Postgres, secreto compartido, mismas llaves
// VAPID ya configuradas como secretos a nivel de proyecto, así que no
// hace falta configurar nada nuevo para desplegar esta función).
//
// Qué hace: una vez al día, busca tarjetas de crédito activas cuya
// PRÓXIMA fecha de pago cae exactamente en 2 días, para usuarios con
// notif_tarjetas = true, y les manda una sola notificación push (aunque
// tengan varias tarjetas venciendo el mismo día) con el pago mínimo
// estimado si está configurado.
//
// Deploy (no requiere secretos nuevos, ya están puestos a nivel de
// proyecto desde recordatorio-nocturno):
//   supabase functions deploy recordatorio-tarjetas --no-verify-jwt
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

// ── Mismas reglas de fecha que frontend/src/utils/helpers.js ──
// (diaEfectivoPago / proximaFechaDia / diasHasta) — replicadas acá
// porque una Edge Function no puede importar el código del frontend.
// Si esas reglas cambian allá, deben cambiar acá también.
const ultimoDiaDelMes = (mes, anio) => new Date(anio, mes, 0).getDate();
const diaEfectivoPago = (diaMes, mes, anio) => Math.min(diaMes, ultimoDiaDelMes(mes, anio));

const proximaFechaDia = (diaMes, desde) => {
  if (!diaMes) return null;
  const hoy = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  let mes = hoy.getMonth() + 1, anio = hoy.getFullYear();
  let fecha = new Date(anio, mes - 1, diaEfectivoPago(diaMes, mes, anio));
  if (fecha < hoy) {
    mes += 1;
    if (mes > 12) { mes = 1; anio += 1; }
    fecha = new Date(anio, mes - 1, diaEfectivoPago(diaMes, mes, anio));
  }
  return fecha;
};

const diasHasta = (fecha, desde) => {
  const hoy = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
};

const fmtCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

Deno.serve(async (req) => {
  try {
    const secretRecibido = req.headers.get('x-cron-secret');
    const secretEsperado = Deno.env.get('CRON_SECRET');
    if (!secretEsperado || secretRecibido !== secretEsperado) {
      console.error('recordatorio-tarjetas: secreto inválido o ausente');
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublic || !vapidPrivate) {
      console.error('recordatorio-tarjetas: faltan las llaves VAPID');
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

    // 1. Usuarios con el recordatorio de tarjetas activado.
    const { data: perfiles, error: errPerfiles } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .eq('notif_tarjetas', true);
    if (errPerfiles) throw errPerfiles;

    if (!perfiles || perfiles.length === 0) {
      return jsonResponse({ enviados: 0, motivo: 'nadie tiene el recordatorio de tarjetas activado' });
    }
    const idsConRecordatorio = perfiles.map((p) => p.id);

    // 2. Tarjetas activas con día de pago configurado, de esos usuarios.
    const { data: tarjetas, error: errTarjetas } = await supabaseAdmin
      .from('tarjetas_credito')
      .select('id, usuario_id, nombre, saldo_actual, dia_pago, pago_minimo_pct')
      .eq('activa', true)
      .not('dia_pago', 'is', null)
      .in('usuario_id', idsConRecordatorio);
    if (errTarjetas) throw errTarjetas;

    // 3. Filtrar las que vencen en EXACTAMENTE 2 días (se dispara una
    //    sola vez por ciclo, no todos los días desde hoy hasta el pago).
    const porUsuario = new Map(); // usuario_id -> [tarjeta, ...]
    for (const t of tarjetas ?? []) {
      const fechaPago = proximaFechaDia(t.dia_pago, ahoraBogota);
      if (diasHasta(fechaPago, ahoraBogota) !== 2) continue;
      if (!porUsuario.has(t.usuario_id)) porUsuario.set(t.usuario_id, []);
      porUsuario.get(t.usuario_id).push(t);
    }

    if (porUsuario.size === 0) {
      return jsonResponse({ enviados: 0, motivo: 'ninguna tarjeta vence en 2 días hoy' });
    }

    // 4. Suscripciones push de esos usuarios.
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

    for (const [usuarioId, tarjetasUsuario] of porUsuario) {
      const misSubs = subsPorUsuario.get(usuarioId) ?? [];
      if (misSubs.length === 0) continue;

      let body;
      if (tarjetasUsuario.length === 1) {
        const t = tarjetasUsuario[0];
        const minimo = t.pago_minimo_pct > 0
          ? ` — mínimo estimado ${fmtCOP(parseFloat(t.saldo_actual) * parseFloat(t.pago_minimo_pct) / 100)}`
          : '';
        body = `${t.nombre} vence en 2 días${minimo}`;
      } else {
        const nombres = tarjetasUsuario.map((t) => t.nombre).join(', ');
        body = `${tarjetasUsuario.length} tarjetas vencen en 2 días: ${nombres}`;
      }

      const payload = JSON.stringify({
        title: 'Pago de tarjeta próximo 💳',
        body,
        url: '/tarjetas',
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
            console.error('recordatorio-tarjetas: error enviando a suscripción', sub.id, err);
          }
        }
      }
    }

    if (suscripcionesMuertas.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', suscripcionesMuertas);
    }

    return jsonResponse({ enviados, usuariosAvisados: porUsuario.size, suscripcionesLimpiadas: suscripcionesMuertas.length });
  } catch (e) {
    console.error('recordatorio-tarjetas: error inesperado', e);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
