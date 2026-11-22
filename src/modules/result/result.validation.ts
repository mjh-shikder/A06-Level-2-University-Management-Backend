import { z } from "zod";

/**
 * Validation schema for section ID parameter.
 */
const sectionIdParamSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
});

/**
 * Validation schema for querying section results.
 * GET /api/v1/sections/:sectionId/results
 */
const getSectionResultsSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum(["totalWeightedPercent", "gradePoint", "createdAt", "updatedAt"])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
	}),
});

/**
 * Validation schema for student viewing their own published results.
 * GET /api/v1/results/my
 */
const getMyResultsSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum(["totalWeightedPercent", "gradePoint", "createdAt", "publishedAt"])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		semesterId: z.string().uuid("Invalid semester ID format").optional(),
	}),
});

export const resultValidation = {
	sectionIdParamSchema,
	getSectionResultsSchema,
	getMyResultsSchema,
};
