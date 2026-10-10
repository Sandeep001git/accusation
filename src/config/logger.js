import {
  createLogger,
  format as _format,
  transports as _transports,
} from "winston";

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: _format.combine(
    _format.timestamp(),
    _format.errors({ stack: true }),
    _format.json(),
  ),
  defaultMeta: { service: "accusation-api" },
  transports: [
    new _transports.File({ filename: "logs/error.log", level: "error" }),
    new _transports.File({ filename: "logs/combined.log" }),
  ],
});

logger.add(
  new _transports.Console({
    format:
      process.env.NODE_ENV === "production"
        ? _format.json()
        : _format.combine(_format.colorize(), _format.simple()),
  }),
);

export { logger };
