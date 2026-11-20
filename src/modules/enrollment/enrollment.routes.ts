import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
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

export const enrollmentRoutes = router;
