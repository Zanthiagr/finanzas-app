const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        moneda VARCHAR(10) DEFAULT 'COP',
        nivel_academia INT DEFAULT 1,
        puntos_xp INT DEFAULT 0,
        racha_dias INT DEFAULT 0,
        ultima_racha DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS movimientos (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        monto DECIMAL(15,2) NOT NULL,
        categoria VARCHAR(50) NOT NULL,
        descripcion VARCHAR(200),
        fecha DATE NOT NULL DEFAULT CURRENT_DATE,
        semana_num INT,
        mes_num INT,
        anio_num INT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(50) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        icono VARCHAR(50) DEFAULT 'ti-tag',
        color VARCHAR(20) DEFAULT '#4A9E72'
      );

      CREATE TABLE IF NOT EXISTS deudas (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        monto_total DECIMAL(15,2) NOT NULL,
        monto_pagado DECIMAL(15,2) DEFAULT 0,
        tasa_interes DECIMAL(5,2) DEFAULT 0,
        fecha_limite DATE,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activos (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        valor_inicial DECIMAL(15,2) NOT NULL,
        valor_actual DECIMAL(15,2) NOT NULL,
        fecha_adquisicion DATE,
        descripcion VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS metas (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(300),
        monto_objetivo DECIMAL(15,2) NOT NULL,
        monto_actual DECIMAL(15,2) DEFAULT 0,
        fecha_limite DATE,
        icono VARCHAR(50) DEFAULT 'ti-target',
        completada BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cierres_semanales (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        semana_num INT NOT NULL,
        mes_num INT NOT NULL,
        anio_num INT NOT NULL,
        total_ingresos DECIMAL(15,2) DEFAULT 0,
        total_gastos DECIMAL(15,2) DEFAULT 0,
        balance DECIMAL(15,2) DEFAULT 0,
        reflexion TEXT,
        estado VARCHAR(20) DEFAULT 'pendiente',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_id, semana_num, anio_num)
      );

      CREATE TABLE IF NOT EXISTS habitos (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(200),
        momento VARCHAR(30) DEFAULT 'cualquier_momento',
        puntos INT DEFAULT 10,
        activo BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS habitos_log (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        habito_id INT REFERENCES habitos(id) ON DELETE CASCADE,
        fecha DATE DEFAULT CURRENT_DATE,
        completado BOOLEAN DEFAULT FALSE,
        UNIQUE(usuario_id, habito_id, fecha)
      );

      CREATE TABLE IF NOT EXISTS diario_financiero (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        pregunta VARCHAR(300),
        respuesta TEXT,
        semana_num INT,
        anio_num INT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
      CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo);
    `);

    await client.query(`
      INSERT INTO categorias (usuario_id, nombre, tipo, icono, color)
      SELECT NULL, nombre, tipo, icono, color FROM (VALUES
        ('Salario', 'ingreso', 'ti-briefcase', '#2D6B4A'),
        ('Freelance', 'ingreso', 'ti-device-laptop', '#2D6B4A'),
        ('Negocio', 'ingreso', 'ti-building-store', '#2D6B4A'),
        ('Alimentación', 'gasto', 'ti-shopping-cart', '#E24B4A'),
        ('Transporte', 'gasto', 'ti-bus', '#378ADD'),
        ('Servicios', 'gasto', 'ti-wifi', '#7F77DD'),
        ('Salud', 'gasto', 'ti-heart-rate-monitor', '#D4537E'),
        ('Educación', 'gasto', 'ti-school', '#BA7517'),
        ('Entretenimiento', 'gasto', 'ti-device-tv', '#D85A30'),
        ('Ropa', 'gasto', 'ti-shirt', '#1D9E75'),
        ('Vivienda', 'gasto', 'ti-home', '#5F5E5A'),
        ('Deudas', 'gasto', 'ti-credit-card', '#A32D2D')
      ) AS t(nombre, tipo, icono, color)
      WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE usuario_id IS NULL LIMIT 1)
    `);

    console.log('Base de datos inicializada correctamente');
  } catch (err) {
    console.error('Error inicializando DB:', err.message);
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
