const { pool } = require('../db');

const getHabitos = async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT h.*, COALESCE(hl.completado, false) as completado_hoy
       FROM habitos h
       LEFT JOIN habitos_log hl ON hl.habito_id = h.id AND hl.fecha = $2
       WHERE h.usuario_id = $1 AND h.activo = true
       ORDER BY h.id`,
      [req.userId, hoy]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error obteniendo hábitos' }); }
};

const toggleHabito = async (req, res) => {
  const { id } = req.params;
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const existing = await pool.query(
      'SELECT * FROM habitos_log WHERE usuario_id=$1 AND habito_id=$2 AND fecha=$3',
      [req.userId, id, hoy]
    );

    let completado;
    if (existing.rows.length > 0) {
      completado = !existing.rows[0].completado;
      await pool.query(
        'UPDATE habitos_log SET completado=$1 WHERE usuario_id=$2 AND habito_id=$3 AND fecha=$4',
        [completado, req.userId, id, hoy]
      );
    } else {
      completado = true;
      await pool.query(
        'INSERT INTO habitos_log (usuario_id, habito_id, fecha, completado) VALUES ($1,$2,$3,$4)',
        [req.userId, id, hoy, true]
      );
    }

    if (completado) {
      const habito = await pool.query('SELECT puntos FROM habitos WHERE id=$1', [id]);
      const pts = habito.rows[0]?.puntos || 0;
      await pool.query('UPDATE usuarios SET puntos_xp = puntos_xp + $1 WHERE id=$2', [pts, req.userId]);
    }

    res.json({ completado });
  } catch (err) { res.status(500).json({ error: 'Error actualizando hábito' }); }
};

const getDiario = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM diario_financiero WHERE usuario_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error obteniendo diario' }); }
};

const createEntradaDiario = async (req, res) => {
  const { pregunta, respuesta } = req.body;
  if (!respuesta) return res.status(400).json({ error: 'Respuesta requerida' });
  const now = new Date();
  const semana = Math.ceil(now.getDate() / 7);
  const anio = now.getFullYear();
  try {
    const result = await pool.query(
      'INSERT INTO diario_financiero (usuario_id, pregunta, respuesta, semana_num, anio_num) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.userId, pregunta || '', respuesta, semana, anio]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error guardando entrada' }); }
};

const getCierresSemana = async (req, res) => {
  const { anio } = req.query;
  const anioFinal = anio || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT cs.*,
        (SELECT SUM(monto) FROM movimientos WHERE usuario_id=$1 AND semana_num=cs.semana_num AND anio_num=cs.anio_num AND tipo='ingreso') as ingresos_calc,
        (SELECT SUM(monto) FROM movimientos WHERE usuario_id=$1 AND semana_num=cs.semana_num AND anio_num=cs.anio_num AND tipo='gasto') as gastos_calc
       FROM cierres_semanales cs WHERE cs.usuario_id=$1 AND cs.anio_num=$2 ORDER BY cs.semana_num`,
      [req.userId, anioFinal]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error obteniendo cierres' }); }
};

const crearCierre = async (req, res) => {
  const { semana_num, mes_num, anio_num, reflexion } = req.body;
  try {
    const movs = await pool.query(
      `SELECT tipo, SUM(monto) as total FROM movimientos
       WHERE usuario_id=$1 AND semana_num=$2 AND anio_num=$3 GROUP BY tipo`,
      [req.userId, semana_num, anio_num]
    );
    const ingresos = parseFloat(movs.rows.find(r => r.tipo === 'ingreso')?.total || 0);
    const gastos = parseFloat(movs.rows.find(r => r.tipo === 'gasto')?.total || 0);
    const balance = ingresos - gastos;
    const estado = balance >= 0 ? 'ok' : 'negativo';

    const result = await pool.query(
      `INSERT INTO cierres_semanales (usuario_id, semana_num, mes_num, anio_num, total_ingresos, total_gastos, balance, reflexion, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (usuario_id, semana_num, anio_num)
       DO UPDATE SET reflexion=$8, estado=$9 RETURNING *`,
      [req.userId, semana_num, mes_num, anio_num, ingresos, gastos, balance, reflexion || '', estado]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error creando cierre' }); }
};

module.exports = { getHabitos, toggleHabito, getDiario, createEntradaDiario, getCierresSemana, crearCierre };
