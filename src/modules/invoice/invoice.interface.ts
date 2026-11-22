import type { InvoiceStatus } from "../../../generated/prisma/client";

export interface TCreateInvoicePayload {
	studentId: string;
	semesterId: string;
	amount: number;
	dueDate: string | Date;
	description?: string;
}

export interface TInvoiceFilterOptions {
	studentId?: string;
	semesterId?: string;
	status?: InvoiceStatus;
	page?: number;
	limit?: number;
	sortBy?: string;
	order?: "asc" | "desc";
	sortOrder?: "asc" | "desc";
}

export interface TMyInvoicesFilterOptions {
	status?: InvoiceStatus;
	semesterId?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	order?: "asc" | "desc";
	sortOrder?: "asc" | "desc";
}
