import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { programService } from "./program.service";

/**
 * Handle academic program creation request (ADMIN only).
 */
const createProgram = catchAsync(async (req: Request, res: Response) => {
	const result = await programService.createProgram(
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Program created successfully",
		data: result,
	});
});

/**
 * Handle listing programs with pagination, search, department filtering, and sorting.
 */
const getPrograms = catchAsync(async (req: Request, res: Response) => {
	const result = await programService.getPrograms(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Programs retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving a single program by its ID.
 */
const getProgramById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await programService.getProgramById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Program retrieved successfully",
		data: result,
	});
});

/**
 * Handle program update request (ADMIN only).
 */
const updateProgram = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await programService.updateProgram(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Program updated successfully",
		data: result,
	});
});

/**
 * Handle program soft-deletion request (ADMIN only).
 */
const deleteProgram = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await programService.deleteProgram(id, req.user.id, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Program deleted successfully",
		data: result,
	});
});

export const programController = {
	createProgram,
	getPrograms,
	getProgramById,
	updateProgram,
	deleteProgram,
};
