import { supabase } from './supabase';
import { parseLocalDate, todayLocalStr, getSemanaDelMes, diaEfectivoPago } from './helpers';

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

// Movimientos más recientes de UN medio de pago específico — para el
// carrusel de tarjetas del Dashboard (cada banco/tarjeta puede ver sus
// propias transacciones recientes al entrar, sin filtrar por mes).
export const getMovimientosPorMedio = async (medioPago, limite = 8) => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('movimientos').select('*')
    .eq('usuario_id', userId).eq('medio_pago', medioPago)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
};

export const crearMovimiento = async (mov) => {
  const userId = await getUserId();
  const fecha = mov.fecha ? parseLocalDate(mov.fecha) : new Date();
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
    fecha:       todayLocalStr(fecha),
    semana_num:  semana,
    mes_num:     fecha.getMonth() + 1,
    anio_num:    fecha.getFullYear(),
  };

  const { data, error } = await supabase.from('movimientos').insert(payload).select().single();
  if (error) throw error;

  // Si el medio de pago está vinculado a una tarjeta de crédito, este
  // gasto (o ingreso, ej. un reembolso) también se refleja en la deuda —
  // automáticamente, sin que el usuario tenga que ir a Deudas a hacerlo
  // aparte. El movimiento en sí queda igual (para categorías/reportes);
  // solo se excluye del cálculo de "capital disponible" (ver getSaldoTotal).
  await sincronizarCargoTarjeta(userId, medioPago, payload.tipo, payload.monto, payload.fecha, data.id, mov.descripcion || mov.categoria, mov.num_cuotas);

  return data;
};

// Busca si un medio de pago está vinculado a una tarjeta de crédito activa
// del usuario. Se llama en cada movimiento nuevo/editado — una sola
// consulta indexada, no es costoso.
const buscarTarjetaVinculada = async (userId, medioPago) => {
  const { data } = await supabase
    .from('deudas').select('id')
    .eq('usuario_id', userId).eq('medio_pago_vinculado', medioPago).eq('activa', true)
    .limit(1).maybeSingle();
  return data?.id || null;
};

// Crea (o no, si el medio de pago no está vinculado a ninguna tarjeta) el
// cargo/abono correspondiente en el historial de la deuda. 'gasto' con
// esa tarjeta = 'cargo' (aumenta lo que debes); 'ingreso' con esa tarjeta
// = 'abono' (ej. un reembolso reduce lo que debes).
const sincronizarCargoTarjeta = async (userId, medioPago, tipoMov, monto, fecha, movimientoId, nota, numCuotas) => {
  const deudaId = await buscarTarjetaVinculada(userId, medioPago);
  if (!deudaId) return;
  await crearDeudaMovimiento({
    deuda_id: deudaId, tipo: tipoMov === 'ingreso' ? 'abono' : 'cargo',
    monto, fecha, nota, movimiento_id: movimientoId,
    num_cuotas: tipoMov === 'ingreso' ? null : numCuotas,
  });
};

// Medios de pago vinculados a alguna tarjeta de crédito activa del
// usuario — se usa en el formulario de gastos para mostrar el campo de
// cuotas solo cuando de verdad aplica (pagando con una tarjeta vinculada).
export const getMediosPagoTarjeta = async () => {
  const userId = await getUserId();
  const { data } = await supabase
    .from('deudas').select('medio_pago_vinculado')
    .eq('usuario_id', userId).eq('activa', true).not('medio_pago_vinculado', 'is', null);
  return new Set((data || []).map(d => d.medio_pago_vinculado));
};

export const actualizarMovimiento = async (id, mov) => {
  const userId = await getUserId();
  const medioPago = mov.medio_pago === 'transferencia' && mov.banco
    ? mov.banco
    : mov.medio_pago || 'efectivo';

  const fecha = parseLocalDate(mov.fecha);

  const payload = {
    tipo:        mov.tipo,
    monto:       parseFloat(String(mov.monto).replace(',','.')),
    categoria:   mov.categoria,
    descripcion: mov.descripcion || null,
    medio_pago:  medioPago,
    fecha:       todayLocalStr(fecha),
    semana_num:  getWeekNumber(fecha),
    mes_num:     fecha.getMonth() + 1,
    anio_num:    fecha.getFullYear(),
  };

  const { data, error } = await supabase
    .from('movimientos').update(payload).eq('id', id).select().single();
  if (error) throw error;

  // Si este movimiento ya tenía un cargo vinculado en alguna tarjeta, se
  // borra (recalcula esa deuda) y se vuelve a evaluar desde cero con los
  // datos nuevos — más simple y confiable que intentar "actualizar en el
  // sitio", porque el medio de pago pudo cambiar de tarjeta a efectivo o
  // viceversa, o pudo cambiar el monto.
  await borrarCargoVinculado(id);
  await sincronizarCargoTarjeta(userId, medioPago, payload.tipo, payload.monto, payload.fecha, id, mov.descripcion || mov.categoria, mov.num_cuotas);

  return data;
};

export const eliminarMovimiento = async (id) => {
  await borrarCargoVinculado(id);
  const { error } = await supabase.from('movimientos').delete().eq('id', id);
  if (error) throw error;
};

// Busca y borra el cargo/abono de tarjeta vinculado a un movimiento
// (si existe) — recalcula la deuda automáticamente al hacerlo. Se usa
// antes de editar o borrar un movimiento, para que el historial de la
// tarjeta nunca quede desincronizado con los gastos reales.
const borrarCargoVinculado = async (movimientoId) => {
  const { data } = await supabase
    .from('deuda_movimientos').select('id').eq('movimiento_id', movimientoId).maybeSingle();
  if (data?.id) await eliminarDeudaMovimiento(data.id);
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

  // Por categoría DENTRO de cada semana — mismo query, sin costo extra.
  // Se usa para el "espejo de la semana" en CierreSemanal.jsx (categoría
  // con más movimiento de esa semana puntual).
  const catSemMap = {};
  data.forEach(m => {
    const key = `${m.semana_num}-${m.categoria}-${m.tipo}`;
    if (!catSemMap[key]) catSemMap[key] = { semana_num: m.semana_num, categoria: m.categoria, tipo: m.tipo, total: 0 };
    catSemMap[key].total += parseFloat(m.monto);
  });

  return {
    ingresos, gastos,
    balance: ingresos - gastos,
    porCategoria: Object.values(catMap).sort((a, b) => b.total - a.total),
    porSemana: Object.values(semMap).sort((a, b) => a.semana_num - b.semana_num),
    porCategoriaSemana: Object.values(catSemMap).sort((a, b) => b.total - a.total),
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
  const montoTotal = parseFloat(String(deuda.monto_total).replace(',','.'));
  const { data, error } = await supabase.from('deudas')
    .insert({
      ...deuda,
      monto_total:  montoTotal,
      capital_original: montoTotal, // fijo — monto_total va a crecer si se agregan intereses/mora/cargos
      monto_pagado: 0,
      tasa_interes: deuda.tasa_interes
        ? parseFloat(String(deuda.tasa_interes).replace(',','.'))
        : null,
      interes_mensual_monto: deuda.interes_mensual_monto
        ? parseFloat(String(deuda.interes_mensual_monto).replace(',','.'))
        : null,
      // Solo aplican cuando tipo === 'Tarjeta de crédito', pero no hace
      // daño guardarlos vacíos para otros tipos de deuda.
      medio_pago_vinculado: deuda.medio_pago_vinculado || null,
      cupo_total: deuda.cupo_total ? parseFloat(String(deuda.cupo_total).replace(',','.')) : null,
      dia_corte: deuda.dia_corte ? parseInt(deuda.dia_corte) : null,
      pago_minimo_pct: deuda.pago_minimo_pct ? parseFloat(String(deuda.pago_minimo_pct).replace(',','.')) : null,
      usuario_id: userId,
    }).select().single();
  if (error) throw error;
  return data;
};

// Edita los DATOS de una deuda (nombre, tipo, tasa, fecha límite, interés
// mensual fijo). Ya NO toca monto_total/monto_pagado directamente — esos
// se recalculan siempre desde el historial real (ver recalcularDeuda),
// nunca se editan a mano, para que jamás se puedan desincronizar.
export const actualizarDeuda = async (id, deuda) => {
  const payload = { nombre: deuda.nombre, tipo: deuda.tipo, fecha_limite: deuda.fecha_limite || null };
  if (deuda.tasa_interes !== undefined) {
    payload.tasa_interes = deuda.tasa_interes ? parseFloat(String(deuda.tasa_interes).replace(',','.')) : null;
  }
  if (deuda.interes_mensual_monto !== undefined) {
    payload.interes_mensual_monto = deuda.interes_mensual_monto ? parseFloat(String(deuda.interes_mensual_monto).replace(',','.')) : null;
  }
  if (deuda.medio_pago_vinculado !== undefined) payload.medio_pago_vinculado = deuda.medio_pago_vinculado || null;
  if (deuda.cupo_total !== undefined) payload.cupo_total = deuda.cupo_total ? parseFloat(String(deuda.cupo_total).replace(',','.')) : null;
  if (deuda.dia_corte !== undefined) payload.dia_corte = deuda.dia_corte ? parseInt(deuda.dia_corte) : null;
  if (deuda.pago_minimo_pct !== undefined) payload.pago_minimo_pct = deuda.pago_minimo_pct ? parseFloat(String(deuda.pago_minimo_pct).replace(',','.')) : null;

  const { data, error } = await supabase.from('deudas').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const eliminarDeuda = async (id) => {
  const { error } = await supabase.from('deudas').delete().eq('id', id);
  if (error) throw error;
};

// Recalcula monto_total/monto_pagado/activa de una deuda A PARTIR de todo
// su historial en deuda_movimientos — única fuente de verdad. Se llama
// después de crear/editar/borrar cualquier movimiento del historial, así
// nunca se puede desincronizar (antes 'monto_pagado' se sumaba/restaba a
// mano en cada acción, sin ningún registro de por qué llegó a ese número).
const recalcularDeuda = async (deudaId) => {
  const { data: deuda, error: eDeuda } = await supabase
    .from('deudas').select('capital_original, monto_total').eq('id', deudaId).single();
  if (eDeuda) throw eDeuda;

  const { data: movs, error: eMovs } = await supabase
    .from('deuda_movimientos').select('tipo, monto').eq('deuda_id', deudaId);
  if (eMovs) throw eMovs;

  const capital = parseFloat(deuda.capital_original ?? deuda.monto_total);
  const sumar = (tipo) => (movs || []).filter(m => m.tipo === tipo).reduce((a, m) => a + parseFloat(m.monto), 0);
  const cargos   = sumar('interes') + sumar('mora') + sumar('cargo'); // suman a lo que se debe
  const abonado  = sumar('abono');                   // resta de lo que se debe

  const montoTotal  = capital + cargos;               // "lo que debes hoy" = capital + lo acumulado
  const montoPagado = Math.min(abonado, montoTotal);

  const { error } = await supabase.from('deudas')
    .update({ monto_total: montoTotal, monto_pagado: montoPagado, activa: montoPagado < montoTotal })
    .eq('id', deudaId);
  if (error) throw error;
};

// ── HISTORIAL DE DEUDA (abonos, intereses, mora) ──────────
export const getDeudaMovimientos = async (deudaId) => {
  const { data, error } = await supabase
    .from('deuda_movimientos').select('*').eq('deuda_id', deudaId)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const crearDeudaMovimiento = async ({ deuda_id, tipo, monto, fecha, nota, movimiento_id, num_cuotas }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('deuda_movimientos').insert({
    usuario_id: userId, deuda_id, tipo,
    monto: parseFloat(String(monto).replace(',','.')),
    fecha: fecha || todayLocalStr(),
    nota: nota || null,
    movimiento_id: movimiento_id || null,
    num_cuotas: num_cuotas && num_cuotas > 1 ? parseInt(num_cuotas) : null,
  }).select().single();
  if (error) throw error;
  await recalcularDeuda(deuda_id);
  return data;
};

// Editar un movimiento del historial — por si hubo un error al registrar
// un abono/interés/mora. Recalcula la deuda completa después.
export const actualizarDeudaMovimiento = async (id, { tipo, monto, fecha, nota, num_cuotas }) => {
  const { data, error } = await supabase.from('deuda_movimientos').update({
    tipo, monto: parseFloat(String(monto).replace(',','.')), fecha, nota: nota || null,
    num_cuotas: num_cuotas && num_cuotas > 1 ? parseInt(num_cuotas) : null,
  }).eq('id', id).select().single();
  if (error) throw error;
  await recalcularDeuda(data.deuda_id);
  return data;
};

export const eliminarDeudaMovimiento = async (id) => {
  const { data, error: eGet } = await supabase
    .from('deuda_movimientos').select('deuda_id').eq('id', id).single();
  if (eGet) throw eGet;
  const { error } = await supabase.from('deuda_movimientos').delete().eq('id', id);
  if (error) throw error;
  await recalcularDeuda(data.deuda_id);
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
  const hoy = todayLocalStr();

  const { data: habitos, error } = await supabase.from('habitos').select('*')
    .eq('usuario_id', userId).eq('activo', true);
  if (error) throw error;

  const { data: logs } = await supabase.from('habitos_log').select('*')
    .eq('usuario_id', userId).eq('fecha', hoy);

  // Racha: días consecutivos completados, contando hacia atrás desde hoy
  // (o desde ayer si hoy aún no se marcó, para no cortar la racha a medio
  // día). Se trae una ventana de 90 días — suficiente para cualquier
  // racha realista sin cargar todo el historial.
  const desde = new Date();
  desde.setDate(desde.getDate() - 90);
  const { data: logsHistoricos } = await supabase.from('habitos_log').select('habito_id,fecha,completado')
    .eq('usuario_id', userId).eq('completado', true).gte('fecha', todayLocalStr(desde));

  const calcularRacha = (habitoId) => {
    const fechasCompletadas = new Set(
      (logsHistoricos || []).filter(l => l.habito_id === habitoId).map(l => l.fecha)
    );
    let racha = 0;
    let cursor = new Date();
    // si hoy no está completado, arranca a contar desde ayer
    if (!fechasCompletadas.has(hoy)) cursor.setDate(cursor.getDate() - 1);
    while (fechasCompletadas.has(todayLocalStr(cursor))) {
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return racha;
  };

  return habitos.map(h => ({
    ...h,
    completado_hoy: logs?.some(l => l.habito_id === h.id && l.completado) || false,
    racha: calcularRacha(h.id),
  }));
};

export const toggleHabito = async (habitoId, puntos) => {
  const userId = await getUserId();
  const hoy = todayLocalStr();

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
    semana_num: getSemanaDelMes(now.getDate()),
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

export const crearCierre = async ({ semana_num, mes_num, anio_num, reflexion, ingresos, gastos, estado_animo }) => {
  const userId = await getUserId();
  const balance = ingresos - gastos;
  const estado = balance >= 0 ? 'ok' : 'negativo';

  const { data, error } = await supabase.from('cierres_semanales').upsert({
    usuario_id: userId, semana_num, mes_num, anio_num,
    total_ingresos: ingresos, total_gastos: gastos,
    balance, reflexion, estado, estado_animo: estado_animo || null,
  }, { onConflict: 'usuario_id,semana_num,mes_num,anio_num' }).select().single();
  if (error) throw error;
  return data;
};

// ── HELPER ──────────────────────────────────────────────
// Semana DENTRO DEL MES (1 a 4, ver getSemanaDelMes en helpers.js).
// Así "Semana 1" siempre significa los primeros días del mes actual.
const getWeekNumber = (date) => getSemanaDelMes(date.getDate());

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
// NOTA: esta función todavía no está conectada a ninguna pantalla. Si se
// usa en el futuro para mostrar capital/saldo (no solo un desglose
// informativo de gasto), debe excluir las tarjetas de crédito igual que
// getSaldoTotal() de abajo — de lo contrario vuelve a aparecer el mismo
// problema: un gasto con tarjeta de crédito no es tu plata saliendo.
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

  // Medios de pago vinculados a una tarjeta de crédito activa — lo
  // gastado ahí NO es capital propio saliendo de una cuenta, es plata
  // prestada. Se excluye por completo del saldo real disponible (el
  // gasto en sí se sigue contando en categorías/reportes normalmente,
  // solo no afecta "cuánta plata tengo").
  const { data: tarjetas } = await supabase
    .from('deudas').select('medio_pago_vinculado')
    .eq('usuario_id', userId).eq('activa', true).not('medio_pago_vinculado', 'is', null);
  const mediosTarjeta = new Set((tarjetas || []).map(t => t.medio_pago_vinculado));

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
    if (mediosTarjeta.has(medio)) return; // plata prestada, no cuenta como capital
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

  const fechaRegistro = fecha || todayLocalStr();
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
  const mesHoy = hoy.getMonth() + 1;
  const anioHoy = hoy.getFullYear();
  const fechaStr = todayLocalStr(hoy);

  // Solo los pagos FIJOS se auto-registran. Los ÚNICOS nunca se procesan
  // solos — se quedan como pendientes hasta que el usuario los confirma
  // manualmente con marcarPagoUnicoComoPagado().
  //
  // No filtramos por dia_mes=diaHoy directo en la consulta porque un
  // pago programado para el día 31 (o 29/30) debe ajustarse al último
  // día del mes cuando el mes es más corto (ej: en abril, un pago del
  // "día 31" cae el 30) — igual que hacen bancos y plataformas de cobro
  // recurrente. Por eso traemos todos los fijos activos y comparamos en
  // JS contra el día efectivo de ESTE mes específico.
  const { data: todosFijos } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('usuario_id', userId)
    .eq('activo', true)
    .or('tipo.eq.fijo,tipo.is.null');

  const pagos = (todosFijos || []).filter(p => diaEfectivoPago(p.dia_mes, mesHoy, anioHoy) === diaHoy);

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
    // Si este pago programado pertenece a una deuda, el abono se registra
    // solo en su historial — no hay que ir a Deudas a hacerlo aparte.
    if (pago.deuda_id) {
      await crearDeudaMovimiento({
        deuda_id: pago.deuda_id, tipo: 'abono', monto: pago.monto,
        fecha: fechaStr, nota: `Pago automático: ${pago.nombre}`,
      });
    }
    procesados++;
  }
  return procesados;
};

// Confirma manualmente un pago único: crea el movimiento real y lo saca
// de la lista de pendientes. A diferencia de los pagos fijos, esto NUNCA
// pasa solo — requiere que el usuario lo confirme a propósito.
export const marcarPagoUnicoComoPagado = async (pago, fechaPago) => {
  const fecha = fechaPago || todayLocalStr();
  await crearMovimiento({
    tipo: 'gasto',
    monto: pago.monto,
    categoria: pago.categoria,
    descripcion: pago.nombre,
    fecha,
    medio_pago: pago.medio_pago || 'otro_banco',
  });
  if (pago.deuda_id) {
    await crearDeudaMovimiento({
      deuda_id: pago.deuda_id, tipo: 'abono', monto: pago.monto,
      fecha, nota: `Pago programado: ${pago.nombre}`,
    });
  }
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

// Respaldo completo de todos los datos del usuario en un solo JSON —
// consulta directa sin los límites/filtros de las vistas normales (que
// están pensadas para una pantalla, no para un backup). Uso: botón
// "Descargar mis datos" en Perfil. Solo lectura — no modifica nada.
export const exportarDatosCompletos = async () => {
  const userId = await getUserId();
  const tablas = [
    'movimientos', 'deudas', 'deuda_movimientos', 'activos', 'metas',
    'habitos', 'habitos_log', 'diario_financiero', 'cierres_semanales',
    'presupuestos', 'pagos_programados', 'saldos_iniciales',
  ];
  const resultado = { exportado_en: new Date().toISOString(), version: 1 };
  for (const tabla of tablas) {
    const { data, error } = await supabase.from(tabla).select('*').eq('usuario_id', userId);
    if (error) { console.error(`Error exportando ${tabla}:`, error); resultado[tabla] = []; }
    else resultado[tabla] = data;
  }
  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle();
  resultado.perfil = perfil;
  return resultado;
};
