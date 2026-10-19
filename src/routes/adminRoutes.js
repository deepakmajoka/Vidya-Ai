const express = require('express');
const { resetDevice } = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middlewares/deviceAuth');

const router = express.Router();

router.post('/reset-device', requireAuth, requireAdmin, resetDevice);

module.exports = router;
