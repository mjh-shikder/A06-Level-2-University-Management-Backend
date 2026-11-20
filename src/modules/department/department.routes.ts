import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { departmentController } from "./department.controller";
import { departmentValidation } from "./department.validation";

const router = Router();

/**
 * POST /api/v1/departments
 * Create a new academic department (ADMIN only)
 */
router.post(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(departmentValidation.createDepartmentSchema),
	departmentController.createDepartment,
);

/**
 * GET /api/v1/departments
 * Retrieve paginated list of departments with optional search and sorting
 */
router.get(
	"/",
	authenticate,
	validate(departmentValidation.queryDepartmentSchema),
	departmentController.getDepartments,
);

/**
 * GET /api/v1/departments/:id
 * Retrieve a single department by its ID
 */
router.get(
	"/:id",
	authenticate,
	validate(departmentValidation.getDepartmentSchema),
	departmentController.getDepartmentById,
);

/**
 * PATCH /api/v1/departments/:id
 * Update an existing department (ADMIN only)
 */
router.patch(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(departmentValidation.updateDepartmentSchema),
	departmentController.updateDepartment,
);

/**
 * DELETE /api/v1/departments/:id
 * Soft delete a department (ADMIN only)
 */
router.delete(
	"/:id",
	authenticate,
	authorize("ADMIN"),
	validate(departmentValidation.getDepartmentSchema),
	departmentController.deleteDepartment,
);

export const departmentRoutes = router;
