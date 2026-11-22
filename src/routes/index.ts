import { Router } from "express";
import httpStatus from "http-status";
import { attendanceRoutes } from "../modules/attendance/attendance.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { courseRoutes } from "../modules/course/course.routes";
import { departmentRoutes } from "../modules/department/department.routes";
import { enrollmentRoutes } from "../modules/enrollment/enrollment.routes";
import { examRoutes } from "../modules/exam/exam.routes";
import { invoiceRoutes } from "../modules/invoice/invoice.routes";
import { paymentRoutes } from "../modules/payment/payment.routes";
import { programRoutes } from "../modules/program/program.routes";
import { resultRoutes } from "../modules/result/result.routes";
import { sectionRoutes } from "../modules/section/section.routes";
import { semesterRoutes } from "../modules/semester/semester.routes";
import { transcriptRoutes } from "../modules/transcript/transcript.routes";
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

// Semester routes
router.use("/semesters", semesterRoutes);

// Section routes
router.use("/sections", sectionRoutes);

// Enrollment routes
router.use("/enrollments", enrollmentRoutes);

// Attendance routes
router.use("/attendance", attendanceRoutes);

// Exam routes
router.use("/exams", examRoutes);

// Result routes
router.use("/results", resultRoutes);

// Student & Transcript routes
router.use("/students", transcriptRoutes);
router.use("/transcripts", transcriptRoutes);

// Invoice routes
router.use("/invoices", invoiceRoutes);

// Payment routes
router.use("/payments", paymentRoutes);

export const apiRoutes = router;
