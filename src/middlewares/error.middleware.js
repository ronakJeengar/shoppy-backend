import { ApiError } from "../utils/apiError.js";

const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // If the error is not an instance of ApiError, normalize it
  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || (error.name === "ValidationError" ? 400 : 500);
    let message = error.message || "Internal Server Error";
    let errors = [];

    // Mongoose CastError (invalid ObjectId)
    if (error.name === "CastError") {
      statusCode = 400;
      message = `Invalid resource identifier: ${error.value}`;
    }

    // Mongoose Duplicate Key Error (code 11000)
    if (error.code === 11000) {
      statusCode = 409;
      const field = Object.keys(error.keyValue || {})[0] || "field";
      message = `Duplicate value entered for '${field}'. Please provide a unique value.`;
      errors = [{ field, message: `${field} already exists` }];
    }

    // Mongoose Validation Error
    if (error.name === "ValidationError") {
      statusCode = 400;
      errors = Object.values(error.errors || {}).map((val) => ({
        field: val.path,
        message: val.message,
      }));
      message = "Validation failed for request data";
    }

    // JWT Errors
    if (error.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid authentication token. Please sign in again.";
    }
    if (error.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Authentication token expired. Please refresh your session.";
    }

    error = new ApiError(statusCode, message, errors, error.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode || 500,
    message: error.message || "An unexpected error occurred",
    errors: error.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  return res.status(error.statusCode || 500).json(response);
};

export { errorMiddleware };
