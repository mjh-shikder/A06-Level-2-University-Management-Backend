import { z } from "zod";

/**
 * Validation schema for creating a new academic program.
 */
const createProgramSchema = z.object({
	body: z.object({
		name: z
			.string()
			.trim()
			.min(2, "Program name must be at least 2 characters")
			.max(100, "Program name cannot exceed 100 characters"),
		code: z
			.string()
			.trim()
			.min(2, "Program code must be at least 2 characters")
			.max(20, "Program code cannot exceed 20 characters")
			.toUpperCase(),
		departmentId: z.string().uuid("Invalid department ID format"),
		requiredCredits: z
			.number()
			.int("Required credits must be an integer")
			.min(1, "Required credits must be at least 1")
			.max(300, "Required credits cannot exceed 300"),
	}),
});

/**
 * Validation schema for updating an academic program.
 */
const updateProgramSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid program ID format"),
	}),
	body: z
		.object({
			name: z
				.string()
				.trim()
				.min(2, "Program name must be at least 2 characters")
				.max(100, "Program name cannot exceed 100 characters")
				.optional(),
			code: z
				.string()
				.trim()
				.min(2, "Program code must be at least 2 characters")
				.max(20, "Program code cannot exceed 20 characters")
				.toUpperCase()
				.optional(),
			departmentId: z.string().uuid("Invalid department ID format").optional(),
			requiredCredits: z
				.number()
				.int("Required credits must be an integer")
				.min(1, "Required credits must be at least 1")
				.max(300, "Required credits cannot exceed 300")
				.optional(),
		})
		.refine(
			(data) =>
				data.name !== undefined ||
				data.code !== undefined ||
				data.departmentId !== undefined ||
				data.requiredCredits !== undefined,
			{
				message: "At least one field must be provided for update",
			},
		),
});

/**
 * Validation schema for program ID parameter.
 */
const getProgramSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid program ID format"),
	}),
});

/**
 * Validation schema for querying programs with pagination, filtering, search, and sorting.
 */
const queryProgramSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum(["name", "code", "requiredCredits", "createdAt", "updatedAt"])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		q: z.string().trim().optional(),
		departmentId: z.string().uuid("Invalid department ID format").optional(),
	}),
});

export const programValidation = {
	createProgramSchema,
	updateProgramSchema,
	getProgramSchema,
	queryProgramSchema,
};
