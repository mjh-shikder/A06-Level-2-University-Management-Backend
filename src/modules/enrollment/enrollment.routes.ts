import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { attendanceController } from "../attendance/attendance.controller";
import { attendanceValidation } from "../attendance/attendance.validation";
import { enrollmentController } from "./enrollment.controller";
import { enrollmentValidation } from "./enrollment.validation";

const router = Router();

/**
 * POST /api/v1/enrollments
 * Enroll in a course section (STUDENT only)
 */
router.post(
	"/",
	authenticate,
	authorize("STUDENT"),
	validate(enrollmentValidation.enrollSectionSchema),
	enrollmentController.enrollSection,
);

/**
 * GET /api/v1/enrollments/my
 * List current student's enrollments with optional semesterId and status filters (STUDENT only)
 */
router.get(
	"/my",
	authenticate,
	authorize("STUDENT"),
	validate(enrollmentValidation.getMyEnrollmentsSchema),
	enrollmentController.getMyEnrollments,
);

/**
 * PATCH /api/v1/enrollments/:id/drop
 * Drop an enrollment within drop deadline (STUDENT only)
 */
router.patch(
	"/:id/drop",
	authenticate,
	authorize("STUDENT"),
	validate(enrollmentValidation.dropEnrollmentSchema),
	enrollmentController.dropEnrollment,
);

/**
 * GET /api/v1/enrollments/section/:sectionId
 * List enrolled students in a section (ADMIN, INSTRUCTOR)
 */
router.get(
	"/section/:sectionId",
	authenticate,
	authorize("ADMIN", "INSTRUCTOR"),
	validate(enrollmentValidation.getSectionStudentsBySectionIdSchema),
	enrollmentController.getSectionStudents,
);

/**
 * GET /api/v1/enrollments/:id/attendance/summary
 * Summary metrics for an enrollment (STUDENT (own), INSTRUCTOR, ADMIN)
 */
router.get(
	"/:id/attendance/summary",
	authenticate,
	authorize("STUDENT", "INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.getEnrollmentAttendanceSummarySchema),
	attendanceController.getEnrollmentAttendanceSummary,
);

/**
 * GET /api/v1/enrollments/:id/attendance
 * Attendance history for an enrollment (STUDENT (own), INSTRUCTOR, ADMIN)
 */
router.get(
	"/:id/attendance",
	authenticate,
	authorize("STUDENT", "INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.getEnrollmentAttendanceSchema),
	attendanceController.getEnrollmentAttendance,
);

export const enrollmentRoutes = router;
