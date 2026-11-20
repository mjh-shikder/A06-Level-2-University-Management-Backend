import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { courseController } from "./course.controller";
import { courseValidation } from "./course.validation";

const router = Router();

/**
 * POST /api/v1/courses
 * Create a new course under an academic program (ADMIN only)
 */
router.post(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(courseValidation.createCourseSchema),
	courseController.createCourse,
);

/**
 * GET /api/v1/courses
 * Retrieve paginated list of courses with optional search, program filter, and sorting
 */
router.get(
	"/",
	authenticate,
	validate(courseValidation.queryCourseSchema),
	courseController.getCourses,
);

/**
 * GET /api/v1/courses/:id
 * Retrieve a single course by its ID
 */
router.get(
	"/:id",
	authenticate,
	validate(courseValidation.getCourseSchema),
	courseController.getCourseById,
);

/**
 * PATCH /api/v1/courses/:id
 * Update an existing course (ADMIN only)
 */
router.patch(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(courseValidation.updateCourseSchema),
	courseController.updateCourse,
);

/**
 * DELETE /api/v1/courses/:id
 * Soft delete a course (ADMIN only)
 */
router.delete(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(courseValidation.getCourseSchema),
	courseController.deleteCourse,
);

/**
 * POST /api/v1/courses/:id/prerequisites
 * Add a prerequisite course to a course (ADMIN only)
 */
router.post(
	"/:id/prerequisites",
	authenticate,
	authorize("ADMIN"),
	validate(courseValidation.addPrerequisiteSchema),
	courseController.addPrerequisite,
);

/**
 * DELETE /api/v1/courses/:id/prerequisites/:prerequisiteId
 * Remove a prerequisite from a course (ADMIN only)
 */
router.delete(
	"/:id/prerequisites/:prerequisiteId",
	authenticate,
	authorize("ADMIN"),
	validate(courseValidation.removePrerequisiteSchema),
	courseController.removePrerequisite,
);

export const courseRoutes = router;
