// Convert unmatched routes and request failures into safe JSON responses.
import { logger } from "#config/logger.js";

export const notFoundHandler = (req, res, next) => {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  logger.error("Request failed", {
    error,
    method: req.method,
    path: req.path,
    status,
  });

  const messages = {
    404: "Route not found",
    409: "Email already exists",
  };
  const message =
    messages[status] ??
    (status < 500 ? "Invalid request" : "Internal server error");
  return res.status(status).json({ error: message });
};

export default errorHandler;
