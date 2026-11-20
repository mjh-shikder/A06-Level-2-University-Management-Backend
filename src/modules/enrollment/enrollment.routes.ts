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

export const enrollmentRoutes = router;
