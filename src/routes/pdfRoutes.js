const express = require('express');
const { uploadImage, uploadPdf } = require('../middleware/upload');
const { guestScanQuota, scanRateLimit } = require('../middlewares/deviceAuth');
const {
  generateCleanPdf,
  generatePdfFromImage,
  generatePdfFromPdf
} = require('../controllers/pdfController');

const router = express.Router();

router.post('/clean-generate', scanRateLimit, guestScanQuota, generateCleanPdf);
router.post('/from-image', scanRateLimit, guestScanQuota, uploadImage, generatePdfFromImage);
router.post('/from-pdf', scanRateLimit, guestScanQuota, uploadPdf, generatePdfFromPdf);

module.exports = router;
