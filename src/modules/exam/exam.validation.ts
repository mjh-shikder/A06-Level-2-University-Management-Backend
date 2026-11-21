import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validation schema for creating a new exam under a section.
 * POST /api/v1/sections/:sectionId/exams
 */
const createExamSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
	body: z.object({
		title: z
			.string()
			.trim()
			.min(1, "Title is required")
			.max(100, "Title cannot exceed 100 characters"),
		weightPercent: z
			.number()
			.positive("weightPercent must be greater than 0")
			.max(100, "weightPercent cannot exceed 100"),
		maxMarks: z
			.number()
			.positive("maxMarks must be greater than 0")
			.max(1000, "maxMarks cannot exceed 1000"),
		examDate: z
			.string()
			.refine((val) => dateRegex.test(val) || !Number.isNaN(Date.parse(val)), {
				message: "examDate must be in YYYY-MM-DD or valid ISO date format",
			})
			.optional(),
	}),
});

/**
 * Validation schema for updating exam details.
 * PATCH /api/v1/exams/:id
 */
const updateExamSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid exam ID format"),
	}),
	body: z
		.object({
			title: z
				.string()
				.trim()
				.min(1, "Title cannot be empty")
				.max(100, "Title cannot exceed 100 characters")
				.optional(),
			weightPercent: z
				.number()
				.positive("weightPercent must be greater than 0")
				.max(100, "weightPercent cannot exceed 100")
				.optional(),
			maxMarks: z
				.number()
				.positive("maxMarks must be greater than 0")
				.max(1000, "maxMarks cannot exceed 1000")
				.optional(),
			examDate: z
				.string()
				.refine(
					(val) => dateRegex.test(val) || !Number.isNaN(Date.parse(val)),
					{
						message: "examDate must be in YYYY-MM-DD or valid ISO date format",
					},
				)
				.nullable()
				.optional(),
		})
		.refine(
			(data) =>
				data.title !== undefined ||
				data.weightPercent !== undefined ||
				data.maxMarks !== undefined ||
				data.examDate !== undefined,
			{
				message: "At least one field must be provided for update",
			},
		),
});

/**
 * Validation schema for an individual student mark in bulk entry.
 */
const markItemSchema = z.object({
	enrollmentId: z.string().uuid("Invalid enrollment ID format"),
	obtainedMarks: z
		.number()
		.min(0, "obtainedMarks cannot be negative")
		.max(1000, "obtainedMarks cannot exceed 1000"),
});

/**
 * Validation schema for bulk entering marks for an exam.
 * POST /api/v1/exams/:id/marks
 */
const bulkEnterMarksSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid exam ID format"),
	}),
	body: z.object({
		marks: z
			.array(markItemSchema)
			.min(1, "At least one student mark entry is required"),
	}),
});

/**
 * Validation schema for listing exams of a section.
 * GET /api/v1/sections/:sectionId/exams
 */
const getSectionExamsSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum(["title", "weightPercent", "maxMarks", "examDate", "createdAt"])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
	}),
});

/**
 * Validation schema for listing marks of an exam.
 * GET /api/v1/exams/:id/marks
 */
const getExamMarksSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid exam ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["obtainedMarks", "createdAt"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
	}),
});

/**
 * Validation schema for exam ID parameter.
 */
const examIdParamSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid exam ID format"),
	}),
});

export const examValidation = {
	createExamSchema,
	updateExamSchema,
	bulkEnterMarksSchema,
	getSectionExamsSchema,
	getExamMarksSchema,
	examIdParamSchema,
};
