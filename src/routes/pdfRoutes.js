const express = require('express');
const { uploadImage, uploadPdf } = require('../middleware/upload');
const {
  generateCleanPdf,
  generatePdfFromImage,
  generatePdfFromPdf
} = require('../controllers/pdfController');

const router = express.Router();

router.post('/clean-generate', generateCleanPdf);
router.post('/from-image', uploadImage, generatePdfFromImage);
router.post('/from-pdf', uploadPdf, generatePdfFromPdf);

module.exports = router;
