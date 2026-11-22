import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/client";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type {
	TCreateInvoicePayload,
	TInvoiceFilterOptions,
	TMyInvoicesFilterOptions,
} from "./invoice.interface";
import { InvoiceService } from "./invoice.service";

/**
 * Controller to generate an invoice for a student.
 * POST /api/v1/invoices (ADMIN)
 */
const createInvoice = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as { id: string; role: Role };
	const result = await InvoiceService.createInvoice(
		req.body as TCreateInvoicePayload,
		user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Invoice generated successfully",
		data: result,
	});
});

/**
 * Controller to list all invoices.
 * GET /api/v1/invoices (ADMIN)
 */
const getInvoices = catchAsync(async (req: Request, res: Response) => {
	const result = await InvoiceService.getInvoices(
		req.query as unknown as TInvoiceFilterOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invoices retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Controller for student to list their own invoices.
 * GET /api/v1/invoices/my (STUDENT)
 */
const getMyInvoices = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as { id: string; role: Role };
	const result = await InvoiceService.getMyInvoices(
		req.query as unknown as TMyInvoicesFilterOptions,
		user.id,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My invoices retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Controller to retrieve invoice details by ID.
 * GET /api/v1/invoices/:id (STUDENT own, ADMIN)
 */
const getInvoiceById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as { id: string; role: Role };
	const result = await InvoiceService.getInvoiceById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invoice details retrieved successfully",
		data: result,
	});
});

/**
 * Controller to initiate payment for an invoice.
 * POST /api/v1/invoices/:id/pay (STUDENT)
 */
const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as { id: string; role: Role };
	const result = await InvoiceService.initiatePayment(id, user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment session initiated successfully",
		data: result,
	});
});

export const InvoiceController = {
	createInvoice,
	getInvoices,
	getMyInvoices,
	getInvoiceById,
	initiatePayment,
};
