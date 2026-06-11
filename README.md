# Fintual — App de Finanzas Personales

> No es una app de finanzas. Es tu camino a la libertad financiera.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Auth | JWT (JSON Web Tokens) |
| Gráficas | Recharts |

---

## Estructura del proyecto

```
finanzas-app/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Lógica de negocio
│   │   ├── db/              # Conexión y esquema PostgreSQL
│   │   ├── middleware/       # Autenticación JWT
│   │   ├── routes/          # Rutas de la API
│   │   └── index.js         # Servidor Express
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── layout/      # Sidebar + Topbar
    │   ├── context/         # AuthContext (estado global)
    │   ├── pages/           # Dashboard, Movimientos, Cierre, etc.
    │   ├── utils/           # API client, helpers, formatos COP
    │   ├── App.jsx          # Router principal
    │   └── main.jsx         # Entry point
    ├── tailwind.config.js
    └── package.json
```

---

## Configuración inicial

### 1. Base de datos PostgreSQL

```sql
-- Crea la base de datos
CREATE DATABASE finanzas_db;
```

> Las tablas se crean automáticamente al iniciar el servidor por primera vez.

### 2. Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env

# Editar .env con tus credenciales:
# DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/finanzas_db
# JWT_SECRET=una_clave_larga_y_segura_aqui

# Iniciar en desarrollo
npm run dev

# Iniciar en producción
npm start
```

El servidor corre en `http://localhost:5000`

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev

# Construir para producción
npm run build
```

La app corre en `http://localhost:3000`

---

## API Reference

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Obtener usuario actual |

### Movimientos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/movimientos` | Listar movimientos (filtros: mes, anio, tipo) |
| GET | `/api/movimientos/resumen` | Resumen con totales y gráficas |
| POST | `/api/movimientos` | Crear movimiento |
| PUT | `/api/movimientos/:id` | Editar movimiento |
| DELETE | `/api/movimientos/:id` | Eliminar movimiento |

### Patrimonio
| Ruta base | Descripción |
|-----------|-------------|
| `/api/activos` | CRUD de activos |
| `/api/deudas` | CRUD de deudas |
| `/api/metas` | CRUD de metas de ahorro |

### Mental & Hábitos
| Ruta | Descripción |
|------|-------------|
| GET `/api/habitos` | Hábitos del día con estado completado |
| POST `/api/habitos/:id/toggle` | Marcar/desmarcar hábito |
| GET/POST `/api/diario` | Entradas del diario financiero |
| GET/POST `/api/cierres` | Cierres semanales |

---

## Funcionalidades incluidas

### Dashboard
- Indicador de salud financiera (0-100)
- KPIs: ingresos, gastos, balance, movimientos
- Gráfica de barras ingresos vs gastos por semana
- Donut de gastos por categoría
- Últimos movimientos

### Movimientos
- Registro rápido de ingresos y gastos
- Categorías con íconos y colores
- Filtros por tipo
- Edición y eliminación inline

### Cierre semanal
- Vista de 4 semanas del mes
- Reflexión guiada con preguntas rotativas
- Cálculo automático de tasa de ahorro

### Activos, Deudas y Metas
- CRUD completo para cada sección
- Barras de progreso visuales
- Abonos parciales en deudas

### Mentalidad
- Frases inspiracionales rotativas
- Sistema de hábitos con puntos XP
- Creencias limitantes vs potenciadoras
- Afirmaciones marcables
- Diario financiero con preguntas guía

### Academia
- 4 módulos: Tarjetas, Deuda buena/mala, Inversiones, Activos/Pasivos
- Calculadoras interactivas con sliders
- Sistema de quiz con retroalimentación

---

## Deploy

### Railway (recomendado)
1. Sube el código a GitHub
2. En Railway: "New Project" → conecta tu repo
3. Configura las variables de entorno del `.env`
4. Railway detecta automáticamente Node.js

### Variables de entorno en producción
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production
FRONTEND_URL=https://tu-dominio.com
PORT=5000
```

---

## Próximos pasos sugeridos

- [ ] Integrar IA asistente (Claude API) como coach financiero
- [ ] Notificaciones push para hábitos y cierres
- [ ] Exportar reportes en PDF
- [ ] App móvil con React Native
- [ ] Modo multi-moneda
- [ ] Compartir metas con comunidad

