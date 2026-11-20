import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./config";
import { AppError } from "./errors/AppError";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { apiRoutes } from "./routes";

const app: Application = express();

// Security HTTP headers
app.use(helmet());

// Strict CORS allowlist from configuration
app.use(
	cors({
		origin: (origin, callback) => {
			// Allow non-browser requests (Postman, curl, server-to-server)
			if (!origin) return callback(null, true);
			if (config.corsOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(
				new AppError(
					httpStatus.FORBIDDEN,
					`Origin ${origin} is not allowed by CORS policy`,
				),
			);
		},
		credentials: true,
	}),
);

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Global Rate Limiter: max 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message:
			"Too many requests from this IP, please try again after 15 minutes",
		errors: [{ message: "Rate limit exceeded" }],
	},
});
app.use(globalLimiter);

// Stricter Rate Limiter for authentication routes: max 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message:
			"Too many authentication attempts from this IP, please try again after 15 minutes",
		errors: [{ message: "Auth rate limit exceeded" }],
	},
});
app.use("/api/v1/auth", authLimiter);

// Root informational endpoint
app.get("/", (_req, res) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "University Management Backend API is operational",
	});
});

// Versioned API routes under /api/v1
app.use("/api/v1", apiRoutes);

// Catch-all 404 handler for undefined routes
app.use(notFound);

// Centralized global error handling middleware
app.use(globalErrorHandler);

export default app;
