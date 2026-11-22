import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/client";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TranscriptService } from "./transcript.service";

/**
 * Controller to retrieve authenticated student's own transcript.
 * Route: GET /api/v1/students/me/transcript (or GET /api/v1/transcripts/my)
 */
const getMyTranscript = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as { id: string; role: Role };
	const result = await TranscriptService.getMyTranscript(user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Official transcript retrieved successfully",
		data: result,
	});
});

/**
 * Controller to retrieve authenticated student's own GPA summary.
 * Route: GET /api/v1/students/me/gpa (or GET /api/v1/transcripts/me/gpa)
 */
const getMyGPASummary = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as { id: string; role: Role };
	const result = await TranscriptService.getMyGPASummary(user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "GPA summary retrieved successfully",
		data: result,
	});
});

/**
 * Controller to retrieve a student's transcript by studentId.
 * Route: GET /api/v1/students/:studentId/transcript
 */
const getStudentTranscript = catchAsync(async (req: Request, res: Response) => {
	const studentId = req.params.studentId as string;
	const user = req.user as { id: string; role: Role };
	const result = await TranscriptService.getStudentTranscript(studentId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Student transcript retrieved successfully",
		data: result,
	});
});

/**
 * Controller to retrieve a student's GPA summary by studentId.
 * Route: GET /api/v1/students/:studentId/gpa
 */
const getStudentGPASummary = catchAsync(async (req: Request, res: Response) => {
	const studentId = req.params.studentId as string;
	const user = req.user as { id: string; role: Role };
	const result = await TranscriptService.getStudentGPASummary(studentId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Student GPA summary retrieved successfully",
		data: result,
	});
});

export const TranscriptController = {
	getMyTranscript,
	getMyGPASummary,
	getStudentTranscript,
	getStudentGPASummary,
};
