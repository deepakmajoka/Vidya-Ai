const SUPPORTED_LANGUAGES = Object.freeze([
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bilingual', name: 'Bilingual (English + Hindi)' },
  { code: 'hinglish', name: 'Hinglish' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'gu', name: 'Gujarati' }
]);

const LANGUAGE_NAMES = Object.freeze(Object.fromEntries(
  SUPPORTED_LANGUAGES.map(({ code, name }) => [code, name])
));

module.exports = { SUPPORTED_LANGUAGES, LANGUAGE_NAMES };
