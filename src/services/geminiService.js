const ai = require('../config/gemini');
const { LANGUAGE_NAMES } = require('../constants/languages');

const MODEL = 'gemini-3.8-flash';

const universalSolverResponseSchema = {
  type: 'OBJECT',
  properties: {
    detectedSubject: {
      type: 'STRING',
      enum: ['Math', 'Reasoning', 'English', 'GK', 'Current Affairs']
    },
    questionText: { type: 'STRING' },
    correctOption: { type: 'STRING' },
    stepByStepSolution: { type: 'STRING' },
    keyTakeaway: { type: 'STRING' }
  },
  required: ['detectedSubject', 'questionText', 'correctOption', 'stepByStepSolution', 'keyTakeaway']
};

const visionResponseSchema = {
  type: 'OBJECT',
  properties: {
    extractedQuestion: { type: 'STRING' },
    subject: { type: 'STRING' },
    topic: { type: 'STRING' },
    sourceLanguage: { type: 'STRING' },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    finalAnswer: { type: 'STRING' },
    correctOption: { type: 'STRING' }
  },
  required: ['extractedQuestion', 'subject', 'topic', 'sourceLanguage', 'steps', 'finalAnswer', 'correctOption']
};

const pdfSolutionsResponseSchema = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          subject: { type: 'STRING' },
          topic: { type: 'STRING' },
          sourceLanguage: { type: 'STRING' },
          steps: { type: 'ARRAY', items: { type: 'STRING' } },
          finalAnswer: { type: 'STRING' },
          correctOption: { type: 'STRING' }
        },
        required: ['question', 'subject', 'topic', 'sourceLanguage', 'steps', 'finalAnswer', 'correctOption']
      }
    }
  },
  required: ['questions']
};

const createQuizResponseSchema = (count) => ({
  type: 'OBJECT',
  properties: {
    topic: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      minItems: count,
      maxItems: count,
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            minItems: 4,
            maxItems: 4,
            items: { type: 'STRING' }
          },
          correctAnswer: { type: 'STRING', enum: ['A', 'B', 'C', 'D'] },
          explanation: { type: 'STRING' }
        },
        required: ['question', 'options', 'correctAnswer', 'explanation']
      }
    }
  },
  required: ['topic', 'questions']
});

const parseJsonResponse = (response, operation) => {
  if (!response.text) {
    throw new Error(`Gemini returned an empty ${operation} response.`);
  }

  try {
    return JSON.parse(response.text);
  } catch (error) {
    throw new Error(`Gemini returned invalid JSON for ${operation}: ${error.message}`);
  }
};

const requestedLanguageName = (language) => LANGUAGE_NAMES[
  String(language || '').toLowerCase()
] || language;

class GeminiService {
  static async solveUniversal({ text, imageBuffer, mimeType, language = 'English' } = {}) {
    if ((!text || typeof text !== 'string' || !text.trim()) && !imageBuffer) {
      throw new TypeError('A non-empty text question or image is required.');
    }
    if (imageBuffer && !mimeType) {
      throw new TypeError('An image MIME type is required when an image is provided.');
    }

    const prompt = `
You are Vidya AI, a precise, exam-focused tutor. Detect the subject of the supplied question and solve it. Choose exactly one detectedSubject from: Math, Reasoning, English, GK, Current Affairs.

SUBJECT RULES:
- Math: show the formula, substitute values, explain each calculation, and give the computed answer.
- Reasoning: explain the underlying logic or pattern and each step used to reach the answer.
- English: give the correct answer and explain the relevant grammar or vocabulary rule. For multiple-choice questions, explain why the correct option works and why each of the other three options is incorrect. If fewer than four options are supplied, explain every supplied alternative.
- GK: provide the accurate fact that answers the question and include exactly 3 to 4 concise supplementary revision bullet points in stepByStepSolution.
- Current Affairs: provide the answer with context, background, and exam relevance in stepByStepSolution. Do not invent details; state uncertainty if the supplied question lacks enough information.

Recognize and preserve the complete question and its answer options in questionText. Set correctOption to the correct option label and answer, or the direct answer when options are absent. Write the explanation and keyTakeaway in ${language}. Keep keyTakeaway concise and useful for revision. Return only a JSON object matching the exact schema; do not add fields or markdown.
`;
    const parts = [{ text: prompt }];
    if (text?.trim()) parts.push({ text: `QUESTION TEXT:\n${text.trim()}` });
    if (imageBuffer) {
      parts.push({ inlineData: { data: imageBuffer.toString('base64'), mimeType } });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: universalSolverResponseSchema
      }
    });

    return parseJsonResponse(response, 'universal solver');
  }

  /**
   * Extracts and solves every question found in parsed PDF text.
   * @param {string} extractedText
   * @param {string} language
   */
  static async solveFromPdfText(extractedText, targetLanguage = null, mode = 'with_solution') {
    if (typeof extractedText !== 'string' || !extractedText.trim()) {
      throw new TypeError('Non-empty extracted PDF text is required.');
    }
    if (!['with_solution', 'without_solution'].includes(mode)) {
      throw new TypeError('mode must be with_solution or without_solution.');
    }

    const languageInstruction = targetLanguage
      ? targetLanguage.toLowerCase() === 'bilingual'
        ? 'Write each question, every answer option, every solution step, and the final answer in both languages. Format every field as paired lines in this exact order: "English: <English text>\\nहिंदी: <Hindi translation in Devanagari>". For steps, keep one bilingual pair in each array item. Preserve formulas and meaning. Record each question\'s detected original source language in sourceLanguage.'
        : targetLanguage.toLowerCase() === 'hinglish'
          ? 'Write all questions and requested content in natural Hinglish: a conversational Hindi-English mix written in Latin script. Record each question\'s detected original source language in sourceLanguage.'
          : `Translate the questions and all requested content into ${requestedLanguageName(targetLanguage)}. For Indian regional languages, use that language in its customary script. Record each question's detected original source language in sourceLanguage.`
      : 'Detect the source language of each question and write the output in that same language. Record the detected language in sourceLanguage.';
    const solutionInstruction = mode === 'without_solution'
      ? 'This is practice mode: extract and cleanly format each question only. Do not solve questions or reveal answers. Return an empty steps array and empty strings for finalAnswer and correctOption.'
      : 'Solve each question with clear ordered steps and a concise final answer. Include the correct option letter for MCQs, or an empty string when there is no MCQ.';

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `
You are an expert educational document assistant. Read the extracted PDF text below and identify each distinct student question. Preserve the question meaning and include all relevant options when present.

LANGUAGE REQUIREMENT: ${languageInstruction}

MODE: ${mode}. ${solutionInstruction}

MATHEMATICAL FORMATTING: Preserve formulas and express mathematical notation cleanly in LaTeX. Use $...$ for inline expressions and $$...$$ for standalone equations.

Return only JSON matching the response schema.

EXTRACTED PDF TEXT:
${extractedText}
`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: pdfSolutionsResponseSchema
      }
    });

    return parseJsonResponse(response, 'PDF solution');
  }

  /**
   * Solves a question from an optimized image buffer.
   * @param {Buffer} buffer
   * @param {string} mimeType
   * @param {string} targetLanguage
   */
  static async solveFromImage(buffer, mimeType, targetLanguage = null, mode = 'with_solution') {
    if (!['with_solution', 'without_solution'].includes(mode)) {
      throw new TypeError('mode must be with_solution or without_solution.');
    }

    const languageInstruction = targetLanguage
      ? targetLanguage.toLowerCase() === 'bilingual'
        ? 'Write the question, every solution step, and final answer in both languages. Format each field as paired lines in this exact order: "English: <English text>\\nहिंदी: <Hindi translation in Devanagari>". Preserve formulas and meaning. Record the detected original language in sourceLanguage.'
        : targetLanguage.toLowerCase() === 'hinglish'
          ? 'Write all question content in natural Hinglish: a conversational Hindi-English mix written in Latin script. Record the detected original language in sourceLanguage.'
          : `Translate the question and all requested content into ${requestedLanguageName(targetLanguage)}. For Indian regional languages, use that language in its customary script. Record the detected original language in sourceLanguage.`
      : 'Detect the source language in the image and use that same language. Record it in sourceLanguage.';
    const solutionInstruction = mode === 'without_solution'
      ? 'This is practice mode: extract and cleanly format only the question and its options. Do not solve it or reveal the correct option. Return empty steps and empty strings for finalAnswer and correctOption.'
      : 'Provide a clear, numbered, step-by-step solution and concise final answer. Include the correct option letter for MCQs; otherwise use an empty string for correctOption.';
    const prompt = `
You are an expert Math and Reasoning tutor. Read the question in the supplied image and identify its subject and topic.

LANGUAGE REQUIREMENT: ${languageInstruction} Do not switch languages. If the requested language is Hinglish, use natural Hindi-English mixed wording in Latin script. Preserve proper names and symbols as needed.

MODE: ${mode}. ${solutionInstruction}

MATHEMATICAL FORMATTING: Preserve formulas and express mathematical notation cleanly in LaTeX. Use $...$ for inline expressions and $$...$$ for standalone equations. Keep each transformation readable and do not alter the mathematical meaning of the question.

Return only JSON matching the response schema.
`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: buffer.toString('base64'), mimeType } }
        ]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: visionResponseSchema
      }
    });

    return parseJsonResponse(response, 'vision solver');
  }

  /**
   * Generates a structured multiple-choice quiz.
   * Current-affairs requests use Google Search to gather facts first, then a
   * separate schema-constrained request to build the quiz from those facts.
   */
  static async generateQuiz({
    topic = 'General Knowledge',
    subject = 'General Knowledge',
    count = 10,
    language = 'English',
    isCurrentAffairs = false
  } = {}) {
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new RangeError('Quiz count must be an integer between 1 and 50.');
    }

    const quizContext = isCurrentAffairs
      ? await this.fetchCurrentAffairsFacts({ topic, subject, count, language })
      : `Create an educational quiz about ${topic} for the subject ${subject}.`;

    const prompt = `
Create exactly ${count} multiple-choice questions for the topic "${topic}" and subject "${subject}".
Write the question, answer options, and explanation strictly in ${language}.
Each question must have exactly four distinct options in the order A), B), C), D). The correctAnswer must be only its letter: A, B, C, or D. Explanations should briefly explain why that answer is correct.
${isCurrentAffairs
    ? `Use only the following Google Search-grounded facts. Do not add or infer facts that are not supported by this material:\n${quizContext}`
    : quizContext}

Return only JSON matching the response schema. Set topic to "${topic}".
`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: createQuizResponseSchema(count)
      }
    });

    return parseJsonResponse(response, 'quiz generation');
  }

  static async fetchCurrentAffairsFacts({ topic, subject, count, language }) {
    const currentDate = new Date().toISOString().slice(0, 10);
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Search the web for recent, verifiable current-affairs facts as of ${currentDate} about "${topic}" in the context of "${subject}". Gather enough distinct facts to support ${count} multiple-choice questions. Return concise factual notes in ${language}, include dates and source names or URLs where available, and distinguish confirmed facts from uncertain claims. Do not create quiz questions or guess when sources disagree.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    if (!response.text) {
      throw new Error('Google Search returned no current-affairs facts.');
    }

    return response.text;
  }
}

module.exports = GeminiService;
