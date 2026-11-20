import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { semesterService } from "./semester.service";

/**
 * Handle semester creation request (ADMIN only).
 */
const createSemester = catchAsync(async (req: Request, res: Response) => {
	const result = await semesterService.createSemester(
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Semester created successfully",
		data: result,
	});
});

/**
 * Handle listing semesters with pagination, filtering, and sorting.
 */
const getSemesters = catchAsync(async (req: Request, res: Response) => {
	const result = await semesterService.getSemesters(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semesters retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving a single semester by its ID.
 */
const getSemesterById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await semesterService.getSemesterById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester retrieved successfully",
		data: result,
	});
});

/**
 * Handle semester update request (ADMIN only).
 */
const updateSemester = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await semesterService.updateSemester(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester updated successfully",
		data: result,
	});
});

/**
 * Handle semester soft-deletion request (ADMIN only).
 */
const deleteSemester = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await semesterService.deleteSemester(id, req.user.id, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester deleted successfully",
		data: result,
	});
});

/**
 * Handle semester status transition request (ADMIN only).
 */
const updateSemesterStatus = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await semesterService.updateSemesterStatus(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester status updated successfully",
		data: result,
	});
});

export const semesterController = {
	createSemester,
	getSemesters,
	getSemesterById,
	updateSemester,
	deleteSemester,
	updateSemesterStatus,
};
