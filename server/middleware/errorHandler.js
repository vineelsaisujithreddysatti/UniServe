function errorHandler(err, req, res, next) {
  // payload too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds maximum permitted size.'
    });
  }

  // duplicate key error from mongo
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'record';
    return res.status(409).json({
      error: 'CONFLICT',
      message: `A conflict occurred with an existing ${field}.`
    });
  }

  // mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: messages.join(', ')
    });
  }

  // invalid mongodb objectid
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: 'Invalid identifier supplied.'
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected internal error occurred.'
    : (err.message || 'Internal server error');

  res.status(statusCode).json({
    error: err.code || 'INTERNAL_ERROR',
    message: message
  });
}

module.exports = {
  errorHandler
};
