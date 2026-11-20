import { Router } from "express";
import httpStatus from "http-status";
import { authRoutes } from "../modules/auth/auth.routes";
import { sendResponse } from "../utils/sendResponse";

const router = Router();

/**
 * Health check endpoint to monitor server uptime and vitality.
 * GET /api/v1/health
 */
router.get("/health", (_req, res) => {
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Service is healthy and operational",
		data: {
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
		},
	});
});

// Authentication routes
router.use("/auth", authRoutes);

export const apiRoutes = router;
