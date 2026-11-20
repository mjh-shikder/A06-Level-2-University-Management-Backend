import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { semesterController } from "./semester.controller";
import { semesterValidation } from "./semester.validation";

const router = Router();

/**
 * POST /api/v1/semesters
 * Create a new academic semester (ADMIN only)
 */
router.post(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(semesterValidation.createSemesterSchema),
	semesterController.createSemester,
);

/**
 * GET /api/v1/semesters
 * Retrieve paginated list of semesters with optional status, year filter, and sorting
 */
router.get(
	"/",
	authenticate,
	validate(semesterValidation.querySemesterSchema),
	semesterController.getSemesters,
);

/**
 * GET /api/v1/semesters/:id
 * Retrieve a single semester by its ID
 */
router.get(
	"/:id",
	authenticate,
	validate(semesterValidation.getSemesterSchema),
	semesterController.getSemesterById,
);

/**
 * PATCH /api/v1/semesters/:id
 * Update an existing semester's details (ADMIN only)
 */
router.patch(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(semesterValidation.updateSemesterSchema),
	semesterController.updateSemester,
);

/**
 * DELETE /api/v1/semesters/:id
 * Soft delete a semester (ADMIN only)
 */
router.delete(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(semesterValidation.getSemesterSchema),
	semesterController.deleteSemester,
);

/**
 * PATCH /api/v1/semesters/:id/status
 * Change semester status (UPCOMING -> ACTIVE -> COMPLETED) (ADMIN only)
 */
router.patch(
	"/:id/status",
	authenticate,
	authorize("ADMIN"),
	validate(semesterValidation.updateSemesterStatusSchema),
	semesterController.updateSemesterStatus,
);

export const semesterRoutes = router;
