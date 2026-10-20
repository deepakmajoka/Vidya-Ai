const multer = require('multer');

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || error.status || 500;
  let message = 'Internal Server Error';
  let errorCode = null;

  if (error instanceof multer.MulterError) {
    statusCode = 400;
    if (error.code === 'LIMIT_FILE_SIZE') {
      const limit = error.field === 'image' ? '10 MB' : '20 MB';
      message = `Uploaded file exceeds the ${limit} limit.`;
      errorCode = 'FILE_TOO_LARGE';
    } else {
      message = 'Invalid file upload.';
      errorCode = 'INVALID_UPLOAD';
    }
  } else if (error.code === 'INVALID_FILE_TYPE') {
    statusCode = 400;
    message = 'Invalid file type.';
    errorCode = 'INVALID_FILE_TYPE';
  } else if (statusCode === 413 || error.status === 413) {
    statusCode = 413;
    message = 'Request body is too large.';
    errorCode = 'PAYLOAD_TOO_LARGE';
  } else if (statusCode === 400 || error.status === 400) {
    statusCode = 400;
    message = 'Invalid request body.';
    errorCode = 'INVALID_REQUEST';
  } else if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: errorCode
  });
};

module.exports = errorHandler;
