const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const { LANGUAGE_NAMES } = require('../constants/languages');

const DEFAULT_UNICODE_FONT = path.resolve(
  __dirname,
  '../../assets/fonts/NotoSansDevanagari-Regular.ttf'
);

const cleanLatexForPdf = (text) => {
  let output = String(text ?? '');
  const slash = String.fromCharCode(92);
  const escapedSlash = slash + slash;

  output = output
    .replaceAll(escapedSlash, '')
    .replace(new RegExp(escapedSlash + 'text\\{([^{}]*)\\}', 'g'), '$1')
    .replace(new RegExp(escapedSlash + 'mathrm\\{([^{}]*)\\}', 'g'), '$1')
    .replace(new RegExp(escapedSlash + 'mathbf\\{([^{}]*)\\}', 'g'), '$1')
    .replace(new RegExp(escapedSlash + 'frac\\{([^{}]*)\\}\\{([^{}]*)\\}', 'g'), '$1/$2')
    .replace(new RegExp(escapedSlash + 'sqrt\\{([^{}]*)\\}', 'g'), '√($1)');

  const symbols = [
    ['\\neq', '≠'],
    ['\\ne', '≠'],
    ['\\leq', '≤'],
    ['\\le', '≤'],
    ['\\geq', '≥'],
    ['\\ge', '≥'],
    ['\\approx', '≈'],
    ['\\equiv', '≡'],
    ['\\infty', '∞'],
    ['\\times', '×'],
    ['\\cdot', '·'],
    ['\\div', '÷'],
    ['\\pm', '±'],
    ['\\mp', '∓'],
    ['\\pi', 'π'],
    ['\\theta', 'θ'],
    ['\\alpha', 'α'],
    ['\\beta', 'β'],
    ['\\gamma', 'γ'],
    ['\\Delta', 'Δ'],
    ['\\sum', '∑'],
    ['\\int', '∫'],
    ['\\ldots', '…'],
    ['\\rightarrow', '→'],
    ['\\to', '→'],
    ['\\degree', '°'],
    ['\\circ', '°'],
    ['\\%', '%'],
    ['\\_', '_'],
    ['\\&', '&']
  ];
  for (const [latex, unicode] of symbols) {
    output = output.replaceAll(latex, unicode);
  }

  return output
    .replace(new RegExp(escapedSlash + '(left|right|displaystyle|textstyle)\\b', 'g'), '')
    .replace(new RegExp(escapedSlash + '[,;:!]', 'g'), ' ')
    .replace(new RegExp(escapedSlash + '[()\\[\\]]', 'g'), '')
    .replace(new RegExp(escapedSlash + '(?=[A-Za-z])', 'g'), '')
    .replace(/[$]/g, '')
    .replace(/[{}]/g, '')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const resolveFont = (doc) => {
  const candidates = [process.env.PDF_FONT_PATH, DEFAULT_UNICODE_FONT]
    .filter(Boolean)
    .map((fontPath) => path.resolve(fontPath));

  for (const fontPath of candidates) {
    try {
      if (fs.statSync(fontPath).isFile()) {
        doc.registerFont('VidyaUnicode', fontPath);
        return 'VidyaUnicode';
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        console.warn(`Could not use PDF font at ${fontPath}; trying the next font.`, error.message);
      }
    }
  }

  return 'Helvetica';
};

const extractTextFromPdf = async (pdfBuffer) => {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new TypeError('A non-empty PDF buffer is required.');
  }

  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    const info = infoResult.info || {};

    return {
      text: textResult.text,
      metadata: {
        title: info.Title || info.title || null,
        author: info.Author || info.author || null,
        subject: info.Subject || info.subject || null,
        creator: info.Creator || info.creator || null,
        producer: info.Producer || info.producer || null,
        creationDate: info.CreationDate || info.creationDate || null,
        modificationDate: info.ModDate || info.modificationDate || null,
        pageCount: infoResult.total,
        dates: typeof infoResult.getDateNode === 'function'
          ? infoResult.getDateNode()
          : null
      }
    };
  } finally {
    await parser.destroy();
  }
};

const extractTextFromDocument = async (buffer, originalName) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('A non-empty document buffer is required.');
  }
  const extension = path.extname(originalName || '').toLowerCase();
  if (extension === '.pdf') return extractTextFromPdf(buffer);
  if (extension === '.txt') return { text: buffer.toString('utf8'), metadata: {} };
  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, metadata: {} };
  }
  if (extension === '.doc') {
    const extractor = new WordExtractor();
    const document = await extractor.extract(buffer);
    return { text: document.getBody(), metadata: {} };
  }
  throw new TypeError('Unsupported document type.');
};

const generateCleanPdf = ({
  title,
  subject = 'General',
  language = 'English',
  questionsWithSolutions = [],
  mode = 'with_solution'
} = {}) => new Promise((resolve, reject) => {
  if (!Array.isArray(questionsWithSolutions)) {
    reject(new TypeError('questionsWithSolutions must be an array.'));
    return;
  }
  if (!['with_solution', 'without_solution'].includes(mode)) {
    reject(new TypeError('mode must be with_solution or without_solution.'));
    return;
  }

  const isPracticeSheet = mode === 'without_solution';
  const documentTitle = title || (isPracticeSheet ? 'Practice Sheet' : 'Solution Sheet');
  const headerTitle = isPracticeSheet
    ? 'Vidya AI - Practice Sheet'
    : 'Vidya AI - Solution Sheet';

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 64, right: 54, bottom: 58, left: 54 },
    info: {
      Title: headerTitle,
      Subject: subject,
      Author: 'Vidya AI'
    }
  });
  const chunks = [];
  const fontName = resolveFont(doc);
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const generatedDate = new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date());
  const languageCode = String(language).toLowerCase();
  const languageLabel = LANGUAGE_NAMES[languageCode] || language;
  const isBilingual = languageCode === 'bilingual';

  const drawHeader = () => {
    doc.font(fontName).fillColor('#17324d');
    doc.fontSize(17).text(headerTitle, { continued: false });
    doc.moveDown(0.15);
    doc.fontSize(12).text(documentTitle, { continued: false });
    doc.fontSize(9).fillColor('#526579')
      .text(`Topic: ${subject}   |   Date: ${generatedDate}   |   Language: ${languageLabel}`);
    const ruleY = doc.y + 8;
    doc.moveTo(doc.page.margins.left, ruleY)
      .lineTo(doc.page.width - doc.page.margins.right, ruleY)
      .lineWidth(1)
      .strokeColor('#d6e0e8')
      .stroke();
    doc.y = ruleY + 18;
    doc.fillColor('#202b36');
  };

  doc.on('pageAdded', drawHeader);
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));

  try {
    if (fontName === 'Helvetica' && language.toLowerCase() !== 'english') {
      console.warn('No Unicode PDF font found. Helvetica fallback may not render all requested language glyphs. Set PDF_FONT_PATH or add assets/fonts/NotoSansDevanagari-Regular.ttf.');
    }

    drawHeader();

    questionsWithSolutions.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new TypeError(`Question ${index + 1} must be an object.`);
      }
      const question = item.question || item.extractedQuestion || item.questionText || '';
      const options = Array.isArray(item.options) ? item.options : [];

      doc.font(fontName).fillColor('#17324d').fontSize(12)
        .text(isBilingual
          ? `Question ${index + 1} / प्रश्न ${index + 1}`
          : `Question ${index + 1}`, { width: contentWidth });
      doc.moveDown(0.3);
      doc.font(fontName).fillColor('#202b36').fontSize(10)
        .text(cleanLatexForPdf(question), { width: contentWidth });
      options.forEach((option, optionIndex) => {
        const cleanedOption = cleanLatexForPdf(option);
        const optionLabel = String.fromCharCode(65 + optionIndex) + ') ';
        const formattedOption = /^[A-D][).]\s/i.test(cleanedOption)
          ? cleanedOption
          : optionLabel + cleanedOption;
        doc.font(fontName).fillColor('#202b36').fontSize(10)
          .text(formattedOption, {
            width: contentWidth,
            indent: 8,
            paragraphGap: 2
          });
      });
      doc.moveDown(0.35);

      if (isPracticeSheet) {
        doc.moveDown(0.5);
        return;
      }

      const steps = item.steps || item.solution?.steps || [];
      const finalAnswer = item.finalAnswer || item.solution?.finalAnswer || '';
      doc.font(fontName).fillColor('#17324d').fontSize(10)
      .text(isBilingual
        ? 'Step-by-step solution / चरण-दर-चरण समाधान'
        : 'Step-by-step solution', { width: contentWidth });
      doc.moveDown(0.2);

      const solutionSteps = Array.isArray(steps) ? steps : [steps];
      solutionSteps.forEach((step, stepIndex) => {
        doc.font(fontName).fillColor('#202b36').fontSize(10)
        .text(`${stepIndex + 1}. ${cleanLatexForPdf(step)}`, {
            width: contentWidth,
            indent: 8,
            paragraphGap: 3
          });
      });

      const answerText = cleanLatexForPdf(finalAnswer || 'Not provided');
      const boxPadding = 10;
      const answerHeight = doc.heightOfString(answerText, {
        width: contentWidth - boxPadding * 2,
        font: fontName,
        fontSize: 10
      }) + boxPadding * 2 + 14;
      const pageBottom = doc.page.height - doc.page.margins.bottom;

      if (doc.y + answerHeight > pageBottom) {
        doc.addPage();
      }

      const boxTop = doc.y + 4;
      doc.roundedRect(doc.page.margins.left, boxTop, contentWidth, answerHeight, 5)
        .fillAndStroke('#eef6fb', '#c9dce9');
      doc.font(fontName).fillColor('#17324d').fontSize(9)
        .text(isBilingual ? 'Final Answer / अंतिम उत्तर' : 'Final Answer', doc.page.margins.left + boxPadding, boxTop + boxPadding, {
          width: contentWidth - boxPadding * 2
        });
      doc.font(fontName).fillColor('#202b36').fontSize(10)
        .text(answerText, doc.page.margins.left + boxPadding, doc.y + 3, {
          width: contentWidth - boxPadding * 2
        });
      doc.y = boxTop + answerHeight + 14;
    });

    doc.end();
  } catch (error) {
    reject(error);
  }
});

module.exports = { extractTextFromPdf, extractTextFromDocument, generateCleanPdf };
