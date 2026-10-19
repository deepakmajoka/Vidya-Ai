// src/routes/solveRoutes.js
const express = require('express');
const router = express.Router();
const { uploadImage, uploadPdf } = require('../middleware/upload');
const { guestScanQuota, scanRateLimit } = require('../middlewares/deviceAuth');
const {
  solveImageQuestion,
  solveTextQuestion,
  solveDocumentQuestion
} = require('../controllers/solverController');

router.post('/image', scanRateLimit, guestScanQuota, uploadImage, solveImageQuestion);
router.post('/text', scanRateLimit, guestScanQuota, solveTextQuestion);
router.post('/pdf', scanRateLimit, guestScanQuota, uploadPdf, solveDocumentQuestion);

module.exports = router;
