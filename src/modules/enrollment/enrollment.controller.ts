import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { enrollmentService } from "./enrollment.service";

/**
 * Handle student enrollment in a course section.
 * POST /api/v1/enrollments
 */
const enrollSection = catchAsync(async (req: Request, res: Response) => {
	const result = await enrollmentService.enrollSection(
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Successfully enrolled in course section",
		data: result,
	});
});

/**
 * Handle dropping a course enrollment.
 * PATCH /api/v1/enrollments/:id/drop
 */
const dropEnrollment = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await enrollmentService.dropEnrollment(
		id,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course enrollment dropped successfully",
		data: result,
	});
});

/**
 * Handle retrieving the current authenticated student's enrollments.
 * GET /api/v1/enrollments/my
 */
const getMyEnrollments = catchAsync(async (req: Request, res: Response) => {
	const result = await enrollmentService.getMyEnrollments(
		req.query,
		req.user.id,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My enrollments retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving students enrolled in a section.
 * Supports /api/v1/sections/:id/students or /api/v1/enrollments/section/:sectionId
 * GET /api/v1/sections/:id/students
 */
const getSectionStudents = catchAsync(async (req: Request, res: Response) => {
	const sectionId = (req.params.id || req.params.sectionId) as string;
	const result = await enrollmentService.getSectionStudents(
		sectionId,
		req.query,
		req.user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section students retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

export const enrollmentController = {
	enrollSection,
	dropEnrollment,
	getMyEnrollments,
	getSectionStudents,
};
