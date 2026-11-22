import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { resultController } from "./result.controller";
import { resultValidation } from "./result.validation";

const router = Router();

/**
 * GET /api/v1/results/my
 * List current student's published results with optional semester filter (STUDENT only)
 */
router.get(
	"/my",
	authenticate,
	authorize("STUDENT"),
	validate(resultValidation.getMyResultsSchema),
	resultController.getMyResults,
);

/**
 * POST /api/v1/results/sections/:sectionId/compute
 * Compute section results (INSTRUCTOR, ADMIN)
 */
router.post(
	"/sections/:sectionId/compute",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(resultValidation.sectionIdParamSchema),
	resultController.computeSectionResults,
);

/**
 * GET /api/v1/results/sections/:sectionId
 * List section results (INSTRUCTOR, ADMIN)
 */
router.get(
	"/sections/:sectionId",
	authenticate,
	authorize("INSTRUCTOR", "ADMIN"),
	validate(resultValidation.getSectionResultsSchema),
	resultController.getSectionResults,
);

/**
 * PATCH /api/v1/results/sections/:sectionId/publish
 * Publish all DRAFT results for a section (ADMIN only)
 */
router.patch(
	"/sections/:sectionId/publish",
	authenticate,
	authorize("ADMIN"),
	validate(resultValidation.sectionIdParamSchema),
	resultController.publishSectionResults,
);

/**
 * PATCH /api/v1/results/sections/:sectionId/unpublish
 * Unpublish results for a section -> reverts to DRAFT (ADMIN only)
 */
router.patch(
	"/sections/:sectionId/unpublish",
	authenticate,
	authorize("ADMIN"),
	validate(resultValidation.sectionIdParamSchema),
	resultController.unpublishSectionResults,
);

export const resultRoutes = router;
