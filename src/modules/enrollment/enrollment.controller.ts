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

export const enrollmentController = {
	enrollSection,
};
