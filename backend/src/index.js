require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

app.use('/api', routes);

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const start = async () => {
  await initDB();
  app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
};

start();
