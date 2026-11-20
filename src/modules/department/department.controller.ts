import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { departmentService } from "./department.service";

/**
 * Handle department creation request (ADMIN only).
 */
const createDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await departmentService.createDepartment(
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Department created successfully",
		data: result,
	});
});

/**
 * Handle listing departments with pagination, search, and sorting.
 */
const getDepartments = catchAsync(async (req: Request, res: Response) => {
	const result = await departmentService.getDepartments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Departments retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving a single department by its ID.
 */
const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await departmentService.getDepartmentById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department retrieved successfully",
		data: result,
	});
});

/**
 * Handle department update request (ADMIN only).
 */
const updateDepartment = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await departmentService.updateDepartment(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department updated successfully",
		data: result,
	});
});

/**
 * Handle department soft-deletion request (ADMIN only).
 */
const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await departmentService.deleteDepartment(
		id,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department deleted successfully",
		data: result,
	});
});

export const departmentController = {
	createDepartment,
	getDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
};
