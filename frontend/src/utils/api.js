import { supabase } from './supabase';
import { parseLocalDate, todayLocalStr, getSemanaDelMes, diaEfectivoPago, CATEGORIA_PAGO_TARJETA, PREFIJO_MEDIO_TARJETA, esMedioTarjeta } from './helpers';

// Helper para obtener el usuario actual.
// Se guarda en memoria: antes CADA función de api.js esperaba a
// supabase.auth.getSession() (que toma un candado interno), y el Dashboard
// dispara ~10 consultas a la vez que hacían fila en ese candado. El id solo
// cambia al iniciar/cerrar sesión o cambiar de cuenta — onAuthStateChange
// lo mantiene al día (solo asigna una variable, sin llamar a Supabase
// adentro del callback, como recomienda la documentación).
let _userId = null;
supabase.auth.onAuthStateChange((_evento, session) => { _userId = session?.user?.id ?? null; });
const getUserId = async () => {
  if (_userId) return _userId;
  const { data: { session } } = await supabase.auth.getSession();
  _userId = session?.user?.id ?? null;
  return _userId;
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

// Traduce lo que elige el formulario al valor real que se guarda en
// movimientos.medio_pago:
//   - 'tarjeta' + tarjeta_id  → 'tarjeta:<id>' (compra con ESA tarjeta)
//   - 'transferencia' + banco → la clave del banco (nequi, bancolombia, ...)
//   - cualquier otro valor    → tal cual (ya viene resuelto, ej. 'efectivo',
//     'bancolombia' o 'tarjeta:<id>' desde Dashboard/Tarjetas)
const resolverMedioPago = (mov) =>
  mov.medio_pago === 'tarjeta' && mov.tarjeta_id ? `${PREFIJO_MEDIO_TARJETA}${mov.tarjeta_id}`
  : mov.medio_pago === 'transferencia' && mov.banco ? mov.banco
  : mov.medio_pago || 'efectivo';

export const crearMovimiento = async (mov) => {
  const userId = await getUserId();
  const fecha = mov.fecha ? parseLocalDate(mov.fecha) : new Date();
  const semana = getWeekNumber(fecha);

  // Construir payload limpio — guardamos banco dentro de medio_pago
  // para no depender de columna extra en Supabase
  const medioPago = resolverMedioPago(mov);

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

  // La búsqueda de la tarjeta vinculada no depende del insert (solo del
  // medio de pago), así que corre a la vez: en el caso común (sin tarjeta)
  // se ahorra una ida y vuelta entera a la base de datos.
  const [{ data, error }, tarjetaId] = await Promise.all([
    supabase.from('movimientos').insert(payload).select().single(),
    buscarTarjetaVinculada(userId, medioPago),
  ]);
  if (error) throw error;

  // Si este movimiento se pagó con una tarjeta de crédito (elegida
  // directamente, o por un medio de pago vinculado — método anterior), este
  // gasto (o ingreso, ej. un reembolso) también se refleja en el historial
  // de esa tarjeta y su saldo se recalcula, sin ir a Tarjetas aparte. El
  // movimiento en sí queda igual (para categorías/reportes); solo se excluye
  // del cálculo de "capital disponible" (ver getSaldoTotal).
  await sincronizarCargoTarjeta(tarjetaId, payload.tipo, payload.monto, payload.fecha, data.id, mov.descripcion || mov.categoria, mov.num_cuotas);

  return data;
};

// Busca si un medio de pago está vinculado a una tarjeta de crédito activa
// del usuario (tabla tarjetas_credito — cuenta real, separada de deudas).
// Se llama en cada movimiento nuevo/editado — una sola consulta indexada,
// no es costoso.
const buscarTarjetaVinculada = async (userId, medioPago) => {
  // Compra hecha eligiendo una tarjeta concreta: el id viaja en el propio
  // medio de pago ('tarjeta:<id>'), no hace falta buscar nada.
  if (esMedioTarjeta(medioPago)) return medioPago.slice(PREFIJO_MEDIO_TARJETA.length);
  // Método anterior: un medio de pago (ej. un banco) vinculado a la tarjeta.
  const { data } = await supabase
    .from('tarjetas_credito').select('id')
    .eq('usuario_id', userId).eq('medio_pago_vinculado', medioPago).eq('activa', true)
    .limit(1).maybeSingle();
  return data?.id || null;
};

// Crea (o no, si el medio de pago no está vinculado a ninguna tarjeta) el
// cargo/abono correspondiente en el historial de la tarjeta. 'gasto' con
// esa tarjeta = 'cargo' (aumenta el saldo que debes); 'ingreso' con esa
// tarjeta = 'abono' (ej. un reembolso reduce el saldo).
const sincronizarCargoTarjeta = async (tarjetaId, tipoMov, monto, fecha, movimientoId, nota, numCuotas) => {
  if (!tarjetaId) return;
  await crearTarjetaMovimiento({
    tarjeta_id: tarjetaId, tipo: tipoMov === 'ingreso' ? 'abono' : 'cargo',
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
    .from('tarjetas_credito').select('medio_pago_vinculado')
    .eq('usuario_id', userId).eq('activa', true).not('medio_pago_vinculado', 'is', null);
  return new Set((data || []).map(d => d.medio_pago_vinculado));
};

export const actualizarMovimiento = async (id, mov) => {
  const userId = await getUserId();
  const medioPago = resolverMedioPago(mov);

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

  // Todo lo que NO depende de lo demás corre a la vez (antes eran ~5
  // consultas una tras otra): el update del movimiento, los vínculos que ya
  // tenía (abono de deuda / cargo de tarjeta) y la tarjeta que le toca ahora.
  const [{ data, error }, { data: deudaVinculada }, { data: tarjetaVinculada }, tarjetaId] = await Promise.all([
    supabase.from('movimientos').update(payload).eq('id', id).select().single(),
    supabase.from('deuda_movimientos').select('id, deuda_id, tipo, nota').eq('movimiento_id', id).maybeSingle(),
    supabase.from('tarjeta_movimientos').select('id').eq('movimiento_id', id).maybeSingle(),
    buscarTarjetaVinculada(userId, medioPago),
  ]);
  if (error) throw error;

  // Los vínculos viejos se borran (recalculando esa deuda/tarjeta) y se
  // vuelven a crear desde cero con los datos nuevos — más simple y confiable
  // que "actualizar en el sitio", porque el medio de pago pudo cambiar de
  // tarjeta a efectivo o viceversa, o pudo cambiar el monto.
  await Promise.all([
    deudaVinculada?.id ? eliminarDeudaMovimiento(deudaVinculada.id) : null,
    tarjetaVinculada?.id ? eliminarTarjetaMovimiento(tarjetaVinculada.id) : null,
  ]);

  if (deudaVinculada) {
    await crearDeudaMovimiento({
      deuda_id: deudaVinculada.deuda_id, tipo: deudaVinculada.tipo, monto: payload.monto,
      fecha: payload.fecha, nota: deudaVinculada.nota, movimiento_id: id,
    });
  }
  await sincronizarCargoTarjeta(tarjetaId, payload.tipo, payload.monto, payload.fecha, id, mov.descripcion || mov.categoria, mov.num_cuotas);

  return data;
};

export const eliminarMovimiento = async (id) => {
  await borrarCargoVinculado(id);
  const { error } = await supabase.from('movimientos').delete().eq('id', id);
  if (error) throw error;
};

// Busca y borra el cargo/abono vinculado a un movimiento (si existe) en
// deudas genéricas o en tarjetas de crédito — recalcula automáticamente
// al hacerlo. Se usa antes de editar o borrar un movimiento, para que el
// historial nunca quede desincronizado con los gastos reales.
const borrarCargoVinculado = async (movimientoId) => {
  const [{ data: enDeuda }, { data: enTarjeta }] = await Promise.all([
    supabase.from('deuda_movimientos').select('id').eq('movimiento_id', movimientoId).maybeSingle(),
    supabase.from('tarjeta_movimientos').select('id').eq('movimiento_id', movimientoId).maybeSingle(),
  ]);
  await Promise.all([
    enDeuda?.id ? eliminarDeudaMovimiento(enDeuda.id) : null,
    enTarjeta?.id ? eliminarTarjetaMovimiento(enTarjeta.id) : null,
  ]);
};

export const getResumen = async ({ mes, anio } = {}) => {
  const userId = await getUserId();
  const mesActual  = mes  || new Date().getMonth() + 1;
  const anioActual = anio || new Date().getFullYear();

  const { data: dataBruta, error } = await supabase
    .from('movimientos')
    .select('tipo, monto, categoria, semana_num')
    .eq('usuario_id', userId)
    .eq('mes_num', mesActual)
    .eq('anio_num', anioActual);

  if (error) throw error;

  // Pagar el extracto de una tarjeta no es un gasto nuevo — el gasto real
  // ya se contó (por categoría) el día de cada compra. Se deja fuera de
  // gastos, presupuestos y reportes; sí baja el capital (getSaldoTotal).
  const data = dataBruta.filter(m => m.categoria !== CATEGORIA_PAGO_TARJETA);

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
  const [{ data: deuda, error: eDeuda }, { data: movs, error: eMovs }] = await Promise.all([
    supabase.from('deudas').select('capital_original, monto_total').eq('id', deudaId).single(),
    supabase.from('deuda_movimientos').select('tipo, monto').eq('deuda_id', deudaId),
  ]);
  if (eDeuda) throw eDeuda;
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

// Abonar a una deuda desde el flujo rápido (Dashboard/Patrimonio "Abonar")
// — a diferencia de llamar crearDeudaMovimiento directo, esto SÍ crea el
// movimiento real con el medio de pago elegido, para que el saldo de esa
// cuenta baje de verdad. Antes el abono solo quedaba en el historial de
// la deuda, sin tocar Movimientos ni el saldo total.
export const abonarDeuda = async (deuda, monto, medioPago, fecha) => {
  const fechaAbono = fecha || todayLocalStr();
  const montoNum = parseFloat(String(monto).replace(',','.'));

  const movimiento = await crearMovimiento({
    tipo: 'gasto', monto: montoNum, categoria: 'Deudas',
    descripcion: `Abono: ${deuda.nombre}`, fecha: fechaAbono, medio_pago: medioPago,
  });

  return crearDeudaMovimiento({
    deuda_id: deuda.id, tipo: 'abono', monto: montoNum, fecha: fechaAbono,
    nota: `Medio de pago: ${medioPago}`, movimiento_id: movimiento.id,
  });
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

// ── TARJETAS DE CRÉDITO ───────────────────────────────────
// Una tarjeta es una CUENTA real, no una deuda genérica: el cupo se usa
// y se libera una y otra vez, no existe un "100% pagado" definitivo como
// en un crédito que se termina. Por eso el modelo es distinto al de
// Deudas — lo que importa aquí es el saldo actual, el cupo disponible,
// y las fechas del ciclo (corte/pago), no un progreso hacia una meta.
export const getTarjetas = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('tarjetas_credito').select('*')
    .eq('usuario_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const crearTarjeta = async (t) => {
  const userId = await getUserId();
  const saldoInicial = t.saldo_inicial ? parseFloat(String(t.saldo_inicial).replace(',','.')) : 0;
  const { data, error } = await supabase.from('tarjetas_credito')
    .insert({
      nombre: t.nombre,
      banco: t.banco || null,
      ultimos_digitos: t.ultimos_digitos || null,
      medio_pago_vinculado: t.medio_pago_vinculado || null,
      cupo_total: t.cupo_total ? parseFloat(String(t.cupo_total).replace(',','.')) : null,
      dia_corte: t.dia_corte ? parseInt(t.dia_corte) : null,
      dia_pago: t.dia_pago ? parseInt(t.dia_pago) : null,
      tasa_interes: t.tasa_interes ? parseFloat(String(t.tasa_interes).replace(',','.')) : null,
      pago_minimo_pct: t.pago_minimo_pct ? parseFloat(String(t.pago_minimo_pct).replace(',','.')) : null,
      saldo_inicial: saldoInicial,
      saldo_actual: saldoInicial,
      usuario_id: userId,
    }).select().single();
  if (error) throw error;
  return data;
};

// Edita los DATOS de la tarjeta. El saldo NUNCA se edita a mano acá —
// se recalcula siempre desde el historial real (ver recalcularTarjeta),
// igual que en Deudas, para que jamás se pueda desincronizar.
export const actualizarTarjeta = async (id, t) => {
  const payload = { nombre: t.nombre, banco: t.banco || null, ultimos_digitos: t.ultimos_digitos || null };
  if (t.medio_pago_vinculado !== undefined) payload.medio_pago_vinculado = t.medio_pago_vinculado || null;
  if (t.cupo_total !== undefined) payload.cupo_total = t.cupo_total ? parseFloat(String(t.cupo_total).replace(',','.')) : null;
  if (t.dia_corte !== undefined) payload.dia_corte = t.dia_corte ? parseInt(t.dia_corte) : null;
  if (t.dia_pago !== undefined) payload.dia_pago = t.dia_pago ? parseInt(t.dia_pago) : null;
  if (t.tasa_interes !== undefined) payload.tasa_interes = t.tasa_interes ? parseFloat(String(t.tasa_interes).replace(',','.')) : null;
  if (t.pago_minimo_pct !== undefined) payload.pago_minimo_pct = t.pago_minimo_pct ? parseFloat(String(t.pago_minimo_pct).replace(',','.')) : null;

  const { data, error } = await supabase.from('tarjetas_credito').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// "Cerrar" una tarjeta no es lo mismo que borrarla: mantiene todo su
// historial, solo deja de contar como activa (deja de excluirse del
// capital disponible, deja de sincronizar cargos nuevos, y libera el
// medio de pago para poder vincularlo a otra tarjeta).
export const cerrarTarjeta = async (id) => {
  const { error } = await supabase.from('tarjetas_credito').update({ activa: false }).eq('id', id);
  if (error) throw error;
};

export const reactivarTarjeta = async (id) => {
  const { error } = await supabase.from('tarjetas_credito').update({ activa: true }).eq('id', id);
  if (error) throw error;
};

export const eliminarTarjeta = async (id) => {
  const { error } = await supabase.from('tarjetas_credito').delete().eq('id', id);
  if (error) throw error;
};

// Recalcula saldo_actual de una tarjeta A PARTIR de todo su historial en
// tarjeta_movimientos — única fuente de verdad, mismo patrón que
// recalcularDeuda(). saldo_actual = saldo_inicial + cargos + intereses +
// mora − abonos. A diferencia de una deuda, puede volver a subir después
// de bajar (uso normal de una tarjeta), así que no existe "activa=false
// automático al llegar a 0" — cerrar la tarjeta es una acción manual.
const recalcularTarjeta = async (tarjetaId) => {
  const [{ data: tarjeta, error: eTarjeta }, { data: movs, error: eMovs }] = await Promise.all([
    supabase.from('tarjetas_credito').select('saldo_inicial').eq('id', tarjetaId).single(),
    supabase.from('tarjeta_movimientos').select('tipo, monto').eq('tarjeta_id', tarjetaId),
  ]);
  if (eTarjeta) throw eTarjeta;
  if (eMovs) throw eMovs;

  const sumar = (tipo) => (movs || []).filter(m => m.tipo === tipo).reduce((a, m) => a + parseFloat(m.monto), 0);
  const saldo = parseFloat(tarjeta.saldo_inicial) + sumar('cargo') + sumar('interes') + sumar('mora') - sumar('abono');

  const { error } = await supabase.from('tarjetas_credito').update({ saldo_actual: saldo }).eq('id', tarjetaId);
  if (error) throw error;
};

// ── HISTORIAL DE TARJETA (compras, pagos, intereses, mora) ──
export const getTarjetaMovimientos = async (tarjetaId) => {
  const { data, error } = await supabase
    .from('tarjeta_movimientos').select('*').eq('tarjeta_id', tarjetaId)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const crearTarjetaMovimiento = async ({ tarjeta_id, tipo, monto, fecha, nota, movimiento_id, num_cuotas }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('tarjeta_movimientos').insert({
    usuario_id: userId, tarjeta_id, tipo,
    monto: parseFloat(String(monto).replace(',','.')),
    fecha: fecha || todayLocalStr(),
    nota: nota || null,
    movimiento_id: movimiento_id || null,
    num_cuotas: num_cuotas && num_cuotas > 1 ? parseInt(num_cuotas) : null,
  }).select().single();
  if (error) throw error;
  await recalcularTarjeta(tarjeta_id);
  return data;
};

export const actualizarTarjetaMovimiento = async (id, { tipo, monto, fecha, nota, num_cuotas }) => {
  const { data, error } = await supabase.from('tarjeta_movimientos').update({
    tipo, monto: parseFloat(String(monto).replace(',','.')), fecha, nota: nota || null,
    num_cuotas: num_cuotas && num_cuotas > 1 ? parseInt(num_cuotas) : null,
  }).eq('id', id).select().single();
  if (error) throw error;
  await recalcularTarjeta(data.tarjeta_id);
  return data;
};

export const eliminarTarjetaMovimiento = async (id) => {
  const { data, error: eGet } = await supabase
    .from('tarjeta_movimientos').select('tarjeta_id').eq('id', id).single();
  if (eGet) throw eGet;
  const { error } = await supabase.from('tarjeta_movimientos').delete().eq('id', id);
  if (error) throw error;
  await recalcularTarjeta(data.tarjeta_id);
};

// Pagar una tarjeta desde el flujo rápido (Dashboard/Tarjetas "Pagar") —
// igual que abonarDeuda: crea el movimiento real con el medio de pago
// elegido (para que el saldo de esa cuenta baje de verdad) y el abono
// correspondiente en el historial de la tarjeta.
export const pagarTarjeta = async (tarjeta, monto, medioPago, fecha) => {
  const fechaPago = fecha || todayLocalStr();
  const montoNum = parseFloat(String(monto).replace(',','.'));

  const movimiento = await crearMovimiento({
    tipo: 'gasto', monto: montoNum, categoria: CATEGORIA_PAGO_TARJETA,
    descripcion: `Pago: ${tarjeta.nombre}`, fecha: fechaPago, medio_pago: medioPago,
  });

  return crearTarjetaMovimiento({
    tarjeta_id: tarjeta.id, tipo: 'abono', monto: montoNum, fecha: fechaPago,
    nota: `Medio de pago: ${medioPago}`, movimiento_id: movimiento.id,
  });
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

// Aportar dinero real a una meta — a diferencia de actualizarMeta()
// (que solo edita los datos de la meta desde el formulario de edición),
// esto es para el flujo de "voy a apartar plata para esto": crea el
// movimiento real con el medio de pago elegido (para que el saldo de esa
// cuenta/billetera SÍ baje) y luego actualiza el monto_actual de la meta.
// Antes esto no pasaba — solo se actualizaba la meta, sin dejar rastro
// en Movimientos, así que el saldo total nunca se enteraba de que esa
// plata había salido.
export const aportarMeta = async (meta, monto, medioPago, fecha) => {
  const fechaAporte = fecha || todayLocalStr();
  const montoNum = parseFloat(String(monto).replace(',','.'));

  await crearMovimiento({
    tipo: 'gasto', monto: montoNum, categoria: 'Ahorro',
    descripcion: `Aporte: ${meta.nombre}`, fecha: fechaAporte, medio_pago: medioPago,
  });

  const nuevoActual = Math.min(parseFloat(meta.monto_actual) + montoNum, parseFloat(meta.monto_objetivo));
  const completada = nuevoActual >= parseFloat(meta.monto_objetivo);
  const { data, error } = await supabase.from('metas')
    .update({ monto_actual: nuevoActual, completada }).eq('id', meta.id).select().single();
  if (error) throw error;
  return { ...data, seCompleta: completada && !meta.completada };
};

// ── PRÉSTAMOS (dinero que TÚ prestas a otros — lo inverso de deudas) ──
export const getPrestamos = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('prestamos').select('*')
    .eq('usuario_id', userId).order('activo', { ascending: false }).order('fecha', { ascending: false });
  if (error) throw error;
  return data;
};

// Registrar un préstamo nuevo (le prestas plata a alguien) crea de una
// vez el movimiento real (gasto: la plata sale de tu cuenta) con el
// medio de pago elegido — no queda solo anotado, se refleja en tu saldo.
export const crearPrestamo = async ({ nombre, monto_total, fecha, notas, medio_pago }) => {
  const userId = await getUserId();
  const montoNum = parseFloat(String(monto_total).replace(',','.'));
  const fechaPrestamo = fecha || todayLocalStr();

  await crearMovimiento({
    tipo: 'gasto', monto: montoNum, categoria: 'Préstamos',
    descripcion: `Préstamo a: ${nombre}`, fecha: fechaPrestamo, medio_pago,
  });

  const { data, error } = await supabase.from('prestamos').insert({
    usuario_id: userId, nombre, monto_total: montoNum, monto_recibido: 0,
    fecha: fechaPrestamo, notas: notas || null, activo: true,
  }).select().single();
  if (error) throw error;
  return data;
};

export const actualizarPrestamo = async (id, { nombre, monto_total, fecha, notas }) => {
  const { data, error } = await supabase.from('prestamos').update({
    nombre, monto_total: parseFloat(String(monto_total).replace(',','.')),
    fecha, notas: notas || null,
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const eliminarPrestamo = async (id) => {
  const { error } = await supabase.from('prestamos').delete().eq('id', id);
  if (error) throw error;
};

export const getPrestamoMovimientos = async (prestamoId) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('prestamo_movimientos').select('*')
    .eq('usuario_id', userId).eq('prestamo_id', prestamoId).order('fecha', { ascending: false });
  if (error) throw error;
  return data;
};

// Cuando te pagan (total o parcial) — crea el ingreso real con el medio
// de pago elegido (la plata SÍ vuelve a esa cuenta) y actualiza cuánto
// te han devuelto en total.
export const abonarPrestamo = async (prestamo, monto, medioPago, fecha) => {
  const userId = await getUserId();
  const fechaAbono = fecha || todayLocalStr();
  const montoNum = parseFloat(String(monto).replace(',','.'));

  const movimiento = await crearMovimiento({
    tipo: 'ingreso', monto: montoNum, categoria: 'Préstamos',
    descripcion: `Pago recibido: ${prestamo.nombre}`, fecha: fechaAbono, medio_pago: medioPago,
  });

  const { error: errMov } = await supabase.from('prestamo_movimientos').insert({
    usuario_id: userId, prestamo_id: prestamo.id, monto: montoNum,
    fecha: fechaAbono, nota: `Medio de pago: ${medioPago}`, movimiento_id: movimiento.id,
  });
  if (errMov) throw errMov;

  const nuevoRecibido = Math.min(parseFloat(prestamo.monto_recibido) + montoNum, parseFloat(prestamo.monto_total));
  const completado = nuevoRecibido >= parseFloat(prestamo.monto_total);
  const { data, error } = await supabase.from('prestamos')
    .update({ monto_recibido: nuevoRecibido, activo: !completado }).eq('id', prestamo.id).select().single();
  if (error) throw error;
  return { ...data, seCompleta: completado };
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

  // Las tres consultas son independientes entre sí: antes se esperaban una
  // detrás de otra (3 idas y vueltas); ahora salen juntas (1).
  //  - movimientos: todo el historial del usuario.
  //  - tarjetas con medio de pago vinculado (método anterior): lo gastado
  //    ahí NO es capital propio saliendo de una cuenta, es plata prestada;
  //    se excluye del saldo real disponible (el gasto sí se sigue contando
  //    en categorías/reportes, solo no afecta "cuánta plata tengo").
  //  - capital inicial: dinero que la persona ya tenía antes de empezar a
  //    usar la app (no es un "ingreso" nuevo). Si la tabla todavía no
  //    existe se ignora en silencio para no romper el resto del dashboard.
  const [resMovs, resTarjetas, resIniciales] = await Promise.all([
    supabase.from('movimientos').select('tipo, monto, medio_pago').eq('usuario_id', userId),
    supabase.from('tarjetas_credito').select('medio_pago_vinculado')
      .eq('usuario_id', userId).eq('activa', true).not('medio_pago_vinculado', 'is', null),
    Promise.resolve(supabase.from('saldos_iniciales').select('medio_pago, monto').eq('usuario_id', userId))
      .catch(() => ({ data: null, error: true })),
  ]);
  if (resMovs.error) throw resMovs.error;
  const data = resMovs.data;
  const mediosTarjeta = new Set((resTarjetas.data || []).map(t => t.medio_pago_vinculado));
  const iniciales = !resIniciales.error ? (resIniciales.data || []) : [];

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
    if (esMedioTarjeta(medio) || mediosTarjeta.has(medio)) return; // plata prestada, no cuenta como capital
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

// Clave de mes usada como llave en meses_resueltos: "YYYY-MM"
const mesKey = (mes, anio) => `${anio}-${String(mes).padStart(2, '0')}`;

// Estado de los pagos fijos para ESTE mes — reemplaza al viejo
// procesarPagosPendientes(), que registraba el gasto solo y en silencio
// apenas llegaba el día exacto. Ahora nada se registra sin que el
// usuario lo confirme: esta función solo CLASIFICA cada pago fijo activo
// según qué tan cerca está su día y si ya se resolvió este mes (pagado o
// corrido), para que la UI decida qué mostrar. No escribe nada en la BD.
//
// Estados posibles por pago:
// - null            → ya resuelto este mes (pagado o corrido), no hay nada que mostrar
// - 'proximo'        → faltan 1-2 días para el día efectivo, aviso informativo
// - 'accionable'     → es hoy o ya pasó el día y sigue sin resolver: pedir acción
// - 'lejano'         → faltan 3+ días, no se muestra en el Dashboard todavía
//   (pero SÍ se puede pagar manualmente desde Calendario si el usuario quiere adelantarlo)
export const getPagosFijosDelMes = async () => {
  const userId = await getUserId();
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const mesHoy = hoy.getMonth() + 1;
  const anioHoy = hoy.getFullYear();
  const key = mesKey(mesHoy, anioHoy);

  const { data: fijos } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('usuario_id', userId)
    .eq('activo', true)
    .or('tipo.eq.fijo,tipo.is.null');

  return (fijos || []).map(p => {
    const diaEfectivo = diaEfectivoPago(p.dia_mes, mesHoy, anioHoy);
    const diasHasta = diaEfectivo - diaHoy;
    const resuelto = p.meses_resueltos?.[key] || null; // 'pagado' | 'saltado' | null

    let estado = null;
    if (!resuelto) {
      if (diasHasta <= 0) estado = 'accionable';
      else if (diasHasta <= 2) estado = 'proximo';
      else estado = 'lejano';
    }
    return { ...p, diaEfectivo, diasHasta, resuelto, estado };
  });
};

// Registra el pago de un pago fijo — cualquier día, no solo el día
// programado. Crea el movimiento real (y el abono en la deuda vinculada
// si aplica) y marca este mes como resuelto para que no se vuelva a
// pedir. `fecha` por defecto es hoy, pero se puede pasar otra si el
// usuario está registrando un pago que ya hizo hace unos días.
export const pagarPagoFijo = async (pago, fecha) => {
  const userId = await getUserId();
  const fechaPago = fecha || todayLocalStr();
  const hoy = new Date();
  const key = mesKey(hoy.getMonth() + 1, hoy.getFullYear());

  await crearMovimiento({
    tipo: 'gasto',
    monto: pago.monto,
    categoria: pago.tarjeta_id ? CATEGORIA_PAGO_TARJETA : pago.categoria,
    descripcion: pago.nombre,
    fecha: fechaPago,
    medio_pago: pago.medio_pago || 'otro_banco',
  });

  if (pago.deuda_id) {
    await crearDeudaMovimiento({
      deuda_id: pago.deuda_id, tipo: 'abono', monto: pago.monto,
      fecha: fechaPago, nota: `Pago: ${pago.nombre}`,
    });
  }
  if (pago.tarjeta_id) {
    await crearTarjetaMovimiento({
      tarjeta_id: pago.tarjeta_id, tipo: 'abono', monto: pago.monto,
      fecha: fechaPago, nota: `Pago: ${pago.nombre}`,
    });
  }

  const nuevosMeses = { ...(pago.meses_resueltos || {}), [key]: 'pagado' };
  const { error } = await supabase.from('pagos_programados')
    .update({ meses_resueltos: nuevosMeses }).eq('id', pago.id).eq('usuario_id', userId);
  if (error) throw error;
};

// "Correr" un pago fijo este mes: no crea ningún movimiento, no toca el
// día programado — el próximo mes vuelve a aparecer normal. Es un
// espacio puntual para ESE mes, no una pausa de la recurrencia.
export const saltarPagoFijoEsteMes = async (pago) => {
  const userId = await getUserId();
  const hoy = new Date();
  const key = mesKey(hoy.getMonth() + 1, hoy.getFullYear());
  const nuevosMeses = { ...(pago.meses_resueltos || {}), [key]: 'saltado' };
  const { error } = await supabase.from('pagos_programados')
    .update({ meses_resueltos: nuevosMeses }).eq('id', pago.id).eq('usuario_id', userId);
  if (error) throw error;
};

// Confirma manualmente un pago único: crea el movimiento real y lo saca
// de la lista de pendientes. A diferencia de los pagos fijos, esto NUNCA
// pasa solo — requiere que el usuario lo confirme a propósito.
export const marcarPagoUnicoComoPagado = async (pago, fechaPago) => {
  const fecha = fechaPago || todayLocalStr();
  await crearMovimiento({
    tipo: 'gasto',
    monto: pago.monto,
    categoria: pago.tarjeta_id ? CATEGORIA_PAGO_TARJETA : pago.categoria,
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
  if (pago.tarjeta_id) {
    await crearTarjetaMovimiento({
      tarjeta_id: pago.tarjeta_id, tipo: 'abono', monto: pago.monto,
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
  'diario_financiero', 'tarjetas_credito',
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
    'movimientos', 'deudas', 'deuda_movimientos', 'tarjetas_credito', 'tarjeta_movimientos',
    'activos', 'metas', 'habitos', 'habitos_log', 'diario_financiero', 'cierres_semanales',
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

// ── PUSH (recordatorio nocturno) ────────────────────────────────────────
// Guarda o actualiza la suscripción push de este dispositivo/navegador.
// `endpoint` es único por dispositivo — si ya existe (el usuario vuelve a
// activar el recordatorio en el mismo navegador), simplemente se
// actualiza en vez de duplicar la fila.
export const guardarSuscripcionPush = async ({ endpoint, p256dh, authKey }) => {
  const userId = await getUserId();
  const { error } = await supabase.from('push_subscriptions').upsert({
    usuario_id: userId,
    endpoint,
    p256dh,
    auth_key: authKey,
  }, { onConflict: 'endpoint' });
  if (error) throw error;
};

export const eliminarSuscripcionPush = async (endpoint) => {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
};
