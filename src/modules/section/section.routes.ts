import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { attendanceController } from "../attendance/attendance.controller";
import { attendanceValidation } from "../attendance/attendance.validation";
import { enrollmentController } from "../enrollment/enrollment.controller";
import { enrollmentValidation } from "../enrollment/enrollment.validation";
import { sectionController } from "./section.controller";
import { sectionValidation } from "./section.validation";

const router = Router();

/**
 * POST /api/v1/sections
 * Create a new course section (ADMIN only)
 */
router.post(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(sectionValidation.createSectionSchema),
	sectionController.createSection,
);

/**
 * GET /api/v1/sections
 * Retrieve paginated list of sections with optional semester, course, instructor filters
 */
router.get(
	"/",
	authenticate,
	validate(sectionValidation.querySectionSchema),
	sectionController.getSections,
);

/**
 * GET /api/v1/sections/:id
 * Retrieve a single section by its ID
 */
router.get(
	"/:id",
	authenticate,
	validate(sectionValidation.getSectionSchema),
	sectionController.getSectionById,
);

/**
 * GET /api/v1/sections/:id/students
 * List enrolled students in a section (ADMIN, INSTRUCTOR)
 */
router.get(
	"/:id/students",
	authenticate,
	authorize("ADMIN", "INSTRUCTOR"),
	validate(enrollmentValidation.getSectionStudentsSchema),
	enrollmentController.getSectionStudents,
);

/**
 * POST /api/v1/sections/:sectionId/attendance
 * Bulk mark attendance for a section on a specific date (INSTRUCTOR, ADMIN)
 */
router.post(
	"/:sectionId/attendance",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.bulkMarkAttendanceSchema),
	attendanceController.bulkMarkAttendance,
);

/**
 * GET /api/v1/sections/:sectionId/attendance
 * List attendance records for a section with optional date filter (INSTRUCTOR, ADMIN)
 */
router.get(
	"/:sectionId/attendance",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(attendanceValidation.getSectionAttendanceSchema),
	attendanceController.getSectionAttendance,
);

/**
 * PATCH /api/v1/sections/:id
 * Update section details (capacity, schedule, room, sectionNumber) (ADMIN only)
 */
router.patch(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(sectionValidation.updateSectionSchema),
	sectionController.updateSection,
);

/**
 * PATCH /api/v1/sections/:id/instructor
 * Assign or unassign an instructor for a section (ADMIN only)
 */
router.patch(
	"/:id/instructor",
	authenticate,
	authorize("ADMIN"),
	validate(sectionValidation.assignInstructorSchema),
	sectionController.assignInstructor,
);

/**
 * DELETE /api/v1/sections/:id
 * Soft delete a section (ADMIN only)
 */
router.delete(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(sectionValidation.getSectionSchema),
	sectionController.deleteSection,
);

export const sectionRoutes = router;
