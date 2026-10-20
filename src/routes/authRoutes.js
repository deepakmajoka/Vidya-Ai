const express = require('express');
const { register, login } = require('../controllers/authController');
const { authRateLimit } = require('../middlewares/deviceAuth');

const router = express.Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);

module.exports = router;
