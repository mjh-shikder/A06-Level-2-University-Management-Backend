import { z } from "zod";

/**
 * Validation schema for creating a new department.
 */
const createDepartmentSchema = z.object({
	body: z.object({
		name: z
			.string()
			.trim()
			.min(2, "Department name must be at least 2 characters")
			.max(100, "Department name cannot exceed 100 characters"),
		code: z
			.string()
			.trim()
			.min(2, "Department code must be at least 2 characters")
			.max(20, "Department code cannot exceed 20 characters")
			.toUpperCase(),
		description: z
			.string()
			.trim()
			.max(500, "Description cannot exceed 500 characters")
			.optional(),
	}),
});

/**
 * Validation schema for updating a department.
 */
const updateDepartmentSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid department ID format"),
	}),
	body: z
		.object({
			name: z
				.string()
				.trim()
				.min(2, "Department name must be at least 2 characters")
				.max(100, "Department name cannot exceed 100 characters")
				.optional(),
			code: z
				.string()
				.trim()
				.min(2, "Department code must be at least 2 characters")
				.max(20, "Department code cannot exceed 20 characters")
				.toUpperCase()
				.optional(),
			description: z
				.string()
				.trim()
				.max(500, "Description cannot exceed 500 characters")
				.optional(),
		})
		.refine(
			(data) =>
				data.name !== undefined ||
				data.code !== undefined ||
				data.description !== undefined,
			{
				message: "At least one field must be provided for update",
			},
		),
});

/**
 * Validation schema for fetching a department by ID.
 */
const getDepartmentSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid department ID format"),
	}),
});

/**
 * Validation schema for querying departments with pagination, search, and sorting.
 */
const queryDepartmentSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["name", "code", "createdAt", "updatedAt"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		q: z.string().trim().optional(),
	}),
});

export const departmentValidation = {
	createDepartmentSchema,
	updateDepartmentSchema,
	getDepartmentSchema,
	queryDepartmentSchema,
};
