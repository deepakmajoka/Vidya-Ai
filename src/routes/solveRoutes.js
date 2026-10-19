// src/routes/solveRoutes.js
const express = require('express');
const router = express.Router();
const { uploadImage, uploadPdf } = require('../middleware/upload');
const { solveImageQuestion, solvePdfQuestion } = require('../controllers/solveController');

router.post('/image', uploadImage, solveImageQuestion);
router.post('/pdf', uploadPdf, solvePdfQuestion);

module.exports = router;
