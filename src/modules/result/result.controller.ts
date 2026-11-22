import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { resultService } from "./result.service";

/**
 * Handle grade computation for all section enrollments.
 * POST /api/v1/sections/:sectionId/results/compute
 */
const computeSectionResults = catchAsync(
	async (req: Request, res: Response) => {
		const sectionId = (req.params.sectionId || req.params.id) as string;
		const result = await resultService.computeSectionResults(
			sectionId,
			req.user,
			req.ip,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Section results computed successfully",
			data: result,
		});
	},
);

/**
 * Handle listing results for a section.
 * GET /api/v1/sections/:sectionId/results
 */
const getSectionResults = catchAsync(async (req: Request, res: Response) => {
	const sectionId = (req.params.sectionId || req.params.id) as string;
	const result = await resultService.getSectionResults(
		sectionId,
		req.query,
		req.user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Section results retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

/**
 * Handle publishing all DRAFT results for a section (ADMIN only).
 * PATCH /api/v1/sections/:sectionId/results/publish
 */
const publishSectionResults = catchAsync(
	async (req: Request, res: Response) => {
		const sectionId = (req.params.sectionId || req.params.id) as string;
		const result = await resultService.publishSectionResults(
			sectionId,
			req.user,
			req.ip,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Section results published successfully",
			data: result,
		});
	},
);

/**
 * Handle unpublishing results for a section (ADMIN only).
 * PATCH /api/v1/sections/:sectionId/results/unpublish
 */
const unpublishSectionResults = catchAsync(
	async (req: Request, res: Response) => {
		const sectionId = (req.params.sectionId || req.params.id) as string;
		const result = await resultService.unpublishSectionResults(
			sectionId,
			req.user,
			req.ip,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Section results unpublished successfully",
			data: result,
		});
	},
);

/**
 * Handle retrieving current student's published results.
 * GET /api/v1/results/my
 */
const getMyResults = catchAsync(async (req: Request, res: Response) => {
	const result = await resultService.getMyResults(req.query, req.user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My results retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

export const resultController = {
	computeSectionResults,
	getSectionResults,
	publishSectionResults,
	unpublishSectionResults,
	getMyResults,
};
