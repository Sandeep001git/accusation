import aj from "#config/arcjet.js";
import { slidingWindow } from "@arcjet/node";
import { logger } from "#config/logger.js";

const securityMiddleware = async (req, res, next) => {
  try {
    const role = req.user?.role || "guest";
    let limit;
    switch (role) {
      case "admin":
        limit = 20;
        break;
      case "user":
        limit = 10;
        break;
      default:
        limit = 5;
        break;
    }

    const client = aj.withRule(
      slidingWindow({
        mode: "LIVE",
        interval: 1,
        max: limit,
        name: `${role.toUpperCase()}_ACCESS_LIMIT`,
      })
    );
    const decision = await client.protect(req);

    if (decision.isDenied() && decision.reason.isBot()) {
      logger.warn("Bot detected: ", {
        ip: req.ip,
        userAgent: req.get("User-agent"),
        path: req.path,
      });
      return res.status(403).json({ message: "Access denied: Bot detected" });
    }
    if (decision.isDenied() && decision.reason.isShield()) {
      logger.warn("Shield detected: ", {
        ip: req.ip,
        userAgent: req.get("User-agent"),
        path: req.path,
        method: req.method,
      });
      return res
        .status(403)
        .json({ message: "Access denied: Shield detected" });
    }
    if (decision.isDenied() && decision.reason.isRateLimit()) {
      logger.warn("Rate limit exceeded: ", {
        ip: req.ip,
        userAgent: req.get("User-agent"),
        path: req.path,
        method: req.method,
      });
      return res
        .status(403)
        .json({ message: "Access denied: Rate limit exceeded" });
    }

    next();
  } catch (error) {
    logger.error("Security middleware failed", { error });
    return next(error);
  }
};
export default securityMiddleware;
