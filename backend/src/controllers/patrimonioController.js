const { pool } = require('../db');

// ── DEUDAS ──────────────────────────────────────────────
const getDeudas = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deudas WHERE usuario_id=$1 ORDER BY activa DESC, created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error obteniendo deudas' }); }
};

const createDeuda = async (req, res) => {
  const { nombre, tipo, monto_total, tasa_interes, fecha_limite } = req.body;
  if (!nombre || !tipo || !monto_total) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO deudas (usuario_id, nombre, tipo, monto_total, tasa_interes, fecha_limite)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, nombre, tipo, monto_total, tasa_interes || 0, fecha_limite || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error creando deuda' }); }
};

const updateDeuda = async (req, res) => {
  const { id } = req.params;
  const { nombre, monto_pagado, activa } = req.body;
  try {
    const result = await pool.query(
      'UPDATE deudas SET nombre=$1, monto_pagado=$2, activa=$3 WHERE id=$4 AND usuario_id=$5 RETURNING *',
      [nombre, monto_pagado, activa, id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Deuda no encontrada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error actualizando deuda' }); }
};

const deleteDeuda = async (req, res) => {
  await pool.query('DELETE FROM deudas WHERE id=$1 AND usuario_id=$2', [req.params.id, req.userId]);
  res.json({ deleted: true });
};

// ── ACTIVOS ──────────────────────────────────────────────
const getActivos = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM activos WHERE usuario_id=$1 ORDER BY created_at DESC', [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error obteniendo activos' }); }
};

const createActivo = async (req, res) => {
  const { nombre, tipo, valor_inicial, valor_actual, fecha_adquisicion, descripcion } = req.body;
  if (!nombre || !tipo || !valor_inicial) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO activos (usuario_id, nombre, tipo, valor_inicial, valor_actual, fecha_adquisicion, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.userId, nombre, tipo, valor_inicial, valor_actual || valor_inicial, fecha_adquisicion || null, descripcion || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error creando activo' }); }
};

const updateActivo = async (req, res) => {
  const { id } = req.params;
  const { nombre, valor_actual, descripcion } = req.body;
  try {
    const result = await pool.query(
      'UPDATE activos SET nombre=$1, valor_actual=$2, descripcion=$3 WHERE id=$4 AND usuario_id=$5 RETURNING *',
      [nombre, valor_actual, descripcion, id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error actualizando activo' }); }
};

const deleteActivo = async (req, res) => {
  await pool.query('DELETE FROM activos WHERE id=$1 AND usuario_id=$2', [req.params.id, req.userId]);
  res.json({ deleted: true });
};

// ── METAS ──────────────────────────────────────────────
const getMetas = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM metas WHERE usuario_id=$1 ORDER BY completada ASC, fecha_limite ASC', [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error obteniendo metas' }); }
};

const createMeta = async (req, res) => {
  const { nombre, descripcion, monto_objetivo, fecha_limite, icono } = req.body;
  if (!nombre || !monto_objetivo) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO metas (usuario_id, nombre, descripcion, monto_objetivo, fecha_limite, icono)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, nombre, descripcion || '', monto_objetivo, fecha_limite || null, icono || 'ti-target']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error creando meta' }); }
};

const updateMeta = async (req, res) => {
  const { id } = req.params;
  const { nombre, monto_actual, completada } = req.body;
  try {
    const result = await pool.query(
      'UPDATE metas SET nombre=$1, monto_actual=$2, completada=$3 WHERE id=$4 AND usuario_id=$5 RETURNING *',
      [nombre, monto_actual, completada, id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error actualizando meta' }); }
};

const deleteMeta = async (req, res) => {
  await pool.query('DELETE FROM metas WHERE id=$1 AND usuario_id=$2', [req.params.id, req.userId]);
  res.json({ deleted: true });
};

module.exports = {
  getDeudas, createDeuda, updateDeuda, deleteDeuda,
  getActivos, createActivo, updateActivo, deleteActivo,
  getMetas, createMeta, updateMeta, deleteMeta,
};
