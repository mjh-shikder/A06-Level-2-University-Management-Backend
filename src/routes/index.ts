import { Router } from "express";
import httpStatus from "http-status";
import { authRoutes } from "../modules/auth/auth.routes";
import { courseRoutes } from "../modules/course/course.routes";
import { departmentRoutes } from "../modules/department/department.routes";
import { programRoutes } from "../modules/program/program.routes";
import { userRoutes } from "../modules/user/user.routes";
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

// User profile & management routes
router.use("/users", userRoutes);

// Department routes
router.use("/departments", departmentRoutes);

// Program routes
router.use("/programs", programRoutes);

// Course routes
router.use("/courses", courseRoutes);

export const apiRoutes = router;
