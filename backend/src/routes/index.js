const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const movCtrl = require('../controllers/movimientosController');
const patriCtrl = require('../controllers/patrimonioController');
const mentalCtrl = require('../controllers/mentalController');

// Auth
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.me);

// Movimientos
router.get('/movimientos', auth, movCtrl.getAll);
router.post('/movimientos', auth, movCtrl.create);
router.put('/movimientos/:id', auth, movCtrl.update);
router.delete('/movimientos/:id', auth, movCtrl.remove);
router.get('/movimientos/resumen', auth, movCtrl.getResumen);

// Deudas
router.get('/deudas', auth, patriCtrl.getDeudas);
router.post('/deudas', auth, patriCtrl.createDeuda);
router.put('/deudas/:id', auth, patriCtrl.updateDeuda);
router.delete('/deudas/:id', auth, patriCtrl.deleteDeuda);

// Activos
router.get('/activos', auth, patriCtrl.getActivos);
router.post('/activos', auth, patriCtrl.createActivo);
router.put('/activos/:id', auth, patriCtrl.updateActivo);
router.delete('/activos/:id', auth, patriCtrl.deleteActivo);

// Metas
router.get('/metas', auth, patriCtrl.getMetas);
router.post('/metas', auth, patriCtrl.createMeta);
router.put('/metas/:id', auth, patriCtrl.updateMeta);
router.delete('/metas/:id', auth, patriCtrl.deleteMeta);

// Mental & hábitos
router.get('/habitos', auth, mentalCtrl.getHabitos);
router.post('/habitos/:id/toggle', auth, mentalCtrl.toggleHabito);
router.get('/diario', auth, mentalCtrl.getDiario);
router.post('/diario', auth, mentalCtrl.createEntradaDiario);

// Cierres semanales
router.get('/cierres', auth, mentalCtrl.getCierresSemana);
router.post('/cierres', auth, mentalCtrl.crearCierre);

module.exports = router;
