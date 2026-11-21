import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validation schema for a single attendance record within bulk submission.
 */
const attendanceRecordSchema = z.object({
	enrollmentId: z.string().uuid("Invalid enrollment ID format"),
	status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
	remarks: z
		.string()
		.trim()
		.max(255, "Remarks cannot exceed 255 characters")
		.optional(),
});

/**
 * Validation schema for bulk marking attendance for a course section.
 * POST /api/v1/sections/:sectionId/attendance
 */
const bulkMarkAttendanceSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
	body: z.object({
		date: z
			.string()
			.refine((val) => dateRegex.test(val) || !Number.isNaN(Date.parse(val)), {
				message: "date must be in YYYY-MM-DD or valid ISO date format",
			}),
		records: z
			.array(attendanceRecordSchema)
			.min(1, "At least one attendance record is required"),
	}),
});

/**
 * Validation schema for retrieving section attendance list.
 * GET /api/v1/sections/:sectionId/attendance
 */
const getSectionAttendanceSchema = z.object({
	params: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["date", "createdAt", "status"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		date: z
			.string()
			.refine((val) => dateRegex.test(val) || !Number.isNaN(Date.parse(val)), {
				message: "date must be in YYYY-MM-DD or valid ISO date format",
			})
			.optional(),
	}),
});

/**
 * Validation schema for retrieving an enrollment's attendance history.
 * GET /api/v1/enrollments/:id/attendance
 */
const getEnrollmentAttendanceSchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid enrollment ID format"),
	}),
	query: z.object({
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum(["date", "createdAt", "status"]).optional(),
		order: z.enum(["asc", "desc"]).optional(),
		sortOrder: z.enum(["asc", "desc"]).optional(),
		startDate: z
			.string()
			.refine((val) => dateRegex.test(val) || !Number.isNaN(Date.parse(val)), {
				message: "startDate must be in YYYY-MM-DD or valid ISO date format",
			})
			.optional(),
		endDate: z
			.string()
			.refine((val) => dateRegex.test(val) || !Number.isNaN(Date.parse(val)), {
				message: "endDate must be in YYYY-MM-DD or valid ISO date format",
			})
			.optional(),
		status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).optional(),
	}),
});

/**
 * Validation schema for retrieving an enrollment's attendance summary.
 * GET /api/v1/enrollments/:id/attendance/summary
 */
const getEnrollmentAttendanceSummarySchema = z.object({
	params: z.object({
		id: z.string().uuid("Invalid enrollment ID format"),
	}),
});

export const attendanceValidation = {
	bulkMarkAttendanceSchema,
	getSectionAttendanceSchema,
	getEnrollmentAttendanceSchema,
	getEnrollmentAttendanceSummarySchema,
};
