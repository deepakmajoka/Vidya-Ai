class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors
    });
  }

  static codedError(res, error, message, statusCode) {
    return res.status(statusCode).json({
      success: false,
      error,
      message
    });
  }
}

module.exports = ApiResponse;
