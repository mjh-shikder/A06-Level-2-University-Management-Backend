import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { courseService } from "./course.service";

/**
 * Handle course creation request (ADMIN only).
 */
const createCourse = catchAsync(async (req: Request, res: Response) => {
	const result = await courseService.createCourse(
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Course created successfully",
		data: result,
	});
});

/**
 * Handle listing courses with pagination, search, program filtering, and sorting.
 */
const getCourses = catchAsync(async (req: Request, res: Response) => {
	const result = await courseService.getCourses(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courses retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving a single course by its ID.
 */
const getCourseById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await courseService.getCourseById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course retrieved successfully",
		data: result,
	});
});

/**
 * Handle course update request (ADMIN only).
 */
const updateCourse = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await courseService.updateCourse(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course updated successfully",
		data: result,
	});
});

/**
 * Handle course soft-deletion request (ADMIN only).
 */
const deleteCourse = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await courseService.deleteCourse(id, req.user.id, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course deleted successfully",
		data: result,
	});
});

/**
 * Handle adding a prerequisite to a course (ADMIN only).
 */
const addPrerequisite = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await courseService.addPrerequisite(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Prerequisite added successfully",
		data: result,
	});
});

/**
 * Handle removing a prerequisite from a course (ADMIN only).
 */
const removePrerequisite = catchAsync(async (req: Request, res: Response) => {
	const { id, prerequisiteId } = req.params as {
		id: string;
		prerequisiteId: string;
	};
	await courseService.removePrerequisite(
		id,
		prerequisiteId,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Prerequisite removed successfully",
		data: null,
	});
});

export const courseController = {
	createCourse,
	getCourses,
	getCourseById,
	updateCourse,
	deleteCourse,
	addPrerequisite,
	removePrerequisite,
};
