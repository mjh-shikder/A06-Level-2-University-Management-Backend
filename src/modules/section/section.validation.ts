import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validation schema for individual class schedule slots.
 */
const scheduleSlotSchema = z
	.object({
		day: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
		startTime: z
			.string()
			.regex(timeRegex, "startTime must be in HH:mm format (e.g. 09:00)"),
		endTime: z
			.string()
			.regex(timeRegex, "endTime must be in HH:mm format (e.g. 10:30)"),
	})
	.refine((data) => data.startTime < data.endTime, {
		message: "startTime must be before endTime",
		path: ["endTime"],
	});

/**
 * Validation schema for creating a new section.
 */
const createSectionSchema = z.object({
	body: z.object({
		sectionNumber: z
			.string()
			.trim()
			.min(1, "Section number cannot be empty")
			.max(20, "Section number cannot exceed 20 characters"),
		courseId: z.string().uuid("Invalid course ID format"),
		semesterId: z.string().uuid("Invalid semester ID format"),
		instructorId: z
			.string()
			.uuid("Invalid instructor ID format")
			.nullable()
			.optional(),
		capacity: z
			.number()
			.int("Capacity must be an integer")
			.min(1, "Capacity must be at least 1")
			.max(500, "Capacity cannot exceed 500"),
		schedule: z
			.array(scheduleSlotSchema)
			.min(1, "At least one schedule slot is required"),
		room: z
			.string()
			.trim()
			.max(50, "Room name cannot exceed 50 characters")
			.optional(),
	}),
});

/**
 * Validation schema for updating an existing section.
 */
const updateSectionSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid section ID format"),
	}),
	body: z
		.object({
			sectionNumber: z
				.string()
				.trim()
				.min(1, "Section number cannot be empty")
				.max(20, "Section number cannot exceed 20 characters")
				.optional(),
			instructorId: z
				.string()
				.uuid("Invalid instructor ID format")
				.nullable()
				.optional(),
			capacity: z
				.number()
				.int("Capacity must be an integer")
				.min(1, "Capacity must be at least 1")
				.max(500, "Capacity cannot exceed 500")
				.optional(),
			schedule: z
				.array(scheduleSlotSchema)
				.min(1, "At least one schedule slot is required")
				.optional(),
			room: z
				.string()
				.trim()
				.max(50, "Room name cannot exceed 50 characters")
				.optional(),
		})
		.refine(
			(data) =>
				data.sectionNumber !== undefined ||
				data.instructorId !== undefined ||
				data.capacity !== undefined ||
				data.schedule !== undefined ||
				data.room !== undefined,
			{
				message: "At least one field must be provided for update",
			},
		),
});

/**
 * Validation schema for assigning or unassigning an instructor.
 */
const assignInstructorSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid section ID format"),
	}),
	body: z.object({
		instructorId: z.string().uuid("Invalid instructor ID format").nullable(),
	}),
});

/**
 * Validation schema for section ID parameter.
 */
const getSectionSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid section ID format"),
	}),
});

/**
 * Validation schema for querying sections.
 */
const querySectionSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z
			.enum([
				"sectionNumber",
				"capacity",
				"enrolledCount",
				"createdAt",
				"updatedAt",
			])
			.optional(),
		order: z.enum(["asc", "desc"]).optional(),
		semesterId: z.string().uuid("Invalid semester ID format").optional(),
		courseId: z.string().uuid("Invalid course ID format").optional(),
		instructorId: z.string().uuid("Invalid instructor ID format").optional(),
		q: z.string().trim().optional(),
	}),
});

export const sectionValidation = {
	createSectionSchema,
	updateSectionSchema,
	assignInstructorSchema,
	getSectionSchema,
	querySectionSchema,
};
