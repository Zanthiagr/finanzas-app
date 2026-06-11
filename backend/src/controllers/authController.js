const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const register = async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  try {
    const exists = await pool.query('SELECT id FROM usuarios WHERE email=$1', [email]);
    if (exists.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1,$2,$3) RETURNING id, nombre, email, nivel_academia, puntos_xp, racha_dias',
      [nombre, email, hash]
    );

    const user = result.rows[0];

    // Crear hábitos por defecto
    await pool.query(`
      INSERT INTO habitos (usuario_id, nombre, descripcion, momento, puntos) VALUES
      ($1, 'Leer 10 min sobre finanzas', 'Aprende algo nuevo sobre dinero cada día', 'manana', 20),
      ($1, 'Registrar gastos del día', 'Lleva el control de todo lo que gastas', 'noche', 15),
      ($1, 'Visualizar mi yo futuro', 'Imagina con claridad quién quieres ser', 'noche', 20),
      ($1, 'Afirmación en voz alta', 'Di tu afirmación financiera del día', 'cualquier_momento', 10)
    `, [user.id]);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const result = await pool.query(
      'SELECT id, nombre, email, password_hash, nivel_academia, puntos_xp, racha_dias FROM usuarios WHERE email=$1',
      [email]
    );
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    delete user.password_hash;
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, moneda, nivel_academia, puntos_xp, racha_dias, created_at FROM usuarios WHERE id=$1',
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { register, login, me };
