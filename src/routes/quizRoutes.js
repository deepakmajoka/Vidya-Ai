const express = require('express');
const { generateQuiz, evaluateQuiz } = require('../controllers/quizController');
const { guestScanQuota, scanRateLimit } = require('../middlewares/deviceAuth');

const router = express.Router();

router.post('/generate', scanRateLimit, guestScanQuota, generateQuiz);
router.post('/evaluate', evaluateQuiz);

module.exports = router;
