import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { sectionService } from "./section.service";

/**
 * Handle section creation request (ADMIN only).
 */
const createSection = catchAsync(async (req: Request, res: Response) => {
	const result = await sectionService.createSection(
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Section created successfully",
		data: result,
	});
});

/**
 * Handle listing sections with filters and pagination.
 */
const getSections = catchAsync(async (req: Request, res: Response) => {
	const result = await sectionService.getSections(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Sections retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving a single section by its ID.
 */
const getSectionById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await sectionService.getSectionById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section retrieved successfully",
		data: result,
	});
});

/**
 * Handle updating section details (ADMIN only).
 */
const updateSection = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await sectionService.updateSection(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section updated successfully",
		data: result,
	});
});

/**
 * Handle assigning or unassigning instructor for a section (ADMIN only).
 */
const assignInstructor = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await sectionService.assignInstructor(
		id,
		req.body,
		req.user.id,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Instructor assigned to section successfully",
		data: result,
	});
});

/**
 * Handle section soft deletion (ADMIN only).
 */
const deleteSection = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await sectionService.deleteSection(id, req.user.id, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section deleted successfully",
		data: result,
	});
});

export const sectionController = {
	createSection,
	getSections,
	getSectionById,
	updateSection,
	assignInstructor,
	deleteSection,
};
