import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { attendanceService } from "./attendance.service";

/**
 * Handle bulk marking of attendance for a course section.
 * POST /api/v1/sections/:sectionId/attendance
 */
const bulkMarkAttendance = catchAsync(async (req: Request, res: Response) => {
	const sectionId = (req.params.sectionId || req.params.id) as string;
	const result = await attendanceService.bulkMarkAttendance(
		sectionId,
		req.body,
		req.user,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Attendance marked successfully",
		data: result,
	});
});

/**
 * Handle retrieving attendance list for a course section.
 * GET /api/v1/sections/:sectionId/attendance
 */
const getSectionAttendance = catchAsync(async (req: Request, res: Response) => {
	const sectionId = (req.params.sectionId || req.params.id) as string;
	const result = await attendanceService.getSectionAttendance(
		sectionId,
		req.query,
		req.user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section attendance retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving attendance history for an individual enrollment.
 * GET /api/v1/enrollments/:id/attendance
 */
const getEnrollmentAttendance = catchAsync(
	async (req: Request, res: Response) => {
		const { id } = req.params as { id: string };
		const result = await attendanceService.getEnrollmentAttendance(
			id,
			req.query,
			req.user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Enrollment attendance history retrieved successfully",
			meta: result.meta,
			data: result.data,
		});
	},
);

/**
 * Handle retrieving attendance summary for an individual enrollment.
 * GET /api/v1/enrollments/:id/attendance/summary
 */
const getEnrollmentAttendanceSummary = catchAsync(
	async (req: Request, res: Response) => {
		const { id } = req.params as { id: string };
		const result = await attendanceService.getEnrollmentAttendanceSummary(
			id,
			req.user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Attendance summary retrieved successfully",
			data: result,
		});
	},
);

export const attendanceController = {
	bulkMarkAttendance,
	getSectionAttendance,
	getEnrollmentAttendance,
	getEnrollmentAttendanceSummary,
};
