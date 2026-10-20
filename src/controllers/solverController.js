const GeminiService = require('../services/geminiService');
const { optimizeImage } = require('../services/imageService');
const PdfService = require('../services/pdfService');
const ApiResponse = require('../utils/apiResponse');
const { LANGUAGE_NAMES } = require('../constants/languages');

const getLanguage = (body = {}) => {
  const language = body.language || 'English';
  return LANGUAGE_NAMES[String(language).toLowerCase()] || language;
};

exports.solveImageQuestion = async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'Please upload an image file.', 400);

  try {
    const image = await optimizeImage(req.file.buffer);
    const solution = await GeminiService.solveUniversal({
      imageBuffer: image.buffer,
      mimeType: image.mimeType,
      language: getLanguage(req.body)
    });
    return ApiResponse.success(res, solution, 'Question solved successfully.');
  } catch (error) {
    console.error('Image solve error:', error);
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
};

exports.solveTextQuestion = async (req, res) => {
  const questionText = req.body?.questionText ?? req.body?.text;
  if (typeof questionText !== 'string' || !questionText.trim() || questionText.length > 5000) {
    return ApiResponse.error(res, 'questionText must be a non-empty string of at most 5000 characters.', 400, 'VALIDATION_ERROR');
  }

  try {
    const solution = await GeminiService.solveUniversal({
      text: questionText.trim(),
      language: getLanguage(req.body)
    });
    return ApiResponse.success(res, solution, 'Question solved successfully.');
  } catch (error) {
    console.error('Text solve error:', error);
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
};

exports.solveDocumentQuestion = async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'Please upload a PDF, Word, or text document.', 400);

  try {
    const { text } = await PdfService.extractTextFromDocument(req.file.buffer, req.file.originalname);
    if (!text?.trim()) return ApiResponse.error(res, 'No extractable text was found in the document.', 422);

    const solution = await GeminiService.solveUniversal({ text, language: getLanguage(req.body) });
    return ApiResponse.success(res, solution, 'Document solved successfully.');
  } catch (error) {
    console.error('Document solve error:', error);
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
};
