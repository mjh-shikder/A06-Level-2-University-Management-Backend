import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { examController } from "./exam.controller";
import { examValidation } from "./exam.validation";

const router = Router();

/**
 * POST /api/v1/exams/sections/:sectionId
 * Create exam for a section (INSTRUCTOR, ADMIN)
 */
router.post(
	"/sections/:sectionId",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.createExamSchema),
	examController.createExam,
);

/**
 * GET /api/v1/exams/sections/:sectionId
 * List exams for a section (INSTRUCTOR, ADMIN)
 */
router.get(
	"/sections/:sectionId",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.getSectionExamsSchema),
	examController.getSectionExams,
);

/**
 * POST /api/v1/exams/:id/marks
 * Bulk enter marks for an exam (INSTRUCTOR, ADMIN)
 */
router.post(
	"/:id/marks",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.bulkEnterMarksSchema),
	examController.bulkEnterMarks,
);

/**
 * GET /api/v1/exams/:id/marks
 * List marks for an exam (INSTRUCTOR, ADMIN)
 */
router.get(
	"/:id/marks",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.getExamMarksSchema),
	examController.getExamMarks,
);

/**
 * GET /api/v1/exams/:id
 * Retrieve single exam details (INSTRUCTOR, ADMIN)
 */
router.get(
	"/:id",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.examIdParamSchema),
	examController.getExamById,
);

/**
 * PATCH /api/v1/exams/:id
 * Update exam details (INSTRUCTOR, ADMIN)
 */
router.patch(
	"/:id",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.updateExamSchema),
	examController.updateExam,
);

/**
 * DELETE /api/v1/exams/:id
 * Delete exam (only if no marks entered) (INSTRUCTOR, ADMIN)
 */
router.delete(
	"/:id",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(examValidation.examIdParamSchema),
	examController.deleteExam,
);

export const examRoutes = router;
