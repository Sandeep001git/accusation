import express from "express";
import { logger } from "#config/logger.js";
import authRoutes from "#routes/auth.routes.js";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import securityMiddleware from "#middleware/security.middleware.js";
import { sql as databaseSql } from "#config/database.js";

dotenv.config();
const app = express();
app.use(helmet()); // Use Helmet to set security-related HTTP headers
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded request bodies

app.use(cookieParser()); // Middleware to parse cookies

app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      },
    },
  }),
); // Use Morgan for HTTP request logging

// const PORT = process.env.PORT || 3000;

app.get("/health", async (req, res) => {
  try {
    await databaseSql`SELECT 1`;
    res.status(200).json({
      status: "OK",
      database: "connected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error("Readiness check failed", { error });
    res.status(503).json({ status: "ERROR", database: "unavailable" });
  }
});

app.use(securityMiddleware); // Use the scheduler middleware for all application routes

app.get("/", (req, res) => {
  logger.info("Received request to app endpoint");
  res.status(200).send("Hello from  Accusation");
});
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Accusation API is running",
  });
});

app.use("/api/auth", authRoutes);

export default app;
