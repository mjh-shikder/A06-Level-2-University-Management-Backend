import { z } from "zod";

const createInvoiceSchema = z.object({
	body: z.object({
		studentId: z
			.string({
				error: "studentId is required",
			})
			.min(1, "studentId cannot be empty"),
		semesterId: z.string().uuid("semesterId must be a valid UUID"),
		amount: z
			.number({
				error: "amount is required and must be a number",
			})
			.positive("amount must be greater than 0"),
		dueDate: z
			.string({
				error: "dueDate is required",
			})
			.refine((val) => !Number.isNaN(Date.parse(val)), {
				message: "dueDate must be a valid ISO date string",
			}),
		description: z.string().optional(),
	}),
});

const getInvoicesSchema = z.object({
	query: z
		.object({
			studentId: z.string().optional(),
			semesterId: z.string().uuid().optional(),
			status: z
				.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"] as const)
				.optional(),
			page: z.coerce.number().int().positive().optional(),
			limit: z.coerce.number().int().positive().max(100).optional(),
			sortBy: z.string().optional(),
			order: z.enum(["asc", "desc"]).optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});

const getMyInvoicesSchema = z.object({
	query: z
		.object({
			semesterId: z.string().uuid().optional(),
			status: z
				.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"] as const)
				.optional(),
			page: z.coerce.number().int().positive().optional(),
			limit: z.coerce.number().int().positive().max(100).optional(),
			sortBy: z.string().optional(),
			order: z.enum(["asc", "desc"]).optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});

const invoiceIdParamSchema = z.object({
	params: z.object({
		id: z.string().uuid("id must be a valid UUID"),
	}),
});

export const invoiceValidation = {
	createInvoiceSchema,
	getInvoicesSchema,
	getMyInvoicesSchema,
	invoiceIdParamSchema,
};
