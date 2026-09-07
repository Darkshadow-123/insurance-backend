function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  if (!err.isOperational) {
    // Unexpected error - log full stack for debugging
    console.error(err);
  }
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
