const GeminiService = require('../services/geminiService');
const ApiResponse = require('../utils/apiResponse');

const normalizeAnswer = (answer) => {
  if (typeof answer !== 'string') return '';
  const normalized = answer.trim().toUpperCase();
  const optionLabel = normalized.match(/^([A-D])(?:\)|\.|:|\s|$)/);
  return optionLabel ? optionLabel[1] : normalized;
};

exports.generateQuiz = async (req, res) => {
  const {
    topic,
    subject,
    count = 10,
    language = 'English',
    isCurrentAffairs = false
  } = req.body || {};

  if (typeof topic !== 'string' || !topic.trim()) {
    return ApiResponse.error(res, 'topic must be a non-empty string', 400);
  }
  if (subject !== undefined && (typeof subject !== 'string' || !subject.trim())) {
    return ApiResponse.error(res, 'subject must be a non-empty string when provided', 400);
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return ApiResponse.error(res, 'count must be an integer between 1 and 50', 400);
  }
  if (typeof language !== 'string' || !language.trim()) {
    return ApiResponse.error(res, 'language must be a non-empty string', 400);
  }
  if (typeof isCurrentAffairs !== 'boolean') {
    return ApiResponse.error(res, 'isCurrentAffairs must be a boolean', 400);
  }

  try {
    const quiz = await GeminiService.generateQuiz({
      topic: topic.trim(),
      subject: subject?.trim(),
      count,
      language: language.trim(),
      isCurrentAffairs
    });

    return ApiResponse.success(res, quiz, 'Quiz generated successfully');
  } catch (error) {
    console.error('Quiz Generation Error:', error);
    return ApiResponse.error(res, error.message || 'Failed to generate quiz', 500);
  }
};

exports.evaluateQuiz = (req, res) => {
  const { questions, answers } = req.body || {};

  if (!Array.isArray(questions) || questions.length === 0) {
    return ApiResponse.error(res, 'questions must be a non-empty array', 400);
  }
  if (!Array.isArray(answers)) {
    return ApiResponse.error(res, 'answers must be an array', 400);
  }

  const answersByIndex = new Map();
  for (const answer of answers) {
    if (!Number.isInteger(answer?.questionIndex)
      || answer.questionIndex < 0
      || answer.questionIndex >= questions.length
      || typeof answer.selectedAnswer !== 'string') {
      return ApiResponse.error(
        res,
        'Each answer must include a valid questionIndex and string selectedAnswer',
        400
      );
    }
    if (answersByIndex.has(answer.questionIndex)) {
      return ApiResponse.error(res, 'Duplicate questionIndex values are not allowed', 400);
    }
    answersByIndex.set(answer.questionIndex, answer.selectedAnswer);
  }

  for (const question of questions) {
    if (!question || typeof question.correctAnswer !== 'string') {
      return ApiResponse.error(res, 'Each question must include a string correctAnswer', 400);
    }
  }

  const review = questions.map((question, questionIndex) => {
    const selectedAnswer = answersByIndex.get(questionIndex) ?? null;
    const isCorrect = selectedAnswer !== null
      && normalizeAnswer(selectedAnswer) === normalizeAnswer(question.correctAnswer);

    return {
      questionIndex,
      question: question.question || '',
      options: question.options || [],
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation || ''
    };
  });
  const totalQuestions = questions.length;
  const score = review.filter((item) => item.isCorrect).length;

  return ApiResponse.success(res, {
    totalQuestions,
    score,
    percentage: Number(((score / totalQuestions) * 100).toFixed(2)),
    review
  }, 'Quiz evaluated successfully');
};
