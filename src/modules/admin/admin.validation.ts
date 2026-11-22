import { z } from "zod";

const listUsersSchema = z.object({
	query: z
		.object({
			role: z.enum(["ADMIN", "INSTRUCTOR", "STUDENT"] as const).optional(),
			status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"] as const).optional(),
			q: z.string().optional(),
			page: z.coerce.number().int().positive().optional(),
			limit: z.coerce.number().int().positive().max(100).optional(),
			sortBy: z.string().optional(),
			order: z.enum(["asc", "desc"]).optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});

const updateUserRoleSchema = z.object({
	params: z.object({
		id: z.string().uuid("id must be a valid UUID"),
	}),
	body: z.object({
		role: z.enum(["ADMIN", "INSTRUCTOR", "STUDENT"] as const, {
			error: "role is required and must be ADMIN, INSTRUCTOR, or STUDENT",
		}),
	}),
});

const updateUserStatusSchema = z.object({
	params: z.object({
		id: z.string().uuid("id must be a valid UUID"),
	}),
	body: z.object({
		status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"] as const, {
			error: "status is required and must be ACTIVE, INACTIVE, or SUSPENDED",
		}),
	}),
});

const listAuditLogsSchema = z.object({
	query: z
		.object({
			actorId: z.string().uuid().optional(),
			entity: z.string().optional(),
			action: z.string().optional(),
			startDate: z
				.string()
				.refine((val) => !Number.isNaN(Date.parse(val)), {
					message: "startDate must be a valid ISO date string",
				})
				.optional(),
			endDate: z
				.string()
				.refine((val) => !Number.isNaN(Date.parse(val)), {
					message: "endDate must be a valid ISO date string",
				})
				.optional(),
			page: z.coerce.number().int().positive().optional(),
			limit: z.coerce.number().int().positive().max(100).optional(),
			sortBy: z.string().optional(),
			order: z.enum(["asc", "desc"]).optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});

const semesterReportParamSchema = z.object({
	params: z.object({
		id: z.string().uuid("id must be a valid UUID"),
	}),
});

export const adminValidation = {
	listUsersSchema,
	updateUserRoleSchema,
	updateUserStatusSchema,
	listAuditLogsSchema,
	semesterReportParamSchema,
};
