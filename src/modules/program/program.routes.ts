import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { programController } from "./program.controller";
import { programValidation } from "./program.validation";

const router = Router();

/**
 * POST /api/v1/programs
 * Create a new academic program under a department (ADMIN only)
 */
router.post(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(programValidation.createProgramSchema),
	programController.createProgram,
);

/**
 * GET /api/v1/programs
 * Retrieve paginated list of programs with optional search, department filter, and sorting
 */
router.get(
	"/",
	authenticate,
	validate(programValidation.queryProgramSchema),
	programController.getPrograms,
);

/**
 * GET /api/v1/programs/:id
 * Retrieve a single program by its ID
 */
router.get(
	"/:id",
	authenticate,
	validate(programValidation.getProgramSchema),
	programController.getProgramById,
);

/**
 * PATCH /api/v1/programs/:id
 * Update an existing academic program (ADMIN only)
 */
router.patch(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(programValidation.updateProgramSchema),
	programController.updateProgram,
);

/**
 * DELETE /api/v1/programs/:id
 * Soft delete an academic program (ADMIN only)
 */
router.delete(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(programValidation.getProgramSchema),
	programController.deleteProgram,
);

export const programRoutes = router;
