import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { examService } from "./exam.service";

/**
 * Handle exam creation under a section.
 * POST /api/v1/sections/:sectionId/exams
 */
const createExam = catchAsync(async (req: Request, res: Response) => {
	const sectionId = (req.params.sectionId || req.params.id) as string;
	const result = await examService.createExam(
		sectionId,
		req.body,
		req.user,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Exam created successfully",
		data: result,
	});
});

/**
 * Handle listing exams for a section.
 * GET /api/v1/sections/:sectionId/exams
 */
const getSectionExams = catchAsync(async (req: Request, res: Response) => {
	const sectionId = (req.params.sectionId || req.params.id) as string;
	const result = await examService.getSectionExams(
		sectionId,
		req.query,
		req.user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section exams retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle retrieving single exam details by ID.
 * GET /api/v1/exams/:id
 */
const getExamById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await examService.getExamById(id, req.user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Exam retrieved successfully",
		data: result,
	});
});

/**
 * Handle updating exam details.
 * PATCH /api/v1/exams/:id
 */
const updateExam = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await examService.updateExam(id, req.body, req.user, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Exam updated successfully",
		data: result,
	});
});

/**
 * Handle deleting an exam (only if no marks entered).
 * DELETE /api/v1/exams/:id
 */
const deleteExam = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await examService.deleteExam(id, req.user, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Exam deleted successfully",
		data: result,
	});
});

/**
 * Handle bulk entering student marks for an exam.
 * POST /api/v1/exams/:id/marks
 */
const bulkEnterMarks = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await examService.bulkEnterMarks(
		id,
		req.body,
		req.user,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Exam marks entered successfully",
		data: result,
	});
});

/**
 * Handle listing entered marks for an exam.
 * GET /api/v1/exams/:id/marks
 */
const getExamMarks = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params as { id: string };
	const result = await examService.getExamMarks(id, req.query, req.user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Exam marks retrieved successfully",
		meta: result.meta,
		data: {
			exam: result.exam,
			marks: result.data,
		},
	});
});

export const examController = {
	createExam,
	getSectionExams,
	getExamById,
	updateExam,
	deleteExam,
	bulkEnterMarks,
	getExamMarks,
};
