const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const createFileFilter = (allowedMimeTypes, allowedExtensions, label) => (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const validMimeType = allowedMimeTypes.includes(file.mimetype);
  const validExtension = allowedExtensions.includes(extension);

  if (validMimeType && validExtension) {
    return callback(null, true);
  }

  const error = new Error(`Invalid ${label} file type.`);
  error.statusCode = 400;
  error.code = 'INVALID_FILE_TYPE';
  return callback(error);
};

const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: createFileFilter(
    ['image/jpeg', 'image/png', 'image/webp'],
    ['.jpg', '.jpeg', '.png', '.webp'],
    'image'
  )
}).single('image');

const uploadDocument = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: createFileFilter(
    [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ],
    ['.pdf', '.docx', '.doc', '.txt'],
    'document'
  )
}).single('document');

const uploadPdf = (req, res, next) => uploadDocument(req, res, (error) => {
  if (error) return next(error);
  return next();
});

module.exports = { uploadImage, uploadPdf };
