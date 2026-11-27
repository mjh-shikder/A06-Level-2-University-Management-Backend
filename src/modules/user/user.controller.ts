import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userService } from "./user.service";

/**
 * Get current authenticated user's profile.
 */
const getMe = catchAsync(async (req: Request, res: Response) => {
	const result = await userService.getMe(req.user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile retrieved successfully",
		data: result,
	});
});

/**
 * Update current authenticated user's profile details.
 */
const updateMe = catchAsync(async (req: Request, res: Response) => {
	const result = await userService.updateMe(req.user.id, req.body, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile updated successfully",
		data: result,
	});
});

/**
 * Change current authenticated user's password.
 */
const changePassword = catchAsync(async (req: Request, res: Response) => {
	await userService.changePassword(req.user.id, req.body, req.ip);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully. Please log in again.",
		data: null,
	});
});

const updateProfileImage = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		if (!req.file) {
			throw new AppError(httpStatus.BAD_REQUEST, "No file uploaded");
		}

		const userId = req.user.id;

		const result = await userService.updateProfileImage(
			req.file?.buffer,
			userId,
		);

		sendResponse(res, {
			statusCode: 200,
			success: true,
			message: "Profile image uploaded successfully",
			data: result,
		});
	},
);

export const userController = {
	getMe,
	updateMe,
	changePassword,
	updateProfileImage,
};
