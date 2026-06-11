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

  const { data, error } = await supabase.from('movimientos').insert({
    ...mov,
    usuario_id: userId,
    fecha: fecha.toISOString().split('T')[0],
    semana_num: semana,
    mes_num: fecha.getMonth() + 1,
    anio_num: fecha.getFullYear(),
  }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarMovimiento = async (id, mov) => {
  const { data, error } = await supabase
    .from('movimientos').update(mov).eq('id', id).select().single();
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
    .insert({ ...deuda, usuario_id: userId }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarDeuda = async (id, deuda) => {
  const { data, error } = await supabase.from('deudas')
    .update(deuda).eq('id', id).select().single();
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
    .insert({ ...activo, usuario_id: userId }).select().single();
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
    .insert({ ...meta, usuario_id: userId }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarMeta = async (id, meta) => {
  const { data, error } = await supabase.from('metas')
    .update(meta).eq('id', id).select().single();
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
    await supabase.from('habitos_log').update({ completado })
      .eq('usuario_id', userId).eq('habito_id', habitoId).eq('fecha', hoy);
  } else {
    completado = true;
    await supabase.from('habitos_log').insert({ usuario_id: userId, habito_id: habitoId, fecha: hoy, completado: true });
  }

  if (completado) {
    await supabase.rpc('incrementar_xp', { user_id: userId, puntos_a_sumar: puntos })
      .catch(() => {}); // Si la función no existe, no bloquea
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
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};
