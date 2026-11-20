import { z } from "zod";

const isValidDate = (val: string) => !Number.isNaN(Date.parse(val));

/**
 * Validation schema for creating a new semester.
 */
const createSemesterSchema = z.object({
	body: z
		.object({
			name: z
				.string()
				.trim()
				.min(2, "Semester name must be at least 2 characters")
				.max(100, "Semester name cannot exceed 100 characters"),
			year: z
				.number()
				.int("Year must be an integer")
				.min(2000, "Year must be 2000 or later")
				.max(2100, "Year cannot exceed 2100"),
			term: z.enum(["Spring", "Summer", "Fall"]),
			startDate: z.string().refine(isValidDate, {
				message: "Invalid startDate format",
			}),
			endDate: z.string().refine(isValidDate, {
				message: "Invalid endDate format",
			}),
			registrationStart: z
				.string()
				.refine(isValidDate, {
					message: "Invalid registrationStart format",
				})
				.optional(),
			registrationEnd: z
				.string()
				.refine(isValidDate, {
					message: "Invalid registrationEnd format",
				})
				.optional(),
			status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED"]).optional(),
		})
		.refine((data) => new Date(data.startDate) < new Date(data.endDate), {
			message: "startDate must be before endDate",
			path: ["endDate"],
		})
		.refine(
			(data) => {
				if (data.registrationStart && data.registrationEnd) {
					return (
						new Date(data.registrationStart) < new Date(data.registrationEnd)
					);
				}
				return true;
			},
			{
				message: "registrationStart must be before registrationEnd",
				path: ["registrationEnd"],
			},
		),
});

/**
 * Validation schema for updating semester details.
 */
const updateSemesterSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid semester ID format"),
	}),
	body: z
		.object({
			name: z
				.string()
				.trim()
				.min(2, "Semester name must be at least 2 characters")
				.max(100, "Semester name cannot exceed 100 characters")
				.optional(),
			year: z
				.number()
				.int("Year must be an integer")
				.min(2000, "Year must be 2000 or later")
				.max(2100, "Year cannot exceed 2100")
				.optional(),
			term: z.enum(["Spring", "Summer", "Fall"]).optional(),
			startDate: z
				.string()
				.refine(isValidDate, { message: "Invalid startDate format" })
				.optional(),
			endDate: z
				.string()
				.refine(isValidDate, { message: "Invalid endDate format" })
				.optional(),
			registrationStart: z
				.string()
				.refine(isValidDate, {
					message: "Invalid registrationStart format",
				})
				.optional(),
			registrationEnd: z
				.string()
				.refine(isValidDate, {
					message: "Invalid registrationEnd format",
				})
				.optional(),
		})
		.refine(
			(data) =>
				data.name !== undefined ||
				data.year !== undefined ||
				data.term !== undefined ||
				data.startDate !== undefined ||
				data.endDate !== undefined ||
				data.registrationStart !== undefined ||
				data.registrationEnd !== undefined,
			{
				message: "At least one field must be provided for update",
			},
		)
		.refine(
			(data) => {
				if (data.startDate && data.endDate) {
					return new Date(data.startDate) < new Date(data.endDate);
				}
				return true;
			},
			{
				message: "startDate must be before endDate",
				path: ["endDate"],
			},
		)
		.refine(
			(data) => {
				if (data.registrationStart && data.registrationEnd) {
					return (
						new Date(data.registrationStart) < new Date(data.registrationEnd)
					);
				}
				return true;
			},
			{
				message: "registrationStart must be before registrationEnd",
				path: ["registrationEnd"],
			},
		),
});

/**
 * Validation schema for changing semester status.
 */
const updateSemesterStatusSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid semester ID format"),
	}),
	body: z.object({
		status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED"]),
	}),
});

/**
 * Validation schema for semester ID parameter.
 */
const getSemesterSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid semester ID format"),
	}),
});

/**
 * Validation schema for querying semesters.
 */
const querySemesterSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum([
				"name",
				"year",
				"term",
				"startDate",
				"endDate",
				"createdAt",
				"updatedAt",
			])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		q: z.string().trim().optional(),
		status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED"]).optional(),
		year: z.coerce.number().int().min(2000).max(2100).optional(),
	}),
});

export const semesterValidation = {
	createSemesterSchema,
	updateSemesterSchema,
	updateSemesterStatusSchema,
	getSemesterSchema,
	querySemesterSchema,
};
