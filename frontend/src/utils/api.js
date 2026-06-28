import { supabase } from './supabase';

// Helper para obtener el usuario actual
const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
};

// ── MOVIMIENTOS ──────────────────────────────────────────
export const getMovimientos = async ({ mes, anio, tipo } = {}) => {
  const userId = await getUserId();
  let query = supabase
    .from('movimientos')
    .select('*')
    .eq('usuario_id', userId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (mes)  query = query.eq('mes_num', mes);
  if (anio) query = query.eq('anio_num', anio);
  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data;
};

export const crearMovimiento = async (mov) => {
  const userId = await getUserId();
  const fecha = mov.fecha ? new Date(mov.fecha) : new Date();
  const semana = getWeekNumber(fecha);

  // Construir payload limpio — guardamos banco dentro de medio_pago
  // para no depender de columna extra en Supabase
  const medioPago = mov.medio_pago === 'transferencia' && mov.banco
    ? mov.banco  // guardamos directamente el banco (nequi, bancolombia, etc)
    : mov.medio_pago || 'efectivo';

  const payload = {
    tipo:        mov.tipo,
    monto:       parseFloat(String(mov.monto).replace(',','.')),
    categoria:   mov.categoria,
    descripcion: mov.descripcion || null,
    medio_pago:  medioPago,
    usuario_id:  userId,
    fecha:       fecha.toISOString().split('T')[0],
    semana_num:  semana,
    mes_num:     fecha.getMonth() + 1,
    anio_num:    fecha.getFullYear(),
  };

  const { data, error } = await supabase.from('movimientos').insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const actualizarMovimiento = async (id, mov) => {
  const medioPago = mov.medio_pago === 'transferencia' && mov.banco
    ? mov.banco
    : mov.medio_pago || 'efectivo';

  const payload = {
    tipo:        mov.tipo,
    monto:       parseFloat(String(mov.monto).replace(',','.')),
    categoria:   mov.categoria,
    descripcion: mov.descripcion || null,
    medio_pago:  medioPago,
    fecha:       mov.fecha,
  };

  const { data, error } = await supabase
    .from('movimientos').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const eliminarMovimiento = async (id) => {
  const { error } = await supabase.from('movimientos').delete().eq('id', id);
  if (error) throw error;
};

export const getResumen = async ({ mes, anio } = {}) => {
  const userId = await getUserId();
  const mesActual  = mes  || new Date().getMonth() + 1;
  const anioActual = anio || new Date().getFullYear();

  const { data, error } = await supabase
    .from('movimientos')
    .select('tipo, monto, categoria, semana_num')
    .eq('usuario_id', userId)
    .eq('mes_num', mesActual)
    .eq('anio_num', anioActual);

  if (error) throw error;

  const ingresos = data.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + parseFloat(m.monto), 0);
  const gastos   = data.filter(m => m.tipo === 'gasto').reduce((a, m) => a + parseFloat(m.monto), 0);

  // Por categoría
  const catMap = {};
  data.forEach(m => {
    const key = `${m.categoria}-${m.tipo}`;
    if (!catMap[key]) catMap[key] = { categoria: m.categoria, tipo: m.tipo, total: 0, cantidad: 0 };
    catMap[key].total    += parseFloat(m.monto);
    catMap[key].cantidad += 1;
  });

  // Por semana
  const semMap = {};
  data.forEach(m => {
    const key = `${m.semana_num}-${m.tipo}`;
    if (!semMap[key]) semMap[key] = { semana_num: m.semana_num, tipo: m.tipo, total: 0 };
    semMap[key].total += parseFloat(m.monto);
  });

  return {
    ingresos, gastos,
    balance: ingresos - gastos,
    porCategoria: Object.values(catMap).sort((a, b) => b.total - a.total),
    porSemana: Object.values(semMap).sort((a, b) => a.semana_num - b.semana_num),
  };
};

// ── DEUDAS ──────────────────────────────────────────────
export const getDeudas = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('deudas').select('*')
    .eq('usuario_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const crearDeuda = async (deuda) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('deudas')
    .insert({
      ...deuda,
      monto_total:  parseFloat(String(deuda.monto_total).replace(',','.')),
      tasa_interes: deuda.tasa_interes
        ? parseFloat(String(deuda.tasa_interes).replace(',','.'))
        : null,
      usuario_id: userId,
    }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarDeuda = async (id, deuda) => {
  const { data, error } = await supabase.from('deudas')
    .update({
      ...deuda,
      monto_total:  parseFloat(String(deuda.monto_total).replace(',','.')),
      monto_pagado: parseFloat(String(deuda.monto_pagado).replace(',','.')),
    }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const eliminarDeuda = async (id) => {
  const { error } = await supabase.from('deudas').delete().eq('id', id);
  if (error) throw error;
};

// ── ACTIVOS ──────────────────────────────────────────────
export const getActivos = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('activos').select('*')
    .eq('usuario_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const crearActivo = async (activo) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('activos')
    .insert({
      ...activo,
      valor_inicial:    parseFloat(String(activo.valor_inicial).replace(',','.')),
      valor_actual:     parseFloat(String(activo.valor_actual || activo.valor_inicial).replace(',','.')),
      tasa_rendimiento: activo.tasa_rendimiento
        ? parseFloat(String(activo.tasa_rendimiento).replace(',','.'))
        : null,
      usuario_id: userId,
    }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarActivo = async (id, activo) => {
  const { data, error } = await supabase.from('activos')
    .update(activo).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const eliminarActivo = async (id) => {
  const { error } = await supabase.from('activos').delete().eq('id', id);
  if (error) throw error;
};

// ── METAS ──────────────────────────────────────────────
export const getMetas = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('metas').select('*')
    .eq('usuario_id', userId).order('completada').order('fecha_limite');
  if (error) throw error;
  return data;
};

export const crearMeta = async (meta) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('metas')
    .insert({
      ...meta,
      monto_objetivo: parseFloat(String(meta.monto_objetivo).replace(',','.')),
      monto_actual:   meta.monto_actual
        ? parseFloat(String(meta.monto_actual).replace(',','.'))
        : 0,
      usuario_id: userId,
    }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarMeta = async (id, meta) => {
  const { data, error } = await supabase.from('metas')
    .update({
      ...meta,
      monto_objetivo: parseFloat(String(meta.monto_objetivo).replace(',','.')),
      monto_actual:   parseFloat(String(meta.monto_actual).replace(',','.')),
    }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const eliminarMeta = async (id) => {
  const { error } = await supabase.from('metas').delete().eq('id', id);
  if (error) throw error;
};

// ── HÁBITOS ──────────────────────────────────────────────
export const getHabitos = async () => {
  const userId = await getUserId();
  const hoy = new Date().toISOString().split('T')[0];

  const { data: habitos, error } = await supabase.from('habitos').select('*')
    .eq('usuario_id', userId).eq('activo', true);
  if (error) throw error;

  const { data: logs } = await supabase.from('habitos_log').select('*')
    .eq('usuario_id', userId).eq('fecha', hoy);

  return habitos.map(h => ({
    ...h,
    completado_hoy: logs?.some(l => l.habito_id === h.id && l.completado) || false,
  }));
};

export const toggleHabito = async (habitoId, puntos) => {
  const userId = await getUserId();
  const hoy = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase.from('habitos_log').select('*')
    .eq('usuario_id', userId).eq('habito_id', habitoId).eq('fecha', hoy).single();

  let completado;
  if (existing) {
    completado = !existing.completado;
    const { error } = await supabase.from('habitos_log').update({ completado })
      .eq('usuario_id', userId).eq('habito_id', habitoId).eq('fecha', hoy);
    if (error) throw error;
  } else {
    completado = true;
    const { error } = await supabase.from('habitos_log')
      .insert({ usuario_id: userId, habito_id: habitoId, fecha: hoy, completado: true });
    if (error) throw error;
  }

  // Actualizar XP en perfiles directamente, sin RPC
  if (completado && puntos > 0) {
    const { data: perfil } = await supabase.from('perfiles').select('puntos_xp').eq('id', userId).single();
    if (perfil) {
      await supabase.from('perfiles').update({ puntos_xp: (perfil.puntos_xp || 0) + puntos }).eq('id', userId);
    }
  }

  return { completado };
};

// ── DIARIO ──────────────────────────────────────────────
export const getDiario = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('diario_financiero').select('*')
    .eq('usuario_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data;
};

export const crearEntradaDiario = async ({ pregunta, respuesta }) => {
  const userId = await getUserId();
  const now = new Date();
  const { data, error } = await supabase.from('diario_financiero').insert({
    usuario_id: userId, pregunta, respuesta,
    semana_num: Math.ceil(now.getDate() / 7),
    anio_num: now.getFullYear(),
  }).select().single();
  if (error) throw error;
  return data;
};

// ── CIERRES SEMANALES ────────────────────────────────────
export const getCierres = async (anio) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('cierres_semanales').select('*')
    .eq('usuario_id', userId).eq('anio_num', anio || new Date().getFullYear())
    .order('semana_num');
  if (error) throw error;
  return data;
};

export const crearCierre = async ({ semana_num, mes_num, anio_num, reflexion, ingresos, gastos }) => {
  const userId = await getUserId();
  const balance = ingresos - gastos;
  const estado = balance >= 0 ? 'ok' : 'negativo';

  const { data, error } = await supabase.from('cierres_semanales').upsert({
    usuario_id: userId, semana_num, mes_num, anio_num,
    total_ingresos: ingresos, total_gastos: gastos,
    balance, reflexion, estado,
  }, { onConflict: 'usuario_id,semana_num,anio_num' }).select().single();
  if (error) throw error;
  return data;
};

// ── HELPER ──────────────────────────────────────────────
// Semana DENTRO DEL MES (1 a 5), no semana del año.
// Así "Semana 1" siempre significa los primeros días del mes actual.
const getWeekNumber = (date) => {
  const d = new Date(date);
  return Math.ceil(d.getDate() / 7);
};

// ── PRESUPUESTOS ──────────────────────────────────────────
export const getPresupuestos = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('presupuestos').select('*')
    .eq('usuario_id', userId);
  if (error) throw error;
  return data;
};

export const guardarPresupuesto = async ({ categoria, monto_limite }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('presupuestos')
    .upsert({ usuario_id: userId, categoria, monto_limite }, { onConflict: 'usuario_id,categoria' })
    .select().single();
  if (error) throw error;
  return data;
};

export const eliminarPresupuesto = async (id) => {
  const { error } = await supabase.from('presupuestos').delete().eq('id', id);
  if (error) throw error;
};

// ── RESUMEN POR MEDIO DE PAGO ────────────────────────────
export const getResumenMedioPago = async ({ mes, anio } = {}) => {
  const userId = await getUserId();
  const mesActual  = mes  || new Date().getMonth() + 1;
  const anioActual = anio || new Date().getFullYear();

  const { data, error } = await supabase
    .from('movimientos')
    .select('tipo, monto, medio_pago')
    .eq('usuario_id', userId)
    .eq('mes_num', mesActual)
    .eq('anio_num', anioActual);

  if (error) throw error;

  const BANCOS_KEYS = ['bancolombia','davivienda','bogota','nequi','daviplata','bbva','occidente','popular','itau','scotiabank','falabella','nu','lulo','otro_banco'];

  const resumen = {};
  data.forEach(mov => {
    const medio = mov.medio_pago || 'efectivo';
    // Si el medio_pago es un banco específico, agruparlo bajo 'transferencia' también
    const esBanco = BANCOS_KEYS.includes(medio);
    const claves = esBanco ? ['transferencia', medio] : [medio];
    claves.forEach(clave => {
      if (!resumen[clave]) resumen[clave] = { ingresos: 0, gastos: 0 };
      if (mov.tipo === 'ingreso') resumen[clave].ingresos += parseFloat(mov.monto);
      else resumen[clave].gastos += parseFloat(mov.monto);
    });
  });

  return resumen;
};

// ── RENDIMIENTO DE ACTIVOS ───────────────────────────────
export const registrarRendimientoActivo = async ({ activo_id, rendimiento_monto, fecha }) => {
  const userId = await getUserId();

  const { data: activo } = await supabase.from('activos').select('*').eq('id', activo_id).single();
  if (!activo) throw new Error('Activo no encontrado');

  const fechaRegistro = fecha || new Date().toISOString().split('T')[0];
  const nuevoValor = parseFloat(activo.valor_actual) + parseFloat(rendimiento_monto);
  await supabase.from('activos').update({
    valor_actual: nuevoValor,
    ultimo_rendimiento_fecha: fechaRegistro,
  }).eq('id', activo_id);

  await crearMovimiento({
    tipo: 'ingreso',
    monto: parseFloat(rendimiento_monto),
    categoria: 'Rendimiento',
    descripcion: `Rendimiento: ${activo.nombre}`,
    fecha: fechaRegistro,
    medio_pago: 'efectivo',
  });

  return nuevoValor;
};

// ── PAGOS PROGRAMADOS ────────────────────────────────────
export const getPagosProgramados = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('usuario_id', userId)
    .order('dia_mes');
  if (error) throw error;
  return data;
};

export const crearPagoProgramado = async (pago) => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('pagos_programados')
    .insert({ ...pago, usuario_id: userId })
    .select().single();
  if (error) throw error;
  return data;
};

export const eliminarPagoProgramado = async (id) => {
  const { error } = await supabase.from('pagos_programados').delete().eq('id', id);
  if (error) throw error;
};

export const procesarPagosPendientes = async () => {
  const userId = await getUserId();
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  const fechaStr = hoy.toISOString().split('T')[0];

  const { data: pagos } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('usuario_id', userId)
    .eq('dia_mes', diaHoy)
    .eq('activo', true);

  if (!pagos?.length) return 0;

  let procesados = 0;
  for (const pago of pagos) {
    // Verificar si ya se registró hoy
    const { data: yaExiste } = await supabase
      .from('movimientos')
      .select('id')
      .eq('usuario_id', userId)
      .eq('descripcion', `[Auto] ${pago.nombre}`)
      .eq('fecha', fechaStr)
      .single();

    if (yaExiste) continue;

    await crearMovimiento({
      tipo: 'gasto',
      monto: pago.monto,
      categoria: pago.categoria,
      descripcion: `[Auto] ${pago.nombre}`,
      fecha: fechaStr,
      medio_pago: pago.medio_pago || 'otro_banco',
    });
    procesados++;
  }
  return procesados;
};
