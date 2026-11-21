import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { attendanceController } from "./attendance.controller";
import { attendanceValidation } from "./attendance.validation";

const router = Router();

/**
 * POST /api/v1/attendance/sections/:sectionId
 * Bulk mark attendance for a section (INSTRUCTOR, ADMIN)
 */
router.post(
	"/sections/:sectionId",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.bulkMarkAttendanceSchema),
	attendanceController.bulkMarkAttendance,
);

/**
 * GET /api/v1/attendance/sections/:sectionId
 * List section attendance with date filter (INSTRUCTOR, ADMIN)
 */
router.get(
	"/sections/:sectionId",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.getSectionAttendanceSchema),
	attendanceController.getSectionAttendance,
);

/**
 * GET /api/v1/attendance/enrollments/:id/summary
 * Summary metrics for an enrollment (STUDENT (own), INSTRUCTOR, ADMIN)
 */
router.get(
	"/enrollments/:id/summary",
	authenticate,
	authorize("STUDENT", "INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.getEnrollmentAttendanceSummarySchema),
	attendanceController.getEnrollmentAttendanceSummary,
);

/**
 * GET /api/v1/attendance/enrollments/:id
 * Attendance history for an enrollment (STUDENT (own), INSTRUCTOR, ADMIN)
 */
router.get(
	"/enrollments/:id",
	authenticate,
	authorize("STUDENT", "INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.getEnrollmentAttendanceSchema),
	attendanceController.getEnrollmentAttendance,
);

export const attendanceRoutes = router;
