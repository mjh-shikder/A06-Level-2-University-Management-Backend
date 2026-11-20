import { z } from "zod";

/**
 * Validation schema for enrolling in a section.
 */
const enrollSectionSchema = z.object({
	body: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
});

/**
 * Validation schema for dropping an enrollment.
 */
const dropEnrollmentSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid enrollment ID format"),
	}),
});

/**
 * Validation schema for retrieving current student's enrollments.
 */
const getMyEnrollmentsSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["enrolledAt", "createdAt", "status"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		semesterId: z.string().uuid("Invalid semester ID format").optional(),
		status: z.enum(["ENROLLED", "DROPPED", "COMPLETED"]).optional(),
	}),
});

/**
 * Validation schema for retrieving students enrolled in a section (via /sections/:id/students).
 */
const getSectionStudentsSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid section ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["enrolledAt", "createdAt", "status"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		status: z.enum(["ENROLLED", "DROPPED", "COMPLETED"]).optional(),
	}),
});

/**
 * Validation schema for retrieving students enrolled in a section (via /enrollments/section/:sectionId).
 */
const getSectionStudentsBySectionIdSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["enrolledAt", "createdAt", "status"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		status: z.enum(["ENROLLED", "DROPPED", "COMPLETED"]).optional(),
	}),
});

export const enrollmentValidation = {
	enrollSectionSchema,
	dropEnrollmentSchema,
	getMyEnrollmentsSchema,
	getSectionStudentsSchema,
	getSectionStudentsBySectionIdSchema,
};
