// Supabase Edge Function: coach-chat
// Proxy seguro hacia la API de Anthropic. La API key de Anthropic vive
// únicamente como secreto de servidor (nunca en el frontend).
//
// Deploy:
//   supabase functions deploy coach-chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// SUPABASE_URL y SUPABASE_ANON_KEY ya están disponibles automáticamente
// en el runtime de Edge Functions, no hace falta configurarlas a mano.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1000;
const LIMITE_MENSAJES_MES = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // 1. Verificar que quien llama tiene una sesión válida de Supabase.
    //    Sin esto, cualquiera podría llamar a este endpoint y gastar el
    //    crédito de Anthropic de la cuenta.
    const authHeader = req.headers.get('Authorization');
    console.log('coach-chat: authHeader presente?', !!authHeader, 'largo:', authHeader?.length ?? 0);
    if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) {
      console.error('coach-chat: auth.getUser() falló ->', JSON.stringify(userError));
      return jsonResponse({ error: 'Sesión inválida' }, 401);
    }

    // 2. Verificar el límite de mensajes del mes en el servidor (no solo
    //    confiar en el contador que lleva el frontend).
    const mesActual = new Date().toISOString().slice(0, 7);
    const { count, error: countError } = await supabaseClient
      .from('coach_mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .gte('created_at', `${mesActual}-01`);

    if (countError) {
      console.error('coach-chat: error contando mensajes', countError);
      return jsonResponse({ error: 'Error interno' }, 500);
    }
    if ((count ?? 0) >= LIMITE_MENSAJES_MES) {
      return jsonResponse({ error: 'Límite de mensajes del mes alcanzado' }, 429);
    }

    // 3. Validar el body.
    const { system, messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'Mensajes inválidos' }, 400);
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('coach-chat: falta el secreto ANTHROPIC_API_KEY');
      return jsonResponse({ error: 'Coach no configurado en el servidor' }, 500);
    }

    // 4. Llamar a Anthropic desde el servidor, con la key como secreto.
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('coach-chat: error de Anthropic', anthropicRes.status, errText);
      return jsonResponse({ error: 'El coach no está disponible en este momento' }, 502);
    }

    const data = await anthropicRes.json();
    const respuesta = data.content?.find((b) => b.type === 'text')?.text
      ?? 'No pude generar una respuesta. Intenta de nuevo.';

    // 5. Registrar el mensaje usado (server-side, no falsificable desde el cliente).
    await supabaseClient.from('coach_mensajes').insert({ usuario_id: user.id });

    return jsonResponse({ respuesta });
  } catch (e) {
    console.error('coach-chat: error inesperado', e);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
