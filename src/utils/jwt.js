import jwt from "jsonwebtoken";
import { logger } from "#config/logger.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_EXPIRES_IN = "1d"; // Token expiration time

export const jwtToken = {
  sign: (payload) => {
    try {
      return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (error) {
      logger.error("Error Authenticating JWT token:", error);
      // eslint-disable-next-line preserve-caught-error
      throw new Error("Error authenticating JWT token");
    }
  },
  verify: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.error("Error verifying JWT token:", error);
      // eslint-disable-next-line preserve-caught-error
      throw new Error("Error authenticating JWT token");
    }
  },
};
