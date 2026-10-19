const PdfService = require('../services/pdfService');
const GeminiService = require('../services/geminiService');
const { optimizeImage } = require('../services/imageService');
const ApiResponse = require('../utils/apiResponse');

const validateModeAndLanguage = (body = {}) => {
  const mode = body.mode || 'with_solution';
  const targetLanguage = body.targetLanguage ?? body.language ?? null;

  if (!['with_solution', 'without_solution'].includes(mode)) {
    return { error: 'mode must be with_solution or without_solution' };
  }
  if (targetLanguage !== null
    && (typeof targetLanguage !== 'string' || !targetLanguage.trim())) {
    return { error: 'language must be a non-empty string when provided' };
  }

  return {
    mode,
    targetLanguage: targetLanguage ? targetLanguage.trim() : null
  };
};

const sendPdfDownload = (res, pdfBuffer, filename) => {
  const safeFilename = String(filename)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'vidya-ai-export';

  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.send(pdfBuffer);
};

const titleForMode = (mode) => (
  mode === 'without_solution' ? 'Practice Sheet' : 'Solution Sheet'
);

exports.generateCleanPdf = async (req, res) => {
  const {
    title = 'Solution Sheet',
    subject = 'General',
    language = 'English',
    mode = 'with_solution',
    questionsWithSolutions
  } = req.body || {};

  if (!Array.isArray(questionsWithSolutions)) {
    return ApiResponse.error(res, 'questionsWithSolutions must be an array', 400);
  }
  const options = validateModeAndLanguage({ mode, language });
  if (options.error) {
    return ApiResponse.error(res, options.error, 400);
  }

  try {
    const pdfBuffer = await PdfService.generateCleanPdf({
      title,
      subject,
      language,
      questionsWithSolutions,
      mode
    });
    return sendPdfDownload(res, pdfBuffer, title);
  } catch (error) {
    console.error('Clean PDF Generation Error:', error);
    return ApiResponse.error(res, error.message || 'Failed to generate PDF', 500);
  }
};

exports.generatePdfFromImage = async (req, res) => {
  if (!req.file) {
    return ApiResponse.error(res, 'Please upload an image file', 400);
  }

  const options = validateModeAndLanguage(req.body);
  if (options.error) {
    return ApiResponse.error(res, options.error, 400);
  }

  try {
    const optimizedImage = await optimizeImage(req.file.buffer);
    const solvedQuestion = await GeminiService.solveFromImage(
      optimizedImage.buffer,
      optimizedImage.mimeType,
      options.targetLanguage,
      options.mode
    );
    const subject = solvedQuestion.topic || solvedQuestion.subject || 'Question Sheet';
    const language = options.targetLanguage || solvedQuestion.sourceLanguage || 'English';
    const pdfBuffer = await PdfService.generateCleanPdf({
      title: titleForMode(options.mode),
      subject,
      language,
      mode: options.mode,
      questionsWithSolutions: [{
        question: solvedQuestion.extractedQuestion,
        steps: solvedQuestion.steps,
        finalAnswer: solvedQuestion.finalAnswer,
        correctOption: solvedQuestion.correctOption
      }]
    });

    return sendPdfDownload(res, pdfBuffer, `${subject}-${titleForMode(options.mode)}`);
  } catch (error) {
    console.error('Image-to-PDF Export Error:', error);
    return ApiResponse.error(res, error.message || 'Failed to generate PDF from image', 500);
  }
};

exports.generatePdfFromPdf = async (req, res) => {
  if (!req.file) {
    return ApiResponse.error(res, 'Please upload a PDF, Word, or text document', 400);
  }

  const options = validateModeAndLanguage(req.body);
  if (options.error) {
    return ApiResponse.error(res, options.error, 400);
  }

  try {
    const { text } = await PdfService.extractTextFromDocument(
      req.file.buffer,
      req.file.originalname
    );
    if (!text || !text.trim()) {
      return ApiResponse.error(res, 'No extractable text was found in the document', 422);
    }

    const solvedPdf = await GeminiService.solveFromPdfText(
      text,
      options.targetLanguage,
      options.mode
    );
    if (!Array.isArray(solvedPdf.questions) || solvedPdf.questions.length === 0) {
      return ApiResponse.error(res, 'No questions were identified in the PDF', 422);
    }

    const subject = solvedPdf.questions.find((question) => question.topic || question.subject);
    const language = options.targetLanguage
      || solvedPdf.questions.find((question) => question.sourceLanguage)?.sourceLanguage
      || 'English';
    const pdfBuffer = await PdfService.generateCleanPdf({
      title: titleForMode(options.mode),
      subject: subject?.topic || subject?.subject || 'Question Sheet',
      language,
      mode: options.mode,
      questionsWithSolutions: solvedPdf.questions
    });

    return sendPdfDownload(res, pdfBuffer, titleForMode(options.mode));
  } catch (error) {
    console.error('PDF-to-PDF Export Error:', error);
    return ApiResponse.error(res, error.message || 'Failed to generate clean PDF', 500);
  }
};
