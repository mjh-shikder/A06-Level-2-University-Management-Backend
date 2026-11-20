import { z } from "zod";

/**
 * Validation schema for creating a new course.
 */
const createCourseSchema = z.object({
	body: z.object({
		title: z
			.string()
			.trim()
			.min(2, "Course title must be at least 2 characters")
			.max(150, "Course title cannot exceed 150 characters"),
		code: z
			.string()
			.trim()
			.min(2, "Course code must be at least 2 characters")
			.max(20, "Course code cannot exceed 20 characters")
			.toUpperCase(),
		credits: z
			.number()
			.int("Credits must be an integer")
			.min(1, "Credits must be at least 1")
			.max(10, "Credits cannot exceed 10"),
		programId: z.string().uuid("Invalid program ID format"),
		description: z
			.string()
			.trim()
			.max(1000, "Description cannot exceed 1000 characters")
			.optional(),
	}),
});

/**
 * Validation schema for updating a course.
 */
const updateCourseSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid course ID format"),
	}),
	body: z
		.object({
			title: z
				.string()
				.trim()
				.min(2, "Course title must be at least 2 characters")
				.max(150, "Course title cannot exceed 150 characters")
				.optional(),
			code: z
				.string()
				.trim()
				.min(2, "Course code must be at least 2 characters")
				.max(20, "Course code cannot exceed 20 characters")
				.toUpperCase()
				.optional(),
			credits: z
				.number()
				.int("Credits must be an integer")
				.min(1, "Credits must be at least 1")
				.max(10, "Credits cannot exceed 10")
				.optional(),
			programId: z.string().uuid("Invalid program ID format").optional(),
			description: z
				.string()
				.trim()
				.max(1000, "Description cannot exceed 1000 characters")
				.optional(),
		})
		.refine(
			(data) =>
				data.title !== undefined ||
				data.code !== undefined ||
				data.credits !== undefined ||
				data.programId !== undefined ||
				data.description !== undefined,
			{
				message: "At least one field must be provided for update",
			},
		),
});

/**
 * Validation schema for course ID parameter.
 */
const getCourseSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid course ID format"),
	}),
});

/**
 * Validation schema for querying courses with pagination, search, and filtering.
 */
const queryCourseSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum(["title", "code", "credits", "createdAt", "updatedAt"])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		q: z.string().trim().optional(),
		programId: z.string().uuid("Invalid program ID format").optional(),
	}),
});

/**
 * Validation schema for adding a prerequisite to a course.
 */
const addPrerequisiteSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid course ID format"),
	}),
	body: z.object({
		prerequisiteId: z.string().uuid("Invalid prerequisite ID format"),
	}),
});

/**
 * Validation schema for removing a prerequisite from a course.
 */
const removePrerequisiteSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid course ID format"),
		prerequisiteId: z.string().uuid("Invalid prerequisite ID format"),
	}),
});

export const courseValidation = {
	createCourseSchema,
	updateCourseSchema,
	getCourseSchema,
	queryCourseSchema,
	addPrerequisiteSchema,
	removePrerequisiteSchema,
};
