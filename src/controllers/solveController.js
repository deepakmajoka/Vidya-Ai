// src/controllers/solveController.js
const GeminiService = require('../services/geminiService');
const { optimizeImage } = require('../services/imageService');
const PdfService = require('../services/pdfService');
const ApiResponse = require('../utils/apiResponse');

exports.solveImageQuestion = async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'Please upload an image file', 400);
    }

    const { language = 'Hindi' } = req.body;
    const optimizedImage = await optimizeImage(req.file.buffer);

    const solutionData = await GeminiService.solveFromImage(
      optimizedImage.buffer,
      optimizedImage.mimeType,
      language
    );

    return ApiResponse.success(res, solutionData, 'Question solved successfully');
  } catch (error) {
    console.error('Solve Error:', error);
    return ApiResponse.error(res, error.message || 'Failed to solve question', 500);
  }
};

exports.solvePdfQuestion = async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'Please upload a PDF file', 400);
    }

    const { language = 'Hindi' } = req.body;
    const { text, metadata } = await PdfService.extractTextFromPdf(req.file.buffer);

    if (!text || !text.trim()) {
      return ApiResponse.error(res, 'No extractable text was found in the PDF', 422);
    }

    const solutions = await GeminiService.solveFromPdfText(text, language);

    return ApiResponse.success(
      res,
      { ...solutions, metadata },
      'PDF questions solved successfully'
    );
  } catch (error) {
    console.error('PDF Solve Error:', error);
    return ApiResponse.error(res, error.message || 'Failed to solve PDF questions', 500);
  }
};
