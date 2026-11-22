import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/client";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type {
	TAuditLogFilterOptions,
	TUpdateUserRolePayload,
	TUpdateUserStatusPayload,
	TUserFilterOptions,
} from "./admin.interface";
import { AdminService } from "./admin.service";

/**
 * Controller to list all users with filtering and pagination.
 * Route: GET /api/v1/admin/users (ADMIN only)
 */
const listUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listUsers(
		req.query as unknown as TUserFilterOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Controller to update a user's role.
 * Route: PATCH /api/v1/admin/users/:id/role (ADMIN only)
 */
const updateUserRole = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as { id: string; role: Role };
	const result = await AdminService.updateUserRole(
		id,
		req.body as TUpdateUserRolePayload,
		user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User role updated successfully",
		data: result,
	});
});

/**
 * Controller to update a user's status.
 * Route: PATCH /api/v1/admin/users/:id/status (ADMIN only)
 */
const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as { id: string; role: Role };
	const result = await AdminService.updateUserStatus(
		id,
		req.body as TUpdateUserStatusPayload,
		user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully",
		data: result,
	});
});

/**
 * Controller to retrieve operational dashboard statistics.
 * Route: GET /api/v1/admin/dashboard (ADMIN only)
 */
const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard statistics retrieved successfully",
		data: result,
	});
});

/**
 * Controller to list audit logs with filtering and pagination.
 * Route: GET /api/v1/admin/audit-logs (ADMIN only)
 */
const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listAuditLogs(
		req.query as unknown as TAuditLogFilterOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Controller to generate an analytical report for a semester.
 * Route: GET /api/v1/admin/semesters/:id/report (ADMIN only)
 */
const getSemesterReport = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await AdminService.getSemesterReport(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester report generated successfully",
		data: result,
	});
});

export const AdminController = {
	listUsers,
	updateUserRole,
	updateUserStatus,
	getDashboardStats,
	listAuditLogs,
	getSemesterReport,
};
