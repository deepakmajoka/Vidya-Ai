const express = require('express');
const { generateQuiz, evaluateQuiz } = require('../controllers/quizController');

const router = express.Router();

router.post('/generate', generateQuiz);
router.post('/evaluate', evaluateQuiz);

module.exports = router;
