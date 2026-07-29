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
  // No usamos upsert(onConflict) porque depende de una restricción UNIQUE
  // en Supabase que puede no existir (causaba que el guardado fallara en
  // silencio). Buscamos primero y decidimos update/insert explícitamente —
  // funciona sin importar el estado de las restricciones en la BD.
  const { data: existente, error: errBusqueda } = await supabase
    .from('presupuestos').select('id')
    .eq('usuario_id', userId).eq('categoria', categoria)
    .maybeSingle();
  if (errBusqueda) throw errBusqueda;

  if (existente) {
    const { data, error } = await supabase.from('presupuestos')
      .update({ monto_limite }).eq('id', existente.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('presupuestos')
    .insert({ usuario_id: userId, categoria, monto_limite }).select().single();
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

// ── SALDO TOTAL ───────────────────────────────────────────
// A diferencia de getResumen/getResumenMedioPago (que se filtran por mes),
// esto es el dinero real acumulado desde siempre: efectivo + cada cuenta
// bancaria. NUNCA debe filtrarse por mes — el cierre mensual/semanal es
// solo para generar reportes, el saldo real de la persona sigue existiendo.
export const getSaldoTotal = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('movimientos')
    .select('tipo, monto, medio_pago')
    .eq('usuario_id', userId);
  if (error) throw error;

  // Capital inicial: dinero que la persona ya tenía antes de empezar a usar
  // la app (no es un "ingreso" nuevo). Se suma aparte porque vive en su
  // propia tabla. Si la tabla todavía no existe (falta correr la migración)
  // se ignora en silencio para no romper el resto del dashboard.
  let iniciales = [];
  try {
    const { data: dataIni, error: errIni } = await supabase
      .from('saldos_iniciales')
      .select('medio_pago, monto')
      .eq('usuario_id', userId);
    if (!errIni) iniciales = dataIni || [];
  } catch { /* tabla no existe aún */ }

  const BANCOS_KEYS = ['bancolombia','davivienda','bogota','nequi','daviplata','bbva','occidente','popular','itau','scotiabank','falabella','nu','lulo','otro_banco'];

  const porMedio = {};
  let ingresosTotal = 0, gastosTotal = 0;

  const acumular = (medio, monto, esIngreso) => {
    const esBanco = BANCOS_KEYS.includes(medio);
    const claves = esBanco ? ['transferencia', medio] : [medio];
    claves.forEach(clave => {
      if (!porMedio[clave]) porMedio[clave] = { ingresos: 0, gastos: 0 };
      if (esIngreso) porMedio[clave].ingresos += monto;
      else porMedio[clave].gastos += monto;
    });
  };

  iniciales.forEach(s => {
    const monto = parseFloat(s.monto);
    acumular(s.medio_pago || 'efectivo', monto, true);
    ingresosTotal += monto;
  });

  data.forEach(mov => {
    const medio = mov.medio_pago || 'efectivo';
    const monto = parseFloat(mov.monto);
    acumular(medio, monto, mov.tipo === 'ingreso');
    if (mov.tipo === 'ingreso') ingresosTotal += monto; else gastosTotal += monto;
  });

  return {
    saldoTotal: ingresosTotal - gastosTotal,
    ingresosTotal, gastosTotal,
    porMedio,
  };
};

// ── CAPITAL INICIAL ───────────────────────────────────────
// Dinero que la persona YA tenía al empezar a usar la app, por medio de
// pago (efectivo, cada banco). Se guarda aparte de "movimientos" porque
// NO es un ingreso nuevo — es el punto de partida. getSaldoTotal() lo
// suma automáticamente al saldo real disponible.
// Requiere la tabla `saldos_iniciales` en Supabase — ver migración en
// CONTEXTO_CHAT_NUEVO.md si aún no existe.
export const getSaldosIniciales = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('saldos_iniciales')
    .select('medio_pago, monto')
    .eq('usuario_id', userId)
    .order('monto', { ascending: false });
  if (error) throw error;
  return data;
};

export const guardarSaldoInicial = async (medio_pago, monto) => {
  const userId = await getUserId();
  const payload = {
    usuario_id: userId,
    medio_pago,
    monto: parseFloat(String(monto).replace(',', '.')) || 0,
  };
  const { error } = await supabase
    .from('saldos_iniciales')
    .upsert(payload, { onConflict: 'usuario_id,medio_pago' });
  if (error) throw error;
};

export const eliminarSaldoInicial = async (medio_pago) => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('saldos_iniciales')
    .delete()
    .eq('usuario_id', userId)
    .eq('medio_pago', medio_pago);
  if (error) throw error;
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
  const fechaStr = hoy.toISOString().split('T')[0];

  // Solo los pagos FIJOS se auto-registran. Los ÚNICOS nunca se procesan
  // solos — se quedan como pendientes hasta que el usuario los confirma
  // manualmente con marcarPagoUnicoComoPagado().
  const { data: pagos } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('usuario_id', userId)
    .eq('dia_mes', diaHoy)
    .eq('activo', true)
    .or('tipo.eq.fijo,tipo.is.null');

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

// Confirma manualmente un pago único: crea el movimiento real y lo saca
// de la lista de pendientes. A diferencia de los pagos fijos, esto NUNCA
// pasa solo — requiere que el usuario lo confirme a propósito.
export const marcarPagoUnicoComoPagado = async (pago, fechaPago) => {
  const fecha = fechaPago || new Date().toISOString().split('T')[0];
  await crearMovimiento({
    tipo: 'gasto',
    monto: pago.monto,
    categoria: pago.categoria,
    descripcion: pago.nombre,
    fecha,
    medio_pago: pago.medio_pago || 'otro_banco',
  });
  const { data, error } = await supabase
    .from('pagos_programados')
    .update({ pagado: true, activo: false, pagado_en: new Date().toISOString() })
    .eq('id', pago.id)
    .select().single();
  if (error) throw error;
  return data;
};

// ── ELIMINAR CUENTA ──────────────────────────────────────────
// Borra TODOS los datos del usuario en todas las tablas. Esto sí lo puede
// hacer el cliente porque cada tabla tiene RLS que solo permite borrar las
// propias filas (auth.uid() = usuario_id).
//
// Lo que el cliente NO puede hacer es borrar el registro de login en sí
// (Supabase Auth) — eso requiere la service_role key, que nunca debe vivir
// en el navegador por seguridad. Para completar el borrado de verdad, esta
// función intenta llamar a una Edge Function ('delete-account') que corre
// del lado del servidor con esa key. Si esa función no está desplegada
// todavía, el borrado de datos igual se completa y se cierra la sesión —
// solo que el email queda libre para volver a registrarse, en vez de
// quedar 100% eliminado de Supabase Auth.
const TABLAS_USUARIO = [
  'movimientos', 'habitos_log', 'habitos', 'presupuestos', 'saldos_iniciales',
  'pagos_programados', 'activos', 'deudas', 'metas', 'cierres_semanales',
  'diario_financiero',
];

export const eliminarCuentaCompleta = async () => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa');

  // Borra en todas las tablas de datos. Si una tabla no existe todavía
  // (ej. saldos_iniciales sin migrar) simplemente se ignora ese error
  // puntual y se sigue con las demás — no debe bloquear el borrado total.
  for (const tabla of TABLAS_USUARIO) {
    const { error } = await supabase.from(tabla).delete().eq('usuario_id', userId);
    if (error && !/relation .* does not exist/i.test(error.message)) {
      console.warn(`No se pudo limpiar la tabla ${tabla}:`, error.message);
    }
  }
  // El perfil se borra al final
  await supabase.from('perfiles').delete().eq('id', userId);

  // Intenta borrar la cuenta de Auth en sí (requiere la Edge Function
  // desplegada — ver supabase/functions/delete-account/index.ts)
  let cuentaAuthEliminada = false;
  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (!error) cuentaAuthEliminada = true;
  } catch {
    // Edge Function no desplegada — no es un error fatal, seguimos igual
  }

  await supabase.auth.signOut();
  return { cuentaAuthEliminada };
};
